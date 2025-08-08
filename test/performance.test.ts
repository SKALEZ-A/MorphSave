/**
 * Performance Tests for Mobile Optimization
 * Tests bundle size, loading performance, and mobile-specific optimizations
 */

import { render, screen, waitFor } from '@testing-library/react';
import { PerformanceMonitor, usePerformanceMonitor, analyzeBundleSize, useNetworkAwareLoading } from '../src/lib/utils/performance';
import { createLazyComponent, preloadComponent } from '../src/lib/utils/lazyImports';
import { TouchButton, SwipeableCard, PullToRefresh } from '../src/lib/utils/touchGestures';
import { OptimizedImage } from '../src/components/ui/OptimizedImage';
import { MobileOptimizedLayout } from '../src/components/layout/MobileOptimizedLayout';

// Mock performance API
const mockPerformance = {
  mark: jest.fn(),
  measure: jest.fn(() => ({ duration: 100 })),
  getEntriesByType: jest.fn(() => []),
  now: jest.fn(() => Date.now()),
};

// Mock PerformanceObserver
class MockPerformanceObserver {
  constructor(private callback: (list: any) => void) {}
  observe = jest.fn();
  disconnect = jest.fn();
}

global.PerformanceObserver = MockPerformanceObserver as any;
global.performance = mockPerformance as any;

describe('Performance Monitoring', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('PerformanceMonitor', () => {
    it('should create singleton instance', () => {
      const monitor1 = PerformanceMonitor.getInstance();
      const monitor2 = PerformanceMonitor.getInstance();
      expect(monitor1).toBe(monitor2);
    });

    it('should mark performance timing', () => {
      const monitor = PerformanceMonitor.getInstance();
      monitor.mark('test-mark');
      expect(mockPerformance.mark).toHaveBeenCalledWith('test-mark');
    });

    it('should measure performance between marks', () => {
      const monitor = PerformanceMonitor.getInstance();
      const duration = monitor.measure('test-measure', 'start', 'end');
      expect(mockPerformance.measure).toHaveBeenCalledWith('test-measure', 'start', 'end');
      expect(duration).toBe(100);
    });

    it('should store and retrieve metrics', () => {
      const monitor = PerformanceMonitor.getInstance();
      monitor.measure('test-metric', 'start', 'end');
      const metrics = monitor.getMetrics();
      expect(metrics['test-metric']).toBe(100);
    });
  });

  describe('usePerformanceMonitor hook', () => {
    it('should provide timing functions', () => {
      const TestComponent = () => {
        const { startTiming, endTiming } = usePerformanceMonitor();
        
        React.useEffect(() => {
          startTiming('component-load');
          setTimeout(() => endTiming('component-load'), 100);
        }, [startTiming, endTiming]);

        return React.createElement('div', null, 'Test Component');
      };

      render(React.createElement(TestComponent));
      expect(mockPerformance.mark).toHaveBeenCalledWith('component-load-start');
    });
  });
});

describe('Bundle Size Analysis', () => {
  beforeEach(() => {
    // Mock DOM elements
    document.head.innerHTML = '';
    document.body.innerHTML = '';
    
    // Mock fetch for bundle analysis
    global.fetch = jest.fn(() =>
      Promise.resolve({
        headers: {
          get: (name: string) => name === 'content-length' ? '1024' : null,
        },
      })
    ) as jest.Mock;
  });

  it('should analyze script sizes', async () => {
    // Add mock script elements
    const script = document.createElement('script');
    script.src = '/test-script.js';
    document.head.appendChild(script);

    const sizes = await analyzeBundleSize();
    expect(sizes).toBeDefined();
    expect(fetch).toHaveBeenCalledWith('/test-script.js', { method: 'HEAD' });
  });

  it('should handle fetch errors gracefully', async () => {
    global.fetch = jest.fn(() => Promise.reject(new Error('Network error')));
    
    const script = document.createElement('script');
    script.src = '/failing-script.js';
    document.head.appendChild(script);

    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
    const sizes = await analyzeBundleSize();
    
    expect(consoleSpy).toHaveBeenCalledWith('Failed to analyze script size:', '/failing-script.js');
    consoleSpy.mockRestore();
  });
});

