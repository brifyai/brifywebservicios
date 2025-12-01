import React from 'react'

const LoadingSpinner = ({ size = 'medium', text = 'Cargando...', className = '', inline = false }) => {
  const sizeClasses = {
    sm: 'w-3 h-3',
    small: 'w-4 h-4',
    medium: 'w-6 h-6',
    large: 'w-8 h-8'
  }

  if (inline) {
    return (
      <div className={`inline-flex items-center ${className}`}>
        <div className={`${sizeClasses[size]} animate-spin`}>
          <svg 
            className="w-full h-full text-current" 
            fill="none" 
            viewBox="0 0 24 24"
          >
            <circle 
              className="opacity-25" 
              cx="12" 
              cy="12" 
              r="10" 
              stroke="currentColor" 
              strokeWidth="4"
            />
            <path 
              className="opacity-75" 
              fill="currentColor" 
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50">
      <div className="flex items-center space-x-3">
        <div className={`${sizeClasses[size]} animate-spin`}>
          <svg 
            className="w-full h-full text-primary-600" 
            fill="none" 
            viewBox="0 0 24 24"
          >
            <circle 
              className="opacity-25" 
              cx="12" 
              cy="12" 
              r="10" 
              stroke="currentColor" 
              strokeWidth="4"
            />
            <path 
              className="opacity-75" 
              fill="currentColor" 
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        </div>
        {text && (
          <span className="text-gray-600 font-medium">{text}</span>
        )}
      </div>
    </div>
  )
}

export default LoadingSpinner