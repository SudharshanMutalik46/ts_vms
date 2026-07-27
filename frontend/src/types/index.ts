// User types
export type UserRole = 'ADMIN' | 'OPERATOR' | 'VIEWER';

export interface User {
    id: string;
    email: string;
    name: string;
    role: UserRole;
}

export interface AuthState {
    user: User | null;
    token: string | null;
    isAuthenticated: boolean;
    isLoading: boolean;
}

// Camera types
export type CameraStatus = 'ONLINE' | 'OFFLINE' | 'RECORDING' | 'ERROR';

export interface Camera {
    id: string;
    name: string;
    type: 'RTSP' | 'HTTP' | 'ONVIF';
    stream_url: string;
    stream_path?: string; // Derived path for backend compatibility
    ip_address?: string;
    port?: number;
    username?: string;
    password?: string;
    location?: string;
    status: CameraStatus;
    thumbnail_url?: string;
    ai_enabled: boolean;
    confidence_threshold?: number;
    roi_points?: { x: number; y: number }[];
    dwell_time_seconds?: number;
    zone_id?: string;
    created_at?: string;
    updated_at?: string;
}

// AI Event types
export type AIEventType =
    | 'person_intrusion'
    | 'person_dwell'
    | 'person_entry'
    | 'person_exit'
    | 'vehicle_detected'
    | 'motion_detected';

export type AIEventStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

export interface AIEvent {
    id: string;
    camera_id: string;
    camera_name?: string;
    event_type: AIEventType;
    confidence: number;
    event_time: string;
    status: AIEventStatus;
    metadata?: Record<string, unknown>;
    snapshot_url?: string;
    clip_url?: string;
    created_at: string;
}

// Recording types
export interface Recording {
    id: string;
    camera_id: string;
    camera_name?: string;
    start_time: string;
    end_time?: string;
    duration_seconds?: number;
    file_path: string;
    file_size_bytes?: number;
    status: 'RECORDING' | 'COMPLETED' | 'FAILED';
}

// Zone / ROI types
export interface Point {
    x: number;
    y: number;
}

export interface Zone {
    id: string;
    name: string;
    camera_id: string;
    polygon: Point[];
    rule_type: 'INTRUSION' | 'DWELL' | 'TRIPWIRE';
    config: {
        dwell_time_ms?: number;
        confidence_threshold?: number;
        enabled: boolean;
    };
}

// Storage types
export interface StorageStatus {
    total_bytes: number;
    used_bytes: number;
    free_bytes: number;
    usage_percent: number;
}

// API Response types
export interface ApiResponse<T> {
    data?: T;
    error?: string;
    message?: string;
}

export interface PaginatedResponse<T> {
    data: T[];
    total: number;
    limit: number;
    offset: number;
}
