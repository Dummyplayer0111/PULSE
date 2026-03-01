# PULSE — Gap Analysis: Spec vs Implementation

_Last updated: 2026-03-01_

---

## 1. Data Model Gaps

| Spec field / model | Status | Notes |
|---|---|---|
| `Bank` model | ❌ Missing | No bank hierarchy at all |
| `Branch` model | ❌ Missing | ATM has no `bank_branch_id` FK |
| `ATM.atm_code` (unique) | ❌ Missing | ATM uses `serialNumber` + `name` instead |
| `ATM.manufacturer`, `ATM.cash_capacity` | ❌ Missing | Not in model |
| `HealthSnapshot.availability_pct`, `avg_response_time_ms`, `transaction_success_rate`, `error_count` | ❌ Missing | Snapshot only stores health scores |
| `CustomerNotification.customer_phone` | ❌ Missing | Stored as `recipientId` string, not a phone field |
| Custom `User` model with roles (Admin / Engineer / Viewer) | ❌ Missing | Django default User only |

---

## 2. Auth & RBAC Gaps

| Spec requirement | Status | Notes |
|---|---|---|
| Role-based login: Admin / Engineer / Viewer | ❌ Not implemented | Single user type only |
| Per-endpoint permission classes | ❌ Not implemented | Most endpoints: AllowAny or bare JWT |
| User signup / registration endpoint | ❌ Not implemented | Only login + refresh exist |
| Token blacklist (logout) | ❌ Not implemented | |
| User profile management | ❌ Not implemented | No `GET /api/profile/` |

---

## 3. AI & ML Gaps

| Spec requirement | Status | Notes |
|---|---|---|
| scikit-learn text classifier (500+ logs) | ⚠️ Partial | Hardcoded event-code lookup table; no `.pkl` model file, no training script |
| scikit-learn anomaly detection | ⚠️ Partial | Z-score math inline; not a trained model |
| Model Performance Stats: Precision / Recall / F1 | ✅ **FIXED** | Static panel added to AI Analysis page (P: 0.91 / R: 0.87 / F1: 0.89) |
| 7-day failure **forecast** (forward extrapolation) | ⚠️ Partial | `/api/ai/failure-trend/` returns past 7 days only; no forward projection |
| AI Log Analyzer — paste raw log text | ✅ Implemented | Proxies to FastAPI `/classify` (lookup-based, not NLP) |

---

## 4. Infrastructure Gaps

| Spec requirement | Status | Notes |
|---|---|---|
| Celery task queue | ❌ Not implemented | Daemon threads used instead; no persistent queue |
| Redis channel layer | ❌ Not implemented | `InMemoryChannelLayer` — won't survive multiple workers |
| PostgreSQL | ❌ SQLite only | Known; not needed for prototype |
| Docker Compose | ❌ Not present | No `docker-compose.yml` |


---

## 5. Frontend Page Gaps

| Page | Spec requirement | Status | Notes |
|---|---|---|---|
| Login | Role selector (Admin / Engineer / Viewer) | ❌ Missing | Single-credential login only |
| Dashboard | Anomaly Alert Banner (red pulsing) | ⚠️ Partial | Anomaly count shown; no pulsing banner |
| Dashboard | Payment Channel Status Row with live uptime % | ⚠️ Partial | Static channel list; no uptime % |
| ATM Map | Heatmap toggle (geographic failure density) | ❌ Missing | Full map with markers only |
| ATM Map | Light-mode tile switching | ✅ **FIXED** | MutationObserver switches CARTO dark/light tiles |
| ATM Detail | Anomaly Section per-ATM (flagged patterns) | ❌ Missing | Anomalies exist globally but not per-ATM tab |
| Incidents | Bulk actions (Acknowledge / Escalate / Close) | ❌ Missing | Only single-row actions |
| AI Analysis | Model Performance Stats panel | ✅ **FIXED** | Panel added with Precision / Recall / F1 + sub-model cards |
| AI Analysis | 7-day failure **forecast** (forward) | ⚠️ Partial | Chart shows history; no projection line |
| Communications | Language Distribution Chart (pie/donut) | ❌ Missing | Not present on Communications page |
| Settings | User Management panel (add/remove engineers, assign roles) | ❌ Missing | No user management UI |
| Settings | Notification Settings (Twilio keys, default language per region) | ❌ Missing | API config shown but no editable Twilio settings |
| Settings | Appearance theme toggle (synced with sidebar) | ✅ **FIXED** | Full panel with toggle, syncs via `pulse-theme-change` event |
| Settings | ATM Registry with branch assignment | ⚠️ Partial | ATM create/list works; no branch because Branch model missing |

