/**
 * ResizablePanelLayout Component
 *
 * A 2-panel layout with:
 * - Draggable divider for resizing
 * - localStorage persistence of panel width
 * - Mobile-responsive stacking
 * - Visual feedback on divider hover/drag
 */

import React from 'react';
import { usePanelResize } from '../hooks/usePanelResize';

interface ResizablePanelLayoutProps {
  leftPanel: React.ReactNode;
  rightPanel: React.ReactNode;
  storageKey?: string;
  defaultLeftWidth?: number;
  minLeftWidth?: number;
  maxLeftWidth?: number;
  className?: string;
}

export const ResizablePanelLayout: React.FC<ResizablePanelLayoutProps> = ({
  leftPanel,
  rightPanel,
  storageKey = 'panelLayout.leftWidth',
  defaultLeftWidth = 35,
  minLeftWidth = 25,
  maxLeftWidth = 50,
  className = '',
}) => {
  const { leftWidth, isDragging, isMobile, handleMouseDown } = usePanelResize({
    storageKey,
    defaultLeftWidth,
    minLeftWidth,
    maxLeftWidth,
  });

  // Mobile: Stack vertically
  if (isMobile) {
    return (
      <div className={`flex flex-col gap-6 ${className}`}>
        <div className="bg-paper border border-border-subtle">{leftPanel}</div>
        <div className="bg-paper border border-border-subtle">{rightPanel}</div>
      </div>
    );
  }

  // Desktop: Side-by-side with resizable divider
  return (
    <div className={`flex h-[calc(100vh-220px)] min-h-[600px] ${className}`}>
      {/* Left Panel */}
      <div
        className="bg-paper border border-border-subtle overflow-hidden flex flex-col"
        style={{ width: `${leftWidth}%` }}
      >
        {leftPanel}
      </div>

      {/* Divider */}
      <div
        onMouseDown={handleMouseDown}
        className={`
          w-1 flex-shrink-0 cursor-col-resize relative group
          transition-colors duration-150
          ${isDragging ? 'bg-editorial-red' : 'bg-border-subtle hover:bg-slate'}
        `}
      >
        {/* Wider hit area */}
        <div className="absolute inset-y-0 -left-2 -right-2" />

        {/* Visual grip indicator */}
        <div
          className={`
            absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2
            w-1 h-8 rounded-full
            transition-all duration-150
            ${isDragging ? 'bg-paper scale-110' : 'bg-silver group-hover:bg-charcoal'}
          `}
        />
      </div>

      {/* Right Panel */}
      <div className="flex-1 bg-paper border border-border-subtle border-l-0 overflow-hidden flex flex-col">
        {rightPanel}
      </div>
    </div>
  );
};

export default ResizablePanelLayout;
