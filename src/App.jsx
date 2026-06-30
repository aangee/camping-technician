import { useState, useEffect, useCallback } from 'react'
import { supabase } from './lib/supabase'
import Dashboard from './components/Dashboard'
import TonteModule from './components/modules/TonteModule'
import PiscineModule from './components/modules/PiscineModule'
import HaiesModule from './components/modules/HaiesModule'
import HistoryView from './components/HistoryView'
import PlanView3D from './components/PlanView3D'

const NAV_ITEMS = [
  { id: 'dashboard', icon: '🏕️', label: 'Accueil' },
  { id: 'tonte',     icon: '🌿', label: 'Tonte' },
  { id: 'piscine',   icon: '🏊', label: 'Piscine' },
  { id: 'haies',     icon: '🌳', label: 'Haies' },
  { id: 'history',   icon: '📋', label: 'Historique' },
]

const VIEW_TITLES = {
  dashboard: 'Camping Cottet',
  tonte:     'Tonte',
  piscine:   'Piscine',
  haies:     'Haies',
  history:   'Historique',
}

export default function App() {
  const [view, setView] = useState('dashboard')
  const [selectedZone, setSelectedZone] = useState(null)
  const [zones, setZones] = useState([])
  const [alerts, setAlerts] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshKey, setRefreshKey] = useState(0)
  const [showPlan3D, setShowPlan3D] = useState(false)

  const [config, setConfig] = useState({})

  const loadData = useCallback(async () => {
    const [zonesRes, alertsRes, configRes] = await Promise.all([
      supabase.from('zones').select('*').eq('active', true).order('type').order('name'),
      supabase.from('alertes').select('*'),
      supabase.from('config').select('key, value'),
    ])
    setZones(zonesRes.data ?? [])
    setAlerts(alertsRes.data ?? [])
    setConfig(Object.fromEntries((configRes.data ?? []).map(c => [c.key, c.value])))
    setLoading(false)
  }, [])

  useEffect(() => {
    loadData()
    const channel = supabase
      .channel('realtime-alerts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'alertes' }, loadData)
      .subscribe()
    return () => supabase.removeChannel(channel)
  }, [loadData])

  const zonesWithAlerts = zones.map(z => ({
    ...z,
    alert: alerts.find(a => a.zone_id === z.id) ?? { level: 'ok', message: '', metric_value: 0 },
  }))

  const alertCount   = alerts.filter(a => a.level === 'alert').length
  const warningCount = alerts.filter(a => a.level === 'warning').length
  const okCount      = zones.length - alertCount - warningCount
  const healthScore  = zones.length > 0 ? Math.round((okCount / zones.length) * 100) : 100

  function handleRefresh() {
    loadData()
    setRefreshKey(k => k + 1)
  }

  function navigateTo(viewId, zone = null) {
    setView(viewId)
    setSelectedZone(zone)
  }

  const thresholds = {
    tonte:   { warning: Number(config.tonte_threshold_warning ?? 40),  alert: Number(config.tonte_threshold_alert ?? 60) },
    piscine: { warning: Number(config.piscine_threshold_warning ?? 20), alert: Number(config.piscine_threshold_alert ?? 30) },
    haies:   { warning: Number(config.haies_threshold_warning ?? 100),  alert: Number(config.haies_threshold_alert ?? 150) },
  }

  const sharedProps = {
    zones: zonesWithAlerts,
    onNavigate: navigateTo,
    onRefresh: handleRefresh,
    refreshKey,
    thresholds,
    onShowPlan3D: () => setShowPlan3D(true),
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh', color: 'var(--text-muted)' }}>
        Chargement…
      </div>
    )
  }

  return (
    <>
      {showPlan3D && (
        <PlanView3D
          zones={zonesWithAlerts}
          onNavigate={navigateTo}
          onClose={() => setShowPlan3D(false)}
        />
      )}
      <header className="header">
        <div>
          <div className="header-title">{VIEW_TITLES[view]}</div>
          <div className="header-subtitle">Tableau de bord technicien</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {alertCount > 0 && (
            <span style={{
              background: 'var(--red)', color: 'white', borderRadius: '50%',
              width: 22, height: 22, display: 'flex', alignItems: 'center',
              justifyContent: 'center', fontSize: '0.72rem', fontWeight: 700,
            }}>
              {alertCount}
            </span>
          )}
          <button className="btn btn-ghost btn-sm" onClick={handleRefresh} title="Rafraîchir">↻</button>
        </div>
      </header>

      <main className="main fade-in" key={view}>
        {view === 'dashboard' && (
          <Dashboard {...sharedProps} healthScore={healthScore} alertCount={alertCount} warningCount={warningCount} okCount={okCount} />
        )}
        {view === 'tonte'   && <TonteModule   {...sharedProps} initialZone={selectedZone} />}
        {view === 'piscine' && <PiscineModule  {...sharedProps} />}
        {view === 'haies'   && <HaiesModule    {...sharedProps} initialZone={selectedZone} />}
        {view === 'history' && <HistoryView    {...sharedProps} />}
      </main>

      <nav className="bottom-nav">
        {NAV_ITEMS.map(item => (
          <button
            key={item.id}
            className={`nav-item ${view === item.id ? 'active' : ''}`}
            onClick={() => navigateTo(item.id)}
          >
            <span className="nav-icon">{item.icon}</span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
    </>
  )
}
