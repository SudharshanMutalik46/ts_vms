-- =============================================================================
-- EXTENSIONS
-- =============================================================================
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "timescaledb";

-- =============================================================================
-- GLOBAL updated_at AUTO-UPDATE FUNCTION
-- =============================================================================
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- CAMERA STATUS ENUM
-- =============================================================================
CREATE TYPE camera_status AS ENUM (
    'ONLINE',
    'OFFLINE',
    'DISABLED',
    'ERROR'
);

-- =============================================================================
-- 1. USERS
-- =============================================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(100) UNIQUE NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL, -- bcrypt hash only
    full_name VARCHAR(255),
    is_active BOOLEAN DEFAULT TRUE,
    last_login_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER trg_users_updated
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- 2. ROLES
-- =============================================================================
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(50) UNIQUE NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER trg_roles_updated
BEFORE UPDATE ON roles
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =============================================================================
-- 3. USER ROLES
-- =============================================================================
CREATE TABLE user_roles (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    granted_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, role_id)
);

-- =============================================================================
-- 4. CAMERAS (SECURE VERSION)
-- =============================================================================
CREATE TABLE cameras (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    ip_address INET NOT NULL,
    port INTEGER DEFAULT 554,
    stream_path TEXT NOT NULL, -- RTSP path ONLY (no credentials)
    location VARCHAR(255),
    status camera_status DEFAULT 'OFFLINE',
    manufacturer VARCHAR(100),
    model VARCHAR(100),
    firmware_version VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TRIGGER trg_cameras_updated
BEFORE UPDATE ON cameras
FOR EACH ROW EXECUTE FUNCTION set_updated_at();

CREATE INDEX idx_cameras_status ON cameras(status);

-- =============================================================================
-- 5. CAMERA CREDENTIALS
-- =============================================================================
CREATE TABLE camera_credentials (
    camera_id UUID PRIMARY KEY REFERENCES cameras(id) ON DELETE CASCADE,
    username VARCHAR(100),
    encrypted_password TEXT, -- AES-256 encrypted
    auth_type VARCHAR(50) DEFAULT 'DIGEST',
    rotated_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_camera_credentials_camera ON camera_credentials(camera_id);

-- =============================================================================
-- 6. LICENSES
-- =============================================================================
CREATE TABLE licenses (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    license_key VARCHAR(255) UNIQUE NOT NULL,
    customer_name VARCHAR(255) NOT NULL,
    max_cameras INTEGER DEFAULT 0,
    features JSONB DEFAULT '{}',
    issued_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ,
    is_active BOOLEAN DEFAULT TRUE
);

-- =============================================================================
-- LICENSE ↔ CAMERA ASSIGNMENT
-- =============================================================================
CREATE TABLE license_assignments (
    license_id UUID REFERENCES licenses(id) ON DELETE CASCADE,
    camera_id UUID REFERENCES cameras(id) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (license_id, camera_id)
);

-- =============================================================================
-- 7. EVENTS (TIMESCALEDB HYPERTABLE)
-- =============================================================================
CREATE TABLE events (
    time TIMESTAMPTZ NOT NULL,
    id UUID DEFAULT uuid_generate_v4(),
    camera_id UUID REFERENCES cameras(id) ON DELETE SET NULL,
    type VARCHAR(100) NOT NULL,
    severity VARCHAR(50) DEFAULT 'INFO',
    confidence FLOAT,
    metadata JSONB,
    snapshot_path TEXT,
    video_clip_path TEXT
);

-- Timescale hypertable
SELECT create_hypertable('events', 'time');

-- Ensure API-friendly unique ID
ALTER TABLE events
ADD CONSTRAINT events_id_unique UNIQUE (id);

-- Indexes
CREATE INDEX idx_events_camera_time ON events (camera_id, time DESC);
CREATE INDEX idx_events_type_time ON events (type, time DESC);
CREATE INDEX idx_events_metadata ON events USING GIN (metadata);

-- =============================================================================
-- 8. AUDIT LOGS (IMMUTABLE)
-- =============================================================================
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(255) NOT NULL,
    resource_type VARCHAR(100),
    resource_id UUID,
    ip_address INET,
    details JSONB,
    performed_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_audit_logs_user_date
ON audit_logs (user_id, performed_at DESC);

-- Prevent UPDATE / DELETE on audit logs
CREATE OR REPLACE FUNCTION prevent_audit_updates()
RETURNS TRIGGER AS $$
BEGIN
    RAISE EXCEPTION 'Audit logs are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_logs_immutable
BEFORE UPDATE OR DELETE ON audit_logs
FOR EACH ROW EXECUTE FUNCTION prevent_audit_updates();
