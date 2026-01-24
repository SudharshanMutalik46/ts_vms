import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './contexts/AuthContext'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import LiveView from './pages/LiveView'
import EventDashboard from './pages/EventDashboard'
import PlaybackPage from './pages/PlaybackPage'
import CamerasPage from './pages/CamerasPage'
import SettingsPage from './pages/SettingsPage'
import HealthPage from './pages/HealthPage'
import AIConfigurationPage from './pages/AIConfigurationPage'
import AIModulesPage from './pages/AIModulesPage'

function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, isLoading } = useAuth()

    if (isLoading) {
        return (
            <div className="min-h-screen bg-stone-950 flex items-center justify-center">
                <div className="w-8 h-8 border-2 border-techno-600 border-t-transparent rounded-full animate-spin" />
            </div>
        )
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />
    }

    return <>{children}</>
}

function App() {
    return (
        <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
                path="/*"
                element={
                    <ProtectedRoute>
                        <Layout>
                            <Routes>
                                <Route path="/" element={<Navigate to="/live" replace />} />
                                <Route path="/live" element={<LiveView />} />
                                <Route path="/cameras" element={<CamerasPage />} />
                                <Route path="/ai-modules" element={<AIModulesPage />} />
                                <Route path="/ai-monitor" element={<AIConfigurationPage />} />
                                <Route path="/events" element={<EventDashboard />} />
                                <Route path="/playback" element={<PlaybackPage />} />
                                <Route path="/settings" element={<SettingsPage />} />
                                <Route path="/health" element={<HealthPage />} />
                            </Routes>
                        </Layout>
                    </ProtectedRoute>
                }
            />
        </Routes>
    )
}

export default App
