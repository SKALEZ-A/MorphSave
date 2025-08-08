#!/usr/bin/env tsx

/**
 * Performance Testing Script
 * Runs comprehensive performance tests including Lighthouse audits,
 * bundle analysis, and mobile performance benchmarks
 */

import { execSync } from 'child_process';
import { writeFileSync, readFileSync, existsSync } from 'fs';
import { join } from 'path';

interface PerformanceResults {
  lighthouse: any;
  bundleAnalysis: any;
  loadTimes: Record<string, number>;
  memoryUsage: any;
  timestamp: string;
}

class PerformanceTester {
  private results: PerformanceResults = {
    lighthouse: null,
    bundleAnalysis: null,
    loadTimes: {},
    memoryUsage: null,
    timestamp: new Date().toISOString(),
  };

  async runAllTests(): Promise<void> {
    console.log('🚀 Starting comprehensive performance tests...\n');

    try {
      await this.buildApplication();
      await this.runLighthouseAudit();
      await this.analyzeBundleSize();
      await this.measureLoadTimes();
      await this.generateReport();
    } catch (error) {
      console.error('❌ Performance tests failed:', error);
      process.exit(1);
    }
  }

  private async buildApplication(): Promise<void> {
    console.log('📦 Building application for production...');
    try {
      execSync('npm run build', { stdio: 'inherit' });
      console.log('✅ Build completed successfully\n');
    } catch (error) {
      throw new Error('Failed to build application');
    }
  }

  private async runLighthouseAudit(): Promise<void> {
    console.log('🔍 Running Lighthouse performance audit...');
    
    try {
      // Start the application server
      const serverProcess = execSync('npm run start &', { stdio: 'pipe' });
      
      // Wait for server to start
      await this.waitForServer('http://localhost:3000', 30000);
      
      // Run Lighthouse audit
      const lighthouseCommand = [
        'lighthouse',
        'http://localhost:3000',
        '--config-path=./lighthouse.config.js',
        '--output=json',
        '--output-path=./lighthouse-results.json',
        '--chrome-flags="--headless --no-sandbox --disable-dev-shm-usage"',
        '--quiet'
      ].join(' ');
      
      execSync(lighthouseCommand, { stdio: 'inherit' });
      
      // Read results
      if (existsSync('./lighthouse-results.json')) {
        const lighthouseData = JSON.parse(readFileSync('./lighthouse-results.json', 'utf8'));
        this.results.lighthouse = this.extractLighthouseMetrics(lighthouseData);
        console.log('✅ Lighthouse audit completed\n');
      }
      
      // Kill server process
      execSync('pkill -f "npm run start"', { stdio: 'ignore' });
      
    } catch (error) {
      console.warn('⚠️  Lighthouse audit failed, continuing with other tests...\n');
    }
  }

  private extractLighthouseMetrics(data: any): any {
    const audits = data.audits;
    return {
      performance: data.categories.performance.score * 100,
      metrics: {
        firstContentfulPaint: audits['first-contentful-paint']?.numericValue,
        largestContentfulPaint: audits['largest-contentful-paint']?.numericValue,
        speedIndex: audits['speed-index']?.numericValue,
        totalBlockingTime: audits['total-blocking-time']?.numericValue,
        cumulativeLayoutShift: audits['cumulative-layout-shift']?.numericValue,
        interactive: audits['interactive']?.numericValue,
      },
      opportunities: Object.keys(audits)
        .filter(key => audits[key].details?.type === 'opportunity')
        .map(key => ({
          audit: key,
          title: audits[key].title,
          description: audits[key].description,
          numericValue: audits[key].numericValue,
          displayValue: audits[key].displayValue,
        })),
      diagnostics: Object.keys(audits)
        .filter(key => audits[key].details?.type === 'diagnostic')
        .map(key => ({
          audit: key,
          title: audits[key].title,
          description: audits[key].description,
          numericValue: audits[key].numericValue,
          displayValue: audits[key].displayValue,
        })),
    };
  }

  private async analyzeBundleSize(): Promise<void> {
    console.log('📊 Analyzing bundle size...');
    
    try {
      // Run bundle analyzer
      execSync('ANALYZE=true npm run build', { stdio: 'pipe' });
      
      // Analyze .next directory for bundle sizes
      const nextDir = './.next';
      if (existsSync(nextDir)) {
        const bundleStats = this.analyzeBundleDirectory(nextDir);
        this.results.bundleAnalysis = bundleStats;
        console.log('✅ Bundle analysis completed\n');
      }
    } catch (error) {
      console.warn('⚠️  Bundle analysis failed, continuing...\n');
    }
  }

