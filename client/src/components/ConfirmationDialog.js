import React from 'react';
import { AlertTriangle, X, CheckCircle, Info, AlertCircle } from 'lucide-react';

const ConfirmationDialog = ({
  isOpen,
  onClose,
  onConfirm,
  title = "Confirm Action",
  message = "Are you sure you want to proceed?",
  confirmText = "Confirm",
  cancelText = "Cancel",
  type = "warning", // warning, danger, info
  isLoading = false,
  confirmButtonColor = "red"
}) => {
  if (!isOpen) return null;

  const getIcon = () => {
    switch (type) {
      case 'danger':
        return <AlertTriangle className="w-6 h-6 text-red-500" />;
      case 'warning':
        return <AlertCircle className="w-6 h-6 text-yellow-500" />;
      case 'info':
        return <Info className="w-6 h-6 text-blue-500" />;
      default:
        return <AlertTriangle className="w-6 h-6 text-red-500" />;
    }
  };

  const getConfirmButtonClass = () => {
    const baseClass = "inline-flex items-center px-4 py-2 text-sm font-medium rounded-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed";
    
    switch (confirmButtonColor) {
      case 'red':
        return `${baseClass} bg-red-600 hover:bg-red-700 text-white focus:ring-red-500`;
      case 'blue':
        return `${baseClass} bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500`;
      case 'green':
        return `${baseClass} bg-green-600 hover:bg-green-700 text-white focus:ring-green-500`;
      default:
        return `${baseClass} bg-red-600 hover:bg-red-700 text-white focus:ring-red-500`;
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleConfirm = () => {
    onConfirm();
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity duration-300"
        onClick={handleBackdropClick}
      />
      
      {/* Dialog Container */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-md transform overflow-hidden rounded-2xl bg-white shadow-2xl transition-all duration-300 scale-100">
          {/* Header */}
          <div className="px-6 pt-6 pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                {getIcon()}
                <h3 className="text-lg font-semibold text-gray-900">
                  {title}
                </h3>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors duration-200 p-1 rounded-lg hover:bg-gray-100"
                disabled={isLoading}
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="px-6 pb-6">
            <p className="text-gray-600 leading-relaxed">
              {message}
            </p>
            
            {/* Warning for destructive actions */}
            {type === 'danger' && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
                <div className="flex items-start">
                  <AlertTriangle className="w-5 h-5 text-red-500 mt-0.5 mr-2 flex-shrink-0" />
                  <p className="text-sm text-red-700">
                    This action cannot be undone. Please make sure you want to proceed.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="px-6 pb-6">
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-3 space-y-3 space-y-reverse sm:space-y-0">
              <button
                onClick={onClose}
                disabled={isLoading}
                className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {cancelText}
              </button>
              <button
                onClick={handleConfirm}
                disabled={isLoading}
                className={getConfirmButtonClass()}
              >
                {isLoading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Processing...
                  </div>
                ) : (
                  <div className="flex items-center">
                    <CheckCircle className="w-4 h-4 mr-2" />
                    {confirmText}
                  </div>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationDialog;
