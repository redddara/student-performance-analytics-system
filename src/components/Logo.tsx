import React from 'react';
import logoSrc from '../assets/logo.png';

interface LogoProps {
  className?: string;
}

const Logo: React.FC<LogoProps> = ({ className = '' }) => (
  <img
    src={logoSrc}
    alt="PhilTech Logo"
    className={`h-10 w-10 object-contain ${className}`}
  />
);

export { Logo };
export default Logo;