describe('Lazy Loading Components', () => {
  it('should create lazy component with loading fallback', async () => {
    const MockComponent = () => React.createElement('div', null, 'Lazy Component');
    const LazyComponent = createLazyComponent(() => Promise.resolve({ default: MockComponent }));

    render(React.createElement(LazyComponent));
    
    // Should show loading initially
    expect(screen.getByRole('status')).toBeInTheDocument();
    
    // Should load component after promise resolves
    await waitFor(() => {
      expect(screen.getByText('Lazy Component')).toBeInTheDocument();
    });
  });

  it('should preload component', () => {
    const mockImport = jest.fn(() => Promise.resolve({ default: () => null }));
    preloadComponent(mockImport);
    expect(mockImport).toHaveBeenCalled();
  });
});

describe('Touch Gestures Performance', () => {
  it('should render TouchButton without performance issues', () => {
    const onPress = jest.fn();
    const startTime = performance.now();
    
    render(
      React.createElement(TouchButton, { onPress }, 'Touch Me')
    );
    
    const renderTime = performance.now() - startTime;
    expect(renderTime).toBeLessThan(16); // Should render within one frame (16ms)
    expect(screen.getByText('Touch Me')).toBeInTheDocument();
  });

  it('should render SwipeableCard efficiently', () => {
    const onSwipeLeft = jest.fn();
    const onSwipeRight = jest.fn();
    const startTime = performance.now();
    
    render(
      <SwipeableCard onSwipeLeft={onSwipeLeft} onSwipeRight={onSwipeRight}>
        <div>Swipeable Content</div>
      </SwipeableCard>
    );
    
    const renderTime = performance.now() - startTime;
    expect(renderTime).toBeLessThan(16);
    expect(screen.getByText('Swipeable Content')).toBeInTheDocument();
  });
});

