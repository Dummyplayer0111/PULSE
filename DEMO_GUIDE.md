# PULSE — Demo Guide

> **PULSE**: Predictive Unified Log and Surveillance Engine
> ATM & Payment Channel Intelligence Platform — Hackathon Demo Guide

---

## 1. Pre-Demo Checklist

Run through this **before** presenting to judges.

| # | Check | Command / Action |
|---|-------|-----------------|
| 1 | Python 3.14 installed | `python --version` |
| 2 | Node.js 18+ installed | `node --version` |
| 3 | All pip packages installed | `cd backend && pip install -r requirements.txt` |
| 4 | All npm packages installed | `cd frontend && npm install` |
| 5 | DB migrations applied | `cd backend && python manage.py migrate` |
| 6 | Message templates seeded | `cd backend && python manage.py seed_templates` |
| 7 | Admin user exists | `cd backend && python manage.py createsuperuser` |
| 8 | Browser at 100% zoom | Press `Ctrl+0` |

---

## 2. Starting All Three Services

Open **three terminal windows/tabs** and run:

### Terminal 1 — Django Backend
```bash
cd C:\Users\Praanesh MB\OneDrive\Documents\PULSE\backend
python manage.py runserver
```
→ API live at **http://localhost:8000/api/**
→ Admin at **http://localhost:8000/admin/**

### Terminal 2 — FastAPI AI Service
```bash
cd C:\Users\Praanesh MB\OneDrive\Documents\PULSE\pulse-ai
python ai_service.py
```
→ AI endpoints live at **http://localhost:8001/**
→ Docs at **http://localhost:8001/docs**

### Terminal 3 — React Frontend
```bash
cd C:\Users\Praanesh MB\OneDrive\Documents\PULSE\frontend
npm run dev
```
→ App at **http://localhost:3000** (or 3001 if 3000 is taken)

---

## 3. Demo Flow (Step-by-Step)

### Step 1 — Login (30 seconds)
1. Open **http://localhost:3000** in browser
2. You land on the **PULSE splash/landing page**
3. Click **"Login"** → enter credentials
4. You're now on the **Dashboard**

**What to say:** *"PULSE is a real-time ATM monitoring platform. Let me show you the live dashboard."*

---

### Step 2 — Dashboard Overview (90 seconds)
**What to show:**
- **Top KPI cards**: Total ATMs · Online · Degraded · Offline · Open Incidents · Avg Health Score
- **Health Overview**: bar/ring charts showing fleet health distribution
- **Recent incidents list** (right side)
- **Self-heal activity** feed

**What to say:**
*"At a glance, operators see the entire ATM fleet's health score, incident count, and recent AI-triggered self-heal actions — all updated live."*

> **Pro tip:** If the health scores are all 100 (fresh DB), start the simulator now — jump to Step 6, run the simulator, then come back to narrate the dashboard as it updates live.

---

### Step 3 — ATM Network Map (60 seconds)
1. Click **"ATM Network"** in the left sidebar
2. The India-only map loads with **colour-coded ATM markers**
   - 🟢 Green = Online | 🟡 Amber = Degraded | 🔴 Red = Offline
3. Click any ATM marker
4. A **side panel** slides in on the right showing: status, health score, location, recent incidents
5. Click **"View Full Details"** → goes to ATM Detail page

**What to say:**
*"Operators can visually scan all ATMs on a live map. Clicking an ATM shows real-time health metrics and recent incidents without leaving the map."*

---

### Step 4 — ATM Detail Page (60 seconds)
**What to show:**
- Health score gauge / trend chart
- Network / Hardware / Software / Transaction sub-scores
- Transaction volume chart (last 24 hours)
- Recent logs tab
- Recent incidents tab

**What to say:**
*"Each ATM has a dedicated health score built from four dimensions: network, hardware, software, and transaction quality. The AI pipeline updates these in real time as logs stream in."*

---

