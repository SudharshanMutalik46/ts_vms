import { useState, useEffect } from 'react'
import { X, Save, Sliders, Shield, AlertTriangle, CheckCircle, RefreshCw } from 'lucide-react'
import type { Camera } from '../types'
import ROIEditor from './ROIEditor'
import * as api from '../services/api'
import FlvPlayer from './FlvPlayer'

interface AIConfigModalProps {
    camera: Camera
    isOpen: boolean
    onClose: () => void
    onSave: () => void
}

export default function AIConfigModal({ camera, isOpen, onClose, onSave }: AIConfigModalProps) {
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [success, setSuccess] = useState(false)

    // Local state for AI config
    const [aiEnabled, setAiEnabled] = useState(false)
    const [confidence, setConfidence] = useState(0.70)
    const [roiPoints, setRoiPoints] = useState<{ x: number; y: number }[]>([])
    const [dwellTime, setDwellTime] = useState(0)

    // Reset state when camera changes or modal opens
    useEffect(() => {
        if (camera && isOpen) {
            setAiEnabled(camera.ai_enabled || false)
            setConfidence(camera.confidence_threshold ?? 0.70)
            setRoiPoints(camera.roi_points || [])
            setDwellTime(camera.dwell_time_seconds ?? 0)
            setError(null)
            setSuccess(false)
        }
    }, [camera, isOpen])

    const handleSave = async () => {
        setLoading(true)
        setError(null)
        try {
            await api.updateCamera(camera.id, {
                ai_enabled: aiEnabled,
                confidence_threshold: confidence,
                roi_points: roiPoints,
                dwell_time_seconds: dwellTime
            })
            setSuccess(true)
            onSave()
            setTimeout(() => onClose(), 1000)
        } catch (err: any) {
            setError(err.message || 'Failed to save AI configuration')
        } finally {
            setLoading(false)
        }
    }

    if (!isOpen) return null

    return (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-stone-900 border border-stone-800 rounded-xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl">
                {/* Header */}
                <div className="p-6 border-b border-stone-800 flex items-center justify-between">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-3">
                            <Shield className="w-6 h-6 text-techno-500" />
                            AI Configuration: {camera.name}
                        </h2>
                        <p className="text-stone-400 text-sm mt-1">Configure detection zones and sensitivity</p>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-stone-800 rounded-lg text-stone-400 hover:text-white transition-colors">
                        <X className="w-6 h-6" />
                    </button>
                </div>

                {error && (
                    <div className="mx-6 mt-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 flex items-center gap-2">
                        <AlertTriangle className="w-5 h-5" />
                        {error}
                    </div>
                )}

                {success && (
                    <div className="mx-6 mt-6 p-4 bg-green-500/10 border border-green-500/20 rounded-lg text-green-400 flex items-center gap-2">
                        <CheckCircle className="w-5 h-5" />
                        Configuration saved successfully!
                    </div>
                )}

                <div className="flex-1 overflow-y-auto p-6 grid grid-cols-1 lg:grid-cols-3 gap-8">
                    {/* Left Column: Controls */}
                    <div className="space-y-6 lg:col-span-1">
                        {/* Enable Toggle */}
                        <div className="p-4 bg-stone-950 rounded-xl border border-stone-800">
                            <div className="flex items-center justify-between mb-2">
                                <label className="font-medium text-white">Enable AI Processing</label>
                                <button
                                    onClick={() => setAiEnabled(!aiEnabled)}
                                    className={`w-12 h-6 rounded-full relative transition-colors ${aiEnabled ? 'bg-techno-600' : 'bg-stone-700'}`}
                                >
                                    <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${aiEnabled ? 'left-7' : 'left-1'}`} />
                                </button>
                            </div>
                            <p className="text-xs text-stone-500">
                                When enabled, the system will analyze the video stream for objects and intrusions.
                            </p>
                        </div>

                        {/* Sliders */}
                        <div className={`space-y-6 transition-opacity duration-300 ${aiEnabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                            <div className="p-4 bg-stone-950 rounded-xl border border-stone-800">
                                <div className="flex items-center justify-between mb-3">
                                    <label className="text-sm font-medium text-stone-300 flex items-center gap-2">
                                        <Sliders className="w-4 h-4" />
                                        Confidence Threshold
                                    </label>
                                    <span className="text-sm font-mono text-techno-400 font-bold">
                                        {Math.round(confidence * 100)}%
                                    </span>
                                </div>
                                <input
                                    type="range"
                                    min="0"
                                    max="100"
                                    value={confidence * 100}
                                    onChange={(e) => setConfidence(Number(e.target.value) / 100)}
                                    className="w-full h-2 bg-stone-800 rounded-lg appearance-none cursor-pointer accent-techno-500 hover:accent-techno-400"
                                />
                                <p className="text-xs text-stone-500 mt-2">Filter out low-confidence detections.</p>
                            </div>

                            <div className="p-4 bg-stone-950 rounded-xl border border-stone-800">
                                <label className="text-sm font-medium text-stone-300 block mb-3">Dwell Time (Seconds)</label>
                                <div className="flex items-center gap-4">
                                    <input
                                        type="number"
                                        min="0"
                                        max="300"
                                        value={dwellTime}
                                        onChange={(e) => setDwellTime(Number(e.target.value))}
                                        className="w-20 bg-stone-900 border border-stone-700 rounded-lg p-2 text-white text-center font-mono"
                                    />
                                    <span className="text-sm text-stone-500">sec</span>
                                </div>
                                <p className="text-xs text-stone-500 mt-2">
                                    Minimum time an object must stay in the zone to trigger an alert.
                                </p>
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Visual Editor */}
                    <div className="lg:col-span-2 flex flex-col gap-4">
                        <div className="flex items-center justify-between">
                            <h3 className="text-lg font-medium text-white">Region of Interest (ROI)</h3>
                            <span className="text-xs text-stone-400 flex items-center gap-1">
                                <span className={`w-2 h-2 rounded-full ${aiEnabled ? 'bg-green-500' : 'bg-red-500'}`} />
                                {aiEnabled ? 'Live Preview Active' : 'AI Disabled'}
                            </span>
                        </div>

                        <div className="flex-1 bg-black rounded-xl border border-stone-800 overflow-hidden relative group">
                            {/* ROI Editor Layer */}
                            <div className="absolute inset-0 z-10">
                                <ROIEditor
                                    points={roiPoints}
                                    onChange={setRoiPoints}
                                    className="w-full h-full"
                                />
                            </div>

                            {/* Background Video Stream */}
                            <div className="absolute inset-0 z-0 opacity-60">
                                <FlvPlayer
                                    src={`${api.getFlvUrl(camera.id)}?token=${localStorage.getItem('vms_token')}`}
                                    className="w-full h-full object-contain"
                                    autoPlay
                                    muted
                                />
                            </div>
                        </div>
                        <p className="text-sm text-stone-500 text-center">
                            Draw a polygon around the area you want to monitor.
                        </p>
                    </div>
                </div>

                {/* Footer */}
                <div className="p-6 border-t border-stone-800 flex justify-end gap-3 bg-stone-900/50">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 rounded-xl font-medium text-stone-400 hover:text-white hover:bg-stone-800 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={loading}
                        className="px-6 py-2.5 bg-techno-600 hover:bg-techno-500 text-white rounded-xl font-medium shadow-lg shadow-techno-600/20 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        {loading ? 'Saving...' : 'Save Configuration'}
                    </button>
                </div>
            </div>
        </div>
    )
}
