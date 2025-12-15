/**
 * usePanelResize Hook
 *
 * Handles resizable 2-panel layout with:
 * - Mouse drag to resize
 * - localStorage persistence
 * - Min/max width constraints
 * - Mobile breakpoint detection
 */

import { useState, useEffect, useCallback, useRef } from 'react';

interface UsePanelResizeOptions {
  storageKey: string;
  defaultLeftWidth?: number;  // percentage (default: 35)
  minLeftWidth?: number;      // percentage (default: 25)
  maxLeftWidth?: number;      // percentage (default: 50)
  mobileBreakpoint?: number;  // pixels (default: 768)
}

interface UsePanelResizeReturn {
  leftWidth: number;
  isDragging: boolean;
  isMobile: boolean;
  handleMouseDown: (e: React.MouseEvent) => void;
  resetToDefault: () => void;
}

export function usePanelResize({
  storageKey,
  defaultLeftWidth = 35,
  minLeftWidth = 25,
  maxLeftWidth = 50,
  mobileBreakpoint = 768,
}: UsePanelResizeOptions): UsePanelResizeReturn {
  // Initialize from localStorage or default
  const [leftWidth, setLeftWidth] = useState<number>(() => {
    if (typeof window === 'undefined') return defaultLeftWidth;
    const stored = localStorage.getItem(storageKey);
    if (stored) {
      const parsed = parseFloat(stored);
      if (!isNaN(parsed) && parsed >= minLeftWidth && parsed <= maxLeftWidth) {
        return parsed;
      }
    }
    return defaultLeftWidth;
  });

  const [isDragging, setIsDragging] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const containerRef = useRef<HTMLElement | null>(null);

  // Check for mobile breakpoint
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < mobileBreakpoint);
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, [mobileBreakpoint]);

  // Persist to localStorage when width changes
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKey, leftWidth.toString());
    }
  }, [leftWidth, storageKey]);

  // Handle mouse move during drag
  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!containerRef.current) return;

      const containerRect = containerRef.current.getBoundingClientRect();
      const containerWidth = containerRect.width;
      const mouseX = e.clientX - containerRect.left;

      // Calculate percentage
      let newWidth = (mouseX / containerWidth) * 100;

      // Clamp between min and max
      newWidth = Math.max(minLeftWidth, Math.min(maxLeftWidth, newWidth));

      setLeftWidth(newWidth);
    },
    [minLeftWidth, maxLeftWidth]
  );

  // Handle mouse up to end drag
  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    document.body.style.cursor = '';
    document.body.style.userSelect = '';
  }, []);

  // Set up and clean up mouse event listeners
  useEffect(() => {
    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  // Start drag on mouse down
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    // Find the parent container (the flex container)
    const divider = e.currentTarget as HTMLElement;
    containerRef.current = divider.parentElement;
    setIsDragging(true);
  }, []);

  // Reset to default width
  const resetToDefault = useCallback(() => {
    setLeftWidth(defaultLeftWidth);
  }, [defaultLeftWidth]);

  return {
    leftWidth,
    isDragging,
    isMobile,
    handleMouseDown,
    resetToDefault,
  };
}

export default usePanelResize;
