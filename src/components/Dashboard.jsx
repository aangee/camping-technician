import ZoneTile from './ZoneTile'

export default function Dashboard({ zones, onNavigate, onRefresh, healthScore, alertCount, warningCount, okCount, thresholds, onShowPlan3D }) {
  const alertZones   = zones.filter(z => z.alert?.level === 'alert')
  const warningZones = zones.filter(z => z.alert?.level === 'warning')
  const okZones      = zones.filter(z => !z.alert || z.alert.level === 'ok')

  const scoreColor = healthScore >= 80 ? 'var(--green)' : healthScore >= 50 ? 'var(--orange)' : 'var(--red)'

  return (
    <div>
      <div className="health-score">
        <div className="health-score-value" style={{ color: scoreColor }}>{healthScore}%</div>
        <div className="health-score-label">Score santé global</div>
        {onShowPlan3D && (
          <button
            onClick={onShowPlan3D}
            style={{
              marginTop: 12, padding: '8px 18px', border: 'none',
              borderRadius: 8, background: 'var(--surface-2, #1e293b)',
              color: 'var(--text, #f1f5f9)', fontSize: 13, fontWeight: 600,
              cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6,
            }}
          >
            🗺️ Vue 3D
          </button>
        )}
      </div>

      <div className="stats-row">
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--red)' }}>{alertCount}</div>
          <div className="stat-label">Alerte(s)</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--orange)' }}>{warningCount}</div>
          <div className="stat-label">À surveiller</div>
        </div>
        <div className="stat-card">
          <div className="stat-value" style={{ color: 'var(--green)' }}>{okCount}</div>
          <div className="stat-label">OK</div>
        </div>
      </div>

      {alertZones.length > 0 && (
        <>
          <div className="section-header">
            <span className="section-title">🔴 Action requise</span>
          </div>
          <div className="zone-grid" style={{ marginBottom: 20 }}>
            {alertZones.map(zone => (
              <ZoneTile key={zone.id} zone={zone} thresholds={thresholds} onClick={() => onNavigate(zone.type, zone)} onRefresh={onRefresh} />
            ))}
          </div>
        </>
      )}

      {warningZones.length > 0 && (
        <>
          <div className="section-header">
            <span className="section-title">🟡 À surveiller</span>
          </div>
          <div className="zone-grid" style={{ marginBottom: 20 }}>
            {warningZones.map(zone => (
              <ZoneTile key={zone.id} zone={zone} thresholds={thresholds} onClick={() => onNavigate(zone.type, zone)} onRefresh={onRefresh} />
            ))}
          </div>
        </>
      )}

      {okZones.length > 0 && (
        <>
          <div className="section-header">
            <span className="section-title">🟢 Tout va bien</span>
          </div>
          <div className="zone-grid">
            {okZones.map(zone => (
              <ZoneTile key={zone.id} zone={zone} thresholds={thresholds} onClick={() => onNavigate(zone.type, zone)} onRefresh={onRefresh} />
            ))}
          </div>
        </>
      )}

      {zones.length === 0 && (
        <div className="empty-state">
          <p>Aucune zone configurée.</p>
          <p>Exécutez le SQL de migration dans Supabase pour initialiser les données.</p>
        </div>
      )}
    </div>
  )
}
