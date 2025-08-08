#!/usr/bin/env tsx

import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'

interface TestResult {
  suite: string
  passed: number
  failed: number
  duration: number
  errors: string[]
}

interface TestReport {
  timestamp: string
  totalTests: number
  totalPassed: number
  totalFailed: number
  totalDuration: number
  suites: TestResult[]
  coverage?: any
}

class IntegrationTestRunner {
  private results: TestResult[] = []
  private startTime: number = 0

  async runAllTests(): Promise<TestReport> {
    console.log('🚀 Starting comprehensive integration test suite...\n')
    this.startTime = Date.now()

    // Run different test suites
    await this.runTestSuite('Unit Tests', 'npm run test -- --coverage --passWithNoTests')
    await this.runTestSuite('Integration Tests', 'npm run test:integration')
    await this.runTestSuite('Smart Contract Tests', 'npm run hardhat:test')
    await this.runTestSuite('E2E Tests', 'npm run test:e2e')
    await this.runTestSuite('Load Tests', 'npm run test:load')

    const report = this.generateReport()
    await this.saveReport(report)
    this.printSummary(report)

    return report
  }

  private async runTestSuite(name: string, command: string): Promise<void> {
    console.log(`📋 Running ${name}...`)
    const startTime = Date.now()

    try {
      const result = await this.executeCommand(command)
      const duration = Date.now() - startTime

      const testResult: TestResult = {
        suite: name,
        passed: this.extractPassedCount(result.stdout),
        failed: this.extractFailedCount(result.stdout),
        duration,
        errors: this.extractErrors(result.stderr)
      }

      this.results.push(testResult)
      console.log(`✅ ${name} completed: ${testResult.passed} passed, ${testResult.failed} failed\n`)

    } catch (error: any) {
      const duration = Date.now() - startTime
      const testResult: TestResult = {
        suite: name,
        passed: 0,
        failed: 1,
        duration,
        errors: [error.message]
      }

      this.results.push(testResult)
      console.log(`❌ ${name} failed: ${error.message}\n`)
    }
  }

  private executeCommand(command: string): Promise<{ stdout: string; stderr: string }> {
    return new Promise((resolve, reject) => {
      const [cmd, ...args] = command.split(' ')
      const process = spawn(cmd, args, { 
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: true 
      })

      let stdout = ''
      let stderr = ''

      process.stdout?.on('data', (data) => {
        stdout += data.toString()
      })

      process.stderr?.on('data', (data) => {
        stderr += data.toString()
      })

      process.on('close', (code) => {
        if (code === 0) {
          resolve({ stdout, stderr })
        } else {
          reject(new Error(`Command failed with code ${code}: ${stderr}`))
        }
      })

      process.on('error', (error) => {
        reject(error)
      })
    })
  }

  private extractPassedCount(output: string): number {
    const match = output.match(/(\d+) passing/i) || output.match(/(\d+) passed/i)
    return match ? parseInt(match[1]) : 0
  }

  private extractFailedCount(output: string): number {
    const match = output.match(/(\d+) failing/i) || output.match(/(\d+) failed/i)
    return match ? parseInt(match[1]) : 0
  }

  private extractErrors(stderr: string): string[] {
    const errors = []
    const lines = stderr.split('\n')
    
    for (const line of lines) {
      if (line.includes('Error:') || line.includes('Failed:') || line.includes('✗')) {
        errors.push(line.trim())
      }
    }
    
    return errors
  }

  private generateReport(): TestReport {
    const totalDuration = Date.now() - this.startTime
    const totalPassed = this.results.reduce((sum, result) => sum + result.passed, 0)
    const totalFailed = this.results.reduce((sum, result) => sum + result.failed, 0)
    const totalTests = totalPassed + totalFailed

    return {
      timestamp: new Date().toISOString(),
      totalTests,
      totalPassed,
      totalFailed,
      totalDuration,
      suites: this.results
    }
  }

  private async saveReport(report: TestReport): Promise<void> {
    const reportsDir = path.join(process.cwd(), 'test-reports')
    
    if (!fs.existsSync(reportsDir)) {
      fs.mkdirSync(reportsDir, { recursive: true })
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const reportPath = path.join(reportsDir, `integration-test-report-${timestamp}.json`)
    
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2))
    console.log(`📊 Test report saved to: ${reportPath}`)

    // Also save as latest
    const latestPath = path.join(reportsDir, 'latest-integration-report.json')
    fs.writeFileSync(latestPath, JSON.stringify(report, null, 2))

