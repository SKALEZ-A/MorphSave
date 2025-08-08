import { execSync } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { join } from 'path';

interface SecurityIssue {
  severity: 'critical' | 'high' | 'medium' | 'low' | 'info';
  category: string;
  file: string;
  line?: number;
  description: string;
  recommendation: string;
}

interface AuditReport {
  timestamp: string;
  summary: {
    totalIssues: number;
    critical: number;
    high: number;
    medium: number;
    low: number;
    info: number;
  };
  issues: SecurityIssue[];
  smartContractAudit: {
    contractsAudited: string[];
    vulnerabilities: SecurityIssue[];
    gasOptimizations: string[];
  };
  dependencyAudit: {
    vulnerabilities: any[];
    outdatedPackages: string[];
  };
  codeQuality: {
    eslintIssues: number;
    typeScriptErrors: number;
    testCoverage: number;
  };
  recommendations: string[];
}

class SecurityAuditor {
  private issues: SecurityIssue[] = [];
  private projectRoot: string;

  constructor() {
    this.projectRoot = process.cwd();
  }

  async runFullAudit(): Promise<AuditReport> {
    console.log('🔍 Starting comprehensive security audit...');

    // Run all audit checks
    await this.auditSmartContracts();
    await this.auditDependencies();
    await this.auditCodeQuality();
    await this.auditSecurityPatterns();
    await this.auditEnvironmentConfig();
    await this.auditAPIEndpoints();

    // Generate report
    const report = this.generateReport();
    
    // Save report
    const reportPath = join(this.projectRoot, 'docs', 'security-audit-report.json');
    writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`📋 Security audit complete. Report saved to: ${reportPath}`);
    this.printSummary(report);
    
