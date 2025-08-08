module.exports = {
  extends: 'lighthouse:default',
  settings: {
    // Run on mobile device
    formFactor: 'mobile',
    throttling: {
      rttMs: 150,
      throughputKbps: 1.6 * 1024,
      cpuSlowdownMultiplier: 4,
      requestLatencyMs: 150,
      downloadThroughputKbps: 1.6 * 1024,
      uploadThroughputKbps: 750,
    },
    screenEmulation: {
      mobile: true,
      width: 375,
      height: 667,
      deviceScaleFactor: 2,
      disabled: false,
    },
    emulatedUserAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1',
  },
  audits: [
    // Core Web Vitals
    'largest-contentful-paint',
    'first-contentful-paint',
    'cumulative-layout-shift',
    'total-blocking-time',
    
    // Mobile-specific audits
    'viewport',
    'tap-targets',
    'font-size',
    'content-width',
    
    // Performance audits
    'speed-index',
    'interactive',
    'first-meaningful-paint',
    'estimated-input-latency',
    
    // Resource audits
    'unused-css-rules',
    'unused-javascript',
    'render-blocking-resources',
    'unminified-css',
    'unminified-javascript',
    'efficient-animated-content',
    'offscreen-images',
    'webp-images',
    'uses-optimized-images',
    'uses-text-compression',
    'uses-responsive-images',
    
    // Caching audits
    'uses-long-cache-ttl',
    'uses-rel-preconnect',
    'uses-rel-preload',
    
    // Bundle audits
    'total-byte-weight',
    'dom-size',
    'critical-request-chains',
    'user-timings',
    
    // PWA audits
    'service-worker',
    'offline-start-url',
    'is-on-https',
    'redirects-http',
    'installable-manifest',
    'splash-screen',
    'themed-omnibox',
    'maskable-icon',
  ],
  categories: {
    performance: {
      title: 'Performance',
      auditRefs: [
        { id: 'first-contentful-paint', weight: 10 },
        { id: 'largest-contentful-paint', weight: 25 },
        { id: 'speed-index', weight: 10 },
        { id: 'cumulative-layout-shift', weight: 25 },
        { id: 'total-blocking-time', weight: 30 },
      ],
    },
    'mobile-performance': {
      title: 'Mobile Performance',
      description: 'Mobile-specific performance metrics',
      auditRefs: [
        { id: 'viewport', weight: 10 },
        { id: 'tap-targets', weight: 10 },
        { id: 'font-size', weight: 5 },
        { id: 'content-width', weight: 5 },
        { id: 'estimated-input-latency', weight: 10 },
        { id: 'interactive', weight: 10 },
      ],
    },
    'resource-optimization': {
      title: 'Resource Optimization',
      description: 'Optimization of images, CSS, and JavaScript',
      auditRefs: [
        { id: 'unused-css-rules', weight: 10 },
        { id: 'unused-javascript', weight: 10 },
        { id: 'render-blocking-resources', weight: 15 },
        { id: 'unminified-css', weight: 5 },
        { id: 'unminified-javascript', weight: 5 },
        { id: 'offscreen-images', weight: 10 },
        { id: 'webp-images', weight: 5 },
        { id: 'uses-optimized-images', weight: 10 },
        { id: 'uses-text-compression', weight: 10 },
        { id: 'uses-responsive-images', weight: 5 },
        { id: 'efficient-animated-content', weight: 5 },
        { id: 'total-byte-weight', weight: 10 },
      ],
    },
    'caching': {
      title: 'Caching Strategy',
      description: 'Effective use of caching for performance',
      auditRefs: [
        { id: 'uses-long-cache-ttl', weight: 30 },
        { id: 'uses-rel-preconnect', weight: 20 },
        { id: 'uses-rel-preload', weight: 20 },
        { id: 'critical-request-chains', weight: 30 },
      ],
    },
  },
  // Performance budgets
  budgets: [
    {
      path: '/*',
      timings: [
        { metric: 'first-contentful-paint', budget: 2000 },
        { metric: 'largest-contentful-paint', budget: 2500 },
        { metric: 'speed-index', budget: 3000 },
        { metric: 'interactive', budget: 3500 },
        { metric: 'total-blocking-time', budget: 300 },
        { metric: 'cumulative-layout-shift', budget: 0.1 },
      ],
      resourceSizes: [
        { resourceType: 'total', budget: 1600 }, // 1.6MB total
        { resourceType: 'script', budget: 600 }, // 600KB JS
        { resourceType: 'stylesheet', budget: 150 }, // 150KB CSS
        { resourceType: 'image', budget: 800 }, // 800KB images
        { resourceType: 'font', budget: 100 }, // 100KB fonts
      ],
      resourceCounts: [
        { resourceType: 'total', budget: 100 },
        { resourceType: 'script', budget: 20 },
        { resourceType: 'stylesheet', budget: 10 },
        { resourceType: 'image', budget: 30 },
        { resourceType: 'font', budget: 5 },
      ],
    },
  ],
};