### Step 5 — Incidents Page (60 seconds)
1. Click **"Incidents"** in sidebar
2. Show the incident table: ID, title, severity badge, root cause, status, time
3. Click any incident → show detail (root cause category, AI confidence, self-heal action taken)
4. Show **"Resolve"** button — manually resolve an incident
5. Show **Export CSV** button → download incidents spreadsheet

**What to say:**
*"Every incident is automatically created by the AI pipeline with a root cause category and confidence score. The self-heal engine already attempted remediation before a human even sees it."*

---

### Step 6 — Start the Simulator & Watch Live Data (2 minutes)
1. Click **"Settings"** in the sidebar
2. In the **Simulator** panel at the top, click **"Start Simulator"**
3. Status badge turns green: **Running**
4. Navigate back to **Dashboard** — watch numbers change in real time
5. Navigate to **AI Analysis** — watch the Live Pipeline Feed populate

**What to say:**
*"We've built a synthetic data simulator that mimics real ATM log streams: normal INFO logs, WARNING events, and injected ERROR/CRITICAL faults across our 8 ATMs. Watch the pipeline fire."*

> Wait ~30 seconds after start for the first anomalies to appear.

---

### Step 7 — AI Analysis Page (2 minutes)
1. Click **"AI Analysis"** in sidebar
2. Show the **Live Pipeline Feed** (bottom section):
   - Each row = one processed log
   - Columns: timestamp, log level badge, source ATM, event code, AI classification, confidence %, incident ID (if created), self-heal action
3. Show **Root Cause Distribution** chart (donut/bar): NETWORK, TIMEOUT, HARDWARE, etc.
4. Show **Failure Trend** chart (line chart over time)
5. Show **AI Predictions** panel: failure probability per ATM

**What to say:**
*"This is PULSE's AI engine in action. Every log is classified by our FastAPI microservice using a trained classifier. High-confidence ERROR logs automatically create incidents and trigger self-heal actions — no human needed."*

---

### Step 8 — Anomaly Detection (60 seconds)
1. Click **"Anomaly Detection"** in sidebar
2. Show the **anomaly flags table**: source, anomaly type, confidence, status
3. Explain: anomalies are detected via **Z-score** on the error rate vs. historical baseline
4. Show flagged anomalies: RAPID_FAILURES, UNUSUAL_WITHDRAWAL, etc.

**What to say:**
*"Beyond single-log classification, PULSE runs Z-score anomaly detection on error rate windows. When the error rate spikes beyond 2 standard deviations from baseline, the system flags an anomaly — enabling early intervention before an ATM goes offline."*

---

### Step 9 — Self-Healing Demo (60 seconds)
Go back to **AI Analysis** or **Incidents** and show a resolved incident with:
- Status: `AUTO_RESOLVED`
- Self-heal action: `SWITCH_NETWORK` / `RESTART_SERVICE` / `FLUSH_CACHE`

**Self-Heal Map (talk track):**
| Root Cause | Auto Action |
|-----------|------------|
| NETWORK | SWITCH_NETWORK |
| SERVER/SWITCH | RESTART_SERVICE |
| TIMEOUT | FLUSH_CACHE |
| FRAUD | FREEZE_ATM |
| CASH_JAM / HARDWARE | ALERT_ENGINEER |

**What to say:**
*"PULSE doesn't just detect — it acts. For network failures, it automatically switches the ATM to a backup network. For cache issues, it flushes the cache. Remediable incidents are auto-resolved within seconds. Only hardware issues that require physical access escalate to an engineer."*

---

### Step 10 — Multilingual Notifications (45 seconds)
1. Click **"Communications"** in sidebar
2. Show the **CustomerNotification** log: English + Tamil SMS messages auto-generated
3. Show **Message Templates** tab — 40 templates across 8 languages (EN, HI, TA, TE, KN, MR, BN, GU)