  private analyzeBundleDirectory(dir: string): any {
    const staticDir = join(dir, 'static');
    if (!existsSync(staticDir)) return null;

    const stats = {
      totalSize: 0,
      jsSize: 0,
      cssSize: 0,
      chunks: [] as any[],
    };

    try {
      const chunks = execSync(`find ${staticDir} -name "*.js" -o -name "*.css"`, { encoding: 'utf8' })
        .split('\n')
        .filter(Boolean);

      chunks.forEach(chunk => {
        try {
          const stat = execSync(`stat -c%s "${chunk}"`, { encoding: 'utf8' });
          const size = parseInt(stat.trim());
          const isJS = chunk.endsWith('.js');
          const isCSS = chunk.endsWith('.css');

          stats.totalSize += size;
          if (isJS) stats.jsSize += size;
          if (isCSS) stats.cssSize += size;

          stats.chunks.push({
            file: chunk.replace(staticDir, ''),
            size,
            type: isJS ? 'js' : isCSS ? 'css' : 'other',
          });
        } catch (error) {
          // Ignore individual file errors
        }
      });
    } catch (error) {
      console.warn('Could not analyze bundle directory');
    }

    return stats;
  }

  private async measureLoadTimes(): Promise<void> {
    console.log('⏱️  Measuring page load times...');
    
    const pages = [
      '/',
      '/dashboard',
      '/challenges',
      '/achievements',
      '/friends',
      '/insights',
    ];

    for (const page of pages) {
      try {
        const startTime = Date.now();
        
        // Simulate page load with curl
        execSync(`curl -s -o /dev/null -w "%{time_total}" http://localhost:3000${page}`, {
          stdio: 'pipe',
          timeout: 10000,
        });
        
        const loadTime = Date.now() - startTime;
        this.results.loadTimes[page] = loadTime;
      } catch (error) {
        this.results.loadTimes[page] = -1; // Indicate failure
      }
    }
    
    console.log('✅ Load time measurements completed\n');
  }

  private async generateReport(): Promise<void> {
    console.log('📋 Generating performance report...');
    
    const report = this.createPerformanceReport();
    
    // Write JSON report
    writeFileSync('./performance-report.json', JSON.stringify(this.results, null, 2));
    
    // Write human-readable report
    writeFileSync('./performance-report.md', report);
    
    console.log('✅ Performance report generated');
    console.log('📄 Reports saved:');
    console.log('   - performance-report.json');
    console.log('   - performance-report.md');
    
    // Display summary
    this.displaySummary();
  }

  private createPerformanceReport(): string {
    const { lighthouse, bundleAnalysis, loadTimes } = this.results;
    
    let report = `# Performance Test Report\n\n`;
    report += `**Generated:** ${this.results.timestamp}\n\n`;
    
    // Lighthouse Results
    if (lighthouse) {
      report += `## Lighthouse Performance Audit\n\n`;
      report += `**Overall Performance Score:** ${lighthouse.performance}/100\n\n`;
      
      report += `### Core Web Vitals\n\n`;
      report += `| Metric | Value | Status |\n`;
      report += `|--------|-------|--------|\n`;
      
      const metrics = lighthouse.metrics;
      report += `| First Contentful Paint | ${this.formatTime(metrics.firstContentfulPaint)} | ${this.getStatus(metrics.firstContentfulPaint, 1800)} |\n`;
      report += `| Largest Contentful Paint | ${this.formatTime(metrics.largestContentfulPaint)} | ${this.getStatus(metrics.largestContentfulPaint, 2500)} |\n`;
      report += `| Speed Index | ${this.formatTime(metrics.speedIndex)} | ${this.getStatus(metrics.speedIndex, 3400)} |\n`;
      report += `| Total Blocking Time | ${this.formatTime(metrics.totalBlockingTime)} | ${this.getStatus(metrics.totalBlockingTime, 200)} |\n`;
      report += `| Cumulative Layout Shift | ${metrics.cumulativeLayoutShift?.toFixed(3)} | ${this.getStatus(metrics.cumulativeLayoutShift, 0.1)} |\n`;
      report += `| Time to Interactive | ${this.formatTime(metrics.interactive)} | ${this.getStatus(metrics.interactive, 3800)} |\n\n`;
      
      // Opportunities
      if (lighthouse.opportunities.length > 0) {
        report += `### Performance Opportunities\n\n`;
        lighthouse.opportunities.forEach((opp: any) => {
          report += `- **${opp.title}**: ${opp.description}\n`;
          if (opp.displayValue) {
            report += `  - Potential savings: ${opp.displayValue}\n`;
          }
        });
        report += `\n`;
      }
    }
    
    // Bundle Analysis
    if (bundleAnalysis) {
      report += `## Bundle Size Analysis\n\n`;
      report += `| Resource Type | Size | Status |\n`;
      report += `|---------------|------|--------|\n`;
      report += `| Total Bundle | ${this.formatBytes(bundleAnalysis.totalSize)} | ${this.getBundleStatus(bundleAnalysis.totalSize, 1600 * 1024)} |\n`;
      report += `| JavaScript | ${this.formatBytes(bundleAnalysis.jsSize)} | ${this.getBundleStatus(bundleAnalysis.jsSize, 600 * 1024)} |\n`;
      report += `| CSS | ${this.formatBytes(bundleAnalysis.cssSize)} | ${this.getBundleStatus(bundleAnalysis.cssSize, 150 * 1024)} |\n\n`;
      
      // Largest chunks
      const largestChunks = bundleAnalysis.chunks
        .sort((a: any, b: any) => b.size - a.size)
        .slice(0, 10);
      
      if (largestChunks.length > 0) {
        report += `### Largest Chunks\n\n`;
        report += `| File | Size | Type |\n`;
        report += `|------|------|------|\n`;
        largestChunks.forEach((chunk: any) => {
          report += `| ${chunk.file} | ${this.formatBytes(chunk.size)} | ${chunk.type} |\n`;
        });
        report += `\n`;
      }
    }
    
    // Load Times
    report += `## Page Load Times\n\n`;
    report += `| Page | Load Time | Status |\n`;
    report += `|------|-----------|--------|\n`;
    Object.entries(loadTimes).forEach(([page, time]) => {
      const status = time === -1 ? '❌ Failed' : time < 2000 ? '✅ Good' : time < 4000 ? '⚠️ Needs Improvement' : '❌ Poor';
      const timeStr = time === -1 ? 'Failed' : `${time}ms`;
      report += `| ${page} | ${timeStr} | ${status} |\n`;
    });
    
    return report;
  }

