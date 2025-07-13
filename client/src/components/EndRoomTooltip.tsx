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

  return (
    <div className={`relative inline-block ${className}`}>
      <button
        onClick={handleToggle}
        className="w-5 h-5 bg-gray-100 hover:bg-gray-200 active:opacity-70 rounded-full flex items-center justify-center text-gray-600 hover:text-gray-800 transition-colors"
        aria-label="End Room information"
      >
        <HelpCircle className="w-3 h-3" />
      </button>
      
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40"
            onClick={() => setIsOpen(false)}
          />
          
          {/* Modal */}
          <div className="fixed inset-4 z-50 flex items-center justify-center">
            <div className="bg-white rounded-xl shadow-lg p-6 max-w-sm w-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">End Room</h3>
                <button
                  onClick={() => setIsOpen(false)}
                  className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 hover:text-gray-700"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-gray-600 leading-relaxed">
                This is where the circle will gather to reflect, share, and honor the efforts of each member's Will.
              </p>
            </div>
          </div>
        </>
      )}
    </div>
  );
}