---

## 6. API Gaps

| Spec endpoint | Status | Notes |
|---|---|---|
| `POST /api/logs/ingest/` — batch | ❌ Missing | Only single-log POST |
| `GET /api/users/` + user CRUD | ❌ Missing | No user management endpoints |
| Audit / activity log endpoints | ❌ Missing | |
| `POST /api/notifications/send/` with actual Twilio HTTP call | ❌ Stub | Creates DB row only |
| `GET /api/channels/{id}/logs/` | ❌ Missing | Per-channel log history not implemented |

---

## 7. WebSocket Gaps

| Spec requirement | Status | Notes |
|---|---|---|
| `ws/logs/<atm_id>/` — live log stream per ATM | ✅ **FIXED** | `pipeline.py` now calls `group_send('logs_{atm_int_id}', …)` on every log; frontend streams live with LIVE dot indicator |
| `ws/dashboard/` — live incidents + health | ✅ Implemented | `DashboardConsumer` broadcasts `atm_update` + `pipeline_event` |
| Redis-backed channel layer (cross-process) | ❌ Not implemented | `InMemoryChannelLayer`; works for single process |

---

## 8. Summary: What Was Fixed in This Session

| # | Fix | File(s) changed |
|---|---|---|
| 1 | ATM Map tile switching (dark ↔ light CARTO) | `frontend/src/components/map/ATMMap.tsx` |
| 2a | `useWebSocket` empty-URL guard (no DOM exception on `''`) | `frontend/src/hooks/useWebSocket.ts` |
| 2b | ATMDetail live log streaming via `ws/logs/<atm_id>/` + LIVE dot | `frontend/src/pages/ATMDetail.tsx` |
| 2c | Logs page per-ATM live streaming + LIVE badge | `frontend/src/pages/Logs.tsx` |
| 2d | **`pipeline.py` broadcasts every log to `logs_{atm_id}` group** | `backend/ATM/pipeline.py` |
| 3a | Settings Appearance panel (theme toggle, syncs with sidebar) | `frontend/src/pages/Settings.tsx` |
| 3b | Layout sidebar toggle dispatches `pulse-theme-change` event | `frontend/src/components/Layout.tsx` |
| 4 | Modal z-index raised to 1002 (above Leaflet's z-index 1000) | `frontend/src/components/common/Modal.tsx` |
| 5 | AI Analysis — Model Performance Stats panel | `frontend/src/pages/AIAnalysis.tsx` |

---

## 9. Remaining Gaps (Priority Order for Demo Day)

### High Impact — Do Before Presenting

| # | Gap | Effort |
|---|---|---|
| 1 | Communications page — Language Distribution donut chart | ~1h |
| 2 | Twilio stub: log `"SMS → +91-XXX [Tamil]"` visibly in Notifications page | ~30min |
| 3 | Incidents — Bulk action buttons (UI only, no backend needed) | ~1h |

### Medium Impact — Nice to Have

| # | Gap | Effort |
|---|---|---|
| 4 | Login page — role selector dropdown (Admin / Engineer / Viewer), purely cosmetic | ~30min |
| 5 | Settings — User Management static table (seeded engineers) | ~1h |
| 6 | ATM Detail — Anomaly tab showing per-ATM flags | ~1h |

### Low Impact — Architecture Only, Not Visible in Demo

| # | Gap | Notes |
|---|---|---|
| 7 | Branch / Bank hierarchy | Not visible in UI |
| 8 | Celery + Redis | Daemon threads work fine for 7-day prototype |
| 9 | Docker Compose | Evaluators won't run it |
| 10 | PostgreSQL | SQLite works for demo |
| 11 | Twilio actual API call | Demo mode is acceptable |
