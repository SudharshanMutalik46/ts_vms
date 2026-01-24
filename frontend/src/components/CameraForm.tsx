import { useState, useEffect, FormEvent } from 'react'
import { X, Save, Video, Globe, MapPin, CheckCircle, AlertTriangle, Radio, RefreshCw } from 'lucide-react'
import type { Camera } from '../types'
import * as api from '../services/api'
// import HlsPlayer from './HlsPlayer'
import FlvPlayer from './FlvPlayer'

interface CameraFormProps {
    camera?: Camera
    onSave: () => void
    onCancel: () => void
}

export default function CameraForm({ camera, onSave, onCancel }: CameraFormProps) {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)

    // Connection Test States
    const [connectionStatus, setConnectionStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle')
    const [connectionMessage, setConnectionMessage] = useState('')
    const [previewId, setPreviewId] = useState<string | null>(null)

    const [formData, setFormData] = useState({
        name: '',
        type: 'RTSP',
        stream_url: '',
        ip_address: '',
        port: 554,
        username: '',
        password: '',
        location: '',
        zone_id: '',
        stream_path: ''
    })

    // Initialize form if editing
    useEffect(() => {
        if (camera) {
            setFormData({
                name: camera.name,
                type: camera.type,
                stream_url: camera.stream_url,
                ip_address: camera.ip_address || '', // Keep existing IP
                port: camera.port || 554,
                username: camera.username || '',
                password: '', // Don't show existing password
                location: camera.location || '',
                zone_id: camera.zone_id || '',
                stream_path: camera.stream_path || ''
            })
        }
    }, [camera])

    // Cleanup preview on unmount
    useEffect(() => {
        return () => {
            if (previewId && !camera) { // Only delete if it was a new temp camera
                // We can't easily wait for this, but we should try. 
                // Best effort cleanup handled in handleCancel usually.
            }
        }
    }, [previewId, camera])

    // Auto-parse RTSP URL
    useEffect(() => {
        if (!formData.stream_url) return

        // IP BUG FIX: Don't overwrite IP if it matches what was loaded from the camera
        if (camera && formData.stream_url === camera.stream_url) {
            return
        }

        try {
            // Basic RTSP URL parsing: rtsp://user:pass@ip:port/path
            const urlPattern = /rtsp:\/\/(?:([^:@]+)(?::([^@]+))?@)?([^:\/]+)(?::(\d+))?(?:\/(.*))?/i
            const match = formData.stream_url.match(urlPattern)

            if (match) {
                const [, user, pass, ip, port, path] = match

                setFormData(prev => ({
                    ...prev,
                    username: (prev.username && prev.username !== '') ? prev.username : (user || ''),
                    password: (prev.password && prev.password !== '') ? prev.password : (pass || ''),
                    ip_address: (prev.ip_address && prev.ip_address !== '') ? prev.ip_address : (ip || ''), // Only set if empty
                    port: port ? parseInt(port) : (prev.port || 554),
                    stream_path: path ? `/${path}` : prev.stream_path
                }))
            }
        } catch (e) {
            // Ignore parsing errors while typing
        }
    }, [formData.stream_url, camera])

    // Reset status when url changes
    useEffect(() => {
        setConnectionStatus('idle')
        setConnectionMessage('')
        // If we had a preview running, ideally we should stop/clear it, but we'll wait for re-test
    }, [formData.stream_url, formData.username, formData.password, formData.ip_address, formData.port])

    const preparePayload = () => {
        const payload: any = {
            ...formData,
            port: Number(formData.port) || 554
        }

        if (!payload.stream_path && payload.stream_url) {
            try {
                const urlObj = new URL(payload.stream_url.startsWith('rtsp://') ? payload.stream_url.replace('rtsp://', 'http://') : payload.stream_url)
                payload.stream_path = urlObj.pathname
            } catch (e) {
                payload.stream_path = '/stream'
            }
        }

        if (!payload.ip_address) delete payload.ip_address
        if (!payload.username) delete payload.username
        if (!payload.location) delete payload.location
        if (!payload.zone_id) delete payload.zone_id
        if (!payload.stream_path) delete payload.stream_path

        return payload
    }

    const handleTestConnection = async () => {
        if (!formData.stream_url) {
            setError('Stream URL is required to test')
            return
        }

        setConnectionStatus('testing')
        setConnectionMessage('Probing RTSP stream...')
        setError(null)

        try {
            const payload = preparePayload()
            const result = await api.testConnection(payload)

            if (result.status === 'ONLINE' || result.message === 'Stream accessible') {
                setConnectionStatus('success')
                setConnectionMessage('Connection Successful!')

                // OPTIMISTIC PREVIEW: Create/Upd temp camera to start stream
                if (!previewId && !camera) {
                    setConnectionMessage('Connection Successful! initializing preview...')
                    const newCam = await api.createCamera(payload)
                    setPreviewId(newCam.id)
                    // Start stream
                    await api.startStream(newCam.id)
                } else if (camera) {
                    // Existing camera
                    await api.startStream(camera.id)
                }
            } else {
                setConnectionStatus('error')
                setConnectionMessage(result.message || 'Connection failed')
            }
        } catch (err: any) {
            setConnectionStatus('error')
            // Handle cases where err.message is a stringified object or generic error
            let msg = err.message || 'Verification failed'
            if (typeof msg === 'object') msg = JSON.stringify(msg)
            // Clean up common "Error: " prefix
            setConnectionMessage(msg.replace(/^Error: /, ''))
        }
    }

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()
        setLoading(true)
        setError(null)

        try {
            const payload = preparePayload()

            if (camera) {
                await api.updateCamera(camera.id, payload)
            } else if (previewId) {
                // If we already created a preview camera, just update it with final details 
                // (e.g. name might have changed after test)
                await api.updateCamera(previewId, payload)
            } else {
                await api.createCamera(payload)
            }
            onSave()
        } catch (err: any) {
            setError(err.message || 'Failed to save camera')
        } finally {
            setLoading(false)
        }
    }

    const handleCancelWrapped = async () => {
        if (previewId && !camera) {
            // Cleanup temp camera if user cancels
            try {
                await api.deleteCamera(previewId)
            } catch (e) { console.error('Failed to cleanup temp camera', e) }
        }
        onCancel()
    }

    return (
        <div className="bg-stone-900 border border-stone-800 rounded-xl p-6 relative">
            <div className="flex items-center justify-between mb-6 border-b border-stone-800 pb-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    {camera ? 'Edit Camera' : 'Add New Camera'}
                </h2>
                <button
                    onClick={handleCancelWrapped}
                    className="p-1 hover:bg-stone-800 rounded-full transition-colors text-stone-400"
                >
                    <X className="w-5 h-5" />
                </button>
            </div>

            {error && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4" />
                    {error}
                </div>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* FORM COLUMN */}
                <form id="camera-form" onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-4">
                        <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wider flex items-center gap-2">
                            <Video className="w-4 h-4" />
                            Stream Details
                        </h3>

                        <div>
                            <label className="block text-sm font-medium text-stone-300 mb-1">Camera Name</label>
                            <input
                                type="text"
                                required
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                className="w-full bg-stone-950 border border-stone-700 rounded-lg p-2.5 text-white focus:ring-2 focus:ring-techno-600 outline-none"
                                placeholder="Front Gate Camera"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-stone-300 mb-1">Stream URL</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    required
                                    value={formData.stream_url}
                                    onChange={e => setFormData({ ...formData, stream_url: e.target.value })}
                                    className="w-full bg-stone-950 border border-stone-700 rounded-lg p-2.5 text-white font-mono text-sm focus:ring-2 focus:ring-techno-600 outline-none"
                                    placeholder="rtsp://admin:pass@192.168.1.50:554/live"
                                />
                            </div>
                            <p className="text-xs text-stone-500 mt-1">Full RTSP URL.</p>
                        </div>
                    </div>

                    {/* Network & Auth */}
                    <div className="space-y-4">
                        <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wider flex items-center gap-2">
                            <Globe className="w-4 h-4" />
                            Network & Auth
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <input
                                type="text"
                                value={formData.ip_address}
                                onChange={e => setFormData({ ...formData, ip_address: e.target.value })}
                                className="bg-stone-950 border border-stone-700 rounded-lg p-2.5 text-white text-sm"
                                placeholder="IP Address"
                            />
                            <input
                                type="number"
                                value={formData.port}
                                onChange={e => setFormData({ ...formData, port: Number(e.target.value) })}
                                className="bg-stone-950 border border-stone-700 rounded-lg p-2.5 text-white text-sm"
                                placeholder="Port (554)"
                            />
                            <input
                                type="text"
                                value={formData.username}
                                onChange={e => setFormData({ ...formData, username: e.target.value })}
                                className="bg-stone-950 border border-stone-700 rounded-lg p-2.5 text-white text-sm"
                                placeholder="Username"
                            />
                            <input
                                type="password"
                                value={formData.password}
                                onChange={e => setFormData({ ...formData, password: e.target.value })}
                                className="bg-stone-950 border border-stone-700 rounded-lg p-2.5 text-white text-sm"
                                placeholder="Password"
                            />
                        </div>
                    </div>

                    <div className="pt-4 flex gap-4">
                        <button
                            type="button"
                            onClick={handleTestConnection}
                            disabled={connectionStatus === 'testing' || !formData.stream_url}
                            className={`flex-1 py-2.5 rounded-lg font-medium border flex items-center justify-center gap-2 transition-all ${connectionStatus === 'success'
                                ? 'bg-green-500/10 border-green-500/30 text-green-400'
                                : connectionStatus === 'error'
                                    ? 'bg-red-500/10 border-red-500/30 text-red-400'
                                    : 'bg-stone-800 border-stone-700 text-stone-300 hover:bg-stone-700'
                                }`}
                        >
                            {connectionStatus === 'testing' ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : connectionStatus === 'success' ? (
                                <CheckCircle className="w-4 h-4" />
                            ) : connectionStatus === 'error' ? (
                                <AlertTriangle className="w-4 h-4" />
                            ) : (
                                <Radio className="w-4 h-4" />
                            )}
                            {connectionStatus === 'testing' ? 'Testing...' : connectionStatus === 'success' ? 'Connection Verified' : 'Test Connection'}
                        </button>
                    </div>

                    {connectionMessage && (
                        <p className={`text-xs text-center ${connectionStatus === 'success' ? 'text-green-500' : connectionStatus === 'error' ? 'text-red-400' : 'text-stone-400'
                            }`}>
                            {connectionMessage}
                        </p>
                    )}
                </form>

                {/* VISUAL COLUMN (Preview) */}
                <div className="flex flex-col gap-6">
                    <div className="bg-black/40 rounded-xl overflow-hidden border border-stone-800 aspect-video relative flex items-center justify-center group">
                        {(previewId || (camera && connectionStatus === 'success')) ? (
                            <FlvPlayer
                                src={`${api.getFlvUrl(previewId || camera?.id || '')}?token=${localStorage.getItem('vms_token')}`}
                                className="w-full h-full"
                                autoPlay
                                muted
                            />
                        ) : (
                            <div className="text-center p-6">
                                <div className="w-16 h-16 rounded-full bg-stone-800 flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
                                    <Video className="w-8 h-8 text-stone-600" />
                                </div>
                                <h3 className="text-stone-400 font-medium">No Signal</h3>
                                <p className="text-stone-600 text-sm mt-1">Test connection to start preview</p>
                            </div>
                        )}

                        {connectionStatus === 'success' && (
                            <div className="absolute top-4 right-4 animate-pulse">
                                <div className="px-2 py-1 bg-green-500/80 backdrop-blur rounded text-[10px] font-bold text-white flex items-center gap-1.5">
                                    <div className="w-1.5 h-1.5 rounded-full bg-white" />
                                    LIVE PREVIEW
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Metadata Section */}
                    <div className="space-y-4">
                        <h3 className="text-xs font-semibold text-stone-500 uppercase tracking-wider flex items-center gap-2">
                            <MapPin className="w-4 h-4" />
                            Metadata
                        </h3>
                        <input
                            type="text"
                            value={formData.location}
                            onChange={e => setFormData({ ...formData, location: e.target.value })}
                            className="w-full bg-stone-950 border border-stone-700 rounded-lg p-2.5 text-white text-sm"
                            placeholder="Location (e.g. Main Lobby)"
                        />


                    </div>

                    <div className="mt-auto flex gap-3 pt-6 border-t border-stone-800">
                        <button
                            type="button"
                            onClick={handleCancelWrapped}
                            className="flex-1 py-3 bg-stone-800 hover:bg-stone-700 text-stone-300 rounded-xl font-medium transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            form="camera-form" // Link to form
                            disabled={loading || connectionStatus === 'testing'}
                            className="flex-[2] py-3 bg-techno-600 hover:bg-techno-500 disabled:opacity-50 text-white rounded-xl font-medium shadow-lg shadow-techno-600/20 flex items-center justify-center gap-2 transition-all"
                        >
                            {loading ? (
                                <RefreshCw className="w-4 h-4 animate-spin" />
                            ) : (
                                <Save className="w-4 h-4" />
                            )}
                            {loading ? 'Saving...' : 'Save Configuration'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    )
}
