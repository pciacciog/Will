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
            <div className="bg-white rounded-2xl shadow-lg p-6 w-[90%] max-w-sm transition-all duration-300 ease-in-out transform animate-in fade-in-0 zoom-in-95 relative">
              {/* Close button in upper right corner */}
              <button
                onClick={handleClose}
                className="absolute top-3 right-3 w-8 h-8 flex items-center justify-center text-gray-500 hover:text-red-500 transition-colors duration-200"
                aria-label="Close modal"
              >
                <span className="text-xl">&times;</span>
              </button>
              
              <div className="pr-10">
                <h3 className="text-xl font-semibold text-gray-900 underline decoration-2 underline-offset-4 decoration-gray-300 mb-3">
                  End Room
                </h3>
                <p className="text-base text-gray-700 leading-relaxed text-center">
                  This is where the circle will gather to reflect, share, and honor the efforts of each member's Will.
                </p>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}