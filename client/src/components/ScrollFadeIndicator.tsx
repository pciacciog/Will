import { useState, useEffect, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';
import { useLocation } from 'wouter';

export function ScrollFadeIndicator() {
  const [visible, setVisible] = useState(false);
  const [location] = useLocation();

  const check = useCallback(() => {
    const el = document.documentElement;
    const scrollable = el.scrollHeight > el.clientHeight + 4;
    const atBottom = window.scrollY + window.innerHeight >= el.scrollHeight - 8;
    setVisible(scrollable && !atBottom);
  }, []);

  useEffect(() => {
    window.addEventListener('scroll', check, { passive: true });
    window.addEventListener('resize', check, { passive: true });
    check();
    return () => {
      window.removeEventListener('scroll', check);
      window.removeEventListener('resize', check);
    };
  }, [check]);

  // Re-check after route change (content may be taller or shorter)
  useEffect(() => {
    const t = setTimeout(check, 150);
    return () => clearTimeout(t);
  }, [location, check]);

  return (
    <div
      className="fixed bottom-0 left-0 right-0 pointer-events-none z-50 transition-opacity duration-300"
      style={{ opacity: visible ? 1 : 0 }}
      aria-hidden="true"
    >
      {/* Gradient fade */}
      <div
        style={{
          height: 64,
          background: 'linear-gradient(to bottom, transparent, #ffffff)',
        }}
      />
      {/* Bouncing chevron — sits at the bottom of the gradient */}
      <div className="absolute bottom-2 left-0 right-0 flex justify-center">
        <ChevronDown className="w-4 h-4 text-gray-400 scroll-bounce" />
      </div>
    </div>
  );
}
