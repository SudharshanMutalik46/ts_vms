-- =============================================================================
-- Migration: Add License AI Features Junction Table
-- Created: 2026-01-03
-- Description: Defines which AI features are allowed per license
-- =============================================================================

-- =============================================================================
-- LICENSE AI FEATURES JUNCTION TABLE
-- =============================================================================
CREATE TABLE license_ai_features (
    license_id UUID NOT NULL REFERENCES licenses(id) ON DELETE CASCADE,
    ai_feature_id UUID NOT NULL REFERENCES ai_features(id) ON DELETE CASCADE,
    allowed BOOLEAN DEFAULT TRUE,
    PRIMARY KEY (license_id, ai_feature_id)
);

-- =============================================================================
-- INDEXES
-- =============================================================================
-- Index for looking up all AI features for a license
CREATE INDEX idx_license_ai_features_license ON license_ai_features(license_id);

-- Index for looking up all licenses that include a specific feature
CREATE INDEX idx_license_ai_features_feature ON license_ai_features(ai_feature_id);

-- Index for filtering allowed features (partial index for efficiency)
CREATE INDEX idx_license_ai_features_allowed ON license_ai_features(license_id, allowed) WHERE allowed = TRUE;

-- =============================================================================
-- COMMENTS
-- =============================================================================
COMMENT ON TABLE license_ai_features IS 'Junction table defining which AI features are allowed per license';
COMMENT ON COLUMN license_ai_features.license_id IS 'FK to licenses table';
COMMENT ON COLUMN license_ai_features.ai_feature_id IS 'FK to ai_features table';
COMMENT ON COLUMN license_ai_features.allowed IS 'Whether this AI feature is allowed under this license';
