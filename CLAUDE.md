# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PULSE is an ATM monitoring and incident management platform. It is a monorepo with three sub-projects:

- `backend/` — Django 6 REST API + Django Channels (WebSocket), runs on port 8000
- `frontend/` — React 19 + TypeScript + Vite + Redux Toolkit, runs on port 3000
- `pulse-ai/` — FastAPI AI microservice, runs on port 8001

## Running the Services

All three services must run simultaneously for full functionality.

**Backend (Django):**
```bash
cd backend
python manage.py migrate
python manage.py runserver
```

**AI Service (FastAPI):**
```bash
cd pulse-ai
pip install -r requirements.txt
python ai_service.py
```

**Frontend (Vite):**
```bash
cd frontend
npm install
npm run dev
```

**Data Simulators (optional):**
```bash
# Generate synthetic ATM log CSV
python pulse-ai/simulator/generate_logs.py --count 3000 --days 2 --output logs.csv

# Generate health snapshots
python pulse-ai/simulator/generate_health_snapshots.py
```

**Django management:**
```bash
cd backend
python manage.py makemigrations
python manage.py migrate
python manage.py createsuperuser   # Admin at http://localhost:8000/admin/
```

## Architecture

### Service Communication

The frontend talks directly to the Django backend (`http://localhost:8000/api/`). Django proxies AI-related requests to the FastAPI service (`http://localhost:8001`). The AI service URL is configurable via the `AI_SERVICE_URL` environment variable (default: `http://localhost:8001`).

```
Frontend (3000)
    └─→ Django REST API (8000)
            ├─→ FastAPI AI service (8001)  [for /ai/* endpoints]
            └─→ SQLite database
```

### Backend (`backend/`)

The single Django app is `ATM/`. Key files:
- `ATM/models.py` — All data models: `Incident`, `LogEntry`, `HealthSnapshot`, `AnomalyFlag`, `Alert`, `SelfHealAction`
- `ATM/views.py` — All REST views; the `_call_classify()` and `ai_predictions()` views make HTTP calls to the FastAPI service
- `ATM/urls.py` — All API routes under `/api/`
- `ATM/consumers.py` — Django Channels WebSocket consumers: `DashboardConsumer`, `LogConsumer`
- `ATM/routing.py` — WebSocket URL patterns: `ws/dashboard/` and `ws/logs/<atm_id>/`
- `PULSE/asgi.py` — ASGI app using `ProtocolTypeRouter` for HTTP + WebSocket

Authentication uses JWT (`rest_framework_simplejwt`). Login: `POST /api/auth/login/`, refresh: `POST /api/auth/refresh/`.

### AI Service (`pulse-ai/ai_service.py`)

Three FastAPI endpoints:
- `POST /classify` — Maps event codes to failure categories and self-heal actions using a lookup table
- `POST /predict` — Predicts failure probability from health snapshot time-series using rolling mean/variance/slope
- `POST /detect` — Detects anomalies using Z-score on error rate vs. historical baseline

### Frontend (`frontend/`)

- `index.tsx` — App entry point; contains routing, auth/landing page, and `<Provider>` wrapping
- `src/store/index.ts` — Redux store combining `pulseApi` (RTK Query) and `uiSlice`
- `src/services/pulseApi.ts` — Single RTK Query API slice with all endpoints; JWT token injected from `localStorage`
- `src/pages/` — Page components (Dashboard, ATMMap, ATMDetail, Incidents, AIAnalysis, Anomaly, Communications, Settings)
- `src/hooks/useWebSocket.ts` — Hook for connecting to Django Channels WebSocket endpoints with auto-reconnect
- `src/hooks/useHealthScore.ts` — Hook for ATM health score data

The `@` alias in imports resolves to `frontend/` (configured in `vite.config.ts`).

A `GEMINI_API_KEY` env var is exposed to the frontend via `vite.config.ts` as `process.env.GEMINI_API_KEY`.

### Data Models

All enum values (severity, status, log level, anomaly type, etc.) are defined as `*_CHOICES` constants at the top of `ATM/models.py`. The frontend must match these values exactly.

Key enum sets:
- **Severity**: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`
- **Root cause categories**: `NETWORK`, `CASH_JAM`, `SWITCH`, `SERVER`, `FRAUD`, `TIMEOUT`, `HARDWARE`, `UNKNOWN`
- **Self-heal actions**: `RESTART_SERVICE`, `SWITCH_NETWORK`, `FLUSH_CACHE`, `REROUTE_TRAFFIC`, `ALERT_ENGINEER`, `FREEZE_ATM`
- **Anomaly types**: `UNUSUAL_WITHDRAWAL`, `CARD_SKIMMING`, `RAPID_FAILURES`, `MALWARE_PATTERN`
