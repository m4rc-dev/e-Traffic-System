import React from 'react';

const ModernLoading = ({ 
  size = 'md', 
  text = 'Loading...', 
  showText = true,
  className = '' 
}) => {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
    xl: 'w-16 h-16'
  };

  const textSizeClasses = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-lg',
    xl: 'text-xl'
  };

  return (
    <div className={`flex flex-col items-center justify-center space-y-3 ${className}`}>
      {/* Modern Spinner */}
      <div className="relative">
        <div className={`${sizeClasses[size]} border-4 border-gray-200 rounded-full animate-spin`}>
          <div className="absolute top-0 left-0 w-full h-full border-4 border-transparent border-t-blue-500 rounded-full animate-spin"></div>
        </div>
        {/* Pulse effect */}
        <div className={`absolute inset-0 ${sizeClasses[size]} border-4 border-blue-200 rounded-full animate-ping opacity-20`}></div>
      </div>
      
      {/* Loading Text */}
      {showText && (
        <div className="text-center">
          <p className={`${textSizeClasses[size]} text-gray-600 font-medium`}>
            {text}
          </p>
          <div className="flex justify-center space-x-1 mt-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ModernLoading;