  private formatTime(ms: number): string {
    if (!ms) return 'N/A';
    return `${(ms / 1000).toFixed(2)}s`;
  }

  private formatBytes(bytes: number): string {
    if (!bytes) return 'N/A';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return `${(bytes / Math.pow(1024, i)).toFixed(2)} ${sizes[i]}`;
  }

  private getStatus(value: number, threshold: number): string {
    if (!value) return 'N/A';
    return value <= threshold ? '✅ Good' : value <= threshold * 1.5 ? '⚠️ Needs Improvement' : '❌ Poor';
  }

  private getBundleStatus(size: number, limit: number): string {
    if (!size) return 'N/A';
    return size <= limit ? '✅ Good' : size <= limit * 1.2 ? '⚠️ Large' : '❌ Too Large';
  }

  private displaySummary(): void {
    console.log('\n📊 Performance Summary:');
    
    if (this.results.lighthouse) {
      console.log(`   Performance Score: ${this.results.lighthouse.performance}/100`);
    }
    
    if (this.results.bundleAnalysis) {
      console.log(`   Total Bundle Size: ${this.formatBytes(this.results.bundleAnalysis.totalSize)}`);
    }
    
    const avgLoadTime = Object.values(this.results.loadTimes)
      .filter(time => time !== -1)
      .reduce((sum, time) => sum + time, 0) / Object.keys(this.results.loadTimes).length;
    
    if (avgLoadTime) {
      console.log(`   Average Load Time: ${avgLoadTime.toFixed(0)}ms`);
    }
    
    console.log('\n🎯 Recommendations:');
    this.generateRecommendations();
  }

  private generateRecommendations(): void {
    const { lighthouse, bundleAnalysis } = this.results;
    
    if (lighthouse?.performance < 90) {
      console.log('   - Optimize Core Web Vitals for better performance score');
    }
    
    if (bundleAnalysis?.totalSize > 1600 * 1024) {
      console.log('   - Reduce bundle size through code splitting and tree shaking');
    }
    
    if (bundleAnalysis?.jsSize > 600 * 1024) {
      console.log('   - Implement lazy loading for non-critical JavaScript');
    }
    
    const failedPages = Object.entries(this.results.loadTimes)
      .filter(([, time]) => time === -1 || time > 4000);
    
    if (failedPages.length > 0) {
      console.log('   - Optimize slow-loading pages:', failedPages.map(([page]) => page).join(', '));
    }
  }

  private async waitForServer(url: string, timeout: number): Promise<void> {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      try {
        execSync(`curl -s ${url}`, { stdio: 'pipe' });
        return;
      } catch (error) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    throw new Error('Server failed to start within timeout');
  }
}

// Run performance tests if called directly
if (require.main === module) {
  const tester = new PerformanceTester();
  tester.runAllTests().catch(console.error);
}

export { PerformanceTester };