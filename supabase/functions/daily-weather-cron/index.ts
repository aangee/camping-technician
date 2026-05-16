// Edge Function — exécutée quotidiennement via pg_cron + pg_net
// Récupère la météo Open-Meteo, met à jour meteo_cache et recalcule les alertes

import { serve } from "https://deno.land/std@0.208.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const OPEN_METEO_URL = "https://api.open-meteo.com/v1/forecast"

serve(async (req: Request) => {
  // Vérification de l'autorisation (service_role_key ou CRON_SECRET)
  const authHeader = req.headers.get('Authorization') ?? ''
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  const cronSecret = Deno.env.get('CRON_SECRET') ?? ''

  const isAuthorized =
    authHeader === `Bearer ${serviceKey}` ||
    (cronSecret && authHeader === `Bearer ${cronSecret}`)

  if (!isAuthorized) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  try {
    // Charger la configuration
    const { data: configRows } = await supabase.from('config').select('key, value')
    const cfg: Record<string, unknown> = Object.fromEntries(
      (configRows ?? []).map((r: { key: string; value: unknown }) => [r.key, r.value])
    )

    const coords = (cfg.coordinates as { lat: number; lon: number }) ?? { lat: 45.92, lon: 5.90 }

    // Récupérer 30 jours de météo depuis Open-Meteo
    const url = new URL(OPEN_METEO_URL)
    url.searchParams.set('latitude',   String(coords.lat))
    url.searchParams.set('longitude',  String(coords.lon))
    url.searchParams.set('daily',      'temperature_2m_max,temperature_2m_min,precipitation_sum')
    url.searchParams.set('past_days',  '30')
    url.searchParams.set('forecast_days', '1')
    url.searchParams.set('timezone',   'Europe/Paris')

    const weatherResp = await fetch(url.toString())
    if (!weatherResp.ok) throw new Error(`Open-Meteo: ${weatherResp.status}`)
    const weatherData = await weatherResp.json()

    // Upsert dans meteo_cache
    const weatherRows = weatherData.daily.time.map((date: string, i: number) => ({
      date,
      temp_max:      weatherData.daily.temperature_2m_max[i]      ?? 0,
      temp_min:      weatherData.daily.temperature_2m_min[i]      ?? 0,
      precipitation: weatherData.daily.precipitation_sum[i]       ?? 0,
    }))
    await supabase.from('meteo_cache').upsert(weatherRows, { onConflict: 'date' })

    // Charger toutes les zones actives
    const { data: zones } = await supabase.from('zones').select('*').eq('active', true)
    const results: { zone: string; level: string; value: number }[] = []

    for (const zone of zones ?? []) {
      let level       = 'ok'
      let message     = ''
      let metricValue = 0

      // ── Tonte & Haies : degrés-jours depuis la dernière intervention ──
      if (zone.type === 'tonte' || zone.type === 'haies') {
        const baseTemp         = Number(cfg[`${zone.type}_base_temp`]         ?? 5)
        const thresholdWarning = Number(cfg[`${zone.type}_threshold_warning`] ?? (zone.type === 'tonte' ? 40 : 100))
        const thresholdAlert   = Number(cfg[`${zone.type}_threshold_alert`]   ?? (zone.type === 'tonte' ? 60 : 150))

        const { data: lastInt } = await supabase
          .from('interventions')
          .select('done_at')
          .eq('zone_id', zone.id)
          .order('done_at', { ascending: false })
          .limit(1)
          .maybeSingle()

        const sinceDate = lastInt?.done_at?.split('T')[0]
          ?? new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]

        const { data: meteoRows } = await supabase
          .from('meteo_cache')
          .select('temp_max, temp_min')
          .gte('date', sinceDate)
          .order('date')

        const degreeDays = (meteoRows ?? []).reduce((acc: number, row: { temp_max: number; temp_min: number }) => {
          const mean = (row.temp_max + row.temp_min) / 2
          return acc + Math.max(0, mean - baseTemp)
        }, 0)

        metricValue = Math.round(degreeDays * 10) / 10

        if (degreeDays >= thresholdAlert) {
          level   = 'alert'
          message = zone.type === 'tonte'
            ? `${zone.name} : tonte urgente (${metricValue} °J)`
            : `${zone.name} : taille urgente (${metricValue} °J)`
        } else if (degreeDays >= thresholdWarning) {
          level   = 'warning'
          message = zone.type === 'tonte'
            ? `${zone.name} : tonte à prévoir (${metricValue} °J)`
            : `${zone.name} : taille à prévoir (${metricValue} °J)`
        } else {
          message = `${zone.name} : OK (${metricValue} °J)`
        }
      }

      // ── Piscine : cumul pluie sur N jours ──
      if (zone.type === 'piscine') {
        const rainDays         = Number(cfg.piscine_rain_days         ?? 7)
        const thresholdWarning = Number(cfg.piscine_threshold_warning ?? 20)
        const thresholdAlert   = Number(cfg.piscine_threshold_alert   ?? 30)

        const since = new Date(Date.now() - rainDays * 86400000).toISOString().split('T')[0]
        const { data: rainRows } = await supabase
          .from('meteo_cache')
          .select('precipitation')
          .gte('date', since)

        const totalRain = (rainRows ?? []).reduce(
          (acc: number, r: { precipitation: number }) => acc + (r.precipitation ?? 0), 0
        )
        metricValue = Math.round(totalRain * 10) / 10

        if (totalRain >= thresholdAlert) {
          level   = 'alert'
          message = `${zone.name} : vidange urgente (${metricValue} mm en ${rainDays}j)`
        } else if (totalRain >= thresholdWarning) {
          level   = 'warning'
          message = `${zone.name} : surveiller niveau (${metricValue} mm en ${rainDays}j)`
        } else {
          message = `${zone.name} : niveau OK (${metricValue} mm en ${rainDays}j)`
        }
      }

      await supabase.from('alertes').upsert(
        { zone_id: zone.id, level, message, metric_value: metricValue, computed_at: new Date().toISOString() },
        { onConflict: 'zone_id' }
      )
      results.push({ zone: zone.name, level, value: metricValue })
    }

    return new Response(JSON.stringify({ success: true, processed: results }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('daily-weather-cron error:', err)
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
})
