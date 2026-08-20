# Path Seeker — Well Trajectory Generation App

Monorepo for well trajectory planning with manual and AI-assisted survey generation.

## Stack

- **Frontend:** Vite + React + TypeScript + Tailwind CSS + Plotly.js
- **Backend:** FastAPI + Beanie (MongoDB ODM)
- **Database:** MongoDB
- **Auth:** Clerk (optional; dev bypass enabled by default)
- **AI:** OpenAI (optional; rule-based fallback)

## Project structure

```
frontend/     # React SPA
backend/      # FastAPI API + trajectory engine placeholders
```

## Local development

### Prerequisites

- Node.js 20+
- Python 3.12+
- MongoDB running locally (or MongoDB Atlas URI)

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

Open http://localhost:5173

Dev auth is enabled by default (`DEV_AUTH_BYPASS=true`). No Clerk keys required for local testing.

## App flow

1. **Projects** — create project with location, environment, CRS
2. **Wells** — surface coordinates, RKB to datum, unit system (API/SI)
3. **Subsurface** — formations table, targets with tolerances
4. **Trajectory** — manual parameters or AI natural-language chat
5. **Report** — PDF download with survey stations

## Trajectory engine

Placeholder minimum-curvature engine lives at `backend/app/services/trajectory/engine.py`.

Replace the `TrajectoryEngine.generate()` implementation with your Python algorithms while keeping `TrajectoryRequest` / `TrajectoryResult` schemas stable.

## Environment variables

### Backend (`backend/.env`)

| Variable | Description |
|----------|-------------|
| `MONGODB_URI` | MongoDB connection string |
| `MONGODB_DB` | Database name |
| `CORS_ORIGINS` | Allowed frontend origins |
| `DEV_AUTH_BYPASS` | Skip JWT verification (local dev) |
| `CLERK_JWKS_URL` | Clerk JWKS URL (production) |
| `OPENAI_API_KEY` | OpenAI key for AI agent |

### Frontend (`frontend/.env`)

| Variable | Description |
|----------|-------------|
| `VITE_API_URL` | Backend API base URL |
| `VITE_CLERK_PUBLISHABLE_KEY` | Clerk publishable key |

## Deployment

| Component | Recommended host |
|-----------|------------------|
| Frontend | Vercel |
| API | Railway or Render |
| Database | MongoDB Atlas |

### Vercel (frontend)

- Root directory: `frontend`
- Build: `npm run build`
- Output: `dist`
- Env: `VITE_API_URL`, `VITE_CLERK_PUBLISHABLE_KEY`

### Railway / Render (backend)

- Start command: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
- Set `MONGODB_URI`, `CORS_ORIGINS`, `CLERK_*`, `OPENAI_API_KEY`
- Disable `DEV_AUTH_BYPASS` in production

### MongoDB Atlas

- Create cluster and database user
- Allow network access for API host
- Set `MONGODB_URI` on backend

## Charts

Six Plotly charts on trajectory review:

- Section View, Plan View, 3D
- Inclination vs MD, Azimuth vs MD, DLS vs MD

## License

Proprietary — Path Seeker
