# Phase 5.6 Soak Test Plan

## Objective
Prove AI event pipeline stability under production load (16+ cameras) for extended duration.

---

## Hardware Assumptions

| Component | Minimum | Recommended |
|-----------|---------|-------------|
| CPU Cores | 8 | 16+ |
| RAM | 16GB | 32GB |
| GPU | None (CPU-only) | NVIDIA (future) |
| Disk | SSD | NVMe SSD |
| Network | 1Gbps | 1Gbps |

---

## Test Configuration

| Parameter | Value |
|-----------|-------|
| Cameras | 16 (target), 8 (minimum) |
| Resolution | 1080p or 720p |
| Camera FPS | 25-30 |
| Sample FPS | 5 per camera |
| Min Confidence | 0.6 |
| Event Interval | 3000ms |
| Duration | 60 minutes |

---

## Success Criteria

| Metric | Threshold | Pass/Fail |
|--------|-----------|-----------|
| Crashes | 0 | PASS if none |
| Memory Growth | < 10% over baseline | PASS if stable |
| Avg Inference Latency | < 100ms | PASS |
| Ingestion Lag | < 5 seconds | PASS |
| Event Drop Rate | < 15% | PASS |
| DB Query (1h) | < 500ms | PASS |
| Reconnect Recovery | < 30s | PASS |

---

## Test Procedure

### Phase 1: 8 Cameras (30 min)
1. Start ai_engine with model
2. Start Node with `USE_AI_ENGINE=true`
3. Register 8 cameras via API
4. Enable PERSON detection on all
5. Monitor for 30 minutes
6. Record metrics at 10, 20, 30 min marks

### Phase 2: 16 Cameras (60 min)
1. Add 8 more cameras (total 16)
2. Monitor for 60 minutes
3. Record metrics at 15, 30, 45, 60 min marks

### Phase 3: Restart Tests
1. Kill ai_engine mid-run → verify Node reconnects
2. Kill Node mid-run → verify no duplicate events
3. Record recovery times

---

## Metrics Collection

Every 10 minutes, record:

**ai_engine:**
- [ ] Total events emitted
- [ ] Active pipelines count
- [ ] Per-camera decode FPS
- [ ] Per-camera infer latency
- [ ] Drop count

**Node:**
- [ ] Events received total
- [ ] Events inserted total
- [ ] Average ingestion lag
- [ ] Reconnect count

**System:**
- [ ] CPU usage (ai_engine process)
- [ ] RAM usage (ai_engine process)
- [ ] CPU usage (Node process)
- [ ] RAM usage (Node process)

**Database:**
- [ ] Total ai_events rows
- [ ] Query latency (1h by camera)

---

## Failure Triage Checklist

| Symptom | Likely Cause | Fix |
|---------|--------------|-----|
| High CPU | Too many cameras or high FPS | Reduce sample_fps |
| Memory growth | Frame buffer leak | Check latest-frame-wins policy |
| Ingestion lag | DB slow or insert queue | Check DB indexes, add batching |
| Reconnect loops | RTSP stream unstable | Increase backoff, check network |
| Event spam | Low event interval | Increase min_event_interval_ms |
| Query slow | Missing index | Add composite index |

---

## Go/No-Go Checklist for Phase 6 UI

| Item | Status |
|------|--------|
| [ ] 8 cameras stable for 60 min | |
| [ ] 16 cameras stable for 60 min | |
| [ ] Query latency < 500ms | |
| [ ] No memory leaks detected | |
| [ ] Restart recovery works | |
| [ ] Ingestion lag < 5s | |
| [ ] No duplicate events on Node restart | |

**Decision:** [PENDING / GO / NO-GO]
