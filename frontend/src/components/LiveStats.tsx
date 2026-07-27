import { Activity, Camera, AlertTriangle, Cpu } from 'lucide-react'
import type { Camera as CameraType, AIEvent } from '../types'

interface LiveStatsProps {
    cameras: CameraType[]
    recentEvents: AIEvent[]
}

export default function LiveStats({ cameras, recentEvents }: LiveStatsProps) {
    const totalCameras = cameras.length
    const onlineCameras = cameras.filter(c => c.status === 'ONLINE' || c.status === 'RECORDING').length
    const activeAlerts = recentEvents.filter(e => {
        const timeDiff = new Date().getTime() - new Date(e.event_time).getTime()
        return timeDiff < 5 * 60 * 1000 // Last 5 minutes
    }).length

    const stats = [
        {
            label: 'System Status',
            value: 'ONLINE',
            icon: Activity,
            color: 'text-green-500',
            bg: 'bg-green-500/10',
            border: 'border-green-500/20'
        },
        {
            label: 'Cameras Online',
            value: `${onlineCameras}/${totalCameras}`,
            icon: Camera,
            color: onlineCameras === totalCameras ? 'text-blue-500' : 'text-amber-500',
            bg: onlineCameras === totalCameras ? 'bg-blue-500/10' : 'bg-amber-500/10',
            border: onlineCameras === totalCameras ? 'border-blue-500/20' : 'border-amber-500/20'
        },
        {
            label: 'Active Alerts',
            value: activeAlerts.toString(),
            icon: AlertTriangle,
            color: activeAlerts > 0 ? 'text-red-500' : 'text-stone-400',
            bg: activeAlerts > 0 ? 'bg-red-500/10' : 'bg-stone-800',
            border: activeAlerts > 0 ? 'border-red-500/20' : 'border-stone-700'
        },
        {
            label: 'AI Engine',
            value: 'ACTIVE',
            icon: Cpu,
            color: 'text-purple-500',
            bg: 'bg-purple-500/10',
            border: 'border-purple-500/20'
        }
    ]

    return (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            {stats.map((stat, i) => (
                <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border ${stat.bg} ${stat.border}`}>
                    <div className={`p-2 rounded-lg bg-black/20 ${stat.color}`}>
                        <stat.icon className="w-5 h-5" />
                    </div>
                    <div>
                        <p className="text-xs text-stone-400 font-medium uppercase tracking-wider">{stat.label}</p>
                        <p className={`text-lg font-bold ${stat.color} leading-none mt-1`}>{stat.value}</p>
                    </div>
                </div>
            ))}
        </div>
    )
}
