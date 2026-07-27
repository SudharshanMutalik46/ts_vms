/**
 * API Service
 * Centralized API calls with JWT authentication
 */

import type { User, Camera, AIEvent, Recording, StorageStatus, PaginatedResponse } from '../types'

const API_BASE = '/api'

// Get stored auth token
const getToken = (): string | null => localStorage.getItem('vms_token')

// Create headers with auth token
const authHeaders = (): Headers => {
    const token = getToken()
    const headers = new Headers({
        'Content-Type': 'application/json',
    })
    if (token) {
        headers.set('Authorization', `Bearer ${token}`)
    }
    return headers
}

// Generic fetch wrapper with auto-refresh
async function fetchApi<T>(
    endpoint: string,
    options: RequestInit = {}
): Promise<T> {
    const makeRequest = async (token?: string) => {
        const headers = authHeaders()
        new Headers(options.headers).forEach((value, key) => headers.set(key, value))
        if (token) headers.set('Authorization', `Bearer ${token}`)

        return fetch(`${API_BASE}${endpoint}`, {
            ...options,
            headers
        })
    }

    let res = await makeRequest()

    // Handle Token Expiry (401)
    if (res.status === 401) {
        const token = await refreshToken()
        if (token) {
            // Update storage
            localStorage.setItem('vms_token', token.token)
            // Retry request
            res = await makeRequest(token.token)
        } else {
            // Refresh failed, user must login
            localStorage.removeItem('vms_token')
            localStorage.removeItem('vms_refresh_token')
            window.location.href = '/login'
            throw new Error('Session expired')
        }
    }

    if (!res.ok) {
        const errorBody = await res.json().catch(() => ({}))
        throw new Error(errorBody.error || `API error: ${res.status}`)
    }

    // Handle empty responses
    const text = await res.text()
    return text ? JSON.parse(text) : ({} as T)
}

// ========== AUTH ==========

export async function login(
    email: string,
    password: string
): Promise<{ user: User; accessToken: string; refreshToken?: string } | null> {
    try {
        return await fetchApi('/auth/login', {
            method: 'POST',
            body: JSON.stringify({ email, password }),
        })
    } catch {
        return null
    }
}

export async function refreshToken(): Promise<{ token: string } | null> {
    try {
        const refreshToken = localStorage.getItem('vms_refresh_token')
        if (!refreshToken) return null

        return await fetchApi('/auth/refresh', {
            method: 'POST',
            body: JSON.stringify({ refreshToken }),
        })
    } catch {
        return null
    }
}

// ========== CAMERAS ==========

export async function listCameras(): Promise<Camera[]> {
    const result = await fetchApi<{ cameras?: Camera[]; data?: Camera[] }>('/cameras')
    return result.cameras || result.data || []
}

export async function getCamera(id: string): Promise<Camera> {
    return fetchApi(`/cameras/${id}`)
}

export async function createCamera(data: Partial<Camera>): Promise<Camera> {
    return fetchApi('/cameras', {
        method: 'POST',
        body: JSON.stringify(data),
    })
}

export async function updateCamera(id: string, data: Partial<Camera>): Promise<Camera> {
    return fetchApi(`/cameras/${id}`, {
        method: 'PUT',
        body: JSON.stringify(data),
    })
}

export async function deleteCamera(id: string): Promise<void> {
    return fetchApi(`/cameras/${id}`, { method: 'DELETE' })
}

export async function checkCameraHealth(id: string): Promise<{ status: 'ONLINE' | 'OFFLINE'; last_check: string }> {
    return fetchApi(`/cameras/${id}/check`, { method: 'POST' })
}

export async function testConnection(data: Partial<Camera>): Promise<{ status: 'ONLINE' | 'ERROR'; message: string }> {
    return fetchApi('/cameras/test', {
        method: 'POST',
        body: JSON.stringify(data),
    })
}

export async function startStream(cameraId: string): Promise<{ hls_url: string }> {
    return fetchApi(`/cameras/${cameraId}/stream/start`, { method: 'POST' })
}

export async function stopStream(cameraId: string): Promise<void> {
    return fetchApi(`/cameras/${cameraId}/stream/stop`, { method: 'POST' })
}

