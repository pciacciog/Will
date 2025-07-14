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
    };

    updateTimeRemaining();
    const interval = setInterval(updateTimeRemaining, 1000);
    
    return () => clearInterval(interval);
  }, [will?.endRoomScheduledAt]);

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