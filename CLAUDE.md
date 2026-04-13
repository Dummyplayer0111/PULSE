# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**PULSE** (also marketed as **PayGuard**) is an ATM monitoring, incident management, and self-healing platform built for Indian banking infrastructure. It is a hackathon/competition project that values demo-readiness and visual polish.

Monorepo with three sub-projects:

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

**Seed data (run once after fresh migrate):**
```bash
cd backend
python manage.py seed_atm_health     # ATMs with health snapshots
python manage.py seed_engineer       # Engineer users
python manage.py seed_templates      # SMS message templates (40 templates × 8 languages)
python manage.py createsuperuser     # Admin at http://localhost:8000/admin/
```

**Default seed credentials:**
- admin / admin123
- engineer / engineer123
- viewer / viewer123
- Customer portal test phone: 8374273580

**Data Simulators (optional):**
```bash
python pulse-ai/simulator/generate_logs.py --count 3000 --days 2 --output logs.csv
python pulse-ai/simulator/generate_health_snapshots.py
```

## Architecture

### Service Communication

```
Frontend (3000)
    └─→ Django REST API (8000)
            ├─→ FastAPI AI service (8001)  [for /ai/* endpoints]
            ├─→ SQLite database (backend/db.sqlite3)
            └─→ Fast2SMS (optional, for real SMS)
```

The frontend talks directly to Django backend (`http://localhost:8000/api/`). Django proxies AI-related requests to the FastAPI service (`http://localhost:8001`). The AI service URL is configurable via the `AI_SERVICE_URL` environment variable.

### Full Pipeline (`backend/ATM/pipeline.py` → `process_log`)

This is the core event processing chain. Every log event flows through:

1. **AI Classify** — FastAPI `/classify` → category + confidence
2. **Anomaly Detect** — FastAPI `/detect` → Z-score analysis
3. **Incident Creation** — if ERROR/CRITICAL + confidence >= 0.65
4. **Auto-assign Engineer** — least-loaded ENGINEER user
5. **Health Score Recalculation** — updates ATM health
6. **Alert Creation** — creates Alert record
7. **Self-Heal Action** — auto-resolve for remote-fixable actions
8. **Customer SMS Notification** — multilingual via language_router.py
9. **FailedTransaction Creation** — ~50% of eligible incidents
10. **WebSocket Broadcast** — dashboard + per-ATM logs

### Backend (`backend/`)

Single Django app: `ATM/`. Key files:

| File | Purpose |
|------|---------|
| `ATM/models.py` | All 16 data models (see Data Models section) |
| `ATM/views.py` | All REST views; AI proxy views call FastAPI |
| `ATM/customer_views.py` | Customer portal: OTP login, transaction timeline, status tokens |
| `ATM/urls.py` | All API routes under `/api/` |
| `ATM/pipeline.py` | Core `process_log()` — the 10-step event pipeline |
| `ATM/language_router.py` | Region → language mapping (8 Indian languages) |
| `ATM/fast2sms_service.py` | SMS integration (graceful skip if no API key) |
| `ATM/consumers.py` | WebSocket consumers: `DashboardConsumer`, `LogConsumer` |
| `ATM/routing.py` | WebSocket URLs: `ws/dashboard/`, `ws/logs/<atm_id>/`, `ws/customer/<phone_hash>/` |
| `PULSE/asgi.py` | ASGI app with `ProtocolTypeRouter` for HTTP + WebSocket |
| `PULSE/settings.py` | Django settings |

**Management Commands:**
- `seed_atm_health` — seed ATM devices + health snapshots
- `seed_engineer` — seed engineer users
- `seed_templates` — seed 40 SMS templates (5 types × 8 languages, native script)
- `show_language_routing` — console demo of language routing
- `assign_open_incidents` — assign unassigned incidents to engineers

**Authentication:** JWT via `rest_framework_simplejwt`. Login: `POST /api/auth/login/`, refresh: `POST /api/auth/refresh/`.

**Roles:** ADMIN, ENGINEER, VIEWER (defined in UserProfile model)

