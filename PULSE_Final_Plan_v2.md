# PULSE — Payment Uptime & Log-based Smart Engine
## Final Architecture & Execution Plan
### Focus: ATM/Digital Payment Troubleshooting (Problem #2) + Multilingual Communications (Problem #7)

---

## 1. PROJECT OVERVIEW

| Field | Detail |
|-------|--------|
| **Project Name** | PULSE |
| **Problem Statements** | #2 — Automated troubleshooting of ATMs & digital payment failures; #7 — AI-powered multilingual customer communication |
| **Stack** | React JS + Django REST Framework + PostgreSQL + Redis + WebSocket |
| **AI/ML** | scikit-learn (root cause classification, anomaly, prediction) |
| **Multilingual** | Pre-built templates × 8 Indian languages via Twilio SMS/WhatsApp |
| **Timeline** | 7-Day Prototype |

---

## 2. WHAT PULSE SOLVES

### Problem #2 — Troubleshooting Digital Payment Service Issues
ATMs and digital payment channels face technical declines, network downtime, and transaction failures. Root cause analysis is manual, slow, and error-prone.

**PULSE delivers:**
- Automated root cause identification from raw logs using AI classification
- Predictive alerting before downtime occurs (health score trending)
- Real-time incident creation with severity scoring
- Self-healing engine that auto-triggers remediation actions
- Full audit trail of every failure, resolution, and action taken

### Problem #7 — Multilingual Customer Communication
Payment failure notifications are sent only in English/Hindi, missing regional customers and reducing trust and engagement.

**PULSE delivers:**
- Customer notifications in 8 Indian languages (English, Hindi, Tamil, Telugu, Kannada, Marathi, Bengali, Gujarati)
- Delivered via SMS and WhatsApp
- Language auto-selected per customer preference
- Templates per incident type (ATM offline, UPI timeout, card decline, network failure, cash jam)
- Template manager for operations teams to edit messaging

---

## 3. SYSTEM ARCHITECTURE

```
┌──────────────────────────────────────────────────────────────┐
│                    FRONTEND (React JS)                        │
│  Dashboard | ATM Map | Incidents | AI Engine | Comms | Logs  │
└──────────────────────┬───────────────────────────────────────┘
                       │ REST API + WebSocket (Django Channels)
┌──────────────────────▼───────────────────────────────────────┐
│                  BACKEND (Django + DRF)                       │
│                                                               │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────────┐  │
│  │ Log Ingestor│  │  AI Engine  │  │  Notification Svc    │  │
│  │ (REST/Batch)│  │ (ML Models) │  │  (SMS/WhatsApp)      │  │
│  └──────┬──────┘  └──────┬──────┘  └──────────────────────┘  │
│         │                │                                    │
│  ┌──────▼────────────────▼──────────────────────────────┐    │
│  │              Core Services Layer                      │    │
│  │  Health Scorer | Anomaly Detector | Self-Heal Engine  │    │
│  └───────────────────────────────────────────────────────┘    │
└───────────┬──────────────────────────────────────────────────┘
            │
┌───────────▼──────────────────────────────────────────────────┐
│                     DATA LAYER                                │
│    PostgreSQL (primary) | Redis (cache/pub-sub) | Celery      │
└───────────────────────────────────────────────────────────────┘
```

---

## 4. DATA MODEL (ER Diagram)

