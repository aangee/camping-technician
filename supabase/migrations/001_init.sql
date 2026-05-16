-- ============================================================
--  Camping Cottet — Technician App — Migration initiale
--  À exécuter dans : Supabase > SQL Editor
-- ============================================================

-- Zones de travail
CREATE TABLE IF NOT EXISTS zones (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name       text NOT NULL,
  type       text NOT NULL CHECK (type IN ('tonte', 'piscine', 'haies')),
  config     jsonb DEFAULT '{}',
  active     boolean DEFAULT true,
  created_at timestamptz DEFAULT now()
);

-- Historique des interventions
CREATE TABLE IF NOT EXISTS interventions (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  zone_id    uuid REFERENCES zones(id) ON DELETE CASCADE,
  type       text NOT NULL CHECK (type IN ('tonte', 'piscine', 'haies')),
  notes      text,
  done_at    timestamptz DEFAULT now(),
  created_by text DEFAULT 'technicien'
);

-- Alertes courantes — une seule ligne par zone (UNIQUE sur zone_id)
CREATE TABLE IF NOT EXISTS alertes (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  zone_id     uuid REFERENCES zones(id) ON DELETE CASCADE UNIQUE,
  level       text NOT NULL CHECK (level IN ('ok', 'warning', 'alert')) DEFAULT 'ok',
  message     text DEFAULT '',
  metric_value numeric DEFAULT 0,
  computed_at timestamptz DEFAULT now()
);

-- Cache météo Open-Meteo (clé = date)
CREATE TABLE IF NOT EXISTS meteo_cache (
  date          date PRIMARY KEY,
  temp_max      numeric NOT NULL,
  temp_min      numeric NOT NULL,
  precipitation numeric NOT NULL DEFAULT 0,
  cached_at     timestamptz DEFAULT now()
);

-- Configuration globale clé/valeur
CREATE TABLE IF NOT EXISTS config (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  updated_at timestamptz DEFAULT now()
);

-- Index
CREATE INDEX IF NOT EXISTS idx_interventions_zone_date ON interventions (zone_id, done_at DESC);
CREATE INDEX IF NOT EXISTS idx_alertes_zone            ON alertes (zone_id);
CREATE INDEX IF NOT EXISTS idx_meteo_date              ON meteo_cache (date DESC);

-- RLS activé sur toutes les tables
ALTER TABLE zones        ENABLE ROW LEVEL SECURITY;
ALTER TABLE interventions ENABLE ROW LEVEL SECURITY;
ALTER TABLE alertes       ENABLE ROW LEVEL SECURITY;
ALTER TABLE meteo_cache   ENABLE ROW LEVEL SECURITY;
ALTER TABLE config        ENABLE ROW LEVEL SECURITY;

-- Politiques : accès complet avec la clé anon (app interne, pas d'auth utilisateur)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'zones' AND policyname = 'allow_all_zones') THEN
    CREATE POLICY allow_all_zones        ON zones        FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'interventions' AND policyname = 'allow_all_interventions') THEN
    CREATE POLICY allow_all_interventions ON interventions FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'alertes' AND policyname = 'allow_all_alertes') THEN
    CREATE POLICY allow_all_alertes      ON alertes       FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'meteo_cache' AND policyname = 'allow_all_meteo') THEN
    CREATE POLICY allow_all_meteo        ON meteo_cache   FOR ALL USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'config' AND policyname = 'allow_all_config') THEN
    CREATE POLICY allow_all_config       ON config        FOR ALL USING (true) WITH CHECK (true);
  END IF;
END $$;

-- ============================================================
--  Données initiales
-- ============================================================

-- Zones par défaut
INSERT INTO zones (name, type) VALUES
  ('Zone Nord',        'tonte'),
  ('Zone Sud',         'tonte'),
  ('Zone Centrale',    'tonte'),
  ('Piscine principale','piscine'),
  ('Haies entrée',     'haies'),
  ('Haies périmètre',  'haies')
ON CONFLICT DO NOTHING;

-- Configuration par défaut
INSERT INTO config (key, value) VALUES
  ('coordinates',              '{"lat": 45.92, "lon": 5.90}'),
  ('tonte_base_temp',          '5'),
  ('tonte_threshold_warning',  '40'),
  ('tonte_threshold_alert',    '60'),
  ('piscine_rain_days',        '7'),
  ('piscine_threshold_warning','20'),
  ('piscine_threshold_alert',  '30'),
  ('haies_base_temp',          '5'),
  ('haies_threshold_warning',  '100'),
  ('haies_threshold_alert',    '150')
ON CONFLICT (key) DO NOTHING;

-- Initialiser les alertes à "ok" pour toutes les zones
INSERT INTO alertes (zone_id, level, message, metric_value)
SELECT id, 'ok', name || ' : en attente de données', 0
FROM zones
ON CONFLICT (zone_id) DO NOTHING;
