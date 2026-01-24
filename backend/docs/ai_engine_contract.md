# AI Engine gRPC Contract (Phase 5.1 Freeze)

**Status:** FROZEN  
**Phase:** 5.1 (Contract Only)  
**Proto File:** `backend/ai_engine/proto/ai_engine.proto`

## Overview
This document defines the frozen contract for the communication between the VMS Control Plane (Node.js) and the Native AI Engine (C++).

## Design Principles
1. **Control Plane vs. Real-time Plane**: 
   - Node.js acts as the control plane (management, persistence, APIs).
   - C++ AI Engine acts as the real-time plane (inference, stream processing).
2. **One-Way Data Flow (Events)**:
   - Events stream predominantly from AI Engine -> Control Plane.
3. **Control Flow**:
   - Configuration flows from Control Plane -> AI Engine.

## Contract Stability Rules
To ensure long-term stability and forward compatibility:

1. **Additive Changes Only**:
   - New fields may be added as `optional`.
   - Existing fields must NEVER be renumbered or repurposed.

2. **Field Deprecation**:
   - If a field is removed, its field number must be `reserved` to prevent reuse.
   - Example: `reserved 10; // former field_name`

3. **Field Numbering**:
   - **1-99**: Core standard fields.
   - **100-199**: Reserved for future standard fields.
   - **200-299**: Reserved for vendor/custom extensions.

4. **Flexible Metadata**:
   - The `metadata_json` field is intentionally loosely typed to support rapid model evolution (e.g., adding new object classes, attributes, or tracking IDs) without requiring proto recompilation.

## Database Mapping Reference (Phase 5.4 Preview)
_Note: This mapping is for documentation purposes only. Ingestion is NOT implemented in Phase 5.1._

| Proto Field (`AiEvent`) | DB Column (`ai_events` table) | Type Info |
|-------------------------|-------------------------------|-----------|
| `event_id`              | `id`                          | UUID      |
| `camera_id`             | `camera_id`                   | UUID      |
| `event_type`            | `event_type`                  | TEXT      |
| `confidence`            | `confidence`                  | FLOAT     |
| `event_time_ms`         | `event_time`                  | TIMESTAMPTZ (convert ms to timestamp) |
| `metadata_json`         | `metadata`                    | JSONB     |

*Note: The `status` column in `ai_events` defaults to `PENDING` (or similar) upon ingestion, unless explicitly handled otherwise.*

## Phase 5.1 Scope
**Included:**
- [x] `ai_engine.proto` definition
- [x] Contract stability documentation
- [x] Proto validation script (`validate_ai_proto.js`)

**Excluded (Out of Scope):**
- C++ Server Implementation
- Node.js Client Implementation
- Event Ingestion / Background Jobs
- DB Schema Migrations
- Inference / ONNX Runtime
- WebRTC Streaming