```
ATM
───
id (PK)
atm_code (unique)
location_name
latitude, longitude
bank_branch_id (FK → Branch)
model, manufacturer
cash_capacity
install_date
status          [ONLINE | OFFLINE | DEGRADED | MAINTENANCE]
health_score    (0–100)
last_heartbeat

Branch
──────
id, name, city, state, region
bank_id (FK → Bank)

Bank
────
id, name, short_code

PaymentChannel
──────────────
id
name           [UPI | NEFT | IMPS | CARD | SWITCH]
provider
health_score
status

LogEntry
────────
id (PK)
source_type     [ATM | UPI | NEFT | CARD | SWITCH]
source_id       (FK → ATM or PaymentChannel)
timestamp
log_level       [INFO | WARN | ERROR | CRITICAL]
raw_message
parsed_component
error_code
transaction_id  (nullable)
processed       (bool)

Incident
────────
id (PK)
incident_number (unique, auto-generated)
source_type
source_id
title
root_cause_category   [NETWORK | CASH_JAM | SWITCH | SERVER | FRAUD | TIMEOUT | UNKNOWN]
root_cause_detail     (AI-generated text)
severity              [LOW | MEDIUM | HIGH | CRITICAL]
status                [OPEN | INVESTIGATING | AUTO_RESOLVED | RESOLVED | ESCALATED]
ai_confidence_score   (0.0–1.0)
created_at
resolved_at
assigned_to    (FK → User, nullable)
log_entry_id   (FK → LogEntry)

HealthSnapshot
──────────────
id, source_type, source_id
timestamp
health_score
availability_pct
avg_response_time_ms
transaction_success_rate
error_count
anomaly_flag

Alert
─────
id (PK)
incident_id         (FK → Incident)
alert_type          [PREDICTIVE | REACTIVE | ANOMALY | SELF_HEAL]
message
severity
sent_at
acknowledged        (bool)
acknowledged_by     (FK → User)

SelfHealAction
──────────────
id (PK)
incident_id     (FK → Incident)
action_type     [RESTART_SERVICE | SWITCH_NETWORK | FLUSH_CACHE | REROUTE_TRAFFIC]
triggered_at
completed_at
success         (bool)
error_message

CustomerNotification
────────────────────
id (PK)
incident_id          (FK → Incident)
customer_phone
language_code        [en | hi | ta | te | kn | mr | bn | gu]
channel              [SMS | WHATSAPP]
message_template_id  (FK → MessageTemplate)
message_sent         (text)
sent_at
status               [PENDING | SENT | FAILED | DELIVERED]

MessageTemplate
───────────────
id (PK)
template_key         (e.g. "upi_timeout", "atm_offline", "card_decline")
language_code
channel
template_text
variables_schema     (JSON)

AnomalyFlag
───────────
id (PK)
source_id
source_type
timestamp
anomaly_type   [UNUSUAL_WITHDRAWAL | CARD_SKIMMING | RAPID_FAILURES | MALWARE_PATTERN]
confidence_score
description
status         [FLAGGED | CONFIRMED | DISMISSED]
log_entry_id   (FK → LogEntry)

User
────
id, name, email
role           [ADMIN | ENGINEER | VIEWER]
preferred_language
phone
```

**Key Relationships:**
- ATM → many LogEntries
- LogEntry → one Incident (nullable)
- Incident → many Alerts
- Incident → many SelfHealActions
- Incident → many CustomerNotifications
- MessageTemplate (language + incident type matrix: 8 languages × 5 types = 40 templates)

---

## 5. APPLICATION PAGES (9 Pages)

### Page 1 — Login
- Bank logo + PULSE branding
- Role-based login: Admin, Engineer, Viewer
- JWT authentication

---

### Page 2 — Main Dashboard (Command Center)
**Top KPI Bar:**
- Total ATMs: Online / Offline / Degraded counts
- UPI Success Rate %
- Active Incidents count
- Overall Platform Health Score

**Panels:**
- Live Incident Feed (WebSocket) — real-time scrolling alerts with severity color badges
- System Health Gauge — animated circular gauge for platform-wide health
- Payment Channel Status Row — UPI | NEFT | IMPS | Cards each with live uptime %
- Recent Self-Heal Actions — mini log of automated resolutions
- Anomaly Alert Banner — red pulsing banner if suspicious activity detected

---

### Page 3 — ATM Network Map
- Full India map (Leaflet.js) with color-coded ATM markers:
  - Green (score 80–100), Yellow (50–79), Red (0–49)
- Click marker → side panel: ATM ID, location, health score, last 5 incidents, cash level
- Filters: by region, bank, status, health range
- Heatmap toggle: geographic density of failures
- Pulsing animation on markers with active incidents

