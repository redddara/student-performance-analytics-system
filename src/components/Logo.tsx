import React from 'react';

interface LogoProps {
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ className = '' }) => (
  <img
    src="/src/assets/logo.png"
    alt="PhilTech Logo"
    className={`h-10 w-10 object-contain ${className}`}
  />
);

export { Logo };
