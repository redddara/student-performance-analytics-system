import { ReactNode } from 'react';

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
}

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* White Background */}
      <div className="absolute inset-0 bg-white/90 backdrop-blur-xl">
        {/* Animated orbs */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute top-20 left-20 w-72 h-72 bg-[#800000]/30 rounded-full blur-[100px] animate-pulse" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-[#800000]/20 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-[#800000]/10 rounded-full blur-[150px] animate-pulse" style={{ animationDelay: '2s' }} />
          {/* Grid pattern overlay */}
          <div className="absolute inset-0 bg-[linear-gradient(rgba(128,0,0,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(128,0,0,0.03)_1px,transparent_1px)] bg-[size:50px_50px]" />
        </div>
      </div>

      {/* Clean Container */}
      <div className="relative z-10 w-full max-w-md p-4 md:p-6">
        {/* Clean white card - no glass box */}
        <div className="bg-white/95 backdrop-blur-xl border border-gray-200/50 rounded-3xl shadow-xl overflow-hidden">
          {/* Simple header */}
          <div className="bg-gradient-to-r from-maroon-600 to-maroon-700 p-8 text-center relative">
            {/* Logo */}
            <div className="flex justify-center mb-6">
              <img 
                src="/src/assets/logo.png" 
                className="w-24 h-24 object-contain drop-shadow-2xl" 
                alt="SAPAS Logo" 
              />
            </div>
            
            <h1 className="text-3xl font-bold text-white drop-shadow-lg">{title}</h1>
            {subtitle && <p className="mt-2 text-white/90 text-sm">{subtitle}</p>}
          </div>

          {/* Content Section */}
          <div className="p-8">
            {children}
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-gray-500 text-xs mt-8">
          Student Academic Performance Analytics System
        </p>
      </div>
    </div>
  );
}