---

### Page 4 — ATM / Channel Detail
- Header: ATM code, location, status badge, health score ring
- Health Score Timeline (area chart: 24h / 7d / 30d)
- Transaction Volume Chart (bar: success vs. failed)
- Active Incident Card: AI root cause, confidence %, recommended action
- Log Stream Panel: live scrolling logs with filter (ERROR / WARN / INFO) and search
- Incident History Table: date, root cause, resolution time, resolution type (auto/manual)
- Self-Heal History: timeline of automated actions
- Anomaly Section: flagged patterns with confidence score

---

### Page 5 — Incidents & Alerts Center
- Incident Table: filterable by severity, status, source, date range
  - Columns: ID | Source | Title | AI Root Cause | Severity | Status | Created | Resolution Time | Assigned To
- Sidebar Filters: Status, Severity, Category, Date Range
- Click Incident → Detail Modal:
  - Full AI analysis breakdown
  - Confidence score bar
  - Timeline of events (contributing log entries)
  - Self-heal or manual actions taken
  - Assign to engineer
  - Customer notifications sent (language + channel)
- Bulk Actions: Acknowledge | Escalate | Close

---

### Page 6 — AI Analysis & Prediction Engine
- Root Cause Breakdown Donut Chart — distribution of failure types this week
- Prediction Panel — top 5 ATMs/channels predicted to fail in next 24h with confidence %
- Failure Trend Forecast — 7-day extrapolation line chart
- AI Log Analyzer — paste or upload raw log text → AI returns structured root cause analysis
- Model Performance Stats — Precision, Recall, F1 score for demo credibility

---

### Page 7 — Cybersecurity & Anomaly Detection
- Threat Level Meter: LOW / MEDIUM / HIGH
- Anomaly Feed Table: timestamp, ATM/channel, anomaly type, confidence score, status
- Anomaly Detail: suspicious pattern description + contributing logs
- Fraud Pattern Heatmap: geographic clustering of suspicious activity
- Action Buttons: Confirm Threat | Dismiss | Escalate to Security Team

---

### Page 8 — Smart Communication Center (Multilingual) ← Problem #7
- Notification History Table: channel | language | template used | status | timestamp
- Language Distribution Chart: pie chart of languages sent this month
- Compose Notification Panel:
  - Select active incident → auto-fills message context
  - Choose language (8 Indian languages dropdown)
  - Choose channel (SMS / WhatsApp)
  - Preview rendered message in selected language
  - Send to affected customers
- Template Manager: view / edit all 40 templates (language × incident type grid)
- Delivery Stats: Sent / Delivered / Failed with trend sparkline

---

### Page 9 — Settings & Configuration
- ATM Registry: add/edit ATMs, assign to branches
- Notification Settings: Twilio/WhatsApp API keys, default language per region
- Alert Thresholds: health score cutoffs per severity
- Self-Heal Rules: toggle on/off specific auto-remediation actions
- User Management: add/remove engineers, assign roles
- AI Config: confidence thresholds, retrain triggers

---

## 6. BACKEND ARCHITECTURE

### Django Apps
```
pulse_backend/
├── config/           # settings, urls, wsgi, asgi
├── core/             # base models, utilities
├── atm/              # ATM, Branch, Bank models + APIs
├── logs/             # LogEntry ingestion + processing
├── incidents/        # incident creation, management
├── ai_engine/
│   ├── classifier.py     # root cause text classifier
│   ├── predictor.py      # failure probability model
│   └── anomaly.py        # Z-score anomaly detection
├── self_heal/
│   └── actions.py        # auto-remediation logic
├── anomaly/          # cybersecurity anomaly management
├── notifications/
│   ├── templates.py      # 40 multilingual templates
│   └── sender.py         # Twilio SMS/WhatsApp integration
├── dashboard/        # aggregated stats APIs
├── websocket/
│   └── consumers.py      # Django Channels real-time
└── scripts/
    ├── seed_data.py       # seed 20 ATMs, channels, users
    └── log_simulator.py   # generate 500+ synthetic logs
```

