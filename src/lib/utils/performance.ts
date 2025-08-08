'use client';

// Performance monitoring utilities
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Map<string, number> = new Map();
  private observers: PerformanceObserver[] = [];

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  constructor() {
    if (typeof window !== 'undefined') {
      this.initializeObservers();
    }
  }

  private initializeObservers() {
    // Observe Core Web Vitals
    if ('PerformanceObserver' in window) {
      // Largest Contentful Paint (LCP)
      const lcpObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        const lastEntry = entries[entries.length - 1];
        this.metrics.set('LCP', lastEntry.startTime);
      });
      lcpObserver.observe({ entryTypes: ['largest-contentful-paint'] });
      this.observers.push(lcpObserver);

      // First Input Delay (FID)
      const fidObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          this.metrics.set('FID', entry.processingStart - entry.startTime);
        });
      });
      fidObserver.observe({ entryTypes: ['first-input'] });
      this.observers.push(fidObserver);

      // Cumulative Layout Shift (CLS)
      let clsValue = 0;
      const clsObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          if (!entry.hadRecentInput) {
            clsValue += entry.value;
            this.metrics.set('CLS', clsValue);
          }
        });
      });
      clsObserver.observe({ entryTypes: ['layout-shift'] });
      this.observers.push(clsObserver);

      // Time to First Byte (TTFB)
      const navigationObserver = new PerformanceObserver((list) => {
        const entries = list.getEntries();
        entries.forEach((entry: any) => {
          this.metrics.set('TTFB', entry.responseStart - entry.requestStart);
        });
      });
      navigationObserver.observe({ entryTypes: ['navigation'] });
      this.observers.push(navigationObserver);
    }
  }

  // Mark performance timing
  mark(name: string): void {
    if (typeof window !== 'undefined' && 'performance' in window) {
      performance.mark(name);
    }
  }

  // Measure performance between marks
  measure(name: string, startMark: string, endMark?: string): number {
    if (typeof window !== 'undefined' && 'performance' in window) {
      const measurement = performance.measure(name, startMark, endMark);
      this.metrics.set(name, measurement.duration);
      return measurement.duration;
    }
    return 0;
  }

  // Get all metrics
  getMetrics(): Record<string, number> {
    return Object.fromEntries(this.metrics);
  }

  // Get specific metric
  getMetric(name: string): number | undefined {
    return this.metrics.get(name);
  }

  // Report metrics to analytics
  reportMetrics(): void {
    const metrics = this.getMetrics();
    
    // Send to analytics service
    if (typeof window !== 'undefined' && window.gtag) {
      Object.entries(metrics).forEach(([name, value]) => {
        window.gtag('event', 'performance_metric', {
          metric_name: name,
          metric_value: Math.round(value),
        });
      });
    }

    // Log to console in development
    if (process.env.NODE_ENV === 'development') {
      console.table(metrics);
    }
  }

  // Clean up observers
  disconnect(): void {
    this.observers.forEach(observer => observer.disconnect());
    this.observers = [];
  }
}

// React hook for performance monitoring
export const usePerformanceMonitor = () => {
  const monitor = PerformanceMonitor.getInstance();

  const startTiming = (name: string) => {
    monitor.mark(`${name}-start`);
  };

  const endTiming = (name: string) => {
    monitor.mark(`${name}-end`);
    return monitor.measure(name, `${name}-start`, `${name}-end`);
  };

  const reportMetrics = () => {
    monitor.reportMetrics();
  };

  return { startTiming, endTiming, reportMetrics, getMetrics: monitor.getMetrics.bind(monitor) };
};

