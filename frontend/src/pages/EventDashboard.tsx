import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Bell, RefreshCw, AlertTriangle } from 'lucide-react'
import * as api from '../services/api'
import { initSocket, onAIEvent, getSocket } from '../services/socket'
import { useAuth } from '../contexts/AuthContext'
import type { AIEvent, Camera as CameraType } from '../types'
import EventCard from '../components/EventCard'

export default function EventDashboard() {
    const [events, setEvents] = useState<AIEvent[]>([])
    const [cameras, setCameras] = useState<CameraType[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedCamera, setSelectedCamera] = useState<string>('')
    const [selectedType, setSelectedType] = useState<string>('')
    const { token } = useAuth()
    const navigate = useNavigate()

    // Load initial data
    useEffect(() => {
        loadCameras()
        loadEvents()
    }, [selectedCamera, selectedType])

    // Initialize WebSocket
    useEffect(() => {
        if (!token) return

        initSocket(token)

        const unsubscribe = onAIEvent((event) => {
            // Add new event to the top
            setEvents((prev) => [event, ...prev.slice(0, 99)])
        })

        return () => {
            unsubscribe()
        }
    }, [token])

    const loadCameras = async () => {
        try {
            const data = await api.listCameras()
            setCameras(data)
        } catch (err) {
            console.error('Failed to load cameras:', err)
        }
    }

    const loadEvents = async () => {
        setLoading(true)
        try {
            const result = await api.listAIEvents({
                limit: 50,
                camera_id: selectedCamera || undefined,
                event_type: selectedType || undefined,
            })
            setEvents(result.data)
        } catch (err) {
            console.error('Failed to load events:', err)
        } finally {
            setLoading(false)
        }
    }

    const handleEventClick = (event: AIEvent) => {
        navigate(`/playback?event_id=${event.id}&camera_id=${event.camera_id}`)
    }

    const eventTypes = [
        { value: '', label: 'All Types' },
        { value: 'person_intrusion', label: 'Person Intrusion' },
        { value: 'person_dwell', label: 'Person Dwell' },
        { value: 'person_entry', label: 'Person Entry' },
        { value: 'person_exit', label: 'Person Exit' },
        { value: 'vehicle_detected', label: 'Vehicle Detected' },
        { value: 'motion_detected', label: 'Motion Detected' },
    ]

    return (
        <div className="h-full flex flex-col gap-4">
            {/* Header */}
            <div className="flex items-center justify-between flex-wrap gap-4">
                <div>
                    <h1 className="text-xl font-bold text-white flex items-center gap-2">
                        <Bell className="w-5 h-5 text-techno-500" />
                        AI Events
                    </h1>
                    <p className="text-sm text-stone-400 mt-1">
                        Real-time detections from AI engine
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    {/* Camera Filter */}
                    <select
                        value={selectedCamera}
                        onChange={(e) => setSelectedCamera(e.target.value)}
                        className="bg-stone-900 border border-stone-700 rounded-lg px-3 py-2 text-sm text-stone-300 focus:outline-none focus:border-techno-600"
                    >
                        <option value="">All Cameras</option>
                        {cameras.map((cam) => (
                            <option key={cam.id} value={cam.id}>
                                {cam.name}
                            </option>
                        ))}
                    </select>

                    {/* Type Filter */}
                    <select
                        value={selectedType}
                        onChange={(e) => setSelectedType(e.target.value)}
                        className="bg-stone-900 border border-stone-700 rounded-lg px-3 py-2 text-sm text-stone-300 focus:outline-none focus:border-techno-600"
                    >
                        {eventTypes.map((type) => (
                            <option key={type.value} value={type.value}>
                                {type.label}
                            </option>
                        ))}
                    </select>

                    {/* Refresh */}
                    <button
                        onClick={loadEvents}
                        disabled={loading}
                        className="p-2 bg-stone-900 border border-stone-700 rounded-lg text-stone-400 hover:text-white hover:border-stone-600 disabled:opacity-50"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                    </button>
                </div>
            </div>

            {/* Connection Status */}
            <div className="flex items-center gap-2 text-sm">
                <div
                    className={`w-2 h-2 rounded-full ${getSocket()?.connected ? 'bg-green-500' : 'bg-yellow-500 animate-pulse'
                        }`}
                />
                <span className="text-stone-400">
                    {getSocket()?.connected ? 'Live updates active' : 'Connecting...'}
                </span>
            </div>

            {/* Events Grid */}
            {loading && events.length === 0 ? (
                <div className="flex-1 flex items-center justify-center">
                    <div className="w-8 h-8 border-2 border-techno-600 border-t-transparent rounded-full animate-spin" />
                </div>
            ) : events.length === 0 ? (
                <div className="flex-1 flex items-center justify-center border-2 border-dashed border-stone-800 rounded-xl">
                    <div className="text-center">
                        <AlertTriangle className="w-12 h-12 text-stone-600 mx-auto mb-4" />
                        <h3 className="text-lg font-medium text-stone-400">No Events</h3>
                        <p className="text-sm text-stone-500">
                            Events will appear here when detected by the AI engine.
                        </p>
                    </div>
                </div>
            ) : (
                <div className="flex-1 overflow-y-auto">
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                        {events.map((event) => (
                            <EventCard
                                key={event.id}
                                event={event}
                                onClick={() => handleEventClick(event)}
                            />
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