---

## 7. API ENDPOINTS

```
AUTH
POST  /api/auth/login/
POST  /api/auth/refresh/

DASHBOARD
GET   /api/dashboard/summary/
GET   /api/dashboard/health-overview/

ATMs
GET   /api/atms/
GET   /api/atms/{id}/
GET   /api/atms/{id}/logs/
GET   /api/atms/{id}/incidents/
GET   /api/atms/{id}/health-history/

PAYMENT CHANNELS
GET   /api/channels/
GET   /api/channels/{id}/

LOGS
POST  /api/logs/ingest/          # ATM/system pushes logs here
GET   /api/logs/?source=&level=&from=&to=

INCIDENTS
GET   /api/incidents/
GET   /api/incidents/{id}/
PATCH /api/incidents/{id}/
POST  /api/incidents/{id}/assign/
POST  /api/incidents/{id}/resolve/

AI ENGINE
POST  /api/ai/analyze-log/       # analyze raw log text
GET   /api/ai/predictions/       # predicted failures
GET   /api/ai/root-cause-stats/

SELF-HEAL
GET   /api/self-heal/actions/
POST  /api/self-heal/trigger/

ANOMALY
GET   /api/anomaly/flags/
PATCH /api/anomaly/flags/{id}/

NOTIFICATIONS
GET   /api/notifications/
POST  /api/notifications/send/
GET   /api/notifications/templates/
POST  /api/notifications/templates/

WEBSOCKET
ws://api/ws/dashboard/           # live incidents + health
ws://api/ws/logs/{atm_id}/       # live log stream per ATM
```

---

## 8. AI ENGINE DESIGN

### Root Cause Classifier
- **Input:** Raw log text (single entry or batch)
- **Approach:** Keyword-rule engine + scikit-learn text classifier trained on 500+ synthetic ATM logs
- **Categories:** NETWORK | CASH_JAM | SWITCH | SERVER | FRAUD | TIMEOUT | HARDWARE | UNKNOWN
- **Output:** `{ category, detail, confidence_score }`

### Predictive Failure Model
- **Input:** Last 24h health snapshots per ATM
- **Approach:** Rolling mean + standard deviation trend analysis; flags ATMs where score is declining
- **Output:** Failure probability % for next 24h per ATM

### Anomaly Detector
- **Input:** Transaction count and error rate per ATM per hour
- **Approach:** Z-score deviation from 30-day rolling baseline
- **Output:** Anomaly flag with type and confidence score

### Self-Heal Engine
| Root Cause | Auto Action |
|------------|------------|
| NETWORK | Switch to backup network path |
| SWITCH | Restart switch connection |
| SERVER | Restart ATM service process |
| TIMEOUT | Flush cache + retry queue |
| CASH_JAM | Alert field engineer (cannot auto-resolve) |
| FRAUD | Freeze ATM + alert security team |

---

## 9. DATA FLOW

```
ATM / Payment Channel generates log
              │
              ▼
    POST /api/logs/ingest/
              │
              ▼
      LogEntry saved to DB
              │
              ▼
  Celery Task: process_log()
              │
        ┌─────┴──────┐
        │             │
        ▼             ▼
  AI Root Cause   Anomaly Check
   Classifier      (Z-score)
        │
        ▼
  Incident Created
  (if ERROR/CRITICAL)
        │
        ▼
  Health Score Recalculated
        │
        ▼
  Alert Created
        │
   ┌────┼────────────┐
   │    │            │
   ▼    ▼            ▼
WebSocket  Self-Heal   Customer Notification
broadcast  triggered   (language auto-selected
(dashboard) if eligible  per customer pref)
```

---

## 10. MULTILINGUAL NOTIFICATION SYSTEM (Problem #7 Detail)

### Template Matrix (40 templates: 8 languages × 5 incident types)

