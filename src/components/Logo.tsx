import logoSrc from '../assets/logo.png';

const Logo: React.FC<LogoProps> = ({ className = '' }) => (
  <img
    src={logoSrc}
    alt="PhilTech Logo"
    className={`h-10 w-10 object-contain ${className}`}
  />
);
