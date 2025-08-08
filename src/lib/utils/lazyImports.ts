import { lazy, ComponentType, Suspense, useState, useEffect, useRef } from 'react';
import { LoadingSpinner } from '../../components/ui/LoadingSpinner';

/**
 * Utility for creating lazy-loaded components with loading fallbacks
 */
export function createLazyComponent<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  fallback: ComponentType = LoadingSpinner
): T {
  const LazyComponent = lazy(importFn);
  
  return ((props: any) => (
    <Suspense fallback={<fallback />}>
      <LazyComponent {...props} />
    </Suspense>
  )) as T;
}

/**
 * Preload a component for better UX
 */
export function preloadComponent(importFn: () => Promise<any>): void {
  if (typeof window !== 'undefined') {
    // Only preload on client side
    const link = document.createElement('link');
    link.rel = 'modulepreload';
    importFn().catch(() => {
      // Ignore preload errors
    });
  }
}

/**
 * Lazy load components based on viewport intersection
 */
export function createIntersectionLazyComponent<T extends ComponentType<any>>(
  importFn: () => Promise<{ default: T }>,
  options: IntersectionObserverInit = { rootMargin: '50px' }
): T {
  return ((props: any) => {
    const [shouldLoad, setShouldLoad] = useState(false);
    const ref = useRef<HTMLDivElement>(null);

    useEffect(() => {
      const observer = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) {
            setShouldLoad(true);
            observer.disconnect();
          }
        },
        options
      );

      if (ref.current) {
        observer.observe(ref.current);
      }

      return () => observer.disconnect();
    }, []);

    if (!shouldLoad) {
      return <div ref={ref} className="min-h-[200px] flex items-center justify-center">
        <LoadingSpinner />
      </div>;
    }

    const LazyComponent = lazy(importFn);
    return (
      <Suspense fallback={<LoadingSpinner />}>
        <LazyComponent {...props} />
      </Suspense>
    );
  }) as T;
}