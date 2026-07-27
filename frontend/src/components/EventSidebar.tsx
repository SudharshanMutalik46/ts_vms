import { useRef } from 'react'
import { Bell, Clock, ChevronRight } from 'lucide-react'
import type { AIEvent } from '../types'
import * as api from '../services/api'

interface EventSidebarProps {
    events: AIEvent[]
    onEventClick: (event: AIEvent) => void
}

export default function EventSidebar({ events, onEventClick }: EventSidebarProps) {
    const scrollRef = useRef<HTMLDivElement>(null)

    // Format relative time (e.g. "2m ago")
    const formatTime = (dateStr: string) => {
        const date = new Date(dateStr)
        const now = new Date()
        const diffMs = now.getTime() - date.getTime()
        const diffMins = Math.floor(diffMs / 60000)

        if (diffMins < 1) return 'Just now'
        if (diffMins < 60) return `${diffMins}m ago`
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    }

    return (
        <div className="w-80 flex flex-col bg-stone-900 border-l border-stone-800 h-full">
            <div className="p-4 border-b border-stone-800 bg-stone-900/50 backdrop-blur z-10 sticky top-0">
                <h3 className="font-bold text-white flex items-center gap-2">
                    <Bell className="w-4 h-4 text-techno-500" />
                    Live Feed
                    <span className="ml-auto text-xs font-normal text-stone-500">
                        {events.length} events
                    </span>
                </h3>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar" ref={scrollRef}>
                {events.length === 0 ? (
                    <div className="text-center py-12 opacity-50">
                        <div className="w-12 h-12 rounded-full bg-stone-800 flex items-center justify-center mx-auto mb-3">
                            <Bell className="w-6 h-6 text-stone-600" />
                        </div>
                        <p className="text-sm text-stone-500">No recent events</p>
                    </div>
                ) : (
                    events.map((event) => (
                        <div
                            key={event.id}
                            onClick={() => onEventClick(event)}
                            className="group relative bg-stone-950 border border-stone-800 rounded-lg overflow-hidden hover:border-techno-600/50 transition-all cursor-pointer"
                        >
                            <div className="flex gap-3 p-3">
                                {/* Thumbnail */}
                                <div className="w-16 h-16 rounded bg-stone-900 flex-shrink-0 overflow-hidden relative">
                                    {event.snapshot_url ? (
                                        <img
                                            src={api.getSnapshotUrl(event.id)}
                                            alt=""
                                            className="w-full h-full object-cover"
                                            loading="lazy"
                                        />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-stone-700">
                                            <Bell className="w-6 h-6" />
                                        </div>
                                    )}
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between">
                                        <h4 className="text-sm font-medium text-stone-200 truncate capitalize">
                                            {event.event_type.replace(/_/g, ' ')}
                                        </h4>
                                        <span className="text-[10px] text-stone-500 flex items-center gap-1 bg-stone-900 px-1.5 py-0.5 rounded">
                                            <Clock className="w-3 h-3" />
                                            {formatTime(event.event_time)}
                                        </span>
                                    </div>
                                    <p className="text-xs text-stone-500 mt-1 truncate">
                                        {event.camera_name || 'Camera ' + event.camera_id}
                                    </p>
                                    <div className="mt-2 flex items-center justify-between">
                                        <div className="text-[10px] font-mono text-techno-500 bg-techno-500/10 px-1.5 py-0.5 rounded">
                                            {Math.round(event.confidence * 100)}% Conf
                                        </div>
                                        <ChevronRight className="w-4 h-4 text-stone-600 group-hover:text-techno-500 transition-colors" />
                                    </div>
                                </div>
                            </div>

                            {/* New Indicator (if very recent) */}
                            {new Date().getTime() - new Date(event.event_time).getTime() < 30000 && (
                                <div className="absolute top-2 right-2 w-2 h-2 rounded-full bg-techno-500 animate-pulse shadow-[0_0_8px_rgba(236,72,153,0.6)]" />
                            )}
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}