// Bundle size analyzer
export const analyzeBundleSize = () => {
  if (typeof window === 'undefined') return;

  const scripts = Array.from(document.querySelectorAll('script[src]'));
  const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"]'));

  const analyzeResources = async () => {
    const resourceSizes: Record<string, number> = {};

    // Analyze scripts
    for (const script of scripts) {
      const src = (script as HTMLScriptElement).src;
      if (src) {
        try {
          const response = await fetch(src, { method: 'HEAD' });
          const size = parseInt(response.headers.get('content-length') || '0');
          resourceSizes[src] = size;
        } catch (error) {
          console.warn('Failed to analyze script size:', src);
        }
      }
    }

    // Analyze stylesheets
    for (const style of styles) {
      const href = (style as HTMLLinkElement).href;
      if (href) {
        try {
          const response = await fetch(href, { method: 'HEAD' });
          const size = parseInt(response.headers.get('content-length') || '0');
          resourceSizes[href] = size;
        } catch (error) {
          console.warn('Failed to analyze stylesheet size:', href);
        }
      }
    }

    return resourceSizes;
  };

  return analyzeResources();
};

// Image optimization utilities
export const optimizeImageLoading = () => {
  // Preload critical images
  const preloadCriticalImages = (urls: string[]) => {
    urls.forEach(url => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = 'image';
      link.href = url;
      document.head.appendChild(link);
    });
  };

  // Lazy load images with Intersection Observer
  const lazyLoadImages = () => {
    const images = document.querySelectorAll('img[data-src]');
    
    if ('IntersectionObserver' in window) {
      const imageObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            const img = entry.target as HTMLImageElement;
            img.src = img.dataset.src!;
            img.removeAttribute('data-src');
            imageObserver.unobserve(img);
          }
        });
      }, {
        rootMargin: '50px 0px',
      });

      images.forEach(img => imageObserver.observe(img));
    } else {
      // Fallback for browsers without Intersection Observer
      images.forEach(img => {
        const image = img as HTMLImageElement;
        image.src = image.dataset.src!;
        image.removeAttribute('data-src');
      });
    }
  };

  return { preloadCriticalImages, lazyLoadImages };
};

// Network-aware loading
export const useNetworkAwareLoading = () => {
  const getConnectionInfo = () => {
    if (typeof navigator !== 'undefined' && 'connection' in navigator) {
      const connection = (navigator as any).connection;
      return {
        effectiveType: connection.effectiveType,
        downlink: connection.downlink,
        rtt: connection.rtt,
        saveData: connection.saveData,
      };
    }
    return null;
  };

  const shouldLoadHighQuality = () => {
    const connection = getConnectionInfo();
    if (!connection) return true; // Default to high quality if unknown

    // Load high quality on fast connections
    return connection.effectiveType === '4g' && 
           connection.downlink > 1.5 && 
           !connection.saveData;
  };

  const getOptimalImageQuality = () => {
    const connection = getConnectionInfo();
    if (!connection) return 75; // Default quality

    if (connection.saveData) return 50;
    if (connection.effectiveType === '2g') return 40;
    if (connection.effectiveType === '3g') return 60;
    return 75; // 4g and above
  };

  return { getConnectionInfo, shouldLoadHighQuality, getOptimalImageQuality };
};

// Memory usage monitoring
export const monitorMemoryUsage = () => {
  if (typeof window === 'undefined' || !('performance' in window)) return;

  const getMemoryInfo = () => {
    const memory = (performance as any).memory;
    if (memory) {
      return {
        usedJSHeapSize: memory.usedJSHeapSize,
        totalJSHeapSize: memory.totalJSHeapSize,
        jsHeapSizeLimit: memory.jsHeapSizeLimit,
        usagePercentage: (memory.usedJSHeapSize / memory.jsHeapSizeLimit) * 100,
      };
    }
    return null;
  };

  const logMemoryUsage = () => {
    const memoryInfo = getMemoryInfo();
    if (memoryInfo && process.env.NODE_ENV === 'development') {
      console.log('Memory Usage:', {
        used: `${(memoryInfo.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
        total: `${(memoryInfo.totalJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
        limit: `${(memoryInfo.jsHeapSizeLimit / 1024 / 1024).toFixed(2)} MB`,
        usage: `${memoryInfo.usagePercentage.toFixed(2)}%`,
      });
    }
  };

  return { getMemoryInfo, logMemoryUsage };
};

// Declare global gtag function
declare global {
  interface Window {
    gtag?: (...args: any[]) => void;
  }
}