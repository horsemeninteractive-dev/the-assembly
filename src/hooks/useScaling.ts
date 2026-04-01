import { useState, useEffect, RefObject } from 'react';

interface ScalingOptions {
  targetWidth?: number;
  targetHeight?: number;
  multiplier?: number;
  minScale?: number;
  maxScale?: number;
  disableOnMobile?: boolean;
}

export function useScaling(
  containerRef: RefObject<HTMLElement | null>,
  {
    targetWidth = 1200,
    targetHeight = 850,
    multiplier = 1,
    minScale = 0.4,
    maxScale = 2,
    disableOnMobile = true,
  }: ScalingOptions = {}
) {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const updateScale = () => {
      if (!containerRef.current) return;

      const w = containerRef.current.clientWidth;
      const h = containerRef.current.clientHeight;

      const scaleW = w / targetWidth;
      const scaleH = h / targetHeight;

      const isMobile = w < 640;
      const autoScale = isMobile && disableOnMobile ? 1 : Math.min(scaleW, scaleH, 1);
      const finalScale = autoScale * multiplier;

      setScale(Math.max(minScale, Math.min(finalScale, maxScale)));
    };

    const observer = new ResizeObserver(updateScale);
    if (containerRef.current) observer.observe(containerRef.current);

    updateScale();
    window.addEventListener('resize', updateScale);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', updateScale);
    };
  }, [containerRef, targetWidth, targetHeight, multiplier, minScale, maxScale, disableOnMobile]);

  return scale;
}