describe('Image Optimization', () => {
  it('should render OptimizedImage with proper loading states', () => {
    render(
      <OptimizedImage
        src="/test-image.jpg"
        alt="Test Image"
        width={200}
        height={200}
      />
    );

    // Should show loading spinner initially
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('should handle image loading errors gracefully', async () => {
    render(
      <OptimizedImage
        src="/non-existent-image.jpg"
        alt="Test Image"
        width={200}
        height={200}
      />
    );

    // Simulate image error
    const img = screen.getByRole('img', { hidden: true });
    Object.defineProperty(img, 'complete', { value: false });
    img.dispatchEvent(new Event('error'));

    await waitFor(() => {
      expect(screen.getByText('Failed to load image')).toBeInTheDocument();
    });
  });
});

describe('Mobile Layout Performance', () => {
  it('should render MobileOptimizedLayout efficiently', () => {
    const startTime = performance.now();
    
    render(
      <MobileOptimizedLayout title="Test Page">
        <div>Mobile Content</div>
      </MobileOptimizedLayout>
    );
    
    const renderTime = performance.now() - startTime;
    expect(renderTime).toBeLessThan(16);
    expect(screen.getByText('Test Page')).toBeInTheDocument();
    expect(screen.getByText('Mobile Content')).toBeInTheDocument();
  });

  it('should handle scroll events efficiently', () => {
    const { container } = render(
      <MobileOptimizedLayout title="Test Page">
        <div style={{ height: '2000px' }}>Long Content</div>
      </MobileOptimizedLayout>
    );

    // Simulate scroll events
    const scrollEvents = 100;
    const startTime = performance.now();
    
    for (let i = 0; i < scrollEvents; i++) {
      window.dispatchEvent(new Event('scroll'));
    }
    
    const scrollHandlingTime = performance.now() - startTime;
    expect(scrollHandlingTime).toBeLessThan(100); // Should handle 100 scroll events in under 100ms
  });
});

describe('Network-Aware Loading', () => {
  it('should provide connection information', () => {
    // Mock navigator.connection
    Object.defineProperty(navigator, 'connection', {
      value: {
        effectiveType: '4g',
        downlink: 2.5,
        rtt: 100,
        saveData: false,
      },
      configurable: true,
    });

    const TestComponent = () => {
      const { getConnectionInfo, shouldLoadHighQuality } = useNetworkAwareLoading();
      const connection = getConnectionInfo();
      const highQuality = shouldLoadHighQuality();
      
      return (
        <div>
          <div data-testid="connection-type">{connection?.effectiveType}</div>
          <div data-testid="high-quality">{highQuality.toString()}</div>
        </div>
      );
    };

    render(<TestComponent />);
    expect(screen.getByTestId('connection-type')).toHaveTextContent('4g');
    expect(screen.getByTestId('high-quality')).toHaveTextContent('true');
  });

  it('should adjust quality based on connection', () => {
    // Mock slow connection
    Object.defineProperty(navigator, 'connection', {
      value: {
        effectiveType: '2g',
        downlink: 0.5,
        rtt: 500,
        saveData: true,
      },
      configurable: true,
    });

    const TestComponent = () => {
      const { getOptimalImageQuality, shouldLoadHighQuality } = useNetworkAwareLoading();
      const quality = getOptimalImageQuality();
      const highQuality = shouldLoadHighQuality();
      
      return (
        <div>
          <div data-testid="image-quality">{quality}</div>
          <div data-testid="high-quality">{highQuality.toString()}</div>
        </div>
      );
    };

    render(<TestComponent />);
    expect(screen.getByTestId('image-quality')).toHaveTextContent('50'); // Low quality for save-data
    expect(screen.getByTestId('high-quality')).toHaveTextContent('false');
  });
});

describe('Memory Usage Monitoring', () => {
  it('should monitor memory usage when available', () => {
    // Mock performance.memory
    Object.defineProperty(performance, 'memory', {
      value: {
        usedJSHeapSize: 10 * 1024 * 1024, // 10MB
        totalJSHeapSize: 20 * 1024 * 1024, // 20MB
        jsHeapSizeLimit: 100 * 1024 * 1024, // 100MB
      },
      configurable: true,
    });

    const { monitorMemoryUsage } = require('../src/lib/utils/performance');
    const { getMemoryInfo } = monitorMemoryUsage();
    const memoryInfo = getMemoryInfo();

    expect(memoryInfo).toBeDefined();
    expect(memoryInfo.usagePercentage).toBe(10); // 10MB / 100MB = 10%
  });
});

// Performance benchmarks
describe('Performance Benchmarks', () => {
  const PERFORMANCE_THRESHOLDS = {
    COMPONENT_RENDER_TIME: 16, // 16ms (one frame)
    BUNDLE_SIZE_LIMIT: 500 * 1024, // 500KB
    IMAGE_LOAD_TIME: 1000, // 1 second
    TOUCH_RESPONSE_TIME: 100, // 100ms
  };

  it('should meet component render time benchmarks', () => {
    const components = [
      () => <TouchButton onPress={() => {}}>Button</TouchButton>,
      () => <OptimizedImage src="/test.jpg" alt="Test" width={100} height={100} />,
      () => <MobileOptimizedLayout><div>Content</div></MobileOptimizedLayout>,
    ];

    components.forEach((Component, index) => {
      const startTime = performance.now();
      render(<Component />);
      const renderTime = performance.now() - startTime;
      
      expect(renderTime).toBeLessThan(PERFORMANCE_THRESHOLDS.COMPONENT_RENDER_TIME);
    });
  });

  it('should meet touch response time benchmarks', async () => {
    const onPress = jest.fn();
    const startTime = performance.now();
    
    render(<TouchButton onPress={onPress}>Touch Me</TouchButton>);
    
    const button = screen.getByText('Touch Me');
    button.click();
    
    const responseTime = performance.now() - startTime;
    expect(responseTime).toBeLessThan(PERFORMANCE_THRESHOLDS.TOUCH_RESPONSE_TIME);
    expect(onPress).toHaveBeenCalled();
  });
});

// Import React for hooks
import React from 'react';
import { Content } from 'next/font/google';

import { Button } from '@/components';

import { Button } from '@/components';

import { Content } from 'next/font/google';

import { Content } from 'next/font/google';

import { Content } from 'next/font/google';

import style from 'styled-jsx/style';

import { title } from 'process';

import { Content } from 'next/font/google';

import { Content } from 'next/font/google';

import { Content } from 'next/font/google';

import { title } from 'process';

import { Content } from 'next/font/google';

import { Content } from 'next/font/google';

import { Content } from 'next/font/google';

import { Button } from '@/components';

import { Content } from 'next/font/google';

import style from 'styled-jsx/style';

import style from 'styled-jsx/style';

import { title } from 'process';

import { title } from 'process';

import { Content } from 'next/font/google';

import { title } from 'process';

import { title } from 'process';

import { Content } from 'next/font/google';
