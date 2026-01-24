-- =============================================================================
-- Migration: Add Camera AI Features Junction Table
-- Created: 2026-01-03
-- Description: Maps AI features to cameras with configuration status
-- =============================================================================

-- =============================================================================
-- CAMERA AI FEATURES JUNCTION TABLE
-- =============================================================================
CREATE TABLE camera_ai_features (
    camera_id UUID NOT NULL REFERENCES cameras(id) ON DELETE CASCADE,
    ai_feature_id UUID NOT NULL REFERENCES ai_features(id) ON DELETE CASCADE,
    is_enabled BOOLEAN DEFAULT TRUE,
    configured_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (camera_id, ai_feature_id)
);

-- =============================================================================
-- INDEXES
-- =============================================================================
-- Index for looking up all features for a camera
CREATE INDEX idx_camera_ai_features_camera ON camera_ai_features(camera_id);

-- Index for looking up all cameras using a specific feature
CREATE INDEX idx_camera_ai_features_feature ON camera_ai_features(ai_feature_id);

-- Index for filtering enabled/disabled features
CREATE INDEX idx_camera_ai_features_enabled ON camera_ai_features(is_enabled) WHERE is_enabled = TRUE;

-- =============================================================================
-- COMMENTS
-- =============================================================================
COMMENT ON TABLE camera_ai_features IS 'Junction table mapping AI features to cameras';
COMMENT ON COLUMN camera_ai_features.camera_id IS 'FK to cameras table';
COMMENT ON COLUMN camera_ai_features.ai_feature_id IS 'FK to ai_features table';
COMMENT ON COLUMN camera_ai_features.is_enabled IS 'Whether this AI feature is currently active on the camera';
COMMENT ON COLUMN camera_ai_features.configured_at IS 'Timestamp when feature was assigned to camera';