| Incident Type | Languages Covered |
|---------------|------------------|
| ATM Offline | en, hi, ta, te, kn, mr, bn, gu |
| UPI Timeout | en, hi, ta, te, kn, mr, bn, gu |
| Card Decline | en, hi, ta, te, kn, mr, bn, gu |
| Network Failure | en, hi, ta, te, kn, mr, bn, gu |
| Cash Jam | en, hi, ta, te, kn, mr, bn, gu |

### Sample Templates

**UPI Timeout — English:**
> "Dear customer, your UPI payment failed due to a server timeout. Our system has detected the issue and expects resolution within 15 minutes. We apologize for the inconvenience."

**UPI Timeout — Tamil:**
> "அன்பான வாடிக்கையாளரே, சர்வர் தாமதம் காரணமாக உங்கள் UPI கட்டணம் தோல்வியடைந்தது. எங்கள் அமைப்பு சிக்கலை கண்டறிந்துள்ளது, 15 நிமிடங்களில் தீர்வு எதிர்பார்க்கப்படுகிறது."

**ATM Offline — Hindi:**
> "प्रिय ग्राहक, आपके नजदीकी ATM अस्थायी रूप से बंद है। हमारी टीम 30 मिनट में समस्या को ठीक करने पर काम कर रही है।"

**Card Decline — Telugu:**
> "ప్రియమైన కస్టమర్, మీ కార్డ్ లావాదేవీ తాత్కాలిక సాంకేతిక సమస్య కారణంగా విఫలమైంది. మేము 20 నిమిషాల్లో పరిష్కరిస్తాము."

### Language Selection Logic
```python
def get_customer_language(customer_phone):
    # 1. Check CustomerProfile.preferred_language
    # 2. Fallback: detect from phone STD code → regional language mapping
    # 3. Final fallback: 'en' (English)
    return language_code
```

---

## 11. HEALTH SCORE ALGORITHM

```python
def calculate_health_score(source_id, source_type, window_hours=1):
    recent_logs = LogEntry.objects.filter(
        source_id=source_id,
        source_type=source_type,
        timestamp__gte=now() - timedelta(hours=window_hours)
    )

    total = recent_logs.count()
    if total == 0:
        return 100  # no logs = assumed healthy

    errors    = recent_logs.filter(log_level='ERROR').count()
    criticals = recent_logs.filter(log_level='CRITICAL').count()
    warns     = recent_logs.filter(log_level='WARN').count()

    error_rate = (errors + criticals * 2) / total

    open_incidents = Incident.objects.filter(
        source_id=source_id,
        status__in=['OPEN', 'INVESTIGATING']
    ).count()

    score  = 100
    score -= min(40, error_rate * 100)
    score -= warns * 2
    score -= open_incidents * 15

    return max(0, round(score))
```

---

## 12. TECH STACK

| Layer | Technology |
|-------|-----------|
| Frontend | React JS, TailwindCSS, Recharts, Leaflet.js |
| State Management | Redux Toolkit + RTK Query |
| Real-time | WebSocket via Django Channels + Redis |
| Backend | Django 4.x + Django REST Framework |
| Auth | JWT (djangorestframework-simplejwt) |
| Task Queue | Celery + Redis |
| Database | PostgreSQL |
| Cache | Redis |
| SMS/WhatsApp | Twilio API (mocked for demo) |
| ML | scikit-learn (root cause + anomaly + predictor) |
| Deployment | Docker Compose |

---

## 13. FOLDER STRUCTURE

### Frontend
```
src/
├── components/
│   ├── common/        # Button, Badge, Modal, Table, Card
│   ├── charts/        # HealthGauge, TrendLine, DonutChart
│   ├── map/           # ATMMap, ATMMarker, SidePanel
│   └── notifications/ # LanguagePicker, MessagePreview
├── pages/
│   ├── Login.jsx
│   ├── Dashboard.jsx
│   ├── ATMMap.jsx
│   ├── ATMDetail.jsx
│   ├── Incidents.jsx
│   ├── AIAnalysis.jsx
│   ├── Anomaly.jsx
│   ├── Communications.jsx
│   └── Settings.jsx
├── store/             # Redux slices
├── services/          # RTK Query API definitions
├── hooks/             # useWebSocket, useHealthScore
└── utils/
```

