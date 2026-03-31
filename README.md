# Scripture Key

Tagline: Unlock the Word. Explore the Living Structure.

Scripture Key is a living, interactive Scripture intelligence website that combines deep textual study, graph-aware exploration, and AI-ready interpretation layers.

## Phase 1 Website (Implemented)

This repository now includes a runnable Node.js website for Phase 1:

- Interactive Scripture Viewer with searchable verse list
- Split-screen reading experience: Verse | Commentary + Context | Original Language
- Cross references and Strong's definitions
- Key Mode Unlock flow with layered interpretation:
	- Literal
	- Historical
	- Prophetic
	- Symbolic
	- Connections
- Lattice signals panel (themes, people, events)
- Related verses navigation

## Tech Stack

- Node.js + Express backend
- Static frontend (HTML, CSS, JavaScript)
- Phase 1 seed dataset in JSON

## Run Locally

Requirements:

- Node.js 18+

Install and run:

```bash
npm install
npm start
```

Open:

- http://localhost:3000

## API Endpoints (Phase 1)

- GET /api/v1/scripture
- GET /api/v1/scripture/:verseId
- POST /api/v1/scripture/unlock
- GET /api/v1/graph/theme/:theme

## Project Structure

```
.
|-- data/
|   `-- scripture-phase1.json
|-- docs/
|   |-- 01-product-vision.md
|   |-- 02-phased-roadmap.md
|   |-- 03-system-architecture.md
|   |-- 04-data-model.md
|   |-- 05-api-contracts.md
|   `-- 06-ui-ux-direction.md
|-- public/
|   |-- app.js
|   |-- index.html
|   `-- styles.css
|-- server.js
`-- package.json
```

## Push to GitHub

If this folder is not yet a git repo:

```bash
git init
git add .
git commit -m "Build Phase 1 Scripture Key website"
git branch -M main
git remote add origin https://github.com/<your-username>/<your-repo>.git
git push -u origin main
```

If it is already a git repo:

```bash
git add .
git commit -m "Build Phase 1 Scripture Key website"
git push
```
