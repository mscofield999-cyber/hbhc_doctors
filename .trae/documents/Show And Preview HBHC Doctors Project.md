## Overview

* Single-page React app loaded via UMD and Babel runtime in `index.html`; uses hash routing and client-side state.

* Minimal API provided by `serve.ps1` to read/write JSON under `data/` via `api/data/<key>`; static hosting for all assets.

* Local persistence in `localStorage` with seeds for first run; optional JSON files in `data/` are used when available.

## Key Files

* `index.html`: Entry page loading fonts, bootstrap icons, React, Babel, and `app.jsx`.

* `styles.css`: Design tokens, components, watermark background, tables, RTL support.

* `app.jsx`: All UI logic and routing; notable helpers/components:

  * `pickField` smart column matcher (`app.jsx:24`).

  * `ensureSeeds` to initialize storage (`app.jsx:89`).

  * `loadDataKey` fetches `api/data/<key>` then falls back to `data/<key>.json` (`app.jsx:105`).

  * Hospitals/Specialties/Departments/Doctors/Shifts/Vacations UIs; `DepartmentAssignPage` for assigning doctors.

* `serve.ps1`: Static server and JSON API; endpoints:

  * `GET/POST /api/data/<key>` read/write `data/<key>.json` (`serve.ps1:33-63`).

  * `GET /api/ping` health check (`serve.ps1:25-31`).

* `data/`: Optional seed files (`hospitals.json`, `departments.json`, `specialties.json`, `vacation_plans.json`).

## Run Preview

* Recommended: start the local PowerShell server from project root:

  * `./serve.ps1 -Port 5173`

* Open the app at `http://localhost:5173/`.

* Alternative: double-click `index.html` to open via `file://` (API calls will not work; JSON fallback may load; for full functionality use the server).

## Verification Steps

* Home loads with watermark and top navigation (Home/Data/Operations/Dashboard).

* Navigate to Data:

  * Add Hospitals, Specialties, Departments; edits save to `localStorage` and reflect across components.

  * Use doctor import (CSV/XLSX) leveraging `xlsx` CDN (`index.html:16`).

* Departments:

  * Assign doctors via `#/assign/<departmentId>`; drag-and-drop and save assignments; refresh to confirm persistence.

* API check:

  * Visit `http://localhost:5173/api/ping` and `http://localhost:5173/api/data/hospitals` to confirm server routes.

## Next Actions

* With your confirmation, I will:

  1. Start `serve.ps1` on port 5173.
  2. Open the live preview URL.
  3. Walk through the verification steps and report results with screenshots-ready notes.

