import { useState } from 'react'
import { supabase } from '../lib/supabase'

const TYPE_LABELS = { tonte: 'Tonte', piscine: 'Piscine', haies: 'Haies' }
const TYPE_ICONS  = { tonte: '🌿',   piscine: '🏊',      haies: '🌳' }
const METRIC_UNIT = { tonte: '°J',   piscine: 'mm (7j)', haies: '°J' }

const ACTION_LABELS = {
  tonte:   'Tondu aujourd\'hui',
  piscine: 'Vidange effectuée',
  haies:   'Taillé aujourd\'hui',
}

const THRESHOLDS = {
  tonte:   { warning: 40,  alert: 60 },
  piscine: { warning: 20,  alert: 30 },
  haies:   { warning: 100, alert: 150 },
}

export default function ZoneTile({ zone, onClick, onRefresh }) {
  const [showConfirm, setShowConfirm] = useState(false)
  const [notes, setNotes]             = useState('')
  const [saving, setSaving]           = useState(false)

  const alert       = zone.alert ?? { level: 'ok', metric_value: 0 }
  const level       = alert.level ?? 'ok'
  const metricValue = alert.metric_value ?? 0
  const thresholds  = THRESHOLDS[zone.type] ?? { warning: 50, alert: 100 }
  const progressPct = Math.min(100, (metricValue / thresholds.alert) * 100)

  async function handleMarkDone(e) {
    e.stopPropagation()
    if (saving) return
    setSaving(true)
    try {
      await Promise.all([
        supabase.from('interventions').insert({
          zone_id: zone.id,
          type: zone.type,
          notes: notes || null,
          done_at: new Date().toISOString(),
        }),
        supabase.from('alertes').upsert(
          { zone_id: zone.id, level: 'ok', message: `${zone.name} : intervention effectuée`, metric_value: 0, computed_at: new Date().toISOString() },
          { onConflict: 'zone_id' }
        ),
      ])
      setShowConfirm(false)
      setNotes('')
      onRefresh()
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className={`zone-tile ${level}`} onClick={onClick} style={{ cursor: 'pointer' }}>
      <div className="zone-tile-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span className={`status-dot ${level}`} />
          <span className="zone-name">{TYPE_ICONS[zone.type]} {zone.name}</span>
        </div>
        <span className="zone-type-badge">{TYPE_LABELS[zone.type]}</span>
      </div>

      <div>
        <div className="zone-metric">{metricValue.toFixed(1)} <span style={{ fontSize: '1rem', fontWeight: 400, color: 'var(--text-muted)' }}>{METRIC_UNIT[zone.type]}</span></div>
      </div>

      <div className="progress-bar">
        <div className={`progress-fill ${level}`} style={{ width: `${progressPct}%` }} />
      </div>

      {alert.message && <div className="zone-message">{alert.message}</div>}

      {(level === 'warning' || level === 'alert') && !showConfirm && (
        <button
          className={`btn ${level === 'alert' ? 'btn-danger' : 'btn-primary'}`}
          onClick={e => { e.stopPropagation(); setShowConfirm(true) }}
        >
          ✓ {ACTION_LABELS[zone.type]}
        </button>
      )}

      {showConfirm && (
        <div onClick={e => e.stopPropagation()}>
          <textarea
            rows={2}
            placeholder="Notes (optionnel)…"
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            <button className="btn btn-success" style={{ flex: 1 }} disabled={saving} onClick={handleMarkDone}>
              {saving ? '…' : '✓ Confirmer'}
            </button>
            <button className="btn btn-ghost btn-sm" onClick={e => { e.stopPropagation(); setShowConfirm(false) }}>
              Annuler
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
