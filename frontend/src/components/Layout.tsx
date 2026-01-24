import { useAuth } from '../contexts/AuthContext'
import Sidebar from './Sidebar'

interface LayoutProps {
    children: React.ReactNode
}

export default function Layout({ children }: LayoutProps) {
    const { user } = useAuth()

    return (
        <div className="h-screen overflow-hidden bg-stone-950 text-stone-100 flex">
            <Sidebar />
            <main className="flex-1 flex flex-col min-w-0">
                {/* Top Header */}
                <header className="h-14 bg-stone-900/80 backdrop-blur border-b border-stone-800 flex items-center justify-between px-6 sticky top-0 z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-2 h-2 rounded-full bg-techno-600 animate-pulse" />
                        <span className="text-sm font-medium text-stone-300">System Online</span>
                    </div>

                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <div className="text-sm font-medium">{user?.name || user?.email}</div>
                            <div className="text-xs text-techno-500 font-mono uppercase">{user?.role}</div>
                        </div>
                        <div className="w-9 h-9 rounded-full bg-stone-800 border border-stone-700 flex items-center justify-center">
                            <span className="text-sm font-medium">
                                {user?.name?.charAt(0) || user?.email?.charAt(0) || 'U'}
                            </span>
                        </div>
                    </div>
                </header>

                {/* Page Content */}
                <div className="flex-1 p-6 overflow-y-auto">{children}</div>
            </main>
        </div>
    )
}
