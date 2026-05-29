# Supabase — Matrice writer/reader (app-technician)

## Tables et accès

| Table | Lecteurs | Écrivains | Notes |
|-------|----------|-----------|-------|
| `zones` | `App.jsx` (SELECT active=true) | `app-admin/tools/seed_supabase_zones.mjs` | Read-only depuis technician — seul le studio admin seed cette table |
| `interventions` | `TonteModule`, `HaiesModule`, `PiscineModule`, `HistoryView` | `ZoneTile` (INSERT), `TonteModule`, `HaiesModule`, `PiscineModule` | Append-only — pas de UPDATE ni DELETE depuis l'app |
| `alertes` | `App.jsx` (SELECT + Realtime subscription) | `TonteModule`, `HaiesModule`, `PiscineModule`, `ZoneTile` (UPSERT on zone_id) | Une ligne par zone max — upsert idempotent |
| `meteo_cache` | `openmeteo.js` (via fetchWeather) | `openmeteo.js` | Cache journalier Open-Meteo — pas de write direct depuis les composants |
| `config` | `TonteModule`, `HaiesModule`, `PiscineModule` (SELECT key,value) | Manuel via Supabase Dashboard | Seuils et coordonnées GPS — ne jamais écrire depuis l'app |

## Politique RLS (migration 002_fix_rls.sql — 2026-05-22)

| Table | anon SELECT | anon INSERT | anon UPDATE | anon DELETE |
|-------|------------|-------------|-------------|-------------|
| `zones` | ✅ | ❌ | ❌ | ❌ |
| `interventions` | ✅ | ✅ | ❌ | ❌ |
| `alertes` | ✅ | ✅ | ✅ | ❌ |
| `meteo_cache` | ✅ | ✅ | ✅ | ❌ |
| `config` | ✅ | ❌ | ❌ | ❌ |

## Invariants à ne jamais briser

- `zones` : **jamais écrire depuis technician** — toujours via `npm run sync:technician` (studio admin)
- `config` : **jamais écrire depuis l'app** — seuils modifiables uniquement via Supabase Dashboard
- `alertes` : une seule ligne par `zone_id` (contrainte UNIQUE sur `zone_id`)
- `interventions` : pas de suppression ni modification — journal append-only

## Clés config attendues

| Clé | Utilisée par | Fallback |
|-----|-------------|---------|
| `coordinates` | TonteModule, HaiesModule, PiscineModule (fetch météo) | `{ lat: 45.34, lon: 4.65 }` |
| `tonte_base_temp` | TonteModule | `5` |
| `tonte_threshold_warning` | TonteModule | `40` |
| `tonte_threshold_alert` | TonteModule | `60` |
| `haies_base_temp` | HaiesModule | à vérifier |
| `haies_threshold_warning` | HaiesModule | à vérifier |
| `haies_threshold_alert` | HaiesModule | à vérifier |
| `piscine_threshold_warning` | PiscineModule | `20` |
| `piscine_threshold_alert` | PiscineModule | `30` |
