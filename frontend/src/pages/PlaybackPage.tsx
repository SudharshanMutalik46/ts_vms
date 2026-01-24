import { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Play, Calendar, Clock, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react'
import * as api from '../services/api'
import type { Recording, Camera } from '../types'
// import HlsPlayer from '../components/HlsPlayer'

export default function PlaybackPage() {
    const [searchParams] = useSearchParams()
    const [recordings, setRecordings] = useState<Recording[]>([])
    const [cameras, setCameras] = useState<Camera[]>([])
    const [loading, setLoading] = useState(true)
    const [selectedRecording, setSelectedRecording] = useState<Recording | null>(null)
    const [selectedCamera, setSelectedCamera] = useState<string>('')

    const eventId = searchParams.get('event_id')
    const cameraId = searchParams.get('camera_id')

    useEffect(() => {
        loadCameras()
    }, [])

    useEffect(() => {
        if (cameraId) {
            setSelectedCamera(cameraId)
        }
    }, [cameraId])

    useEffect(() => {
        loadRecordings()
    }, [selectedCamera])

    const loadCameras = async () => {
        try {
            const data = await api.listCameras()
            setCameras(data)
        } catch (err) {
            console.error('Failed to load cameras:', err)
        }
    }

    const loadRecordings = async () => {
        setLoading(true)
        try {
            const result = await api.listRecordings({
                camera_id: selectedCamera || undefined,
                limit: 50,
            })
            setRecordings(result.data)

            // Auto-select first if coming from event
            if (result.data.length > 0 && !selectedRecording) {
                setSelectedRecording(result.data[0])
            }
        } catch (err) {
            console.error('Failed to load recordings:', err)
        } finally {
            setLoading(false)
        }
    }

    const formatDuration = (seconds?: number) => {
        if (!seconds) return '--:--'
        const mins = Math.floor(seconds / 60)
        const secs = Math.floor(seconds % 60)
        return `${mins}:${secs.toString().padStart(2, '0')}`
    }

    const formatTime = (dateStr: string) => {
        return new Date(dateStr).toLocaleString()
    }

    const [deleteId, setDeleteId] = useState<string | null>(null)

    const handleDeleteClick = (id: string, e: React.MouseEvent) => {
        e.stopPropagation()
        setDeleteId(id)
    }

    const confirmDelete = async () => {
        if (!deleteId) return

        try {
            await api.deleteRecording(deleteId)
            setRecordings(prev => prev.filter(r => r.id !== deleteId))
            if (selectedRecording?.id === deleteId) setSelectedRecording(null)
        } catch (err) {
            console.error('Failed to delete:', err)
        } finally {
            setDeleteId(null)
        }
    }

    return (
        <div className="h-full flex flex-col gap-4 relative">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-xl font-bold text-white flex items-center gap-2">
                        <Play className="w-5 h-5 text-techno-500" />
                        Playback
                    </h1>
                    <p className="text-sm text-stone-400 mt-1">Review recorded footage</p>
                </div>

                <div className="flex items-center gap-3">
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
                </div>
            </div>

            <div className="flex-1 flex gap-4 min-h-0">
                {/* Recording List */}
                <div className="w-80 bg-stone-900 border border-stone-800 rounded-xl overflow-hidden flex flex-col">
                    <div className="p-3 border-b border-stone-800">
                        <h3 className="font-medium text-stone-300">Recordings</h3>
                    </div>

                    {loading ? (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="w-6 h-6 border-2 border-techno-600 border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : recordings.length === 0 ? (
                        <div className="flex-1 flex items-center justify-center text-center p-4">
                            <div>
                                <Calendar className="w-10 h-10 text-stone-600 mx-auto mb-2" />
                                <p className="text-sm text-stone-500">No recordings found</p>
                            </div>
                        </div>
                    ) : (
                        <div className="flex-1 overflow-y-auto">
                            {recordings.map((rec) => (
                                <button
                                    key={rec.id}
                                    onClick={() => setSelectedRecording(rec)}
                                    className={`w-full p-3 text-left border-b border-stone-800 hover:bg-stone-800/50 transition-colors ${selectedRecording?.id === rec.id ? 'bg-techno-600/10 border-l-2 border-l-techno-600' : ''
                                        }`}
                                >
                                    <div className="font-medium text-sm text-white truncate">
                                        {rec.camera_name || `Camera ${rec.camera_id}`}
                                    </div>
                                    <div className="flex items-center gap-2 mt-1 text-xs text-stone-400">
                                        <Clock className="w-3 h-3" />
                                        <span>{formatTime(rec.start_time)}</span>
                                    </div>
                                    <div className="flex items-center justify-between mt-1">
                                        <div className="text-xs text-stone-500">
                                            Duration: {formatDuration(rec.duration_seconds)}
                                        </div>
                                        <button
                                            onClick={(e) => handleDeleteClick(rec.id, e)}
                                            className="p-1 hover:bg-red-500/20 rounded text-stone-500 hover:text-red-500 transition-colors"
                                            title="Delete Recording"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {/* Video Player */}
                <div className="flex-1 bg-stone-900 border border-stone-800 rounded-xl overflow-hidden flex flex-col">
                    {selectedRecording ? (
                        <>
                            <div className="flex-1 bg-black relative">
                                <video
                                    src={`${api.getPlaybackStreamUrl(selectedRecording.id)}?token=${localStorage.getItem('vms_token')}`}
                                    className="w-full h-full object-contain"
                                    autoPlay
                                    controls
                                    playsInline
                                />
                            </div>
                            <div className="p-4 border-t border-stone-800">
                                <h3 className="font-bold text-white">
                                    {selectedRecording.camera_name || `Camera ${selectedRecording.camera_id}`}
                                </h3>
                                <p className="text-sm text-stone-400 mt-1">
                                    {formatTime(selectedRecording.start_time)}
                                    {selectedRecording.end_time && ` - ${formatTime(selectedRecording.end_time)}`}
                                </p>
                            </div>
                        </>
                    ) : (
                        <div className="flex-1 flex items-center justify-center">
                            <div className="text-center">
                                <Play className="w-12 h-12 text-stone-600 mx-auto mb-4" />
                                <h3 className="text-lg font-medium text-stone-400">Select a Recording</h3>
                                <p className="text-sm text-stone-500">
                                    Choose a recording from the list to start playback.
                                </p>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* Custom Delete Confirmation Modal */}
            {deleteId && (
                <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                    <div className="bg-stone-900 border border-stone-800 rounded-xl p-6 shadow-2xl max-w-sm w-full mx-4 animate-in fade-in zoom-in duration-200">
                        <h3 className="text-lg font-bold text-white mb-2">Delete Recording?</h3>
                        <p className="text-sm text-stone-400 mb-6">
                            This action cannot be undone. The video file will be permanently removed.
                        </p>
                        <div className="flex justify-end gap-3">
                            <button
                                onClick={() => setDeleteId(null)}
                                className="px-4 py-2 rounded-lg text-sm font-medium text-stone-300 hover:text-white hover:bg-stone-800 transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="px-4 py-2 rounded-lg text-sm font-medium bg-red-600 text-white hover:bg-red-700 transition-colors shadow-lg shadow-red-900/20"
                            >
                                Delete Forever
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
