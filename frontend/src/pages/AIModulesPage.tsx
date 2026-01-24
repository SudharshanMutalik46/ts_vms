import { useState, useEffect } from 'react'
import {
    Users,
    Activity,
    AlertTriangle,
    Shield,
    ParkingCircle,
    ScanFace,
    Flame,
    Car,
    UserX,
    Settings,
    X,
    Camera as CameraIcon,
    Loader2,
    MapPin,
    Sliders,
    Clock,
    Target,
    ChevronRight,
    RotateCcw,
    ArrowLeftRight,
    Trash2
} from 'lucide-react'
import { listCameras, enableCameraFeature, disableCameraFeature, updateCamera, getFlvUrl, startStream, getCameraFeatures } from '../services/api'
import type { Camera } from '../types'
import ROIEditor from '../components/ROIEditor'
import FlvPlayer from '../components/FlvPlayer'

interface AIModule {
    id: string
    name: string
    description: string
    icon: React.ReactNode
    color: string
    available: boolean
    featureCode: string
    thresholds: ThresholdConfig[]
}

interface ThresholdConfig {
    key: string
    label: string
    min: number
    max: number
    defaultValue: number
    unit: string
    description: string
}

interface Point {
    x: number
    y: number
}

const defaultModules: AIModule[] = [
    {
        id: 'people_counting',
        name: 'People Counting',
        description: 'Real-time crowd analysis and footfall counting.',
        icon: <Users className="w-6 h-6" />,
        color: 'techno',
        available: true,
        featureCode: 'PEOPLE_COUNTING',
        thresholds: [
            { key: 'confidence_threshold', label: 'Confidence Threshold', min: 0.3, max: 1.0, defaultValue: 0.7, unit: '%', description: 'Minimum detection confidence' },
            { key: 'min_count', label: 'Min Count Alert', min: 1, max: 100, defaultValue: 5, unit: 'people', description: 'Alert when count exceeds this' },
            { key: 'dwell_time', label: 'Dwell Time', min: 0, max: 300, defaultValue: 30, unit: 'sec', description: 'Minimum time in zone' }
        ]
    },
    {
        id: 'motion_detection',
        name: 'Motion Detection',
        description: 'Detects movement in static zones.',
        icon: <Activity className="w-6 h-6" />,
        color: 'techno',
        available: true,
        featureCode: 'MOTION',
        thresholds: [
            { key: 'sensitivity', label: 'Sensitivity', min: 0.1, max: 1.0, defaultValue: 0.5, unit: '%', description: 'Motion detection sensitivity' },
            { key: 'min_area', label: 'Min Motion Area', min: 1, max: 50, defaultValue: 5, unit: '%', description: 'Minimum area change to trigger' },
            { key: 'cooldown', label: 'Cooldown Period', min: 1, max: 60, defaultValue: 5, unit: 'sec', description: 'Time between alerts' }
        ]
    },
    {
        id: 'border_crossing',
        name: 'Border Crossing',
        description: 'Alerts when line boundaries are crossed.',
        icon: <AlertTriangle className="w-6 h-6" />,
        color: 'techno',
        available: true,
        featureCode: 'LINE_CROSSING',
        thresholds: [
            { key: 'confidence_threshold', label: 'Confidence Threshold', min: 0.3, max: 1.0, defaultValue: 0.7, unit: '%', description: 'Minimum detection confidence' },
            { key: 'direction', label: 'Direction Sensitivity', min: 0, max: 2, defaultValue: 0, unit: '', description: '0=Both, 1=In, 2=Out' }
        ]
    },
    {
        id: 'intrusion_detection',
        name: 'Intrusion Detection',
        description: 'Secure zone breach monitoring.',
        icon: <Shield className="w-6 h-6" />,
        color: 'techno',
        available: true,
        featureCode: 'INTRUSION',
        thresholds: [
            { key: 'confidence_threshold', label: 'Confidence Threshold', min: 0.3, max: 1.0, defaultValue: 0.75, unit: '%', description: 'Minimum detection confidence' },
            { key: 'dwell_time', label: 'Dwell Time', min: 0, max: 60, defaultValue: 3, unit: 'sec', description: 'Time before alert triggers' }
        ]
    },
    {
        id: 'illegal_parking',
        name: 'Illegal Parking',
        description: 'Detects unauthorized vehicle stops.',
        icon: <ParkingCircle className="w-6 h-6" />,
        color: 'techno',
        available: true,
        featureCode: 'ILLEGAL_PARKING',
        thresholds: [
            { key: 'confidence_threshold', label: 'Confidence Threshold', min: 0.3, max: 1.0, defaultValue: 0.7, unit: '%', description: 'Minimum detection confidence' },
            { key: 'dwell_time', label: 'Parking Duration', min: 10, max: 600, defaultValue: 120, unit: 'sec', description: 'Time before violation alert' }
        ]
    },
    {
        id: 'face_recognition',
        name: 'Face Recognition',
        description: 'Person tracking and identification.',
        icon: <ScanFace className="w-6 h-6" />,
        color: 'techno',
        available: true,
        featureCode: 'FACE_RECOGNITION',
        thresholds: [
            { key: 'confidence_threshold', label: 'Match Confidence', min: 0.5, max: 1.0, defaultValue: 0.85, unit: '%', description: 'Minimum face match confidence' },
            { key: 'min_face_size', label: 'Min Face Size', min: 20, max: 200, defaultValue: 50, unit: 'px', description: 'Minimum face pixel size' }
        ]
    },
    {
        id: 'fire_detection',
        name: 'Fire / Flame Detection',
        description: 'Detects fire-like colors and patterns.',
        icon: <Flame className="w-6 h-6" />,
        color: 'techno',
        available: true,
        featureCode: 'FIRE_SMOKE',
        thresholds: [
            { key: 'confidence_threshold', label: 'Confidence Threshold', min: 0.3, max: 1.0, defaultValue: 0.6, unit: '%', description: 'Minimum detection confidence' },
            { key: 'sensitivity', label: 'Sensitivity', min: 0.1, max: 1.0, defaultValue: 0.7, unit: '%', description: 'Fire/smoke detection sensitivity' }
        ]
    },
    {
        id: 'traffic_violations',
        name: 'Traffic Violations',
        description: 'Monitors vehicle movements in zones.',
        icon: <Car className="w-6 h-6" />,
        color: 'techno',
        available: true,
        featureCode: 'TRAFFIC_VIOLATION',
        thresholds: [
            { key: 'confidence_threshold', label: 'Confidence Threshold', min: 0.3, max: 1.0, defaultValue: 0.7, unit: '%', description: 'Minimum detection confidence' },
            { key: 'speed_threshold', label: 'Speed Limit', min: 10, max: 200, defaultValue: 60, unit: 'km/h', description: 'Speed violation threshold' }
        ]
    },
    {
        id: 'criminal_activity',
        name: 'Criminal Activity',
        description: 'Detects suspicious behavior patterns.',
        icon: <UserX className="w-6 h-6" />,
        color: 'techno',
        available: true,
        featureCode: 'CRIMINAL_ACTIVITY',
        thresholds: [
            { key: 'confidence_threshold', label: 'Confidence Threshold', min: 0.3, max: 1.0, defaultValue: 0.7, unit: '%', description: 'Minimum detection confidence' },
            { key: 'loitering_time', label: 'Loitering Time', min: 30, max: 600, defaultValue: 120, unit: 'sec', description: 'Time before loitering alert' }
        ]
    }
]

