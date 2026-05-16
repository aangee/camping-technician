-- ============================================================
--  Camping Cottet — Configuration pg_cron + pg_net
--  À exécuter dans Supabase > SQL Editor
--  PRÉREQUIS : activer pg_cron et pg_net dans Database > Extensions
-- ============================================================

-- Étape 1 : stocker le CRON_SECRET comme paramètre de session
-- (définir d'abord CRON_SECRET dans Edge Functions > Secrets dans la console Supabase)

-- Étape 2 : créer le job cron quotidien à 6h UTC (= 8h heure de Paris en été)
SELECT cron.schedule(
  'daily-weather-update',        -- nom du job
  '0 6 * * *',                   -- cron expression : tous les jours à 6h UTC
  $$
  SELECT
    net.http_post(
      url     := 'https://abzrgubpdlvwdzwotcdi.supabase.co/functions/v1/daily-weather-cron',
      headers := jsonb_build_object(
        'Content-Type',  'application/json',
        'Authorization', 'Bearer ' || current_setting('app.cron_secret', true)
      ),
      body    := '{}'::jsonb
    )
  $$
);

-- Stocker le secret en paramètre (remplacer YOUR_CRON_SECRET par la valeur réelle)
-- À exécuter UNE SEULE FOIS :
-- ALTER DATABASE postgres SET app.cron_secret = 'YOUR_CRON_SECRET';

-- Vérifier le job créé
SELECT jobid, jobname, schedule, active FROM cron.job WHERE jobname = 'daily-weather-update';

-- Pour désactiver le job :
-- SELECT cron.unschedule('daily-weather-update');

-- Pour déclencher manuellement depuis SQL (test) :
-- SELECT net.http_post(
--   url     := 'https://abzrgubpdlvwdzwotcdi.supabase.co/functions/v1/daily-weather-cron',
--   headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb,
--   body    := '{}'::jsonb
-- );
