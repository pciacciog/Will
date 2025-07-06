import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useState } from "react";

interface WillInstructionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStart: () => void;
  showDontShowAgain?: boolean;
}

export function WillInstructionModal({ 
  isOpen, 
  onClose, 
  onStart,
  showDontShowAgain = true 
}: WillInstructionModalProps) {
  const [dontShowAgain, setDontShowAgain] = useState(false);

  const handleStart = () => {
    if (dontShowAgain) {
      localStorage.setItem('willInstructionSeen', 'true');
    }
    onStart();
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-bold text-center mb-4">
            🙋‍♀️ How to Start a <em>Will</em>
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <p className="text-gray-700 text-center mb-6">
            A "<em>Will</em>" is something you deeply want to follow through on. This flow will help you name it, share it, and commit to it.
          </p>
          
          <div className="space-y-4">
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-blue-600 font-semibold text-sm">1</span>
              </div>
              <div>
                <h3 className="font-medium text-gray-900 mb-1">When 🗓</h3>
                <p className="text-sm text-gray-600">Choose when your <em>Will</em> starts and ends.</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-green-600 font-semibold text-sm">2</span>
              </div>
              <div>
                <h3 className="font-medium text-gray-900 mb-1">What 📝</h3>
                <p className="text-sm text-gray-600">Example: "I will make time to call my grandmother this week."</p>
              </div>
            </div>
            
            <div className="flex items-start space-x-3">
              <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                <span className="text-orange-600 font-semibold text-sm">3</span>
              </div>
              <div>
                <h3 className="font-medium text-gray-900 mb-1">Why 💖</h3>
                <p className="text-sm text-gray-600">Example: "Because I like how I feel after I talk to her."</p>
              </div>
            </div>
          </div>
          
          <div className="pt-4 border-t">
            {showDontShowAgain && (
              <div className="flex items-center space-x-2 mb-4">
                <Checkbox 
                  id="dontShowAgain"
                  checked={dontShowAgain}
                  onCheckedChange={(checked) => setDontShowAgain(checked as boolean)}
                />
                <label 
                  htmlFor="dontShowAgain" 
                  className="text-sm text-gray-600 cursor-pointer"
                >
                  Don't show this again
                </label>
              </div>
            )}
            
            <Button 
              onClick={handleStart}
              className="w-full bg-primary hover:bg-blue-600"
            >
              Got it → Start
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}