import React, { useState } from 'react';

const Logo = ({ className = '', size = 'md', showText = true, variant = 'default' }) => {
  const [logoSrc, setLogoSrc] = useState('/spectrum-logo%20PNG.png');
  const [logoLoaded, setLogoLoaded] = useState(false);
  const [showPlaceholder, setShowPlaceholder] = useState(false);
  const [triedPaths, setTriedPaths] = useState(['/spectrum-logo%20PNG.png']);

  // Height classes – header size stays small so logo fits in the bar
  const heightClasses = {
    header: 'h-8 max-h-8',   // 32px – for header bar only
    sm: 'h-12',
    md: 'h-20',
    lg: 'h-28',
    xl: 'h-36'
  };

  const containerClasses = {
    header: 'h-8 w-8 max-h-8',
    sm: 'h-12 w-12',
    md: 'h-20 w-20',
    lg: 'h-28 w-28',
    xl: 'h-36 w-36'
  };

  const textSizeClasses = {
    header: 'text-lg',
    sm: 'text-xl',
    md: 'text-2xl',
    lg: 'text-3xl',
    xl: 'text-4xl'
  };

  const textColor = variant === 'white' ? 'text-white' : 'text-primary';

  const handleImageError = (e) => {
    const possiblePaths = ['/spectrum-logo%20PNG.png', '/spectrum-logo.png', '/logo.svg', '/Logo.svg', '/logo.png', '/Logo.png'];
    const nextPath = possiblePaths.find(path => !triedPaths.includes(path));

    if (nextPath) {
      setTriedPaths([...triedPaths, nextPath]);
      setLogoSrc(nextPath);
    } else {
      e.target.style.display = 'none';
      setShowPlaceholder(true);
      setLogoLoaded(false);
    }
  };

  const handleImageLoad = () => {
    setLogoLoaded(true);
    setShowPlaceholder(false);
  };

  const shouldShowText = showText && (!logoLoaded || showPlaceholder);
  const heightClass = heightClasses[size] || heightClasses.md;
  const containerClass = containerClasses[size] || containerClasses.md;

  return (
    <div className={`flex items-center gap-4 ${className}`}>
      <div className={`relative flex-shrink-0 overflow-hidden ${size === 'header' ? 'max-h-8' : 'max-w-full'}`}>
        <img
          src={logoSrc}
          alt="Spectrum Outfitters"
          className={`${heightClass} w-auto max-w-full object-contain object-left ${variant === 'white' ? 'brightness-0 invert' : ''} ${size === 'header' ? 'drop-shadow-none' : 'drop-shadow-lg'}`}
          onLoad={handleImageLoad}
          onError={handleImageError}
        />
        <div
          className={`${containerClass} bg-primary rounded-lg flex items-center justify-center text-white font-bold ${size === 'header' ? 'text-xs shadow-none' : 'shadow-lg'} ${size === 'sm' ? 'text-base' : size === 'md' ? 'text-xl' : size === 'lg' ? 'text-2xl' : 'text-3xl'}`}
          style={{ display: showPlaceholder && !logoLoaded ? 'flex' : 'none' }}
        >
          <span className="font-bold">SO</span>
        </div>
      </div>
      {shouldShowText && (
        <span className={`font-bold ${textColor} ${textSizeClasses[size] || textSizeClasses.md} tracking-tight`}>
          Spectrum Outfitters
        </span>
      )}
    </div>
  );
};

export default Logo;