export async function getStreamStatus(cameraId: string): Promise<{ active: boolean; url?: string }> {
    return fetchApi(`/cameras/${cameraId}/stream/status`)
}

// ========== AI EVENTS ==========

export interface ListEventsParams {
    limit?: number
    offset?: number
    camera_id?: string
    event_type?: string
    start_time?: string
    end_time?: string
}

export async function listAIEvents(
    params: ListEventsParams = {}
): Promise<PaginatedResponse<AIEvent>> {
    const query = new URLSearchParams()
    if (params.limit) query.set('limit', String(params.limit))
    if (params.offset) query.set('offset', String(params.offset))
    if (params.camera_id) query.set('camera_id', params.camera_id)
    if (params.event_type) query.set('event_type', params.event_type)
    if (params.start_time) query.set('start_time', params.start_time)
    if (params.end_time) query.set('end_time', params.end_time)

    const result = await fetchApi<{
        events?: AIEvent[]
        data?: AIEvent[]
        total?: number
        limit?: number
        offset?: number
    }>(`/ai/events?${query.toString()}`)

    return {
        data: result.events || result.data || [],
        total: result.total || 0,
        limit: result.limit || params.limit || 50,
        offset: result.offset || params.offset || 0,
    }
}

export async function getAIEvent(id: string): Promise<AIEvent> {
    return fetchApi(`/ai/events/${id}`)
}

export function getSnapshotUrl(eventId: string): string {
    return `${API_BASE}/ai/events/${eventId}/snapshot`
}

export function getClipUrl(eventId: string): string {
    return `${API_BASE}/ai/events/${eventId}/clip`
}

// ========== CAMERA AI FEATURES ==========

export async function getCameraFeatures(cameraId: string): Promise<{ code: string; enabled: boolean }[]> {
    const res = await fetchApi<{ features: any[] }>(`/cameras/${cameraId}/ai-features`)
    return res.features || []
}

export async function enableCameraFeature(cameraId: string, featureCode: string): Promise<void> {
    return fetchApi(`/cameras/${cameraId}/ai-features/enable`, {
        method: 'POST',
        body: JSON.stringify({ featureCode })
    })
}

export async function disableCameraFeature(cameraId: string, featureCode: string): Promise<void> {
    return fetchApi(`/cameras/${cameraId}/ai-features/disable`, {
        method: 'POST',
        body: JSON.stringify({ featureCode })
    })
}

// ========== PLAYBACK ==========

export interface ListRecordingsParams {
    camera_id?: string
    start_time?: string
    end_time?: string
    limit?: number
    offset?: number
}

export async function listRecordings(
    params: ListRecordingsParams = {}
): Promise<PaginatedResponse<Recording>> {
    const query = new URLSearchParams()
    if (params.camera_id) query.set('camera_id', params.camera_id)
    if (params.start_time) query.set('start_time', params.start_time)
    if (params.end_time) query.set('end_time', params.end_time)
    if (params.limit) query.set('limit', String(params.limit))
    if (params.offset) query.set('offset', String(params.offset))

    const result = await fetchApi<{
        recordings?: Recording[]
        data?: Recording[]
        total?: number
    }>(`/playback/recordings?${query.toString()}`)

    return {
        data: result.recordings || result.data || [],
        total: result.total || 0,
        limit: params.limit || 50,
        offset: params.offset || 0,
    }
}

export function getPlaybackStreamUrl(recordingId: string): string {
    return `${API_BASE}/playback/stream/${recordingId}`
}

export async function deleteRecording(id: string): Promise<void> {
    return fetchApi(`/playback/recordings/${id}`, { method: 'DELETE' })
}

// ========== STORAGE ==========

export async function getStorageStatus(): Promise<StorageStatus> {
    return fetchApi('/storage/status')
}

// ========== HLS ==========

export function getHlsUrl(cameraId: string): string {
    return `/streams/${cameraId}/index.m3u8`
}

export function getFlvUrl(cameraId: string): string {
    return `${API_BASE}/cameras/${cameraId}/preview.flv`
}
