import { useRef, useEffect, useCallback } from 'react';

export function useAutoResizeTextarea(value: string, maxHeight: number = 120) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resize = useCallback(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Reset height to calculate scrollHeight
    textarea.style.height = 'auto';
    
    // Set height to scrollHeight (content height)
    const newHeight = Math.min(textarea.scrollHeight, maxHeight);
    textarea.style.height = `${newHeight}px`;
  }, [maxHeight]);

  // Resize when value changes
  useEffect(() => {
    resize();
  }, [value, resize]);

  // Resize on mount
  useEffect(() => {
    resize();
  }, [resize]);

  return { textareaRef, resize };
}