### AI Service (`pulse-ai/ai_service.py`)

Three FastAPI endpoints — these are the **stable core** and should NOT be modified:

- `POST /classify` — Maps event codes to failure categories and self-heal actions (lookup table)
- `POST /predict` — Predicts failure probability from health snapshot time-series (rolling mean/variance/slope)
- `POST /detect` — Detects anomalies using Z-score on error rate vs. historical baseline

**AI confidence threshold:** 0.6 (below = UNKNOWN)

**Self-Heal Mapping:**
- NETWORK → SWITCH_NETWORK
- CASH_JAM → ALERT_ENGINEER
- SERVER/SOFTWARE → RESTART_SERVICE
- FRAUD → FREEZE_ATM

### Frontend (`frontend/`)

| File/Dir | Purpose |
|----------|---------|
| `index.tsx` | App entry point; routing, auth/landing page, `<Provider>` wrapping |
| `src/store/index.ts` | Redux store: `pulseApi` (RTK Query) + `uiSlice` |
| `src/services/payguardApi.ts` | Single RTK Query API slice; JWT injected from localStorage |
| `src/pages/Dashboard.tsx` | Main admin dashboard with bento grid layout |
| `src/pages/ATMMap.tsx` | Map view with Leaflet + heatmap |
| `src/pages/ATMDetail.tsx` | Individual ATM detail page |
| `src/pages/Incidents.tsx` | Incident management (admin) |
| `src/pages/AIAnalysis.tsx` | AI predictions + analysis page |
| `src/pages/Anomaly.tsx` | Anomaly detection page |
| `src/pages/Communications.tsx` | SMS templates, send form, language routing card |
| `src/pages/Settings.tsx` | App settings |
| `src/pages/EngineerDashboard.tsx` | Engineer view: assigned incidents, resolution |
| `src/pages/ViewerDashboard.tsx` | Customer-facing: Find healthy ATMs + My Status |
| `src/pages/CustomerPortal.tsx` | OTP login → transaction timeline |
| `src/pages/Logs.tsx` | Log viewer |
| `src/components/Layout.tsx` | Sidebar layout with role-based navigation |
| `src/components/map/ATMMap.tsx` | Leaflet map component |
| `src/components/map/SidePanel.tsx` | Map side panel |
| `src/components/notifications/ToastProvider.tsx` | Toast notification system |
| `src/hooks/usePipelineSocket.ts` | WebSocket hook for real-time pipeline events |
| `src/hooks/useWebSocket.ts` | Generic WebSocket hook with auto-reconnect |
| `src/hooks/useHealthScore.ts` | ATM health score data hook |
| `src/types/` | TypeScript type definitions |

The `@` alias in imports resolves to `frontend/` (configured in `vite.config.ts`).

`GEMINI_API_KEY` env var is exposed to the frontend via `vite.config.ts` as `process.env.GEMINI_API_KEY`.

### Data Models (`ATM/models.py`)

16 models total:

| Model | Purpose |
|-------|---------|
| `Incident` | Core incident record with severity, category, status, assigned engineer |
| `LogEntry` | Raw ATM log entries |
| `HealthSnapshot` | Time-series health data per ATM |
| `AnomalyFlag` | AI-detected anomalies |
| `Alert` | Notification alerts |
| `SelfHealAction` | Automated remediation actions |
| `ATM` | ATM device registry (location, region, health) |
| `PaymentChannel` | Payment channel status |
| `Transaction` | Transaction records |
| `CustomerNotification` | SMS/notification records sent to customers |
| `MessageTemplate` | Multilingual SMS templates |
| `UserProfile` | User role (ADMIN/ENGINEER/VIEWER) + assigned ATMs |
| `FailedTransaction` | Failed transaction lifecycle tracking |
| `OTPToken` | OTP codes for customer portal login |
| `CustomerSession` | Customer session management |
| `StatusToken` | Shareable status tracking tokens |

