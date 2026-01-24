-- =============================================================================
-- Migration: Add AI Features Table
-- Created: 2026-01-03
-- Description: Stores AI feature definitions for the VMS system
-- =============================================================================

-- =============================================================================
-- AI FEATURES TABLE
-- =============================================================================
CREATE TABLE ai_features (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    code VARCHAR(50) UNIQUE NOT NULL,           -- e.g., MOTION, ANPR, FACE_RECOGNITION
    name VARCHAR(255) NOT NULL,                  -- Human readable name
    description TEXT,                            -- Detailed feature description
    is_premium BOOLEAN DEFAULT FALSE,            -- Premium feature flag
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================================================
-- INDEXES
-- =============================================================================
-- Index on code for fast lookups by feature code (already unique, creates implicit index)
-- Index on is_premium for filtering premium vs free features
CREATE INDEX idx_ai_features_is_premium ON ai_features(is_premium);

-- Composite index for common query pattern: find active premium features
CREATE INDEX idx_ai_features_premium_code ON ai_features(is_premium, code);

-- =============================================================================
-- COMMENTS
-- =============================================================================
COMMENT ON TABLE ai_features IS 'Stores AI feature definitions for the VMS system';
COMMENT ON COLUMN ai_features.id IS 'Unique identifier for the AI feature';
COMMENT ON COLUMN ai_features.code IS 'Unique code identifier (e.g., MOTION, ANPR, FACE_RECOGNITION)';
COMMENT ON COLUMN ai_features.name IS 'Human readable feature name';
COMMENT ON COLUMN ai_features.description IS 'Detailed description of the AI feature';
COMMENT ON COLUMN ai_features.is_premium IS 'Flag indicating if this is a premium feature';
COMMENT ON COLUMN ai_features.created_at IS 'Timestamp when the feature was created';

-- =============================================================================
-- SEED DATA (Common AI Features)
-- =============================================================================
INSERT INTO ai_features (code, name, description, is_premium) VALUES
    ('MOTION', 'Motion Detection', 'Detects movement in camera field of view', FALSE),
    ('ANPR', 'Automatic Number Plate Recognition', 'Reads and recognizes vehicle license plates', TRUE),
    ('FACE_RECOGNITION', 'Face Recognition', 'Identifies and matches faces against known database', TRUE),
    ('INTRUSION', 'Intrusion Detection', 'Detects unauthorized entry into defined zones', FALSE),
    ('LINE_CROSSING', 'Line Crossing Detection', 'Detects when objects cross a virtual line', FALSE),
    ('OBJECT_LEFT', 'Object Left Behind', 'Detects objects left unattended in a scene', TRUE),
    ('CROWD_DETECTION', 'Crowd Detection', 'Detects crowd formation and density', TRUE),
    ('FIRE_SMOKE', 'Fire & Smoke Detection', 'Detects fire and smoke in video feed', TRUE),
    ('PEOPLE_COUNTING', 'People Counting', 'Counts people entering and exiting areas', FALSE),
    ('HEAT_MAP', 'Heat Map Analytics', 'Generates movement heat maps for area analysis', TRUE);
