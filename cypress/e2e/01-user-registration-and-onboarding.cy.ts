describe('User Registration and Onboarding', () => {
  beforeEach(() => {
    // Clear any existing sessions
    cy.clearCookies()
    cy.clearLocalStorage()
  })

  it('should complete full user registration flow', () => {
    const testUser = {
      email: `test-${Date.now()}@morphsave.com`,
      password: 'TestPassword123!',
      username: `testuser${Date.now()}`
    }

    // Visit registration page
    cy.visit('/register')
    cy.get('[data-testid="register-form"]').should('be.visible')

    // Fill registration form
    cy.get('[data-testid="email-input"]').type(testUser.email)
    cy.get('[data-testid="password-input"]').type(testUser.password)
    cy.get('[data-testid="confirm-password-input"]').type(testUser.password)
    cy.get('[data-testid="username-input"]').type(testUser.username)

    // Accept terms and conditions
    cy.get('[data-testid="terms-checkbox"]').check()

    // Submit registration
    cy.get('[data-testid="register-button"]').click()

    // Should redirect to dashboard after successful registration
    cy.url().should('include', '/dashboard')
    cy.get('[data-testid="welcome-message"]').should('contain', testUser.username)

    // Verify wallet creation
    cy.get('[data-testid="wallet-address"]').should('be.visible')
    cy.get('[data-testid="wallet-balance"]').should('contain', '0.00')
  })

  it('should handle registration validation errors', () => {
    cy.visit('/register')

    // Try to submit empty form
    cy.get('[data-testid="register-button"]').click()
    cy.get('[data-testid="email-error"]').should('contain', 'Email is required')
    cy.get('[data-testid="password-error"]').should('contain', 'Password is required')

    // Test invalid email
    cy.get('[data-testid="email-input"]').type('invalid-email')
    cy.get('[data-testid="register-button"]').click()
    cy.get('[data-testid="email-error"]').should('contain', 'Invalid email format')

    // Test weak password
    cy.get('[data-testid="email-input"]').clear().type('test@example.com')
    cy.get('[data-testid="password-input"]').type('weak')
    cy.get('[data-testid="register-button"]').click()
    cy.get('[data-testid="password-error"]').should('contain', 'Password must be at least 8 characters')

    // Test password mismatch
    cy.get('[data-testid="password-input"]').clear().type('StrongPassword123!')
    cy.get('[data-testid="confirm-password-input"]').type('DifferentPassword123!')
    cy.get('[data-testid="register-button"]').click()
    cy.get('[data-testid="confirm-password-error"]').should('contain', 'Passwords do not match')
  })

  it('should complete onboarding flow after registration', () => {
    const testUser = {
      email: `onboard-${Date.now()}@morphsave.com`,
      password: 'TestPassword123!',
      username: `onboarduser${Date.now()}`
    }

    // Register user
    cy.register(testUser.email, testUser.password, testUser.username)

    // Should show onboarding flow
    cy.get('[data-testid="onboarding-modal"]').should('be.visible')

    // Step 1: Set savings goal
    cy.get('[data-testid="savings-goal-input"]').type('1000')
    cy.get('[data-testid="onboarding-next"]').click()

    // Step 2: Connect bank account
    cy.get('[data-testid="connect-bank-onboarding"]').click()
    cy.connectBankAccount()
    cy.get('[data-testid="onboarding-next"]').click()

    // Step 3: Enable round-ups
    cy.get('[data-testid="enable-roundups-toggle"]').click()
    cy.get('[data-testid="roundup-amount-select"]').select('1.00')
    cy.get('[data-testid="onboarding-next"]').click()

    // Step 4: Complete onboarding
    cy.get('[data-testid="onboarding-complete"]').click()

    // Should show dashboard with onboarding complete
    cy.get('[data-testid="onboarding-modal"]').should('not.exist')
    cy.get('[data-testid="savings-goal-card"]').should('contain', '$1,000')
    cy.get('[data-testid="roundups-enabled-badge"]').should('be.visible')
  })

  it('should allow skipping onboarding steps', () => {
    const testUser = {
      email: `skip-${Date.now()}@morphsave.com`,
      password: 'TestPassword123!',
      username: `skipuser${Date.now()}`
    }

    cy.register(testUser.email, testUser.password, testUser.username)

    // Skip all onboarding steps
    cy.get('[data-testid="onboarding-skip"]').click()
    cy.get('[data-testid="confirm-skip-onboarding"]').click()

    // Should show dashboard without onboarding setup
    cy.get('[data-testid="onboarding-modal"]').should('not.exist')
    cy.get('[data-testid="setup-incomplete-banner"]').should('be.visible')
  })
})