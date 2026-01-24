import { useState, useEffect } from 'react'
import { Activity, HardDrive, Camera, Cpu, AlertTriangle, CheckCircle, XCircle } from 'lucide-react'
import * as api from '../services/api'
import type { Camera as CameraType, StorageStatus } from '../types'

export default function HealthPage() {
    const [cameras, setCameras] = useState<CameraType[]>([])
    const [storage, setStorage] = useState<StorageStatus | null>(null)
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    useEffect(() => {
        let mounted = true

        const loadData = async () => {
            try {
                // Safety timeout to prevent infinite loading
                const timeoutDetails = new Promise((_, reject) =>
                    setTimeout(() => reject(new Error('Request timed out')), 5000)
                )

                const fetchData = Promise.all([
                    api.listCameras().catch(err => {
                        console.error('Camera list failed', err)
                        return [] as CameraType[]
                    }),
                    api.getStorageStatus().catch(err => {
                        console.warn('Storage status failed', err)
                        return null
                    })
                ])

                const [cameraData, storageData] = await Promise.race([fetchData, timeoutDetails]) as [CameraType[], StorageStatus | null]

                if (mounted) {
                    setCameras(cameraData || [])
                    setStorage(storageData)
                    setLoading(false)
                }
            } catch (err) {
                console.error('Critical HealthPage error:', err)
                if (mounted) {
                    setError('System status unavailable')
                    setLoading(false)
                }
            }
        }

        loadData()

        return () => { mounted = false }
    }, [])

    const onlineCameras = cameras.filter((c) => c.status === 'ONLINE' || c.status === 'RECORDING') || []
    const offlineCameras = cameras.filter((c) => c.status === 'OFFLINE' || c.status === 'ERROR') || []

    const formatBytes = (bytes: number | undefined) => {
        if (typeof bytes !== 'number') return '--'
        const gb = bytes / (1024 * 1024 * 1024)
        return `${gb.toFixed(1)} GB`
    }

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-stone-500 gap-3">
                <div className="w-8 h-8 border-2 border-techno-600 border-t-transparent rounded-full animate-spin" />
                <p>Checking System Health...</p>
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex flex-col items-center justify-center h-full text-red-400 gap-3">
                <AlertTriangle className="w-12 h-12" />
                <p>{error}</p>
                <button
                    onClick={() => window.location.reload()}
                    className="px-4 py-2 bg-stone-800 rounded text-white hover:bg-stone-700"
                >
                    Retry
                </button>
            </div>
        )
    }

    return (
        <div className="h-full flex flex-col gap-6 overflow-y-auto">
            <div>
                <h1 className="text-xl font-bold text-white flex items-center gap-2">
                    <Activity className="w-5 h-5 text-techno-500" />
                    System Health
                </h1>
                <p className="text-sm text-stone-400 mt-1">Monitor system status and performance</p>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {/* Online Cameras */}
                <div className="bg-stone-900 border border-stone-800 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-3">
                        <Camera className="w-5 h-5 text-green-500" />
                        <CheckCircle className="w-4 h-4 text-green-500" />
                    </div>
                    <div className="text-3xl font-bold text-white">{onlineCameras.length}</div>
                    <div className="text-sm text-stone-400">Cameras Online</div>
                </div>

                {/* Offline Cameras */}
                <div className="bg-stone-900 border border-stone-800 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-3">
                        <Camera className="w-5 h-5 text-red-500" />
                        <XCircle className="w-4 h-4 text-red-500" />
                    </div>
                    <div className="text-3xl font-bold text-white">{offlineCameras.length}</div>
                    <div className="text-sm text-stone-400">Cameras Offline</div>
                </div>

                {/* Storage Used */}
                <div className="bg-stone-900 border border-stone-800 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-3">
                        <HardDrive className="w-5 h-5 text-blue-500" />
                        <span className="text-xs text-stone-400">
                            {storage?.usage_percent ? `${storage.usage_percent.toFixed(0)}%` : '--'}
                        </span>
                    </div>
                    <div className="text-3xl font-bold text-white">
                        {storage?.used_bytes ? formatBytes(storage.used_bytes) : '--'}
                    </div>
                    <div className="text-sm text-stone-400">Storage Used</div>
                    {storage?.usage_percent !== undefined && (
                        <div className="mt-2 h-2 bg-stone-800 rounded-full overflow-hidden">
                            <div
                                className={`h-full rounded-full ${storage.usage_percent > 90
                                    ? 'bg-red-500'
                                    : storage.usage_percent > 70
                                        ? 'bg-yellow-500'
                                        : 'bg-green-500'
                                    }`}
                                style={{ width: `${storage.usage_percent}%` }}
                            />
                        </div>
                    )}
                </div>

                {/* AI Engine */}
                <div className="bg-stone-900 border border-stone-800 rounded-xl p-5">
                    <div className="flex items-center justify-between mb-3">
                        <Cpu className="w-5 h-5 text-purple-500" />
                        <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                    </div>
                    <div className="text-3xl font-bold text-white">Active</div>
                    <div className="text-sm text-stone-400">AI Engine Status</div>
                </div>
            </div>

            {/* Camera Status List */}
            <div className="flex-1 bg-stone-900 border border-stone-800 rounded-xl overflow-hidden min-h-[300px]">
                <div className="p-4 border-b border-stone-800">
                    <h3 className="font-medium text-white">Camera Status Details</h3>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-stone-800/50">
                            <tr>
                                <th className="text-left px-4 py-3 text-xs font-medium text-stone-400 uppercase">Camera</th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-stone-400 uppercase">Location</th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-stone-400 uppercase">Status</th>
                                <th className="text-left px-4 py-3 text-xs font-medium text-stone-400 uppercase">AI</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-stone-800">
                            {cameras.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-4 py-8 text-center text-stone-500">
                                        No cameras found.
                                    </td>
                                </tr>
                            ) : (
                                cameras.map((camera) => (
                                    <tr key={camera.id} className="hover:bg-stone-800/30">
                                        <td className="px-4 py-3 text-sm font-medium text-white">{camera.name}</td>
                                        <td className="px-4 py-3 text-sm text-stone-400">{camera.location || 'N/A'}</td>
                                        <td className="px-4 py-3">
                                            <span
                                                className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium ${camera.status === 'ONLINE' || camera.status === 'RECORDING'
                                                    ? 'bg-green-500/10 text-green-400'
                                                    : camera.status === 'ERROR'
                                                        ? 'bg-red-500/10 text-red-400'
                                                        : 'bg-stone-700 text-stone-400'
                                                    }`}
                                            >
                                                <span
                                                    className={`w-1.5 h-1.5 rounded-full ${camera.status === 'ONLINE' || camera.status === 'RECORDING'
                                                        ? 'bg-green-400'
                                                        : camera.status === 'ERROR'
                                                            ? 'bg-red-400'
                                                            : 'bg-stone-400'
                                                        }`}
                                                />
                                                {camera.status}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3">
                                            {camera.ai_enabled ? (
                                                <CheckCircle className="w-4 h-4 text-techno-500" />
                                            ) : (
                                                <XCircle className="w-4 h-4 text-stone-600" />
                                            )}
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    )
}
