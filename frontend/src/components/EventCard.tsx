import { Camera, Clock, Eye, AlertTriangle, User, Car } from 'lucide-react'
import type { AIEvent } from '../types'
import * as api from '../services/api'

interface EventCardProps {
    event: AIEvent
    onClick?: () => void
}

const eventTypeConfig: Record<string, { icon: typeof AlertTriangle; color: string; label: string }> = {
    person_intrusion: { icon: AlertTriangle, color: 'bg-red-500', label: 'Intrusion' },
    person_dwell: { icon: User, color: 'bg-amber-500', label: 'Dwell' },
    person_entry: { icon: User, color: 'bg-blue-500', label: 'Entry' },
    person_exit: { icon: User, color: 'bg-green-500', label: 'Exit' },
    vehicle_detected: { icon: Car, color: 'bg-purple-500', label: 'Vehicle' },
    motion_detected: { icon: Eye, color: 'bg-cyan-500', label: 'Motion' },
}

export default function EventCard({ event, onClick }: EventCardProps) {
    const config = eventTypeConfig[event.event_type] || {
        icon: AlertTriangle,
        color: 'bg-stone-500',
        label: event.event_type,
    }
    const Icon = config.icon

    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr)
        const now = new Date()
        const diffMs = now.getTime() - date.getTime()
        const diffMins = Math.floor(diffMs / 60000)

        if (diffMins < 1) return 'Just now'
        if (diffMins < 60) return `${diffMins}m ago`
        if (diffMins < 1440) return `${Math.floor(diffMins / 60)}h ago`
        return date.toLocaleDateString()
    }

    return (
        <div
            onClick={onClick}
            className="bg-stone-900 border border-stone-800 rounded-xl overflow-hidden cursor-pointer hover:border-techno-600/50 transition-all group"
        >
            {/* Snapshot / Placeholder */}
            <div className="relative aspect-video bg-stone-950">
                {event.snapshot_url ? (
                    <img
                        src={api.getSnapshotUrl(event.id)}
                        alt={`${event.event_type} snapshot`}
                        className="w-full h-full object-cover opacity-90 group-hover:opacity-100 transition-opacity"
                        loading="lazy"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center">
                        <Camera className="w-10 h-10 text-stone-700" />
                    </div>
                )}

                {/* Event Type Badge */}
                <div className="absolute top-2 left-2">
                    <span
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded text-[10px] font-bold text-white ${config.color}`}
                    >
                        <Icon className="w-3 h-3" />
                        {config.label}
                    </span>
                </div>

                {/* Confidence */}
                <div className="absolute top-2 right-2 bg-black/60 backdrop-blur px-2 py-1 rounded text-xs font-mono text-white">
                    {Math.round(event.confidence * 100)}%
                </div>

                {/* View Overlay */}
                <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="w-10 h-10 rounded-full bg-white/20 backdrop-blur flex items-center justify-center">
                        <Eye className="w-5 h-5 text-white" />
                    </div>
                </div>
            </div>

            {/* Info */}
            <div className="p-3">
                <div className="flex items-center justify-between mb-1">
                    <h4 className="font-medium text-white text-sm truncate">
                        {event.camera_name || `Camera ${event.camera_id}`}
                    </h4>
                    <span
                        className={`w-2 h-2 rounded-full ${event.status === 'COMPLETED'
                            ? 'bg-green-500'
                            : event.status === 'PENDING'
                                ? 'bg-amber-500'
                                : 'bg-red-500'
                            }`}
                    />
                </div>
                <div className="flex items-center gap-2 text-xs text-stone-500">
                    <Clock className="w-3 h-3" />
                    <span>{formatTime(event.event_time)}</span>
                    {/* Track ID Display */}
                    {event.metadata && (event.metadata as any).track_id && (
                        <span className="bg-stone-800 px-1.5 py-0.5 rounded text-[10px] text-stone-400 border border-stone-700 font-mono">
                            #{String((event.metadata as any).track_id)}
                        </span>
                    )}
                </div>
            </div>
        </div>
    )
}