**Key Enums (defined as `*_CHOICES` at top of models.py):**
- **Severity**: `LOW`, `MEDIUM`, `HIGH`, `CRITICAL`
- **Root cause categories**: `NETWORK`, `CASH_JAM`, `SWITCH`, `SERVER`, `FRAUD`, `TIMEOUT`, `HARDWARE`, `UNKNOWN`
- **Self-heal actions**: `RESTART_SERVICE`, `SWITCH_NETWORK`, `FLUSH_CACHE`, `REROUTE_TRAFFIC`, `ALERT_ENGINEER`, `FREEZE_ATM`
- **Anomaly types**: `UNUSUAL_WITHDRAWAL`, `CARD_SKIMMING`, `RAPID_FAILURES`, `MALWARE_PATTERN`

**FailedTransaction lifecycle:**
`DETECTED → INVESTIGATING → ENGINEER_DISPATCHED → RESOLVING → REFUND_INITIATED → RESOLVED`

Different flows per failure type: CASH_JAM, PARTIAL_DISPENSE, NETWORK_TIMEOUT, CARD_CAPTURED.

### Migrations

10 migrations applied (0001–0010). Recent additions:
- 0007: `acknowledged_at` field on Incident
- 0008: `escalation_notes` field
- 0009: VIEWER role support
- 0010: Database indexes for performance

### Customer Portal

- OTP-based login: phone → OTP printed to Django console (or sent via Fast2SMS)
- Session via `X-Customer-Token` header
- WebSocket real-time updates at `ws/customer/<phone_hash>/`
- Shows FailedTransaction timeline with EN+HI bilingual messages
- Status token sharing: `/status/<token>` — public link to track a specific transaction

### Feature 11 — Multilingual Auto-Routing (DONE)

- `language_router.py` — single source of truth for region → language mapping
- 8 languages: en, hi, ta, te, kn, mr, bn, gu (native script templates)
- 40 templates seeded (5 types × 8 languages)
- Communications page shows language badges + fleet distribution card
- `GET /api/language-routing/` — audit endpoint
- `python manage.py show_language_routing` — console demo

### Simulator

`POST /api/simulator/start/` runs a background thread that:
1. Generates weighted ATM events
2. Runs each through the full 10-step pipeline
3. Progresses FailedTransactions through lifecycle stages

## Important Rules

1. **Engineer = Field Engineer** — same role, never use "field engineer" as a separate term
2. **Viewer dashboard is customer-facing** — shows "Find ATMs" + "My Status", NOT admin features
3. **RTK Query arrays are frozen** — always `[...array].sort()`, never `array.sort()` directly
4. **Don't modify AI models** — features layer around them; never change `/classify`, `/predict`, `/detect` endpoints in `ai_service.py`. Add pre/post processing in `pipeline.py` instead
5. **India-focused** — use Indian bank names (SBI, HDFC, ICICI), Indian regions, RBI compliance context
6. **AdminOnly route guard** prevents VIEWER/ENGINEER from admin pages

## Proposed Features (Not Yet Implemented)

| # | Feature | Status |
|---|---------|--------|
| 1 | Salary-Day Surge Prediction | NOT STARTED |
| 2 | ISP/Telco Failover Map | NOT STARTED |
| 3 | UPS + DG Set Monitoring | NOT STARTED |
| 4 | Cash-Level Forecasting | NOT STARTED |
| 5 | RBI Downtime Reporting (auto-generated) | NOT STARTED |
| 6 | NPCI/UPI Health Correlation | NOT STARTED |
| 7 | Festival Calendar Overlay | NOT STARTED |
| 8 | Vendor SLA Tracker (NCR/Diebold) | NOT STARTED |
| 9 | Tiered Branch Escalation | NOT STARTED |
| 10 | ATM Cluster Correlation (same ISP/feeder/zone) | NOT STARTED |
| 11 | Multilingual Auto-Routing by ATM Region | DONE |

## Hackathon Deliverables

Generated presentation and report files in project root:
- `payguard_hackathon_deck.pptx` / `payguard_pitch_deck.pptx` — pitch decks
- `payguard_hackathon_report.pdf` / `payguard_market_report.pdf` — reports
- `create_hackathon_pptx.py` / `create_pptx.py` — generation scripts
