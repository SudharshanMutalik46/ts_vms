import { Settings, Shield, Database, Cpu } from 'lucide-react'

export default function SettingsPage() {
    return (
        <div className="h-full flex flex-col gap-6">
            <div>
                <h1 className="text-xl font-bold text-white flex items-center gap-2">
                    <Settings className="w-5 h-5 text-techno-500" />
                    Settings
                </h1>
                <p className="text-sm text-stone-400 mt-1">System configuration and preferences</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in fade-in duration-300">
                {/* AI Configuration */}
                <div className="bg-stone-900 border border-stone-800 rounded-xl p-6 opacity-60">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-lg bg-purple-500/10 flex items-center justify-center">
                            <Shield className="w-5 h-5 text-purple-500" />
                        </div>
                        <div>
                            <h3 className="font-medium text-white">AI Configuration</h3>
                            <p className="text-xs text-stone-400">Zone editor and detection rules</p>
                        </div>
                    </div>
                    <button disabled className="w-full py-2 px-4 bg-stone-800/50 rounded-lg text-sm text-stone-500 cursor-not-allowed flex items-center justify-center gap-2">
                        <Shield className="w-3 h-3" />
                        Coming Soon
                    </button>
                </div>

                {/* Storage Settings */}
                <div className="bg-stone-900 border border-stone-800 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
                            <Database className="w-5 h-5 text-green-500" />
                        </div>
                        <div>
                            <h3 className="font-medium text-white">Storage</h3>
                            <p className="text-xs text-stone-400">Retention policies and disk usage</p>
                        </div>
                    </div>
                    <button className="w-full py-2 px-4 bg-stone-800 hover:bg-stone-700 rounded-lg text-sm text-stone-300 transition-colors">
                        Manage Storage
                    </button>
                </div>

                {/* Security Settings */}
                <div className="bg-stone-900 border border-stone-800 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
                            <Shield className="w-5 h-5 text-red-500" />
                        </div>
                        <div>
                            <h3 className="font-medium text-white">Security</h3>
                            <p className="text-xs text-stone-400">Users and access control</p>
                        </div>
                    </div>
                    <button className="w-full py-2 px-4 bg-stone-800 hover:bg-stone-700 rounded-lg text-sm text-stone-300 transition-colors">
                        Manage Security
                    </button>
                </div>

                {/* System Info */}
                <div className="bg-stone-900 border border-stone-800 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                        <div className="w-10 h-10 rounded-lg bg-blue-500/10 flex items-center justify-center">
                            <Cpu className="w-5 h-5 text-blue-500" />
                        </div>
                        <div>
                            <h3 className="font-medium text-white">System</h3>
                            <p className="text-xs text-stone-400">Version and license info</p>
                        </div>
                    </div>
                    <div className="text-xs text-stone-500 space-y-1">
                        <p>Version: 1.0.0-beta</p>
                        <p>License: Community Edition</p>
                    </div>
                </div>
            </div>
        </div>
    )
}