    // Generate HTML report
    await this.generateHtmlReport(report, reportsDir)
  }

  private async generateHtmlReport(report: TestReport, reportsDir: string): Promise<void> {
    const htmlContent = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>MorphSave Integration Test Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; background-color: #f5f5f5; }
        .container { max-width: 1200px; margin: 0 auto; background: white; padding: 20px; border-radius: 8px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { text-align: center; margin-bottom: 30px; }
        .summary { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-bottom: 30px; }
        .metric { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; }
        .metric h3 { margin: 0 0 10px 0; color: #333; }
        .metric .value { font-size: 2em; font-weight: bold; }
        .passed { color: #28a745; }
        .failed { color: #dc3545; }
        .duration { color: #6c757d; }
        .suite { margin-bottom: 20px; border: 1px solid #dee2e6; border-radius: 8px; overflow: hidden; }
        .suite-header { background: #e9ecef; padding: 15px; font-weight: bold; }
        .suite-content { padding: 15px; }
        .suite-stats { display: flex; gap: 20px; margin-bottom: 10px; }
        .errors { background: #f8d7da; border: 1px solid #f5c6cb; border-radius: 4px; padding: 10px; margin-top: 10px; }
        .error-item { margin: 5px 0; font-family: monospace; font-size: 0.9em; }
        .timestamp { text-align: center; color: #6c757d; margin-top: 20px; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>🧪 MorphSave Integration Test Report</h1>
            <p>Comprehensive test suite results</p>
        </div>

        <div class="summary">
            <div class="metric">
                <h3>Total Tests</h3>
                <div class="value">${report.totalTests}</div>
            </div>
            <div class="metric">
                <h3>Passed</h3>
                <div class="value passed">${report.totalPassed}</div>
            </div>
            <div class="metric">
                <h3>Failed</h3>
                <div class="value failed">${report.totalFailed}</div>
            </div>
            <div class="metric">
                <h3>Duration</h3>
                <div class="value duration">${Math.round(report.totalDuration / 1000)}s</div>
            </div>
            <div class="metric">
                <h3>Success Rate</h3>
                <div class="value ${report.totalFailed === 0 ? 'passed' : 'failed'}">
                    ${Math.round((report.totalPassed / report.totalTests) * 100)}%
                </div>
            </div>
        </div>

        <div class="suites">
            ${report.suites.map(suite => `
                <div class="suite">
                    <div class="suite-header">
                        ${suite.suite}
                        ${suite.failed === 0 ? '✅' : '❌'}
                    </div>
                    <div class="suite-content">
                        <div class="suite-stats">
                            <span class="passed">✅ ${suite.passed} passed</span>
                            <span class="failed">❌ ${suite.failed} failed</span>
                            <span class="duration">⏱️ ${Math.round(suite.duration / 1000)}s</span>
                        </div>
                        ${suite.errors.length > 0 ? `
                            <div class="errors">
                                <strong>Errors:</strong>
                                ${suite.errors.map(error => `<div class="error-item">${error}</div>`).join('')}
                            </div>
                        ` : ''}
                    </div>
                </div>
            `).join('')}
        </div>

        <div class="timestamp">
            Generated on ${new Date(report.timestamp).toLocaleString()}
        </div>
    </div>
</body>
</html>`

    const htmlPath = path.join(reportsDir, 'integration-test-report.html')
    fs.writeFileSync(htmlPath, htmlContent)
    console.log(`📄 HTML report generated: ${htmlPath}`)
  }

  private printSummary(report: TestReport): void {
    console.log('\n' + '='.repeat(60))
    console.log('📊 INTEGRATION TEST SUMMARY')
    console.log('='.repeat(60))
    console.log(`Total Tests: ${report.totalTests}`)
    console.log(`Passed: ${report.totalPassed} ✅`)
    console.log(`Failed: ${report.totalFailed} ${report.totalFailed > 0 ? '❌' : '✅'}`)
    console.log(`Success Rate: ${Math.round((report.totalPassed / report.totalTests) * 100)}%`)
    console.log(`Total Duration: ${Math.round(report.totalDuration / 1000)}s`)
    console.log('='.repeat(60))

    if (report.totalFailed > 0) {
      console.log('\n❌ FAILED SUITES:')
      report.suites.filter(s => s.failed > 0).forEach(suite => {
        console.log(`  • ${suite.suite}: ${suite.failed} failures`)
        suite.errors.forEach(error => {
          console.log(`    - ${error}`)
        })
      })
    } else {
      console.log('\n🎉 ALL TESTS PASSED!')
    }

    console.log('\n')
  }
}

// Run if called directly
if (require.main === module) {
  const runner = new IntegrationTestRunner()
  runner.runAllTests()
    .then((report) => {
      process.exit(report.totalFailed > 0 ? 1 : 0)
    })
    .catch((error) => {
      console.error('❌ Test runner failed:', error)
      process.exit(1)
    })
}

export { IntegrationTestRunner }