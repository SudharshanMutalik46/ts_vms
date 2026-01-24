import { useState, FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Shield, Lock, User, ArrowRight, Eye, EyeOff } from 'lucide-react'
import { useAuth } from '../contexts/AuthContext'

export default function LoginPage() {
    const [email, setEmail] = useState('admin@vms.local')
    const [password, setPassword] = useState('')
    const [showPassword, setShowPassword] = useState(false)
    const [error, setError] = useState('')
    const [isLoading, setIsLoading] = useState(false)

    const { login } = useAuth()
    const navigate = useNavigate()

    const handleSubmit = async (e: FormEvent) => {
        e.preventDefault()
        setError('')
        setIsLoading(true)

        try {
            const success = await login(email, password)
            if (success) {
                navigate('/live')
            } else {
                setError('Invalid credentials. Please try again.')
            }
        } catch {
            setError('Login failed. Please check your connection.')
        } finally {
            setIsLoading(false)
        }
    }

    return (
        <div className="min-h-screen bg-stone-950 flex items-center justify-center p-4 relative overflow-hidden">
            {/* Background Effects */}
            <div className="absolute inset-0">
                <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-techno-600 rounded-full blur-[120px] opacity-10 animate-pulse" />
                <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-techno-500 rounded-full blur-[150px] opacity-5" />
                <div
                    className="absolute inset-0 opacity-[0.03]"
                    style={{
                        backgroundImage: `linear-gradient(#ea580c 1px, transparent 1px), linear-gradient(90deg, #ea580c 1px, transparent 1px)`,
                        backgroundSize: '40px 40px',
                    }}
                />
            </div>

            <div className="w-full max-w-5xl h-[600px] bg-stone-900/60 backdrop-blur-xl border border-stone-800 rounded-2xl shadow-2xl flex overflow-hidden z-10 relative">
                {/* Left Side: Brand */}
                <div className="hidden lg:flex w-1/2 bg-stone-950 relative flex-col justify-between p-12 border-r border-stone-800">
                    <div className="absolute inset-0 bg-gradient-to-b from-transparent via-techno-500/10 to-transparent h-[20%] w-full animate-scan pointer-events-none" />

                    <div className="z-10">
                        <div className="flex items-center gap-3 mb-8">
                            <Shield className="w-12 h-12 text-techno-500" />
                            <div className="flex flex-col leading-none">
                                <span className="text-3xl font-bold text-techno-600 tracking-tight lowercase">
                                    techno
                                </span>
                                <span className="text-3xl font-bold text-techno-600 tracking-tight lowercase -mt-2">
                                    support
                                </span>
                            </div>
                        </div>

                        <div className="text-[10px] font-bold text-stone-500 tracking-[0.2em] uppercase mb-8">
                            Core Innovations Pvt. Ltd
                        </div>

                        <p className="text-stone-400 text-lg max-w-sm border-l-2 border-techno-600 pl-4">
                            Advanced Video Management System
                        </p>
                    </div>

                    <div className="space-y-6">
                        <div className="flex items-center gap-4 text-stone-400 text-sm">
                            <div className="w-12 h-12 rounded-full bg-stone-900 border border-stone-800 flex items-center justify-center">
                                <Shield className="w-5 h-5 text-techno-500" />
                            </div>
                            <div>
                                <div className="text-white font-medium">Enterprise Security</div>
                                <div className="text-xs">End-to-end encryption & RBAC</div>
                            </div>
                        </div>
                        <div className="flex items-center gap-4 text-stone-400 text-sm">
                            <div className="w-12 h-12 rounded-full bg-stone-900 border border-stone-800 flex items-center justify-center">
                                <Eye className="w-5 h-5 text-techno-500" />
                            </div>
                            <div>
                                <div className="text-white font-medium">Real-time AI Analytics</div>
                                <div className="text-xs">Person, vehicle & intrusion detection</div>
                            </div>
                        </div>
                    </div>

                    <div className="text-xs text-stone-600 font-mono">
                        v2.0.0 | System Status: <span className="text-techno-500">ONLINE</span>
                    </div>
                </div>

                {/* Right Side: Form */}
                <div className="w-full lg:w-1/2 p-8 md:p-12 flex flex-col justify-center bg-stone-900/40">
                    <div className="max-w-md mx-auto w-full">
                        <div className="mb-8">
                            <h2 className="text-2xl font-bold text-white mb-2">Secure Access</h2>
                            <p className="text-stone-400 text-sm">
                                Please authenticate to access the control center.
                            </p>
                        </div>

                        {error && (
                            <div className="mb-6 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
                                {error}
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="space-y-5">
                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-stone-300 uppercase tracking-wider ml-1">
                                    Email
                                </label>
                                <div className="relative group">
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-500 group-focus-within:text-techno-500 transition-colors" />
                                    <input
                                        type="email"
                                        value={email}
                                        onChange={(e) => setEmail(e.target.value)}
                                        className="w-full bg-stone-950/50 border border-stone-700 rounded-lg py-3 pl-10 pr-4 text-stone-200 placeholder-stone-600 focus:outline-none focus:border-techno-500 focus:ring-1 focus:ring-techno-500 transition-all"
                                        placeholder="you@example.com"
                                        required
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <label className="text-xs font-semibold text-stone-300 uppercase tracking-wider ml-1">
                                    Password
                                </label>
                                <div className="relative group">
                                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-500 group-focus-within:text-techno-500 transition-colors" />
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="w-full bg-stone-950/50 border border-stone-700 rounded-lg py-3 pl-10 pr-12 text-stone-200 placeholder-stone-600 focus:outline-none focus:border-techno-500 focus:ring-1 focus:ring-techno-500 transition-all"
                                        placeholder="••••••••"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-stone-500 hover:text-stone-300"
                                    >
                                        {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                    </button>
                                </div>
                            </div>

                            <button
                                type="submit"
                                disabled={isLoading}
                                className="w-full bg-techno-600 hover:bg-techno-500 disabled:bg-techno-600/50 text-white font-bold py-3 rounded-lg shadow-lg shadow-techno-600/20 transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 mt-4"
                            >
                                {isLoading ? (
                                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                ) : (
                                    <>
                                        <span>Authenticate</span>
                                        <ArrowRight className="w-4 h-4" />
                                    </>
                                )}
                            </button>
                        </form>

                        <div className="mt-8 text-center">
                            <p className="text-xs text-stone-600">
                                Techno Support Core Innovations © 2026
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
