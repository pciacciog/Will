import React, { useState, useEffect } from 'react';

interface EndRoomCountdownProps {
  will: any;
}

export function EndRoomCountdown({ will }: EndRoomCountdownProps) {
  const [timeRemaining, setTimeRemaining] = useState<string>('');

  useEffect(() => {
    if (!will?.endRoomScheduledAt) return;

    const updateTimeRemaining = () => {
      const now = new Date().getTime();
      const scheduledTime = new Date(will.endRoomScheduledAt).getTime();
      const endTime = scheduledTime + (30 * 60 * 1000); // 30 minutes after start time
      
      // Check if End Room is still pending (not opened yet)
      if (will?.endRoomStatus === 'pending' && now < scheduledTime) {
        // Show countdown until End Room opens
        const difference = scheduledTime - now;
        const hours = Math.floor(difference / (1000 * 60 * 60));
        const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((difference % (1000 * 60)) / 1000);

        if (hours > 0) {
          setTimeRemaining(`opens in: ${hours}h ${minutes}m ${seconds}s`);
        } else if (minutes > 0) {
          setTimeRemaining(`opens in: ${minutes}m ${seconds}s`);
        } else {
          setTimeRemaining(`opens in: ${seconds}s`);
        }
      } else {
        // Show countdown until End Room session ends
        const difference = endTime - now;
        if (difference > 0) {
          const hours = Math.floor(difference / (1000 * 60 * 60));
          const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
          const seconds = Math.floor((difference % (1000 * 60)) / 1000);

          if (hours > 0) {
            setTimeRemaining(`${hours}h ${minutes}m ${seconds}s remaining`);
          } else if (minutes > 0) {
            setTimeRemaining(`${minutes}m ${seconds}s remaining`);
          } else {
            setTimeRemaining(`${seconds}s remaining`);
          }
        } else {
          setTimeRemaining('Session ended');
        }
      }
    };

    updateTimeRemaining();
    const interval = setInterval(updateTimeRemaining, 1000);
    
    return () => clearInterval(interval);
  }, [will?.endRoomScheduledAt, will?.endRoomStatus]);

  if (!will?.endRoomScheduledAt) {
    return (
      <p className="text-sm text-gray-600 mb-3">
        30-minute group reflection session
      </p>
    );
  }

  return (
    <p className="text-sm text-purple-700 font-medium mb-3">
      {timeRemaining}
    </p>
  );
}