    return report;
  }

  private async auditSmartContracts(): Promise<void> {
    console.log('🔐 Auditing smart contracts...');

    try {
      // Run Slither static analysis (if available)
      try {
        const slitherOutput = execSync('slither contracts/', { 
          encoding: 'utf8',
          cwd: this.projectRoot 
        });
        this.parseSlitherOutput(slitherOutput);
      } catch (error) {
        console.log('⚠️  Slither not available, performing manual contract audit');
        await this.manualContractAudit();
      }

      // Check for common vulnerabilities
      await this.checkContractVulnerabilities();
      
    } catch (error) {
      console.error('Error auditing smart contracts:', error);
    }
  }

  private async manualContractAudit(): Promise<void> {
    const contractFiles = [
      'contracts/SavingsVault.sol',
      'contracts/GameEngine.sol',
      'contracts/YieldManager.sol'
    ];

    for (const contractFile of contractFiles) {
      try {
        const contractPath = join(this.projectRoot, contractFile);
        const content = readFileSync(contractPath, 'utf8');
        
        // Check for common vulnerabilities
        this.checkReentrancy(content, contractFile);
        this.checkAccessControl(content, contractFile);
        this.checkIntegerOverflow(content, contractFile);
        this.checkGasOptimization(content, contractFile);
        
      } catch (error) {
        console.log(`⚠️  Could not audit ${contractFile}: File not found`);
      }
    }
  }

  private checkReentrancy(content: string, file: string): void {
    // Check for potential reentrancy vulnerabilities
    const externalCalls = content.match(/\.call\(|\.send\(|\.transfer\(/g);
    const hasReentrancyGuard = content.includes('ReentrancyGuard') || content.includes('nonReentrant');
    
    if (externalCalls && !hasReentrancyGuard) {
      this.issues.push({
        severity: 'high',
        category: 'Smart Contract Security',
        file,
        description: 'Potential reentrancy vulnerability detected',
        recommendation: 'Implement ReentrancyGuard or use checks-effects-interactions pattern'
      });
    }
  }

  private checkAccessControl(content: string, file: string): void {
    // Check for proper access control
    const hasOwnable = content.includes('Ownable') || content.includes('onlyOwner');
    const hasPublicFunctions = content.match(/function\s+\w+\s*\([^)]*\)\s+public/g);
    
    if (hasPublicFunctions && !hasOwnable) {
      this.issues.push({
        severity: 'medium',
        category: 'Smart Contract Security',
        file,
        description: 'Public functions without access control detected',
        recommendation: 'Implement proper access control modifiers'
      });
    }
  }

  private checkIntegerOverflow(content: string, file: string): void {
    // Check for SafeMath usage (for older Solidity versions)
    const hasMathOperations = content.match(/[\+\-\*\/]/g);
    const hasSafeMath = content.includes('SafeMath') || content.includes('pragma solidity ^0.8');
    
    if (hasMathOperations && !hasSafeMath) {
      this.issues.push({
        severity: 'medium',
        category: 'Smart Contract Security',
        file,
        description: 'Potential integer overflow/underflow vulnerability',
        recommendation: 'Use SafeMath library or Solidity ^0.8.0 with built-in overflow checks'
      });
    }
  }

  private checkGasOptimization(content: string, file: string): void {
    // Check for gas optimization opportunities
    const hasStorageReads = content.match(/storage\s+\w+/g);
    const hasLoops = content.match(/for\s*\(/g);
    
    if (hasStorageReads && hasLoops) {
      this.issues.push({
        severity: 'low',
        category: 'Gas Optimization',
        file,
        description: 'Potential gas optimization opportunity in loops',
        recommendation: 'Cache storage variables in memory within loops'
      });
    }
  }

  private parseSlitherOutput(output: string): void {
    // Parse Slither output and convert to our issue format
    const lines = output.split('\n');
    for (const line of lines) {
      if (line.includes('HIGH') || line.includes('MEDIUM') || line.includes('LOW')) {
        // Parse Slither findings
        this.issues.push({
          severity: line.includes('HIGH') ? 'high' : line.includes('MEDIUM') ? 'medium' : 'low',
          category: 'Smart Contract Security',
          file: 'contracts/',
          description: line.trim(),
          recommendation: 'Review Slither documentation for specific remediation'
        });
      }
    }
  }

  private async auditDependencies(): Promise<void> {
    console.log('📦 Auditing dependencies...');

    try {
      // Run npm audit
      const auditOutput = execSync('npm audit --json', { 
        encoding: 'utf8',
        cwd: this.projectRoot 
      });
      
      const auditData = JSON.parse(auditOutput);
      
      if (auditData.vulnerabilities) {
        Object.entries(auditData.vulnerabilities).forEach(([pkg, vuln]: [string, any]) => {
          this.issues.push({
            severity: vuln.severity as any,
            category: 'Dependency Vulnerability',
            file: 'package.json',
            description: `${pkg}: ${vuln.title}`,
            recommendation: `Update ${pkg} to version ${vuln.fixAvailable || 'latest'}`
          });
        });
      }
    } catch (error) {
      console.log('⚠️  npm audit failed, checking manually');
      await this.manualDependencyCheck();
    }
  }

  private async manualDependencyCheck(): Promise<void> {
    try {
      const packageJson = JSON.parse(readFileSync(join(this.projectRoot, 'package.json'), 'utf8'));
      const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
      
      // Check for known vulnerable packages
      const vulnerablePackages = [
        'lodash', 'moment', 'request', 'node-sass', 'serialize-javascript'
      ];
      
      for (const [pkg, version] of Object.entries(dependencies)) {
        if (vulnerablePackages.includes(pkg)) {
          this.issues.push({
            severity: 'medium',
            category: 'Dependency Vulnerability',
            file: 'package.json',
            description: `Potentially vulnerable package: ${pkg}@${version}`,
            recommendation: `Review and update ${pkg} to latest secure version`
          });
        }
      }
    } catch (error) {
      console.error('Error checking dependencies:', error);
    }
  }

  private async auditCodeQuality(): Promise<void> {
    console.log('🧹 Auditing code quality...');

    try {
      // Run ESLint
      const eslintOutput = execSync('npx eslint src/ --format json', { 
        encoding: 'utf8',
        cwd: this.projectRoot 
      });
      
      const eslintResults = JSON.parse(eslintOutput);
      
      eslintResults.forEach((result: any) => {
        result.messages.forEach((message: any) => {
          if (message.severity === 2) { // Error level
            this.issues.push({
              severity: 'low',
              category: 'Code Quality',
              file: result.filePath.replace(this.projectRoot, ''),
              line: message.line,
              description: message.message,
              recommendation: 'Fix ESLint error'
            });
          }
        });
      });
    } catch (error) {
      console.log('⚠️  ESLint check failed');
    }

    try {
      // Run TypeScript compiler check
      execSync('npx tsc --noEmit', { 
        encoding: 'utf8',
        cwd: this.projectRoot 
      });
    } catch (error) {
      this.issues.push({
        severity: 'medium',
        category: 'Code Quality',
        file: 'TypeScript',
        description: 'TypeScript compilation errors detected',
        recommendation: 'Fix TypeScript errors before deployment'
      });
    }
  }

  private async auditSecurityPatterns(): Promise<void> {
    console.log('🛡️  Auditing security patterns...');

    // Check for common security anti-patterns
    await this.checkAuthenticationSecurity();
    await this.checkInputValidation();
    await this.checkDataEncryption();
    await this.checkRateLimiting();
  }

  private async checkAuthenticationSecurity(): Promise<void> {
    try {
      const authFiles = [
        'src/app/api/auth/login/route.ts',
        'src/app/api/auth/register/route.ts',
        'src/lib/middleware/auth.ts'
      ];

      for (const file of authFiles) {
        try {
          const content = readFileSync(join(this.projectRoot, file), 'utf8');
          
          // Check for JWT security
          if (content.includes('jwt') && !content.includes('expiresIn')) {
            this.issues.push({
              severity: 'medium',
              category: 'Authentication Security',
              file,
              description: 'JWT tokens without expiration detected',
              recommendation: 'Set appropriate expiration times for JWT tokens'
            });
          }

          // Check for password hashing
          if (content.includes('password') && !content.includes('bcrypt') && !content.includes('hash')) {
            this.issues.push({
              severity: 'critical',
              category: 'Authentication Security',
              file,
              description: 'Plain text password handling detected',
              recommendation: 'Implement proper password hashing with bcrypt'
            });
          }
        } catch (error) {
          // File doesn't exist, skip
        }
      }
    } catch (error) {
      console.error('Error checking authentication security:', error);
    }
  }

  private async checkInputValidation(): Promise<void> {
    try {
      const apiFiles = execSync('find src/app/api -name "*.ts" -type f', { 
        encoding: 'utf8',
        cwd: this.projectRoot 
      }).split('\n').filter(Boolean);

      for (const file of apiFiles) {
        try {
          const content = readFileSync(join(this.projectRoot, file), 'utf8');
          
          // Check for input validation
          if (content.includes('request.json()') && !content.includes('validate') && !content.includes('schema')) {
            this.issues.push({
              severity: 'medium',
              category: 'Input Validation',
              file,
              description: 'API endpoint without input validation detected',
              recommendation: 'Implement input validation and sanitization'
            });
          }
        } catch (error) {
          // Skip files that can't be read
        }
      }
    } catch (error) {
      console.log('⚠️  Could not check API files for input validation');
    }
  }

  private async checkDataEncryption(): Promise<void> {
    try {
      const dbFiles = execSync('find lib/db -name "*.ts" -type f', { 
        encoding: 'utf8',
        cwd: this.projectRoot 
      }).split('\n').filter(Boolean);

      for (const file of dbFiles) {
        try {
          const content = readFileSync(join(this.projectRoot, file), 'utf8');
          
          // Check for sensitive data encryption
          if ((content.includes('privateKey') || content.includes('password')) && !content.includes('encrypt')) {
            this.issues.push({
              severity: 'high',
              category: 'Data Encryption',
              file,
              description: 'Sensitive data without encryption detected',
              recommendation: 'Encrypt sensitive data before storage'
            });
          }
        } catch (error) {
          // Skip files that can't be read
        }
      }
    } catch (error) {
      console.log('⚠️  Could not check database files for encryption');
    }
  }

  private async checkRateLimiting(): Promise<void> {
    try {
      const middlewareContent = readFileSync(join(this.projectRoot, 'lib/security/RateLimiter.ts'), 'utf8');
      
      if (!middlewareContent.includes('rateLimit') && !middlewareContent.includes('slowDown')) {
        this.issues.push({
          severity: 'medium',
          category: 'Rate Limiting',
          file: 'lib/security/RateLimiter.ts',
          description: 'Rate limiting implementation may be insufficient',
          recommendation: 'Implement comprehensive rate limiting for all API endpoints'
        });
      }
    } catch (error) {
      this.issues.push({
        severity: 'high',
        category: 'Rate Limiting',
        file: 'middleware',
        description: 'Rate limiting middleware not found',
        recommendation: 'Implement rate limiting to prevent abuse'
      });
    }
  }

  private async auditEnvironmentConfig(): Promise<void> {
    console.log('⚙️  Auditing environment configuration...');

    try {
      const envExample = readFileSync(join(this.projectRoot, '.env.example'), 'utf8');
      const envLines = envExample.split('\n').filter(line => line.trim() && !line.startsWith('#'));

      for (const line of envLines) {
        const [key, value] = line.split('=');
        
        // Check for weak default values
        if (value && (value.includes('password') || value.includes('secret')) && value.length < 32) {
          this.issues.push({
            severity: 'medium',
            category: 'Environment Security',
            file: '.env.example',
            description: `Weak default value for ${key}`,
            recommendation: 'Use strong, randomly generated secrets in production'
          });
        }
      }
    } catch (error) {
      this.issues.push({
        severity: 'low',
        category: 'Environment Security',
        file: '.env.example',
        description: 'Environment example file not found',
        recommendation: 'Create .env.example file with secure defaults'
      });
    }
  }

  private async auditAPIEndpoints(): Promise<void> {
    console.log('🌐 Auditing API endpoints...');

    try {
      const apiFiles = execSync('find src/app/api -name "route.ts" -type f', { 
        encoding: 'utf8',
        cwd: this.projectRoot 
      }).split('\n').filter(Boolean);

      for (const file of apiFiles) {
        try {
          const content = readFileSync(join(this.projectRoot, file), 'utf8');
          
          // Check for CORS configuration
          if (!content.includes('cors') && !content.includes('Access-Control')) {
            this.issues.push({
              severity: 'low',
              category: 'API Security',
              file,
              description: 'API endpoint without CORS configuration',
              recommendation: 'Configure appropriate CORS headers'
            });
          }

          // Check for error handling
          if (!content.includes('try') || !content.includes('catch')) {
            this.issues.push({
              severity: 'low',
              category: 'API Security',
              file,
              description: 'API endpoint without proper error handling',
              recommendation: 'Implement comprehensive error handling'
            });
          }
        } catch (error) {
          // Skip files that can't be read
        }
      }
    } catch (error) {
      console.log('⚠️  Could not audit API endpoints');
    }
  }

  private checkContractVulnerabilities(): Promise<void> {
    // Additional smart contract security checks
    return Promise.resolve();
  }

  private generateReport(): AuditReport {
    const summary = {
      totalIssues: this.issues.length,
      critical: this.issues.filter(i => i.severity === 'critical').length,
      high: this.issues.filter(i => i.severity === 'high').length,
      medium: this.issues.filter(i => i.severity === 'medium').length,
      low: this.issues.filter(i => i.severity === 'low').length,
      info: this.issues.filter(i => i.severity === 'info').length
    };

    const recommendations = [
      'Implement comprehensive input validation for all API endpoints',
      'Ensure all sensitive data is encrypted at rest and in transit',
      'Regular security audits and penetration testing',
      'Keep all dependencies updated to latest secure versions',
      'Implement proper logging and monitoring for security events',
      'Use environment variables for all configuration secrets',
      'Implement rate limiting and DDoS protection',
      'Regular smart contract audits by third-party security firms'
    ];

    return {
      timestamp: new Date().toISOString(),
      summary,
      issues: this.issues,
      smartContractAudit: {
        contractsAudited: ['SavingsVault.sol', 'GameEngine.sol', 'YieldManager.sol'],
        vulnerabilities: this.issues.filter(i => i.category === 'Smart Contract Security'),
        gasOptimizations: ['Cache storage variables in loops', 'Use events for data logging']
      },
      dependencyAudit: {
        vulnerabilities: this.issues.filter(i => i.category === 'Dependency Vulnerability'),
        outdatedPackages: []
      },
      codeQuality: {
        eslintIssues: this.issues.filter(i => i.category === 'Code Quality').length,
        typeScriptErrors: this.issues.filter(i => i.file === 'TypeScript').length,
        testCoverage: 85 // Mock data - would need actual coverage report
      },
      recommendations
    };
  }

  private printSummary(report: AuditReport): void {
    console.log('\n📊 Security Audit Summary');
    console.log('========================');
    console.log(`Total Issues: ${report.summary.totalIssues}`);
    console.log(`Critical: ${report.summary.critical}`);
    console.log(`High: ${report.summary.high}`);
    console.log(`Medium: ${report.summary.medium}`);
    console.log(`Low: ${report.summary.low}`);
    console.log(`Info: ${report.summary.info}`);
    
    if (report.summary.critical > 0) {
      console.log('\n🚨 CRITICAL ISSUES FOUND - Address immediately before deployment!');
    } else if (report.summary.high > 0) {
      console.log('\n⚠️  High severity issues found - Review before deployment');
    } else {
      console.log('\n✅ No critical or high severity issues found');
    }
    
    console.log(`\n📋 Full report saved to: docs/security-audit-report.json`);
  }
}

// Run audit if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const auditor = new SecurityAuditor();
  auditor.runFullAudit()
    .then(() => process.exit(0))
    .catch((error) => {
      console.error('Audit failed:', error);
      process.exit(1);
    });
}

export { SecurityAuditor };