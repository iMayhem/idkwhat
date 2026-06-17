import { useState, useEffect, useRef } from "react";

/**
 * Custom hook to map mouse-wheel spin momentum to Z perspective coordinates
 * with heavy friction dampening for smooth cinematic depth transitions.
 */
export function usePerspectiveScroller(initialZ: number = 10, minZ: number = 4, maxZ: number = 18) {
  const [zPosition, setZPosition] = useState<number>(initialZ);
  const targetZRef = useRef<number>(initialZ);
  const currentZRef = useRef<number>(initialZ);
  const velocityRef = useRef<number>(0);

  useEffect(() => {
    const handleWheel = (e: WheelEvent) => {
      // Scale scroll intensity and add to velocity target
      const scale = 0.003;
      velocityRef.current += e.deltaY * scale;
      
      // Limit acceleration bounds
      velocityRef.current = Math.max(-1.5, Math.min(1.5, velocityRef.current));
    };

    window.addEventListener("wheel", handleWheel, { passive: true });

    let animationFrameId: number;

    const tick = () => {
      // Exponential target shifting with heavy damping (friction of 0.85)
      targetZRef.current += velocityRef.current;
      targetZRef.current = Math.max(minZ, Math.min(maxZ, targetZRef.current));

      // Friction slows down the speed velocity toward 0
      velocityRef.current *= 0.88;

      // Bring actual position to target position with lerp
      currentZRef.current += (targetZRef.current - currentZRef.current) * 0.1;
      
      // Update React state
      setZPosition(parseFloat(currentZRef.current.toFixed(4)));

      animationFrameId = requestAnimationFrame(tick);
    };

    animationFrameId = requestAnimationFrame(tick);

    return () => {
      window.removeEventListener("wheel", handleWheel);
      cancelAnimationFrame(animationFrameId);
    };
  }, [minZ, maxZ]);

  const resetScroller = (zValue: number) => {
    targetZRef.current = zValue;
    currentZRef.current = zValue;
    velocityRef.current = 0;
    setZPosition(zValue);
  };

  return { zPosition, resetScroller, velocity: velocityRef.current };
}
