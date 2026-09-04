import { useEffect } from 'react';

/**
 * Instantly resets window scroll position to top-left.
 */
export const resetScrollToTop = (): void => {
  if (typeof window !== 'undefined') {
    window.scrollTo({
      top: 0,
      left: 0,
      behavior: 'instant'
    });
  }
};

/**
 * React hook to automatically reset scroll position to top whenever
 * specified state or route dependencies change.
 */
export const useScrollToTopOnChange = (deps: any[]): void => {
  useEffect(() => {
    resetScrollToTop();
  }, deps);
};
