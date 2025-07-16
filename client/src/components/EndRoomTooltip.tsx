import React, { useState } from "react";
import { X } from "lucide-react";

interface EndRoomTooltipProps {
  className?: string;
}

export function EndRoomTooltip({ className = "" }: EndRoomTooltipProps) {
  const [isOpen, setIsOpen] = useState(false);

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  const handleClose = () => {
    setIsOpen(false);
  };

  // Handle keyboard escape
  React.useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };

    if (isOpen) {
      document.addEventListener('keydown', handleEscape);
    }

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        onClick={handleToggle}
        className="w-5 h-5 text-xs rounded-full border border-gray-300 bg-white flex items-center justify-center text-gray-700 hover:bg-gray-100 hover:border-blue-500 active:opacity-70 transition-all"
        aria-label="End Room information"
      >
        ?
      </button>
      
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40 transition-opacity duration-300"
            onClick={handleClose}
          />
          
          {/* Modal */}
          <div className="fixed inset-4 z-50 flex items-center justify-center">
            <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-6 w-[90%] max-w-sm transition-all duration-300 ease-in-out transform animate-in fade-in-0 zoom-in-95 relative">
              {/* Close button in upper right corner */}
              <button
                onClick={handleClose}
                className="absolute top-4 right-4 w-7 h-7 flex items-center justify-center text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition-all duration-200"
                aria-label="Close modal"
              >
                <span className="text-lg font-light">&times;</span>
              </button>
              
              <div className="pr-8">
                {/* Icon and Title */}
                <div className="flex items-center space-x-3 mb-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-indigo-600 rounded-full flex items-center justify-center">
                    <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900">
                    End Room
                  </h3>
                </div>
                
                {/* Description */}
                <p className="text-base text-gray-700 leading-relaxed">
                  This is where your circle will gather to reflect, share, and honor the efforts of each member's <em>Will</em>.
                </p>
                
                {/* Features */}
                <div className="mt-4 space-y-2">
                  <div className="flex items-start space-x-2">
                    <div className="w-1.5 h-1.5 bg-purple-500 rounded-full mt-2.5"></div>
                    <p className="text-sm text-gray-600">30-minute group reflection session</p>
                  </div>
                  <div className="flex items-start space-x-2">
                    <div className="w-1.5 h-1.5 bg-purple-500 rounded-full mt-2.5"></div>
                    <p className="text-sm text-gray-600">Opens automatically at scheduled time</p>
                  </div>
                  <div className="flex items-start space-x-2">
                    <div className="w-1.5 h-1.5 bg-purple-500 rounded-full mt-2.5"></div>
                    <p className="text-sm text-gray-600">Video call with your circle members</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}