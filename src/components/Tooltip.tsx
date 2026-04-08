import React, { useState, useRef, useEffect } from 'react';
import { cn } from '../utils/utils';

interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactElement;
  className?: string;
  position?: 'top' | 'bottom' | 'left' | 'right';
  align?: 'start' | 'center' | 'end';
}

export const Tooltip = ({ 
  content, 
  children, 
  className, 
  position = 'bottom',
  align = 'center' 
}: TooltipProps) => {
  const [isVisible, setIsVisible] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const show = () => setIsVisible(true);
  const hide = () => {
    setIsVisible(false);
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  // Long press for mobile
  const handleTouchStart = () => {
    timerRef.current = setTimeout(() => {
      show();
    }, 500);
  };

  const handleTouchEnd = () => {
    if (timerRef.current) clearTimeout(timerRef.current);
  };

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        hide();
      }
    };

    if (isVisible) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isVisible]);

  const alignStyles = {
    start: 'left-0',
    center: 'left-1/2 -translate-x-1/2',
    end: 'right-0',
  };

  const positionClasses = {
    top: cn('bottom-full mb-2', alignStyles[align]),
    bottom: cn('top-full mt-2', alignStyles[align]),
    left: 'right-full top-1/2 -translate-y-1/2 mr-2',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2',
  };

  return (
    <div
      ref={containerRef}
      className={cn('relative inline-block', isVisible && 'z-[100]')}
      onMouseEnter={show}
      onMouseLeave={hide}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {children}
      {isVisible && (
        <div
          className={cn(
            'absolute z-[100] px-3 py-2 bg-surface-glass backdrop-blur-xl border border-default rounded-lg shadow-2xl pointer-events-none transition-opacity duration-200 min-w-[120px] max-w-[240px] text-left',
            positionClasses[position],
            className
          )}
        >
          <div className="text-[10px] font-mono text-primary uppercase tracking-wider break-words leading-relaxed">
            {content}
          </div>
        </div>
      )}
    </div>
  );
};


