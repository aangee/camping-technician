# CLAUDE.md — Technician Camping Cottet

**Chemin :** `L:/CORE/labs/Camping_Cottet_2026/Apps/app-technician/`
**Stack :** Vite 8 + React 19 + Supabase + Vitest
**NSM project_id :** `p-mp9r26cnpgp`

## Rôle

PWA technicien — logger les interventions d'entretien (tonte / piscine / haies), suivre l'état de santé global du site, recevoir des alertes basées sur la météo (degrés-jours, cumul pluie).

## Position dans la suite

Consommateur du studio admin (cf. `Apps/CLAUDE.md`).
- **Données spatiales** (zones) : seedées dans Supabase par `app-admin/tools/seed_supabase_zones.mjs` via `npm run sync:technician`. Mapping `config.local_id` → `zone.uuid`.
- **Données transactionnelles** (`interventions`, `alertes`) : écrites depuis cette app directement vers Supabase.
- **Données métier** (`config`, `meteo_cache`) : Supabase, gérées hors-studio.

## Structure src/

```
src/
  App.jsx                — Nav 5 pages + Realtime Supabase sur table `alertes`
  components/
    Dashboard.jsx        — Health score global, zones groupées par niveau d'alerte
    HistoryView.jsx      — Filtre par type, interventions groupées par date
    ZoneTile.jsx         — Carte zone + badge alerte
    modules/
      TonteModule.jsx    — Degrés-jours (base 5°C), log intervention, upsert alerte
      PiscineModule.jsx  — Cumul pluie 7j, drain button, alerte sur seuil
      HaiesModule.jsx    — Degrés-jours haies, log taille
  lib/
    supabase.js          — Client Supabase
    openmeteo.js         — Fetch météo Open-Meteo
    degreeDays.js        — Calcul degrés-jours + getAlertLevel
    *.test.js            — Vitest units (3 fichiers)
```

## Tables Supabase

| Table | Rôle | Écrit par |
|-------|------|-----------|
| `zones` | Définition spatiale zones entretien | Studio admin (seed) |
| `interventions` | Historique actions techniciens | Technician |
| `alertes` | État courant par zone (ok/warning/alert) | Technician (upsert depuis modules) |
| `meteo_cache` | Cache journalier Open-Meteo | Technician |
| `config` | Seuils, coordonnées GPS site | Manuel Supabase |

RLS activé (migration 002_fix_rls.sql — 2026-05-22). Policies granulaires par opération : zones/config SELECT only, interventions SELECT+INSERT, alertes/meteo_cache SELECT+INSERT+UPDATE.

**Supabase project_id :** `abzrgubpdlvwdzwotcdi` (MCP tool `execute_sql` + requêtes admin — bypasse RLS)
**URL :** `https://abzrgubpdlvwdzwotcdi.supabase.co`

⚠ La clé anon ne peut pas DELETE sur `zones` (RLS 002 l'interdit volontairement). Pour les ops de maintenance sur `zones` → utiliser le MCP Supabase (`execute_sql` avec project_id ci-dessus) ou le SQL Editor Supabase.

## Conventions

- **State** : `useState` + `useCallback`, Realtime subscription Supabase sur `alertes`
- **Style** : CSS vanilla, design tokens custom properties, layout mobile portrait (max-width 480px)
- **Tests** : Vitest, focus calculs métier (degrees-days, seuils, logique piscine)
- **Env** : `.env.example` → `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`

## Build & deploy

- `vite.config.js` : `base: '/camping-technician/'` (mis à jour 2026-05-20 après renommage repo)
- Pas de workflow GitHub Actions encore (à ajouter)

## Scripts npm

```
dev / build / preview / lint / test / test:watch
```

## Pièges connus

- Realtime subscription sur `alertes` → chaque mutation déclenche `loadData()` (peut être bruyant)
- Coords GPS par défaut hardcodées (45.34, 4.65 — Châteauneuf-Isère) en fallback si config manquante
- Layout figé portrait `max-width: 480px` — pas responsive desktop
- RLS actif depuis 2026-05-22 — policies granulaires, app prête pour déploiement prod
