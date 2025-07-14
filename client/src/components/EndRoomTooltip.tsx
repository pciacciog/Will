import React, { useState } from "react";
import { HelpCircle, X } from "lucide-react";

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
        className="w-6 h-6 bg-white border border-gray-300 hover:bg-gray-50 hover:border-blue-400 active:opacity-70 rounded-full flex items-center justify-center text-gray-600 hover:text-blue-600 transition-all shadow-sm cursor-pointer"
        aria-label="End Room information"
      >
        <HelpCircle className="w-5 h-5" />
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
            <div className="bg-white rounded-2xl shadow-lg p-6 w-[90%] max-w-sm transition-all duration-300 ease-in-out transform animate-in fade-in-0 zoom-in-95">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xl font-semibold text-gray-900">End Room</h3>
                <button
                  onClick={handleClose}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-700 transition-colors"
                  aria-label="Close modal"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <p className="text-sm text-gray-700 leading-relaxed text-center">
                This is where the circle will gather to reflect, share, and honor the efforts of each member's Will.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}