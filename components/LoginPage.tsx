import React, { useState } from 'react';
import { Shield, Lock, User, ArrowRight, Eye } from 'lucide-react';
import { UserRole } from '../types';

interface LoginPageProps {
  onLogin: (username: string, role: UserRole) => void;
}

const LoginPage: React.FC<LoginPageProps> = ({ onLogin }) => {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>(UserRole.ADMIN);
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    // Simulate auth delay
    setTimeout(() => {
      onLogin(username, role);
      setIsLoading(false);
    }, 1200);
  };

  return (
    <div className="min-h-screen bg-[#0c0a09] flex items-center justify-center p-4 relative overflow-hidden">
      {/* Background Ambience */}
      <div className="absolute inset-0 z-0">
         <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-techno-600 rounded-full blur-[120px] opacity-10 animate-pulse"></div>
         <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-techno-500 rounded-full blur-[150px] opacity-5"></div>
         
         {/* Grid Pattern */}
         <div className="absolute inset-0 opacity-[0.03]" style={{ 
            backgroundImage: `linear-gradient(#ea580c 1px, transparent 1px), linear-gradient(90deg, #ea580c 1px, transparent 1px)`,
            backgroundSize: '40px 40px'
         }}></div>
      </div>

      <div className="w-full max-w-5xl h-[600px] bg-stone-900/60 backdrop-blur-xl border border-stone-800 rounded-2xl shadow-2xl flex overflow-hidden z-10 relative">
        
        {/* Left Side: Brand & Visuals */}
        <div className="hidden lg:flex w-1/2 bg-stone-950 relative flex-col justify-between p-12 border-r border-stone-800">
           {/* Animated Scanning Line */}
           <div className="absolute inset-0 bg-gradient-to-b from-transparent via-techno-500/10 to-transparent h-[20%] w-full animate-scan pointer-events-none"></div>

           <div className="z-10">
              {/* Logo Area */}
              <div className="flex flex-col items-start gap-1 mb-8">
                {/* Simulated Logo based on the user provided image */}
                <div className="flex items-center gap-3">
                   {/* Abstract 't' Logo Mark */}
                   <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M12 24C12 18 16 14 24 14V24H12Z" fill="#ea580c"/>
                      <path d="M12 24H24V40C16 40 12 34 12 24Z" fill="#ea580c"/>
                      <path d="M28 14H36V34C36 37.3137 33.3137 40 30 40H28V14Z" fill="#ea580c"/>
                   </svg>
                   <div className="flex flex-col leading-none">
                      <span className="text-3xl font-bold text-techno-600 tracking-tight lowercase">techno</span>
                      <span className="text-3xl font-bold text-techno-600 tracking-tight lowercase -mt-2">support</span>
                   </div>
                </div>
                <div className="text-[10px] font-bold text-stone-500 tracking-[0.2em] uppercase mt-1 ml-1">
                  Core Innovations Pvt. Ltd
                </div>
              </div>
              
              <p className="text-stone-400 text-lg max-w-sm mt-8 border-l-2 border-techno-600 pl-4">
                Advanced Video Management System
              </p>
           </div>

           <div className="space-y-6">
              <div className="flex items-center gap-4 text-stone-400 text-sm">
                <div className="w-12 h-12 rounded-full bg-stone-900 border border-stone-800 flex items-center justify-center group-hover:border-techno-500 transition-colors">
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
                  <div className="text-white font-medium">Real-time Monitoring</div>
                  <div className="text-xs">WebRTC & HLS Low-latency stream</div>
                </div>
              </div>
           </div>

           <div className="text-xs text-stone-600 font-mono">
             v2.4.0-stable | System Status: <span className="text-techno-500">ONLINE</span>
           </div>
        </div>

        {/* Right Side: Login Form */}
        <div className="w-full lg:w-1/2 p-8 md:p-12 flex flex-col justify-center bg-stone-900/40">
           <div className="max-w-md mx-auto w-full">
              <div className="mb-8">
                 <h2 className="text-2xl font-bold text-white mb-2">Secure Access</h2>
                 <p className="text-stone-400 text-sm">Please identify yourself to access the secure terminal.</p>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                 
                 <div className="space-y-1.5">
                   <label className="text-xs font-semibold text-stone-300 uppercase tracking-wider ml-1">Identity</label>
                   <div className="relative group">
                     <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-500 group-focus-within:text-techno-500 transition-colors" />
                     <input 
                       type="text" 
                       value={username}
                       onChange={(e) => setUsername(e.target.value)}
                       className="w-full bg-stone-950/50 border border-stone-700 rounded-lg py-3 pl-10 pr-4 text-stone-200 placeholder-stone-600 focus:outline-none focus:border-techno-500 focus:ring-1 focus:ring-techno-500 transition-all"
                       placeholder="Username"
                       required
                     />
                   </div>
                 </div>

                 <div className="space-y-1.5">
                   <label className="text-xs font-semibold text-stone-300 uppercase tracking-wider ml-1">Access Key</label>
                   <div className="relative group">
                     <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-stone-500 group-focus-within:text-techno-500 transition-colors" />
                     <input 
                       type="password" 
                       value={password}
                       onChange={(e) => setPassword(e.target.value)}
                       className="w-full bg-stone-950/50 border border-stone-700 rounded-lg py-3 pl-10 pr-4 text-stone-200 placeholder-stone-600 focus:outline-none focus:border-techno-500 focus:ring-1 focus:ring-techno-500 transition-all"
                       placeholder="••••••••"
                     />
                   </div>
                 </div>

                 <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-stone-300 uppercase tracking-wider ml-1">Role Clearance</label>
                    <div className="grid grid-cols-3 gap-2">
                       {Object.values(UserRole).map((r) => (
                         <button
                           key={r}
                           type="button"
                           onClick={() => setRole(r)}
                           className={`text-xs font-medium py-2 rounded border transition-all ${role === r ? 'bg-techno-600/20 border-techno-600 text-techno-500' : 'bg-stone-950/50 border-stone-700 text-stone-500 hover:border-stone-500'}`}
                         >
                           {r}
                         </button>
                       ))}
                    </div>
                 </div>

                 <button 
                  type="submit" 
                  disabled={isLoading}
                  className="w-full bg-techno-600 hover:bg-techno-500 text-white font-bold py-3 rounded-lg shadow-lg shadow-techno-600/20 transition-all transform hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2 mt-4"
                 >
                   {isLoading ? (
                     <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
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
                   Techno Support Core Innovations Pvt. Ltd © 2024
                 </p>
              </div>
           </div>
        </div>

      </div>
    </div>
  );
};

export default LoginPage;