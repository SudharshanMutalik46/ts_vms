# Phase 5.6 Performance Baseline

## Environment

| Component | Specification |
|-----------|---------------|
| OS | Windows 11 / Ubuntu 22.04 |
| CPU | 8+ cores recommended |
| RAM | 16GB+ recommended |
| GPU | Optional (CPU-only baseline) |
| ONNX Runtime | v1.16+ (CPU EP) |
| Model | YOLOv8n (640x640, ~6MB) |
| Sample FPS | 5 per camera |

---

## Baseline Metrics Template

### ai_engine Metrics

| Cameras | CPU% | RAM (MB) | Decode FPS | Infer FPS | Avg Infer (ms) | Drops | Reconnects |
|---------|------|----------|------------|-----------|----------------|-------|------------|
| 1       | TBD  | TBD      | TBD        | TBD       | TBD            | TBD   | TBD        |
| 4       | TBD  | TBD      | TBD        | TBD       | TBD            | TBD   | TBD        |
| 8       | TBD  | TBD      | TBD        | TBD       | TBD            | TBD   | TBD        |
| 16      | TBD  | TBD      | TBD        | TBD       | TBD            | TBD   | TBD        |

### Node Ingestion Metrics

| Cameras | CPU% | RAM (MB) | Events/sec | Inserts/sec | Lag (ms) | Reconnects |
|---------|------|----------|------------|-------------|----------|------------|
| 1       | TBD  | TBD      | TBD        | TBD         | TBD      | TBD        |
| 4       | TBD  | TBD      | TBD        | TBD         | TBD      | TBD        |
| 8       | TBD  | TBD      | TBD        | TBD         | TBD      | TBD        |
| 16      | TBD  | TBD      | TBD        | TBD         | TBD      | TBD        |

### Database Metrics

| Cameras | Inserts/sec | Query (1h) | Query (24h) | Index Usage |
|---------|-------------|------------|-------------|-------------|
| 1       | TBD         | TBD        | TBD         | TBD         |
| 4       | TBD         | TBD        | TBD         | TBD         |
| 8       | TBD         | TBD        | TBD         | TBD         |
| 16      | TBD         | TBD        | TBD         | TBD         |

---

## Expected Performance Targets

| Metric | Target | Notes |
|--------|--------|-------|
| Inference Latency | < 100ms | Per frame, CPU only |
| Ingestion Lag | < 5s | Event time to DB insert |
| Query (1h events) | < 500ms | Per camera |
| Memory Growth | < 5% | Over 60 minutes |
| Drop Rate | < 10% | Frames dropped due to load |

---

## How to Collect Metrics

### ai_engine
```bash
# Enable verbose logging
export LOG_LEVEL=debug

# Watch logs for stats every 30s
./ai_engine 2>&1 | grep -E "(Stats|Pipeline)"
```

### Node
```bash
# Stats logged every 10-30s
npm start | grep -E "(AI_EVENTS|INGESTION)"
```

### Database
```sql
-- Inserts per second (last minute)
SELECT count(*) / 60.0 as inserts_per_sec
FROM ai_events 
WHERE created_at > now() - interval '1 minute';

-- Query performance
EXPLAIN ANALYZE
SELECT * FROM ai_events 
WHERE camera_id = 'your-camera-id' 
  AND event_time > now() - interval '1 hour'
ORDER BY event_time DESC
LIMIT 100;
```

---

## Run Instructions

```bash
# 1. Start ai_engine
export AI_MODEL_PATH=models/yolov8n.onnx
./build/ai_engine

# 2. Start Node with AI Engine enabled
export USE_AI_ENGINE=true
npm start

# 3. Register cameras via API
# 4. Enable features via API
# 5. Monitor logs and collect metrics
```