export default function AIModulesPage() {
    const [selectedModule, setSelectedModule] = useState<AIModule | null>(null)
    const [cameras, setCameras] = useState<Camera[]>([])
    const [loadingCameras, setLoadingCameras] = useState(false)
    // State: CameraID -> List of enabled feature codes
    const [cameraFeatures, setCameraFeatures] = useState<Record<string, string[]>>({})
    const [processing, setProcessing] = useState<string | null>(null)

    // Full Configuration Screen State
    const [showFullConfig, setShowFullConfig] = useState(false)
    const [configCamera, setConfigCamera] = useState<Camera | null>(null)
    const [roiPoints, setRoiPoints] = useState<Point[]>([])
    const [thresholdValues, setThresholdValues] = useState<Record<string, number>>({})
    const [saving, setSaving] = useState(false)

    // activeCounts state to show badge on cards
    const [activeCounts, setActiveCounts] = useState<Record<string, number>>({})

    useEffect(() => {
        // Fetch stats on mount
        fetchGlobalStats()
    }, [])

    useEffect(() => {
        if (selectedModule) {
            // Re-fetch when entering configuration to ensure fresh state
            fetchGlobalStats()
        }
    }, [selectedModule])

    const fetchGlobalStats = async () => {
        setLoadingCameras(true)
        try {
            const cams = await listCameras()
            setCameras(cams)

            // Fetch features for ALL cameras
            // We need to know exactly which features are enabled for each camera
            const featureMap: Record<string, string[]> = {}
            const counts: Record<string, number> = {}

            // Initialize counts
            defaultModules.forEach(m => counts[m.id] = 0)

            await Promise.all(cams.map(async (cam) => {
                try {
                    const features = await getCameraFeatures(cam.id)
                    // Backend returns 'feature_code', handle both just in case
                    const codes = features.map((f: any) => f.feature_code || f.code)
                    featureMap[cam.id] = codes

                    // Increment counts for found features
                    defaultModules.forEach(m => {
                        if (codes.includes(m.featureCode) || codes.includes(m.featureCode.toUpperCase())) {
                            counts[m.id] = (counts[m.id] || 0) + 1
                        }
                    })
                } catch {
                    featureMap[cam.id] = []
                }
            }))

            setCameraFeatures(featureMap)
            setActiveCounts(counts)

        } catch (error) {
            console.error("Error fetching camera data:", error)
        } finally {
            setLoadingCameras(false)
        }
    }

    // fetchGlobalStats handles both initial load and updates


    const toggleCameraFeature = async (cameraId: string, currentState: boolean) => {
        if (!selectedModule) return
        setProcessing(cameraId)
        try {
            const code = selectedModule.featureCode
            if (currentState) {
                await disableCameraFeature(cameraId, code)
                // Remove from local state
                setCameraFeatures(prev => ({
                    ...prev,
                    [cameraId]: (prev[cameraId] || []).filter(c => c !== code && c !== code.toUpperCase())
                }))
                // Update active count locally
                setActiveCounts(prev => ({
                    ...prev,
                    [selectedModule.id]: Math.max(0, (prev[selectedModule.id] || 0) - 1)
                }))
            } else {
                await enableCameraFeature(cameraId, code)
                // Auto-enable global AI flag to ensure pipeline starts
                await updateCamera(cameraId, { ai_enabled: true })

                // Add to local state
                setCameraFeatures(prev => ({
                    ...prev,
                    [cameraId]: [...(prev[cameraId] || []), code]
                }))
                // Update active count locally
                setActiveCounts(prev => ({
                    ...prev,
                    [selectedModule.id]: (prev[selectedModule.id] || 0) + 1
                }))
            }
        } catch (error) {
            console.error("Failed to toggle feature:", error)
        } finally {
            setProcessing(null)
        }
    }

    // Delete/Reset AI Configuration
    const deleteCameraAI = async (cameraId: string) => {
        if (!selectedModule || !confirm('Are you sure you want to delete this AI configuration? This will disable the AI and clear all ROI points.')) return

        setProcessing(cameraId)
        try {
            // 1. Disable the feature
            await disableCameraFeature(cameraId, selectedModule.featureCode)

            // 2. Clear ROI and reset generic fields
            await updateCamera(cameraId, {
                roi_points: [],
                ai_enabled: false
                // We keep generic thresholds as they might be used by other things, or reset them if desired
            })

            // 3. Update local state
            setCameraFeatures(prev => ({ ...prev, [cameraId]: [] }))
            setCameras(prev => prev.map(c =>
                c.id === cameraId ? { ...c, roi_points: [] } : c
            ))
        } catch (error) {
            console.error("Failed to delete AI configuration:", error)
        } finally {
            setProcessing(null)
        }
    }

    // Get enabled cameras for this module
    const getEnabledCameras = () => {
        if (!selectedModule) return []
        return cameras.filter(c => {
            const features = cameraFeatures[c.id] || []
            return features.includes(selectedModule.featureCode) || features.includes(selectedModule.featureCode.toUpperCase())
        })
    }

    // Open full configuration screen
    const openFullConfig = async () => {
        const enabledCams = getEnabledCameras()
        if (enabledCams.length === 0) {
            setSelectedModule(null)
            return
        }
        // Start with first enabled camera
        const firstCam = enabledCams[0]

        // Start the stream for this camera
        try {
            await startStream(firstCam.id)
            // Wait for stream to stabilize
            await new Promise(r => setTimeout(r, 1000))
        } catch (err) {
            console.error('Failed to start stream:', err)
        }

        setConfigCamera(firstCam)
        setRoiPoints(firstCam.roi_points || [])

        // Initialize threshold values with defaults
        if (selectedModule) {
            const defaults: Record<string, number> = {}
            selectedModule.thresholds.forEach(t => {
                defaults[t.key] = firstCam.confidence_threshold && t.key === 'confidence_threshold'
                    ? firstCam.confidence_threshold
                    : t.defaultValue
            })
            setThresholdValues(defaults)
        }

        setShowFullConfig(true)
    }

    // Switch configuring camera
    const switchConfigCamera = async (camera: Camera) => {
        // Start the stream for this camera
        try {
            await startStream(camera.id)
        } catch (err) {
            console.error('Failed to start stream:', err)
        }

        setConfigCamera(camera)
        setRoiPoints(camera.roi_points || [])

        // Reset thresholds to this camera's values or defaults
        if (selectedModule) {
            const values: Record<string, number> = {}
            selectedModule.thresholds.forEach(t => {
                values[t.key] = camera.confidence_threshold && t.key === 'confidence_threshold'
                    ? camera.confidence_threshold
                    : t.defaultValue
            })
            setThresholdValues(values)
        }
    }

    // Reset current configuration
    const handleReset = () => {
        // Clear ROI
        setRoiPoints([])

        // Reset thresholds to defaults
        if (selectedModule) {
            const defaults: Record<string, number> = {}
            selectedModule.thresholds.forEach(t => {
                defaults[t.key] = t.defaultValue
            })
            setThresholdValues(defaults)
        }
    }

    const handleSaveConfig = async () => {
        if (!configCamera || !selectedModule) return
        setSaving(true)
        try {
            await updateCamera(configCamera.id, {
                roi_points: roiPoints,
                confidence_threshold: thresholdValues['confidence_threshold'] || 0.7,
                dwell_time_seconds: thresholdValues['dwell_time'] || 0
            })

            // Update local camera list
            setCameras(prev => prev.map(c =>
                c.id === configCamera.id
                    ? { ...c, roi_points: roiPoints, confidence_threshold: thresholdValues['confidence_threshold'] }
                    : c
            ))

            // Move to next camera or close
            const enabledCams = getEnabledCameras()
            const currentIndex = enabledCams.findIndex(c => c.id === configCamera.id)
            if (currentIndex < enabledCams.length - 1) {
                switchConfigCamera(enabledCams[currentIndex + 1])
            } else {
                // All done
                setShowFullConfig(false)
                setSelectedModule(null)
            }
        } catch (error) {
            console.error("Failed to save config:", error)
        } finally {
            setSaving(false)
        }
    }

    const closeAll = () => {
        setShowFullConfig(false)
        setSelectedModule(null)
        setConfigCamera(null)
    }

    return (
        <div className="h-full flex flex-col gap-6">
            {/* Header */}
            <div>
                <h1 className="text-2xl font-bold text-white">AI Modules</h1>
                <p className="text-stone-400 mt-1">Deploy advanced computer vision models to specific cameras.</p>
            </div>

            {/* Module Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {defaultModules.map((module) => (
                    <div
                        key={module.id}
                        onClick={() => setSelectedModule(module)}
                        className="relative p-5 rounded-xl border cursor-pointer transition-all duration-200 border-stone-800 bg-stone-900/50 hover:border-techno-600/50 hover:bg-stone-900"
                    >
                        <div className="w-12 h-12 rounded-lg flex items-center justify-center mb-4 bg-stone-800 text-stone-500">
                            {module.icon}
                        </div>
                        <h3 className="font-semibold mb-1 text-white">{module.name}</h3>
                        <p className="text-sm text-stone-500 mb-4">{module.description}</p>

                        <div className="flex items-center justify-between mt-auto">
                            <div className="flex items-center gap-1 text-xs font-medium text-techno-400">
                                <Settings className="w-3 h-3" />
                                Configure Cameras
                            </div>
                            {activeCounts[module.id] > 0 && (
                                <div className="flex items-center gap-1.5 text-[10px] font-bold text-green-400 bg-green-500/10 px-2 py-1 rounded-full border border-green-500/20">
                                    <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                    {activeCounts[module.id]} Active
                                </div>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* Step 1: Camera Selection Modal */}
            {selectedModule && !showFullConfig && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-stone-900 border border-stone-800 rounded-xl w-full max-w-2xl shadow-2xl flex flex-col max-h-[85vh]">
                        {/* Modal Header */}
                        <div className="p-6 border-b border-stone-800 flex items-center justify-between shrink-0">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl bg-techno-600/20 text-techno-500 flex items-center justify-center">
                                    {selectedModule.icon}
                                </div>
                                <div>
                                    <h2 className="text-xl font-bold text-white">Configure {selectedModule.name}</h2>
                                    <p className="text-sm text-stone-400">Step 1: Select cameras to enable</p>
                                </div>
                            </div>
                            <button onClick={() => setSelectedModule(null)} className="p-2 hover:bg-stone-800 rounded-lg text-stone-400 hover:text-white transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Camera List */}
                        <div className="flex-1 overflow-y-auto p-6">
                            {loadingCameras ? (
                                <div className="flex flex-col items-center justify-center h-40 space-y-3">
                                    <Loader2 className="w-8 h-8 text-techno-500 animate-spin" />
                                    <p className="text-stone-500">Loading cameras...</p>
                                </div>
                            ) : cameras.length === 0 ? (
                                <div className="text-center py-10 text-stone-500">
                                    No cameras found. Please add a camera first.
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {cameras.map((camera) => {
                                        const features = cameraFeatures[camera.id] || []
                                        const isEnabled = features.includes(selectedModule.featureCode) || features.includes(selectedModule.featureCode.toUpperCase())
                                        const isProcessing = processing === camera.id

                                        return (
                                            <div
                                                key={camera.id}
                                                className={`p-4 rounded-lg border transition-all duration-200 ${isEnabled ? 'bg-techno-900/10 border-techno-600/30' : 'bg-stone-950 border-stone-800'}`}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-3">
                                                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${isEnabled ? 'bg-techno-600/20 text-techno-500' : 'bg-stone-800 text-stone-500'}`}>
                                                            <CameraIcon className="w-5 h-5" />
                                                        </div>
                                                        <div>
                                                            <h3 className="font-medium text-white">{camera.name}</h3>
                                                            <div className="flex items-center gap-2 mt-0.5">
                                                                <span className="text-xs text-stone-500">{camera.ip_address}</span>
                                                                {isEnabled && (
                                                                    <div className="flex items-center gap-1.5 ml-1">
                                                                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 shadow-[0_0_6px_rgba(34,197,94,0.5)]" />
                                                                        <span className="text-[10px] font-bold text-green-400 uppercase tracking-wide">Configured</span>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex items-center gap-3">
                                                        {isEnabled && (
                                                            <button
                                                                onClick={() => deleteCameraAI(camera.id)}
                                                                disabled={isProcessing}
                                                                title="Delete AI Configuration"
                                                                className="p-2 rounded-lg hover:bg-red-500/20 text-stone-500 hover:text-red-500 transition-colors disabled:opacity-50"
                                                            >
                                                                <Trash2 className="w-5 h-5" />
                                                            </button>
                                                        )}

                                                        {/* Toggle */}
                                                        <button
                                                            onClick={() => toggleCameraFeature(camera.id, isEnabled)}
                                                            disabled={isProcessing}
                                                            className={`w-12 h-6 rounded-full relative transition-colors ${isEnabled ? 'bg-techno-600' : 'bg-stone-700'} ${isProcessing ? 'opacity-50 cursor-wait' : 'cursor-pointer'}`}
                                                        >
                                                            <div className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-all duration-200 ${isEnabled ? 'left-[1.75rem]' : 'left-1'}`} />
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        )
                                    })}
                                </div>
                            )}
                        </div>

                        {/* Footer - Done opens full config */}
                        <div className="p-6 border-t border-stone-800 bg-stone-900/50 flex items-center justify-between">
                            <div className="text-sm text-stone-500">
                                {getEnabledCameras().length} camera(s) selected
                            </div>
                            <button
                                onClick={openFullConfig}
                                disabled={getEnabledCameras().length === 0}
                                className="px-6 py-2.5 bg-techno-600 hover:bg-techno-500 disabled:bg-stone-700 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                            >
                                Configure ROI & Thresholds
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Step 2: Full Configuration Screen (ROI + Thresholds) */}
            {showFullConfig && selectedModule && configCamera && (
                <div className="fixed inset-0 bg-black/95 backdrop-blur-sm z-[60] flex">
                    {/* Left Sidebar - Camera List */}
                    <div className="w-64 bg-stone-900 border-r border-stone-800 flex flex-col">
                        <div className="p-4 border-b border-stone-800">
                            <h3 className="text-sm font-medium text-stone-400">Selected Cameras</h3>
                        </div>
                        <div className="flex-1 overflow-y-auto">
                            {getEnabledCameras().map((camera) => (
                                <button
                                    key={camera.id}
                                    onClick={() => switchConfigCamera(camera)}
                                    className={`w-full p-3 text-left flex items-center gap-3 transition-colors ${camera.id === configCamera.id
                                        ? 'bg-techno-600/20 border-l-2 border-techno-500'
                                        : 'hover:bg-stone-800'
                                        }`}
                                >
                                    <CameraIcon className={`w-4 h-4 ${camera.id === configCamera.id ? 'text-techno-500' : 'text-stone-500'}`} />
                                    <div>
                                        <div className={`text-sm font-medium ${camera.id === configCamera.id ? 'text-white' : 'text-stone-300'}`}>
                                            {camera.name}
                                        </div>
                                        <div className="text-xs text-stone-500 flex items-center gap-1">
                                            {camera.roi_points && camera.roi_points.length >= 3 ? (
                                                <>
                                                    <MapPin className="w-2.5 h-2.5 text-green-500" />
                                                    <span className="text-green-500">Configured</span>
                                                </>
                                            ) : (
                                                'Not configured'
                                            )}
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Main Content */}
                    <div className="flex-1 flex flex-col">
                        {/* Header */}
                        <div className="p-4 border-b border-stone-800 flex items-center justify-between bg-stone-900/50">
                            <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-lg bg-techno-600/20 text-techno-500 flex items-center justify-center">
                                    {selectedModule.icon}
                                </div>
                                <div>
                                    <h2 className="text-lg font-bold text-white">{selectedModule.name} - {configCamera.name}</h2>
                                    <p className="text-sm text-stone-400">Configure detection zone and thresholds</p>
                                </div>
                            </div>
                            <button onClick={closeAll} className="p-2 hover:bg-stone-800 rounded-lg text-stone-400 hover:text-white transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Content Area */}
                        <div className="flex-1 flex overflow-hidden">
                            {/* ROI Editor */}
                            <div className="flex-1 p-4">
                                <div className="h-full flex flex-col">
                                    <div className="flex items-center gap-2 mb-3">
                                        <Target className="w-4 h-4 text-techno-500" />
                                        <span className="text-sm font-medium text-white">Detection Zone</span>
                                    </div>
                                    <div className="flex-1 relative bg-black rounded-lg overflow-hidden group">
                                        <FlvPlayer
                                            src={`${getFlvUrl(configCamera.id)}?token=${localStorage.getItem('vms_token')}`}
                                            className="absolute inset-0 w-full h-full object-cover"
                                            muted={true}
                                            controls={false}
                                        />
                                        <div className="absolute inset-0">
                                            <ROIEditor
                                                points={roiPoints}
                                                onChange={setRoiPoints}
                                                className="w-full h-full"
                                                mode={selectedModule.featureCode === 'PEOPLE_COUNTING' || selectedModule.featureCode === 'LINE_CROSSING' ? 'line' : 'polygon'}
                                            />
                                        </div>

                                        {/* Live Counts Overlay for Line Crossing */}
                                        {(selectedModule.featureCode === 'PEOPLE_COUNTING' || selectedModule.featureCode === 'LINE_CROSSING') && (
                                            <div className="absolute top-4 right-4 flex flex-col gap-2">
                                                <div className="bg-black/60 backdrop-blur px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                                                    <span className="text-xs font-bold text-white">IN: 0</span>
                                                </div>
                                                <div className="bg-black/60 backdrop-blur px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-2">
                                                    <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                                    <span className="text-xs font-bold text-white">OUT: 0</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                    <div className="mt-2 text-xs text-stone-500 flex justify-between">
                                        <span>
                                            {roiPoints.length} points • {
                                                (selectedModule.featureCode === 'PEOPLE_COUNTING' || selectedModule.featureCode === 'LINE_CROSSING')
                                                    ? (roiPoints.length >= 2 ? <span className="text-green-400">Valid line</span> : 'Draw 2 points for line')
                                                    : (roiPoints.length >= 3 ? <span className="text-green-400">Valid zone</span> : 'Draw at least 3 points')
                                            }
                                        </span>
                                        <span className="text-stone-600">
                                            {(selectedModule.featureCode === 'PEOPLE_COUNTING' || selectedModule.featureCode === 'LINE_CROSSING') ? 'Line crossing detection' : 'Polygon zone detection'}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Threshold Settings Panel */}
                            <div className="w-80 bg-stone-900/50 border-l border-stone-800 p-4 overflow-y-auto">
                                <div className="flex items-center gap-2 mb-4">
                                    <Sliders className="w-4 h-4 text-techno-500" />
                                    <span className="text-sm font-medium text-white">Thresholds</span>
                                </div>

                                <div className="space-y-4">
                                    {selectedModule.thresholds.map((threshold) => (
                                        <div key={threshold.key} className="bg-stone-950 rounded-lg p-3">
                                            <div className="flex items-center justify-between mb-2">
                                                <label className="text-sm font-medium text-stone-300">{threshold.label}</label>
                                                <span className="text-xs text-techno-400 font-mono">
                                                    {threshold.key === 'confidence_threshold' || threshold.key === 'sensitivity' || threshold.key === 'min_area'
                                                        ? Math.round((thresholdValues[threshold.key] || threshold.defaultValue) * 100)
                                                        : (thresholdValues[threshold.key] || threshold.defaultValue)
                                                    }
                                                    {threshold.unit}
                                                </span>
                                            </div>
                                            <input
                                                type="range"
                                                min={threshold.min}
                                                max={threshold.max}
                                                step={threshold.max <= 1 ? 0.05 : 1}
                                                value={thresholdValues[threshold.key] || threshold.defaultValue}
                                                onChange={(e) => setThresholdValues(prev => ({
                                                    ...prev,
                                                    [threshold.key]: parseFloat(e.target.value)
                                                }))}
                                                className="w-full h-2 bg-stone-800 rounded-lg appearance-none cursor-pointer accent-techno-500"
                                            />
                                            <p className="text-xs text-stone-500 mt-1">{threshold.description}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-stone-800 bg-stone-900/50 flex items-center justify-between">
                            <div className="flex items-center gap-2 text-sm text-stone-500">
                                <Clock className="w-4 h-4" />
                                Camera {getEnabledCameras().findIndex(c => c.id === configCamera.id) + 1} of {getEnabledCameras().length}
                                <span className="mx-2 text-stone-700">|</span>
                                <button
                                    onClick={handleReset}
                                    className="flex items-center gap-1 text-stone-400 hover:text-white transition-colors"
                                    title="Reset to defaults"
                                >
                                    <RotateCcw className="w-3.5 h-3.5" />
                                    Reset
                                </button>
                                {/* Invert Line Button */}
                                {(selectedModule.featureCode === 'PEOPLE_COUNTING' || selectedModule.featureCode === 'LINE_CROSSING') && roiPoints.length === 2 && (
                                    <>
                                        <span className="mx-2 text-stone-700">|</span>
                                        <button
                                            onClick={() => setRoiPoints([roiPoints[1], roiPoints[0]])}
                                            className="flex items-center gap-1 text-techno-400 hover:text-techno-300 transition-colors"
                                            title="Swap IN/OUT direction"
                                        >
                                            <ArrowLeftRight className="w-3.5 h-3.5" />
                                            Invert Direction
                                        </button>
                                    </>
                                )}
                            </div>
                            <div className="flex gap-3">
                                <button
                                    onClick={closeAll}
                                    className="px-4 py-2 bg-stone-800 hover:bg-stone-700 text-white rounded-lg font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleSaveConfig}
                                    disabled={saving}
                                    className="px-6 py-2 bg-techno-600 hover:bg-techno-500 disabled:opacity-50 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                                >
                                    {saving ? (
                                        <>
                                            <Loader2 className="w-4 h-4 animate-spin" />
                                            Saving...
                                        </>
                                    ) : (
                                        <>
                                            Save & {getEnabledCameras().findIndex(c => c.id === configCamera.id) < getEnabledCameras().length - 1 ? 'Next' : 'Finish'}
                                            <ChevronRight className="w-4 h-4" />
                                        </>
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    )
}
