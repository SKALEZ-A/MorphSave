/// <reference types="cypress" />

// Custom commands for MorphSave testing

declare global {
  namespace Cypress {
    interface Chainable {
      /**
       * Custom command to login with test user
       * @example cy.login()
       */
      login(): Chainable<void>
      
      /**
       * Custom command to register a new test user
       * @example cy.register('test@example.com', 'password', 'username')
       */
      register(email: string, password: string, username: string): Chainable<void>
      
      /**
       * Custom command to connect a mock bank account
       * @example cy.connectBankAccount()
       */
      connectBankAccount(): Chainable<void>
      
      /**
       * Custom command to simulate a transaction for round-up
       * @example cy.simulateTransaction(25.67, 'Coffee Shop')
       */
      simulateTransaction(amount: number, merchant: string): Chainable<void>
      
      /**
       * Custom command to wait for blockchain transaction
       * @example cy.waitForBlockchainTx()
       */
      waitForBlockchainTx(): Chainable<void>
      
      /**
       * Custom command to set mobile viewport
       */
      setMobileViewport(): Chainable<void>
      
      /**
       * Custom command to set tablet viewport
       */
      setTabletViewport(): Chainable<void>
      
      /**
       * Custom command to set desktop viewport
       */
      setDesktopViewport(): Chainable<void>
    }
  }
}

// Login command
Cypress.Commands.add('login', () => {
  const { email, password } = Cypress.env('testUser')
  
  cy.session([email, password], () => {
    cy.visit('/login')
    cy.get('[data-testid="email-input"]').type(email)
    cy.get('[data-testid="password-input"]').type(password)
    cy.get('[data-testid="login-button"]').click()
    cy.url().should('include', '/dashboard')
    cy.get('[data-testid="user-menu"]').should('be.visible')
  })
})

// Register command
Cypress.Commands.add('register', (email: string, password: string, username: string) => {
  cy.visit('/register')
  cy.get('[data-testid="email-input"]').type(email)
  cy.get('[data-testid="password-input"]').type(password)
  cy.get('[data-testid="confirm-password-input"]').type(password)
  cy.get('[data-testid="username-input"]').type(username)
  cy.get('[data-testid="register-button"]').click()
  cy.url().should('include', '/dashboard')
})

// Connect bank account command
Cypress.Commands.add('connectBankAccount', () => {
  cy.get('[data-testid="connect-bank-button"]').click()
  cy.get('[data-testid="plaid-link-button"]').click()
  
  // Mock Plaid Link flow
  cy.window().then((win) => {
    // Simulate successful Plaid connection
    win.postMessage({
      type: 'PLAID_LINK_SUCCESS',
      data: {
        public_token: 'mock-public-token',
        accounts: [{
          id: 'mock-account-id',
          name: 'Test Checking Account',
          type: 'depository',
          subtype: 'checking'
        }]
      }
    }, '*')
  })
  
  cy.get('[data-testid="bank-connected-success"]').should('be.visible')
})

// Simulate transaction command
Cypress.Commands.add('simulateTransaction', (amount: number, merchant: string) => {
  cy.request('POST', '/api/test/simulate-transaction', {
    amount,
    merchant,
    category: 'food_and_drink'
  }).then((response) => {
    expect(response.status).to.eq(200)
  })
})

// Wait for blockchain transaction
Cypress.Commands.add('waitForBlockchainTx', () => {
  cy.get('[data-testid="transaction-pending"]', { timeout: 30000 }).should('not.exist')
  cy.get('[data-testid="transaction-confirmed"]').should('be.visible')
})

export {}