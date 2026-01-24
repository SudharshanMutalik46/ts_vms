# VMS Master Verification Checklist (Phases 1-5)

This checklist validates the end-to-end functionality of the VMS system.

## 🛠️ Prerequisites
- [ ] Database Running (PostgreSQL + TimescaleDB)
- [ ] Redis Running
- [ ] Node API Gateway Running (`npm start`)
- [ ] Recording Engine Running (`./recording_engine`)
- [ ] AI Engine Running (`./ai_engine`)

---

## Phase 1 & 2: Authentication & RBAC

| ID | Test Case | Action | Expected Result |
|----|-----------|--------|-----------------|
| 1.1 | Login | POST `/api/auth/login` with `admin`/`admin123` | Returns valid JWT Access + Refresh tokens |
| 1.2 | Token Refresh | POST `/api/auth/refresh` | Returns new Access Token |
| 1.3 | Logout | POST `/api/auth/logout` | Tokens invalidated |
| 2.1 | Create User | POST `/api/users` (as Admin) | User created |
| 2.2 | RBAC Deny | POST `/api/users` (as Viewer) | 403 Forbidden |

## Phase 3: Camera Management

| ID | Test Case | Action | Expected Result |
|----|-----------|--------|-----------------|
| 3.1 | Add Camera | POST `/api/cameras` with RTSP URL | Camera created, ID returned |
| 3.2 | List Cameras | GET `/api/cameras` | List includes new camera |
| 3.3 | Stream URL | GET `/api/streams/{id}/live` | Returns WebSocket/HLS URL (mock if no ffmpeg) |
| 3.4 | Audit Log | Check `audit_logs` table | "CAMERA_CREATED" event logged |

## Phase 4: Recording Engine

| ID | Test Case | Action | Expected Result |
|----|-----------|--------|-----------------|
| 4.1 | Start Recording | POST `/api/recordings/{id}/start` | Status changes to RECORDING |
| 4.2 | Check Files | Check `C:\VMS_Recordings` (or config path) | `.mp4` segment files appearing |
| 4.3 | List Recordings | GET `/api/recordings?camera_id={id}` | Returns recording segments |
| 4.4 | Stop Recording | POST `/api/recordings/{id}/stop` | Status changes to STOPPED |

## Phase 5: AI Engine & events

| ID | Test Case | Action | Expected Result |
|----|-----------|--------|-----------------|
| 5.1 | Enable Feature | POST `/api/cameras/{id}/features` (code="PERSON") | Node calls AI Engine gRPC `Configure` |
| 5.2 | Verify License | Check `licenses` table | Premium features denied if license invalid |
| 5.3 | Stream Events | Simulate motion/person in front of cam | Events emitted to gRPC stream |
| 5.4 | DB Ingestion | Query `ai_events` table | New rows appearing with `event_type='PERSON_DETECTED'` |
| 5.5 | RBAC Query | GET `/api/ai/events` as Viewer | Returns only assigned camera events |
| 5.6 | Performance | Check logs logs | AI Engine stats logging FPS/Latency |

---

## 🔍 Troubleshooting

### Missing Tables?
Run migrations:
```powershell
# From backend/api_gateway
npm run migrate
```

### AI Engine Connection Failed?
Check `USE_AI_ENGINE` env var in `.env` and ensure `ai_engine.exe` is running on port 50052.

### No Events?
Ensure `yolov8n.onnx` model is present in `backend/ai_engine/models/`.
