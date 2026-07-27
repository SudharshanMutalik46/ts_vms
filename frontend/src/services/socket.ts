/**
 * Socket Service
 * WebSocket connection for real-time AI events
 */

import { io, Socket } from 'socket.io-client'
import type { AIEvent } from '../types'

let socket: Socket | null = null

export function initSocket(token: string): Socket {
    if (socket?.connected) {
        return socket
    }

    socket = io('/', {
        auth: { token },
        transports: ['websocket', 'polling'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 5000,
    })

    socket.on('connect', () => {
        console.log('[Socket] Connected:', socket?.id)
    })

    socket.on('disconnect', (reason) => {
        console.log('[Socket] Disconnected:', reason)
    })

    socket.on('connect_error', (error) => {
        console.error('[Socket] Connection error:', error.message)
    })

    return socket
}

export function getSocket(): Socket | null {
    return socket
}

export function disconnectSocket(): void {
    if (socket) {
        socket.disconnect()
        socket = null
    }
}

// Event subscription helpers
export function onAIEvent(callback: (event: AIEvent) => void): () => void {
    if (!socket) {
        console.warn('[Socket] Not connected, cannot subscribe to events')
        return () => { }
    }

    socket.on('ai_event', callback)
    return () => socket?.off('ai_event', callback)
}

export function onCameraStatus(
    callback: (data: { cameraId: string; status: string }) => void
): () => void {
    if (!socket) return () => { }

    socket.on('camera_status', callback)
    return () => socket?.off('camera_status', callback)
}
