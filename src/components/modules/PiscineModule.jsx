import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { fetchWeather } from '../../lib/openmeteo'

const DEFAULT_COORDS = { lat: 45.92, lon: 5.90 }

export default function PiscineModule({ zones, onRefresh, refreshKey }) {
  const [weather, setWeather]             = useState([])
  const [interventions, setInterventions] = useState([])
  const [config, setConfig]               = useState({})
  const [saving, setSaving]               = useState(false)
  const [notes, setNotes]                 = useState('')
  const [loading, setLoading]             = useState(true)

  const piscineZones = zones.filter(z => z.type === 'piscine')

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    Promise.all([
      supabase.from('config').select('key, value'),
      supabase.from('interventions').select('*').eq('type', 'piscine').order('done_at', { ascending: false }).limit(20),
    ]).then(async ([configRes, intRes]) => {
      if (cancelled) return
      const cfg = Object.fromEntries((configRes.data ?? []).map(c => [c.key, c.value]))
      setConfig(cfg)
      setInterventions(intRes.data ?? [])
      const coords = cfg.coordinates ?? DEFAULT_COORDS
      const w = await fetchWeather({ lat: coords.lat, lon: coords.lon, days: 14 })
      if (!cancelled) { setWeather(w); setLoading(false) }
    }).catch(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [refreshKey])

  const rainDays         = Number(config.piscine_rain_days ?? 7)
  const thresholdWarning = Number(config.piscine_threshold_warning ?? 20)
  const thresholdAlert   = Number(config.piscine_threshold_alert ?? 30)

  const recentWeather = weather.slice(-rainDays)
  const totalRain     = recentWeather.reduce((acc, d) => acc + (d.precipitation ?? 0), 0)
  const level         = totalRain >= thresholdAlert ? 'alert' : totalRain >= thresholdWarning ? 'warning' : 'ok'
  const progressPct   = Math.min(100, (totalRain / thresholdAlert) * 100)

  async function handleDrained(zoneId) {
    if (saving) return
    setSaving(true)
    try {
      await Promise.all([
        supabase.from('interventions').insert({
          zone_id: zoneId, type: 'piscine', notes: notes || null, done_at: new Date().toISOString(),
        }),
        supabase.from('alertes').upsert(
          { zone_id: zoneId, level: 'ok', message: 'Piscine : vidange effectuée', metric_value: totalRain, computed_at: new Date().toISOString() },
          { onConflict: 'zone_id' }
        ),
      ])
      setNotes('')
      onRefresh()
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="loading">Chargement météo…</div>

  return (
    <div>
      <div className="info-card">
        Cumul des <strong>précipitations sur {rainDays} jours</strong> via Open-Meteo.
        Orange à <strong>{thresholdWarning} mm</strong> — Rouge à <strong>{thresholdAlert} mm</strong> (risque trop-plein).
      </div>

      {/* Metric principale */}
      <div className={`zone-tile ${level}`} style={{ marginBottom: 16 }}>
        <div className="zone-tile-header">
          <span className="zone-name">🌧️ Pluie — {rainDays} derniers jours</span>
          <span className={`status-dot ${level}`} />
        </div>
        <div>
          <div className="zone-metric">
            {totalRain.toFixed(1)} <span style={{ fontSize: '1rem', fontWeight: 400, color: 'var(--text-muted)' }}>mm</span>
          </div>
          <div className="zone-metric-label">cumul sur {rainDays} jours</div>
        </div>
        <div className="progress-bar">
          <div className={`progress-fill ${level}`} style={{ width: `${progressPct}%` }} />
        </div>
        <div className="threshold-labels">
          <span>0 mm</span>
          <span>⚠ {thresholdWarning} mm</span>
          <span>🔴 {thresholdAlert} mm</span>
        </div>
      </div>

      {/* Graphe pluie */}
      {weather.length > 0 && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="section-title" style={{ marginBottom: 12 }}>Précipitations quotidiennes — 14 jours</div>
          <RainBars weather={weather} highlightLast={rainDays} />
          <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: '0.72rem', color: 'var(--text-muted)' }}>
            <span><span style={{ color: 'var(--blue)', fontWeight: 600 }}>■</span> Inclus dans le calcul</span>
            <span><span style={{ color: 'var(--surface-2)', fontWeight: 600 }}>■</span> Plus ancien</span>
          </div>
        </div>
      )}

      {/* Action par zone */}
      {piscineZones.map(zone => (
        <div key={zone.id} className="card" style={{ marginBottom: 12 }}>
          <div className="zone-name" style={{ marginBottom: 12 }}>🏊 {zone.name}</div>

          {level === 'ok' ? (
            <div className="alert-banner ok">
              <span>✅</span>
              <span>Niveau correct — aucune action requise</span>
            </div>
          ) : (
            <>
              <div className={`alert-banner ${level}`} style={{ marginBottom: 12 }}>
                <span>{level === 'alert' ? '🔴' : '🟡'}</span>
                <span>
                  {level === 'alert'
                    ? `Vidange partielle urgente — ${totalRain.toFixed(0)} mm accumulés`
                    : `Surveiller le niveau — ${totalRain.toFixed(0)} mm accumulés`}
                </span>
              </div>
              <textarea rows={2} placeholder="Notes (volume vidangé, observations…)" value={notes} onChange={e => setNotes(e.target.value)} />
              <button className="btn btn-success" disabled={saving} onClick={() => handleDrained(zone.id)} style={{ marginTop: 8 }}>
                {saving ? '…' : '✓ Vidange partielle effectuée'}
              </button>
            </>
          )}
        </div>
      ))}

      {piscineZones.length === 0 && (
        <div className="empty-state">Aucune zone de piscine configurée.</div>
      )}

      {/* Historique */}
      {interventions.length > 0 && (
        <div className="card">
          <div className="section-title" style={{ marginBottom: 12 }}>Dernières vidanges</div>
          {interventions.slice(0, 8).map(i => (
            <div key={i.id} className="intervention-item">
              <div className="intervention-dot" style={{ background: 'var(--blue)' }} />
              <div>
                <div className="intervention-text">Vidange partielle{i.notes ? ` — ${i.notes}` : ''}</div>
                <div className="intervention-date">{formatDate(i.done_at)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function RainBars({ weather, highlightLast }) {
  const maxRain = Math.max(...weather.map(d => d.precipitation), 1)
  const cutoff  = weather.length - highlightLast
  return (
    <div className="weather-bars">
      {weather.map((day, i) => {
        const height      = Math.max(2, (day.precipitation / maxRain) * 72)
        const isHighlight = i >= cutoff
        return (
          <div
            key={day.date}
            className="weather-bar"
            style={{
              height: day.precipitation > 0 ? `${height}px` : '3px',
              background: day.precipitation > 0 ? (isHighlight ? 'var(--blue)' : 'var(--surface-2)') : 'var(--surface-2)',
              opacity: day.precipitation > 0 ? 1 : 0.3,
            }}
            title={`${day.date.slice(5)} — ${day.precipitation.toFixed(1)} mm`}
          />
        )
      })}
    </div>
  )
}

function formatDate(isoString) {
  if (!isoString) return 'N/A'
  return new Date(isoString).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}
