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

      {/* Glass Container */}
      <div className="relative z-10 w-full max-w-md p-4 md:p-6">
        {/* Maroon Glass Card */}
        <div className="backdrop-blur-2xl bg-[#800000]/20 border border-[#800000]/40 rounded-3xl shadow-2xl overflow-hidden">
          {/* Decorative header */}
          <div className="bg-gradient-to-r from-[#800000]/40 to-[#600000]/30 p-8 text-center relative">
            {/* Logo Section - Big Logo */}
            <div className="relative inline-block mb-4">
              <div className="w-24 h-24 rounded-2xl bg-gradient-to-br from-[#800000] to-[#a52a2a] flex items-center justify-center shadow-2xl border-2 border-white/20">
                <i className="hgi-stroke hgi-mortarboard-01 text-white text-5xl"></i>
              </div>
              <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-[#d4af37] rounded-full flex items-center justify-center shadow-lg border-2 border-white/20">
                <i className="hgi-stroke hgi-spark-01 text-white text-sm"></i>
              </div>
            </div>
            
            <h1 className="text-3xl font-bold text-white drop-shadow-lg">{title}</h1>
            {subtitle && <p className="mt-2 text-white/80 text-sm">{subtitle}</p>}
          </div>

          {/* Content Section */}
          <div className="p-6 md:p-8">
            {children}
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-white/50 text-xs mt-6">
          Student Academic Performance Analytics System
        </p>
      </div>
    </div>
  );
}
