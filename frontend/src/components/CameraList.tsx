import { useState, useEffect } from 'react'
import { Plus, Edit2, Trash2, Activity, Video, Brain } from 'lucide-react'
import type { Camera } from '../types'
import * as api from '../services/api'
import AIConfigModal from './AIConfigModal'

interface CameraListProps {
    onEdit: (camera: Camera) => void
    onAdd: () => void
}

export default function CameraList({ onEdit, onAdd }: CameraListProps) {
    const [cameras, setCameras] = useState<Camera[]>([])
    const [loading, setLoading] = useState(true)
    const [checking, setChecking] = useState<string | null>(null)
    const [aiConfigCamera, setAiConfigCamera] = useState<Camera | null>(null)

    useEffect(() => {
        loadCameras()
    }, [])

    const loadCameras = async () => {
        try {
            setLoading(true)
            const data = await api.listCameras()
            setCameras(data)
        } catch (err) {
            console.error('Failed to load cameras', err)
        } finally {
            setLoading(false)
        }
    }

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this camera?')) return

        try {
            await api.deleteCamera(id)
            setCameras(cameras.filter((c) => c.id !== id))
        } catch (err) {
            alert('Failed to delete camera')
        }
    }

    const handleHealthCheck = async (id: string, e: React.MouseEvent) => {
        e.stopPropagation()
        setChecking(id)
        try {
            const result = await api.checkCameraHealth(id)
            setCameras(cameras.map(c =>
                c.id === id ? { ...c, status: result.status } : c
            ))
            alert(`Camera is ${result.status}`)
        } catch (err) {
            alert('Health check failed')
        } finally {
            setChecking(null)
        }
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center p-12 text-stone-500">
                <Activity className="w-6 h-6 animate-pulse mr-2" />
                Loading cameras...
            </div>
        )
    }

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                    <Video className="w-5 h-5 text-techno-500" />
                    Configured Cameras
                </h2>
                <button
                    onClick={onAdd}
                    className="flex items-center gap-2 px-3 py-1.5 bg-techno-600 hover:bg-techno-500 text-white rounded-lg text-sm font-medium transition-colors"
                >
                    <Plus className="w-4 h-4" />
                    Add New Camera
                </button>
            </div>

            <div className="bg-stone-900 border border-stone-800 rounded-xl overflow-hidden">
                {cameras.length === 0 ? (
                    <div className="p-8 text-center">
                        <div className="w-12 h-12 rounded-full bg-stone-800 flex items-center justify-center mx-auto mb-3">
                            <Video className="w-6 h-6 text-stone-600" />
                        </div>
                        <p className="text-stone-400 text-sm">No cameras configured yet.</p>
                        <p className="text-stone-500 text-xs mt-1">Click "Add New Camera" to get started.</p>
                    </div>
                ) : (
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="border-b border-stone-800 text-stone-500 text-xs uppercase tracking-wider bg-stone-950/50">
                                <th className="p-4 font-medium">Status</th>
                                <th className="p-4 font-medium">Name</th>
                                <th className="p-4 font-medium">Type</th>
                                <th className="p-4 font-medium">AI Status</th>
                                <th className="p-4 font-medium text-right">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-800">
                            {cameras.map((camera) => (
                                <tr key={camera.id} className="group hover:bg-stone-800/50 transition-colors">
                                    <td className="p-4">
                                        <span
                                            className={`inline-flex items-center gap-1.5 px-2 py-1 rounded text-xs font-medium border ${camera.status === 'ONLINE'
                                                ? 'bg-green-500/10 text-green-500 border-green-500/20'
                                                : camera.status === 'RECORDING'
                                                    ? 'bg-red-500/10 text-red-500 border-red-500/20'
                                                    : 'bg-stone-800 text-stone-400 border-stone-700'
                                                }`}
                                        >
                                            <span
                                                className={`w-1.5 h-1.5 rounded-full ${camera.status === 'ONLINE' || camera.status === 'RECORDING'
                                                    ? 'bg-current animate-pulse'
                                                    : 'bg-stone-500'
                                                    }`}
                                            />
                                            {camera.status}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        <div className="font-medium text-stone-200">{camera.name}</div>
                                        <div className="text-xs text-stone-500 truncate max-w-[150px]">{camera.stream_url}</div>
                                    </td>
                                    <td className="p-4 text-sm text-stone-400">{camera.type}</td>
                                    <td className="p-4 text-sm">
                                        {camera.ai_enabled ? (
                                            <span className="text-techno-400 flex items-center gap-1 text-xs">
                                                <Brain className="w-3 h-3" /> Enabled
                                            </span>
                                        ) : (
                                            <span className="text-stone-600 text-xs">Disabled</span>
                                        )}
                                    </td>
                                    <td className="p-4 text-right">
                                        <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">

                                            <button
                                                onClick={(e) => handleHealthCheck(camera.id, e)}
                                                className={`p-1.5 rounded-md hover:bg-stone-700 text-stone-400 hover:text-white transition-colors ${checking === camera.id ? 'animate-spin text-techno-500' : ''
                                                    }`}
                                                title="Check connection"
                                            >
                                                <Activity className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => onEdit(camera)}
                                                className="p-1.5 rounded-md hover:bg-stone-700 text-stone-400 hover:text-blue-400 transition-colors"
                                                title="Edit camera"
                                            >
                                                <Edit2 className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(camera.id)}
                                                className="p-1.5 rounded-md hover:bg-stone-700 text-stone-400 hover:text-red-400 transition-colors"
                                                title="Delete camera"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* AI Config Modal */}
            {aiConfigCamera && (
                <AIConfigModal
                    camera={aiConfigCamera}
                    isOpen={!!aiConfigCamera}
                    onClose={() => setAiConfigCamera(null)}
                    onSave={() => {
                        loadCameras() // Refresh list to update status
                        // Don't close immediately, let modal handle success
                    }}
                />
            )}
        </div>
    )
}
