import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { fetchWeather } from '../../lib/openmeteo'
import { calculateDegreeDays } from '../../lib/degreeDays'

const DEFAULT_COORDS = { lat: 45.92, lon: 5.90 }

export default function HaiesModule({ zones, onRefresh, refreshKey }) {
  const [weather, setWeather]             = useState([])
  const [interventions, setInterventions] = useState([])
  const [config, setConfig]               = useState({})
  const [loading, setLoading]             = useState(true)

  const haiesZones = zones.filter(z => z.type === 'haies')

  useEffect(() => {
    let cancelled = false
    setLoading(true)

    Promise.all([
      supabase.from('config').select('key, value'),
      supabase.from('interventions').select('*').eq('type', 'haies').order('done_at', { ascending: false }).limit(30),
    ]).then(async ([configRes, intRes]) => {
      if (cancelled) return
      const cfg = Object.fromEntries((configRes.data ?? []).map(c => [c.key, c.value]))
      setConfig(cfg)
      setInterventions(intRes.data ?? [])
      const coords = cfg.coordinates ?? DEFAULT_COORDS
      const w = await fetchWeather({ lat: coords.lat, lon: coords.lon, days: 60 })
      if (!cancelled) { setWeather(w); setLoading(false) }
    }).catch(() => { if (!cancelled) setLoading(false) })

    return () => { cancelled = true }
  }, [refreshKey])

  const baseTemp         = Number(config.haies_base_temp ?? 5)
  const thresholdWarning = Number(config.haies_threshold_warning ?? 100)
  const thresholdAlert   = Number(config.haies_threshold_alert ?? 150)

  if (loading) return <div className="loading">Chargement météo…</div>

  return (
    <div>
      <div className="info-card">
        Calcul par <strong>degrés-jours</strong> (base {baseTemp}°C) depuis la dernière taille.
        Orange à <strong>{thresholdWarning} °J</strong> — Rouge à <strong>{thresholdAlert} °J</strong>.
        La fenêtre de calcul est de 60 jours max.
      </div>

      {haiesZones.length === 0 ? (
        <div className="empty-state">Aucune zone de haies configurée.</div>
      ) : (
        haiesZones.map(zone => (
          <HaiesZoneDetail
            key={zone.id}
            zone={zone}
            weather={weather}
            interventions={interventions.filter(i => i.zone_id === zone.id)}
            baseTemp={baseTemp}
            thresholdWarning={thresholdWarning}
            thresholdAlert={thresholdAlert}
            onRefresh={onRefresh}
          />
        ))
      )}

      {interventions.length > 0 && (
        <div className="card">
          <div className="section-title" style={{ marginBottom: 12 }}>Dernières tailles</div>
          {interventions.slice(0, 8).map(i => (
            <div key={i.id} className="intervention-item">
              <div className="intervention-dot" style={{ background: 'var(--green)' }} />
              <div>
                <div className="intervention-text">
                  {zones.find(z => z.id === i.zone_id)?.name ?? 'Zone inconnue'}
                  {i.notes ? ` — ${i.notes}` : ''}
                </div>
                <div className="intervention-date">{formatDate(i.done_at)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function HaiesZoneDetail({ zone, weather, interventions, baseTemp, thresholdWarning, thresholdAlert, onRefresh }) {
  const [saving, setSaving] = useState(false)
  const [notes, setNotes]   = useState('')

  const lastIntervention = interventions[0]
  const sinceDate        = lastIntervention?.done_at?.split('T')[0]
  const weatherSince     = sinceDate ? weather.filter(d => d.date >= sinceDate) : weather
  const degreeDays       = calculateDegreeDays(weatherSince, baseTemp)
  const level            = degreeDays >= thresholdAlert ? 'alert' : degreeDays >= thresholdWarning ? 'warning' : 'ok'
  const progressPct      = Math.min(100, (degreeDays / thresholdAlert) * 100)

  async function handleTrimmed() {
    if (saving) return
    setSaving(true)
    try {
      await Promise.all([
        supabase.from('interventions').insert({
          zone_id: zone.id, type: 'haies', notes: notes || null, done_at: new Date().toISOString(),
        }),
        supabase.from('alertes').upsert(
          { zone_id: zone.id, level: 'ok', message: `${zone.name} : taillé`, metric_value: 0, computed_at: new Date().toISOString() },
          { onConflict: 'zone_id' }
        ),
      ])
      setNotes('')
      onRefresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={`zone-tile ${level}`} style={{ marginBottom: 12 }}>
      <div className="zone-tile-header">
        <span className="zone-name">🌳 {zone.name}</span>
        <span className={`status-dot ${level}`} />
      </div>

      <div>
        <div className="zone-metric">
          {degreeDays.toFixed(1)} <span style={{ fontSize: '1rem', fontWeight: 400, color: 'var(--text-muted)' }}>°J</span>
        </div>
        <div className="zone-metric-label">
          depuis {lastIntervention ? formatDate(lastIntervention.done_at) : 'début de période (60j)'}
        </div>
      </div>

      <div className="progress-bar">
        <div className={`progress-fill ${level}`} style={{ width: `${progressPct}%` }} />
      </div>
      <div className="threshold-labels">
        <span>0</span>
        <span>⚠ {thresholdWarning} °J</span>
        <span>🔴 {thresholdAlert} °J</span>
      </div>

      <textarea rows={2} placeholder="Notes (zones concernées, observations…)" value={notes} onChange={e => setNotes(e.target.value)} />

      <button className="btn btn-success" disabled={saving} onClick={handleTrimmed}>
        {saving ? '…' : '✓ Taillé aujourd\'hui — remettre à zéro'}
      </button>
    </div>
  )
}

function formatDate(isoString) {
  if (!isoString) return 'N/A'
  return new Date(isoString).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })
}
