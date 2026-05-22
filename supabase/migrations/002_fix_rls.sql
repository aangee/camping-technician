-- ============================================================
--  Camping Cottet — Technician App — Migration 002
--  RLS granulaire : remplace les policies allow_all_*
--
--  À exécuter dans : Supabase > SQL Editor
--  Contexte : app interne sans auth utilisateur — restriction
--  par opération (pas par uid).
-- ============================================================

-- 1. Suppression des policies trop permissives
DROP POLICY IF EXISTS allow_all_zones         ON zones;
DROP POLICY IF EXISTS allow_all_interventions  ON interventions;
DROP POLICY IF EXISTS allow_all_alertes        ON alertes;
DROP POLICY IF EXISTS allow_all_meteo          ON meteo_cache;
DROP POLICY IF EXISTS allow_all_config         ON config;

-- 2. zones — lecture + seed admin (INSERT/UPDATE via sync:technician)
--    DELETE interdit : retirer une zone = action manuelle SQL Editor
CREATE POLICY zones_select ON zones FOR SELECT USING (true);
CREATE POLICY zones_insert ON zones FOR INSERT WITH CHECK (true);
CREATE POLICY zones_update ON zones FOR UPDATE USING (true) WITH CHECK (true);

-- 3. interventions — lecture + ajout seulement (log immuable)
CREATE POLICY interventions_select ON interventions FOR SELECT USING (true);
CREATE POLICY interventions_insert ON interventions FOR INSERT WITH CHECK (true);

-- 4. alertes — lecture + upsert (ON CONFLICT zone_id → INSERT + UPDATE)
CREATE POLICY alertes_select ON alertes FOR SELECT USING (true);
CREATE POLICY alertes_insert ON alertes FOR INSERT WITH CHECK (true);
CREATE POLICY alertes_update ON alertes FOR UPDATE USING (true) WITH CHECK (true);

-- 5. meteo_cache — lecture + cache journalier (INSERT ou UPDATE si date existe)
CREATE POLICY meteo_select ON meteo_cache FOR SELECT USING (true);
CREATE POLICY meteo_insert ON meteo_cache FOR INSERT WITH CHECK (true);
CREATE POLICY meteo_update ON meteo_cache FOR UPDATE USING (true) WITH CHECK (true);

-- 6. config — lecture seule (modification via SQL Editor uniquement)
CREATE POLICY config_select ON config FOR SELECT USING (true);
