import { useEffect, useState } from 'react';

interface SplashScreenProps {
  onComplete: () => void;
}

export default function SplashScreen({ onComplete }: SplashScreenProps) {
  const [showWill, setShowWill] = useState(false);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    // Show "Will." after a short delay
    const willTimer = setTimeout(() => {
      setShowWill(true);
    }, 800);

    // Start fade out after total duration
    const fadeTimer = setTimeout(() => {
      setFadeOut(true);
    }, 1800);

    // Complete after fade out
    const completeTimer = setTimeout(() => {
      onComplete();
    }, 2300);

    return () => {
      clearTimeout(willTimer);
      clearTimeout(fadeTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  return (
    <div className={`fixed inset-0 h-screen w-screen bg-white flex flex-col justify-center items-center transition-opacity duration-500 ${fadeOut ? 'opacity-0' : 'opacity-100'}`}>
      <p className="text-lg text-gray-500 mb-2 italic tracking-wide animate-fade-in">
        All You Need Is a Little...
      </p>
      <h1 className={`text-5xl font-bold text-black tracking-tight transition-opacity duration-500 ${showWill ? 'opacity-100' : 'opacity-0'}`}>
        Will.
      </h1>
    </div>
  );
}