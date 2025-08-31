import React from 'react';

const Logo = ({ size = 'default', className = '' }) => {
  const sizeClasses = {
    small: 'h-8 w-8',
    default: 'h-10 w-10',
    large: 'h-12 w-12'
  };

  const textSizes = {
    small: 'text-lg',
    default: 'text-2xl',
    large: 'text-3xl'
  };

  return (
    <div className={`flex items-center ${className}`}>
      {/* Logo Icon */}
      <div className={`${sizeClasses[size]} flex-shrink-0 rounded-lg bg-white ring-1 ring-gray-200 flex items-center justify-center shadow-lg overflow-hidden`}>
        <img
          src="/logo1.png"
          alt="E-Traffic System logo"
          className="w-5/6 h-5/6 object-contain"
          loading="lazy"
          onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://cdn-icons-png.flaticon.com/512/13481/13481653.png'; }}
        />
      </div>
      
      {/* Logo Text */}
      <div className="ml-4">
        <h1 className={`font-black tracking-tight ${textSizes[size]} leading-tight font-['Orbitron']`}>
          <span className="text-gray-900 bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent">e</span>
          <span className="text-transparent bg-gradient-to-r from-primary-600 via-primary-700 to-primary-800 bg-clip-text">-Traffic</span>
        </h1>
        <p className="text-xs font-semibold text-gray-500 tracking-wide uppercase font-['Inter']">System</p>
      </div>
    </div>
  );
};

export default Logo;