### Backend
```
pulse_backend/
├── config/
├── core/
├── atm/
├── logs/
├── incidents/
├── ai_engine/
│   ├── classifier.py
│   ├── predictor.py
│   └── anomaly.py
├── self_heal/
│   └── actions.py
├── anomaly/
├── notifications/
│   ├── templates.py
│   └── sender.py
├── dashboard/
├── websocket/
│   └── consumers.py
└── scripts/
    ├── seed_data.py
    └── log_simulator.py
```

---

## 14. 7-DAY EXECUTION PLAN

### Day 1 — Foundation
- [ ] Django project setup, all apps created, PostgreSQL connected
- [ ] All models created and migrated
- [ ] JWT auth working (login + token refresh)
- [ ] React project setup with TailwindCSS + routing
- [ ] Login page complete

### Day 2 — Data Layer + Simulation
- [ ] Seed script: 20 ATMs across 6 Indian cities, 3 payment channels
- [ ] Synthetic log generator: 500+ entries across all error types
- [ ] Log ingestion API endpoint (`POST /api/logs/ingest/`) working
- [ ] Health score calculation logic implemented
- [ ] Celery: periodic HealthSnapshot task (every 15 min)

### Day 3 — AI Engine
- [ ] Root cause classifier (rule-based + scikit-learn, 8 categories)
- [ ] Incident auto-creation from log analysis
- [ ] Predictive failure scoring (threshold + trend analysis)
- [ ] Anomaly detection (Z-score on transaction patterns)
- [ ] Self-heal action simulator (all 4 auto-action types)

### Day 4 — Backend APIs Complete
- [ ] All REST endpoints implemented and tested
- [ ] WebSocket setup (dashboard feed + per-ATM log stream)
- [ ] Celery tasks: log processing, health updates, notifications
- [ ] 40 multilingual notification templates seeded (8 × 5)
- [ ] Notification send API with Twilio mock

### Day 5 — Frontend Core
- [ ] Dashboard page (KPIs, incident feed, health gauges) — WebSocket connected
- [ ] ATM Map (Leaflet.js, color-coded markers, side panel)
- [ ] ATM Detail page (charts, log stream, incident history)
- [ ] Incidents & Alerts Center (table + detail modal)

### Day 6 — Frontend Advanced
- [ ] AI Analysis & Prediction page (donut, forecast, log analyzer)
- [ ] Anomaly & Cybersecurity page (feed, heatmap, actions)
- [ ] Smart Communication Center — multilingual compose + template manager
- [ ] Settings page

### Day 7 — Polish + Demo Prep
- [ ] Demo script rehearsed end-to-end (see Section 15)
- [ ] Realistic demo data seeded (6 cities, varied incident types)
- [ ] Mobile responsiveness pass
- [ ] Loading states, error states, empty states for all pages
- [ ] Final UI polish + presentation slides

---

## 15. DEMO SCRIPT (7-Step Flow)

| Step | Action | What Judge Sees |
|------|--------|----------------|
| 1 | Open Dashboard | 20 ATMs live — 2 degraded, 1 incident active, UPI at 97.3% |
| 2 | POST critical log to `/api/logs/ingest/` | Incident card appears on dashboard in real-time via WebSocket |
| 3 | Click incident | AI root cause: "Cash dispenser jam — 94% confidence" |
| 4 | Self-heal panel | Automated action: "Field engineer alert triggered" |
| 5 | Communication Center | Customer notification sent in Tamil — WhatsApp preview shown |
| 6 | ATM Map | Marker turns red → back to green after self-heal resolves |
| 7 | AI Prediction tab | 3 ATMs predicted to fail in next 24h with confidence % |

---

*This is the single source of truth for PULSE. Scope is locked to Problem #2 (ATM/payment troubleshooting) and Problem #7 (multilingual communications). All other use cases are out of scope.*
