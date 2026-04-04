import { ReactNode } from 'react';

interface AuthLayoutProps {
  children: ReactNode;
  title: string;
  subtitle?: string;
}

export function AuthLayout({ children, title, subtitle }: AuthLayoutProps) {
  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden">
      {/* Clean solid background */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-50 to-white" />

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
          Student Performance Analytics System
        </p>
      </div>
    </div>
  );
}