**What to say:**
*"India's ATM users speak 8+ languages. PULSE auto-selects the correct language template and generates customer-facing SMS notifications instantly when an ATM goes offline or a transaction fails — no operator intervention needed."*

---

### Step 11 — Stop Simulator & Show Recovery (45 seconds)
1. Go to **Settings** → **Stop Simulator**
2. Navigate to **Dashboard** → watch health scores slowly recover
3. Explain: each INFO log nudges scores up by 2 points on all dimensions

**What to say:**
*"When faults stop, PULSE's health score recovers automatically. ATMs transition from OFFLINE → DEGRADED → ONLINE as clean logs accumulate. The system self-heals at the fleet level, not just per-incident."*

---

## 4. API Endpoints Quick Reference

All endpoints live under `http://localhost:8000/api/`

| Category | Key Endpoints |
|----------|--------------|
| Auth | `POST /auth/login/` · `POST /auth/refresh/` |
| ATMs | `GET /atms/` · `GET /atms/{id}/` · `GET /atms/{id}/health-history/` |
| Logs | `POST /logs/ingest/` · `GET /logs/` |
| Incidents | `GET /incidents/` · `POST /incidents/{id}/resolve/` |
| AI | `POST /ai/analyze-log/` · `GET /ai/predictions/` · `GET /ai/root-cause-stats/` |
| Self-Heal | `GET /self-heal/actions/` · `POST /self-heal/trigger/` |
| Anomaly | `GET /anomaly/flags/` |
| Notifications | `GET /notifications/` · `GET /notifications/templates/` |
| Simulator | `POST /simulator/start/` · `POST /simulator/stop/` · `GET /simulator/status/` |
| Pipeline | `GET /pipeline/events/` |
| Dashboard | `GET /dashboard/summary/` · `GET /dashboard/health-overview/` |

---

## 5. Architecture at a Glance

```
Browser (React 19 + Leaflet)
        │  HTTP/REST (RTK Query polling)
        ▼
  Django REST API :8000
        │
  ┌─────┴──────────────────────┐
  │                            │
  ▼                            ▼
FastAPI AI :8001          SQLite DB
 /classify                     │
 /predict              process_log()
 /detect               (background thread)
                               │
                    ┌──────────┼──────────┐
                    ▼          ▼          ▼
               Incident    Self-Heal   Customer
               Created     Triggered   Notification
```

---

## 6. Troubleshooting

| Problem | Likely Cause | Fix |
|---------|-------------|-----|
| Dashboard shows all zeros | No data in DB | Start simulator first |
| Pipeline feed empty | Simulator not started | Settings → Start Simulator |
| 401 errors in console | Expired JWT | App auto-refreshes; if stuck, log out & back in |
| AI Analysis shows no classifications | FastAPI service down | Start `python ai_service.py` in pulse-ai/ |
| Map shows no ATM markers | No ATMs in DB | Run `python manage.py seed_atms` or ingest logs |
| Anomaly flags don't appear | Too few logs (< 5 baseline) | Run simulator for 60+ seconds |
| Port 3000 unavailable | Another app running | Frontend auto-uses 3001 |

---

## 7. Key Talking Points

1. **End-to-end in < 2 seconds**: From a log being ingested to an incident being created, self-heal triggered, and customer notified — all in under 2 seconds.

2. **No human in the loop for remediable faults**: SWITCH_NETWORK, RESTART_SERVICE, FLUSH_CACHE, REROUTE_TRAFFIC are all auto-executed.

3. **Multilingual by design**: 40 templates × 8 languages — India's linguistic diversity handled out of the box.

4. **AI-native**: Root cause classification (FastAPI /classify), anomaly detection (Z-score /detect), failure prediction (/predict) — three AI services powering one unified platform.

5. **Real-time observability**: Health scores, incidents, and pipeline events update in < 5 seconds via polling (WebSocket as bonus layer).

---

*Demo prepared for PULSE Hackathon — 2026*
