import { useState, useEffect } from 'react'
import { ZONE_ENTRETIEN_COLORS } from '@aangee/cottet-plan-lib/constants'
import { supabase } from '../lib/supabase'

const TYPE_ICONS  = { tonte: '🌿', piscine: '🏊', haies: '🌳' }
// Mapping cssVar local (hors scope plan-lib pour éviter couplage app UI)
const TYPE_CSSVAR = { tonte: 'var(--orange)', piscine: 'var(--blue)', haies: 'var(--green)' }
const TYPE_LABELS = Object.fromEntries(Object.entries(ZONE_ENTRETIEN_COLORS).map(([k, v]) => [k, v.label]))
const TYPE_COLORS = TYPE_CSSVAR  // alias pour minimiser diff

export default function HistoryView({ zones }) {
  const [interventions, setInterventions] = useState([])
  const [loading, setLoading]             = useState(true)
  const [filter, setFilter]               = useState('all')

  useEffect(() => {
    supabase
      .from('interventions')
      .select('*')
      .order('done_at', { ascending: false })
      .limit(100)
      .then(({ data }) => {
        setInterventions(data ?? [])
        setLoading(false)
      })
  }, [])

  const filtered = filter === 'all' ? interventions : interventions.filter(i => i.type === filter)
  const grouped  = groupByDate(filtered)

  if (loading) return <div className="loading">Chargement…</div>

  return (
    <div>
      <div className="filter-row">
        {['all', 'tonte', 'piscine', 'haies'].map(f => (
          <button
            key={f}
            className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-ghost'}`}
            style={{ whiteSpace: 'nowrap' }}
            onClick={() => setFilter(f)}
          >
            {f === 'all' ? 'Tout' : `${TYPE_ICONS[f]} ${TYPE_LABELS[f]}`}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="empty-state">
          <p>Aucune intervention enregistrée.</p>
          <p>Les interventions apparaîtront ici après les premières saisies.</p>
        </div>
      ) : (
        Object.entries(grouped).map(([date, items]) => (
          <div key={date} style={{ marginBottom: 16 }}>
            <div className="section-title" style={{ marginBottom: 8 }}>{formatDateHeader(date)}</div>
            <div className="card" style={{ padding: '4px 16px' }}>
              {items.map(item => {
                const zone = zones.find(z => z.id === item.zone_id)
                return (
                  <div key={item.id} className="intervention-item">
                    <div className="intervention-dot" style={{ background: TYPE_COLORS[item.type] }} />
                    <div style={{ flex: 1 }}>
                      <div className="intervention-text">
                        {TYPE_ICONS[item.type]} {TYPE_LABELS[item.type]}
                        {zone ? ` — ${zone.name}` : ''}
                      </div>
                      {item.notes && (
                        <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: 2 }}>
                          {item.notes}
                        </div>
                      )}
                      <div className="intervention-date">
                        {new Date(item.done_at).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                        {item.created_by ? ` · ${item.created_by}` : ''}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ))
      )}
    </div>
  )
}

function groupByDate(items) {
  return items.reduce((acc, item) => {
    const date = item.done_at.split('T')[0]
    ;(acc[date] ??= []).push(item)
    return acc
  }, {})
}

function formatDateHeader(isoDate) {
  const today     = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  if (isoDate === today)     return "Aujourd'hui"
  if (isoDate === yesterday) return 'Hier'
  return new Date(isoDate + 'T12:00:00').toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long',
  })
}
