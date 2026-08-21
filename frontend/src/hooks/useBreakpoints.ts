import { useState, useEffect } from 'react';

export function useBreakpoints() {
  const [isMobile, setIsMobile] = useState(false);
  const [isTablet, setIsTablet] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);

  useEffect(() => {
    const checkBreakpoints = () => {
      const width = window.innerWidth;
      // Mobile: < 640px
      setIsMobile(width < 640);
      // Tablet: 640px - 1024px
      setIsTablet(width >= 640 && width < 1024);
      // Desktop: >= 1024px
      setIsDesktop(width >= 1024);
    };

    // Initial check
    checkBreakpoints();

    // Listen for resize events
    window.addEventListener('resize', checkBreakpoints);

    // Cleanup
    return () => window.removeEventListener('resize', checkBreakpoints);
  }, []);

  return { isMobile, isTablet, isDesktop };
}