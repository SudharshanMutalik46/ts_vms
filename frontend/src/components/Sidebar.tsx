import { NavLink, useNavigate } from 'react-router-dom'
import {
    Grid3X3,
    Bell,
    Play,
    Settings,
    Activity,
    Video,
    LogOut,
    Shield,
    Menu,
    X,
    Brain,
    Cpu,
} from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../contexts/AuthContext'

const navItems = [
    { to: '/live', icon: Grid3X3, label: 'Live View' },
    { to: '/playback', icon: Play, label: 'Playback' },
    { to: '/ai-modules', icon: Cpu, label: 'AI Modules' },
    { to: '/ai-monitor', icon: Brain, label: 'AI Monitor' },
    { to: '/cameras', icon: Video, label: 'Cameras' },
    { to: '/events', icon: Bell, label: 'Events' },
    { to: '/health', icon: Activity, label: 'Health' },
    { to: '/settings', icon: Settings, label: 'Settings' },
]

export default function Sidebar() {
    const [collapsed, setCollapsed] = useState(false)
    const { logout, user } = useAuth()
    const navigate = useNavigate()

    const handleLogout = () => {
        logout()
        navigate('/login')
    }

    return (
        <aside
            className={`${collapsed ? 'w-16' : 'w-60'
                } bg-stone-900 border-r border-stone-800 flex flex-col transition-all duration-200`}
        >
            {/* Logo / Brand */}
            <div className="h-14 flex items-center justify-between px-4 border-b border-stone-800">
                {!collapsed && (
                    <div className="flex items-center gap-2">
                        <Shield className="w-6 h-6 text-techno-500" />
                        <div className="flex flex-col leading-none">
                            <span className="text-sm font-bold text-techno-500">techno</span>
                            <span className="text-sm font-bold text-techno-500 -mt-1">support</span>
                        </div>
                    </div>
                )}
                <button
                    onClick={() => setCollapsed(!collapsed)}
                    className="p-1.5 hover:bg-stone-800 rounded text-stone-400"
                >
                    {collapsed ? <Menu className="w-5 h-5" /> : <X className="w-5 h-5" />}
                </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 py-4 px-2 space-y-1">
                {navItems.map((item) => (
                    <NavLink
                        key={item.to}
                        to={item.to}
                        className={({ isActive }) =>
                            `flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors ${isActive
                                ? 'bg-techno-600/20 text-techno-500 border border-techno-600/30'
                                : 'text-stone-400 hover:text-white hover:bg-stone-800'
                            }`
                        }
                    >
                        <item.icon className="w-5 h-5 flex-shrink-0" />
                        {!collapsed && <span className="text-sm font-medium">{item.label}</span>}
                    </NavLink>
                ))}
            </nav>

            {/* User / Logout */}
            <div className="p-3 border-t border-stone-800">
                {!collapsed && user && (
                    <div className="mb-3 px-2">
                        <div className="text-xs text-stone-500 uppercase tracking-wider">Signed in as</div>
                        <div className="text-sm font-medium text-stone-300 truncate">{user.email}</div>
                    </div>
                )}
                <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 px-3 py-2 w-full rounded-lg text-stone-400 hover:text-red-400 hover:bg-stone-800 transition-colors"
                >
                    <LogOut className="w-5 h-5 flex-shrink-0" />
                    {!collapsed && <span className="text-sm">Sign Out</span>}
                </button>
            </div>
        </aside>
    )
}
