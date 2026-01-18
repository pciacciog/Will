import { useEffect } from "react";
import { useLocation } from "wouter";

export default function InnerCircle() {
  const [, setLocation] = useLocation();
  
  useEffect(() => {
    setLocation('/circles');
  }, [setLocation]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );
}
