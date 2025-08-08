describe('Savings Automation', () => {
  beforeEach(() => {
    cy.login()
    cy.visit('/dashboard')
  })

  it('should process round-up transactions automatically', () => {
    // Connect bank account if not already connected
    cy.get('body').then(($body) => {
      if ($body.find('[data-testid="connect-bank-button"]').length > 0) {
        cy.connectBankAccount()
      }
    })

    // Enable round-ups
    cy.get('[data-testid="settings-menu"]').click()
    cy.get('[data-testid="roundup-settings"]').click()
    cy.get('[data-testid="enable-roundups-toggle"]').check()
    cy.get('[data-testid="save-settings"]').click()

    // Record initial balance
    cy.get('[data-testid="savings-balance"]').invoke('text').as('initialBalance')

    // Simulate a transaction that should trigger round-up
    cy.simulateTransaction(23.45, 'Coffee Shop')

    // Wait for round-up processing
    cy.get('[data-testid="roundup-notification"]', { timeout: 10000 })
      .should('be.visible')
      .and('contain', '$0.55')

    // Verify balance increased
    cy.get('[data-testid="savings-balance"]').should(($balance) => {
      const currentBalance = parseFloat($balance.text().replace('$', ''))
      cy.get('@initialBalance').then((initial) => {
        const initialAmount = parseFloat(initial.toString().replace('$', ''))
        expect(currentBalance).to.be.greaterThan(initialAmount)
      })
    })

    // Check transaction history
    cy.get('[data-testid="transaction-history"]').click()
    cy.get('[data-testid="transaction-item"]').first().should('contain', 'Round-up')
    cy.get('[data-testid="transaction-item"]').first().should('contain', '$0.55')
  })

  it('should auto-invest accumulated round-ups', () => {
    // Ensure we have enough round-ups to trigger auto-investment
    for (let i = 0; i < 5; i++) {
      cy.simulateTransaction(19.99 + i, `Merchant ${i}`)
      cy.wait(1000) // Wait between transactions
    }

    // Wait for auto-investment threshold to be reached
    cy.get('[data-testid="auto-investment-notification"]', { timeout: 30000 })
      .should('be.visible')
      .and('contain', 'Auto-invested')

    // Verify blockchain transaction
    cy.get('[data-testid="blockchain-tx-link"]').should('be.visible')
    cy.waitForBlockchainTx()

    // Check yield tracking
    cy.get('[data-testid="yield-display"]').should('be.visible')
    cy.get('[data-testid="current-apy"]').should('contain', '%')
  })

  it('should handle manual deposits', () => {
    cy.get('[data-testid="manual-deposit-button"]').click()
    cy.get('[data-testid="deposit-modal"]').should('be.visible')

    // Enter deposit amount
    cy.get('[data-testid="deposit-amount-input"]').type('50.00')
    cy.get('[data-testid="deposit-source-select"]').select('checking')

    // Confirm deposit
    cy.get('[data-testid="confirm-deposit-button"]').click()

    // Wait for processing
    cy.get('[data-testid="deposit-processing"]').should('be.visible')
    cy.get('[data-testid="deposit-success"]', { timeout: 15000 }).should('be.visible')

    // Verify balance update
    cy.get('[data-testid="savings-balance"]').should('contain', '50.00')

    // Check blockchain transaction
    cy.get('[data-testid="view-on-explorer"]').should('be.visible')
  })

  it('should allow withdrawal with proper validation', () => {
    // First make a deposit to have funds to withdraw
    cy.get('[data-testid="manual-deposit-button"]').click()
    cy.get('[data-testid="deposit-amount-input"]').type('100.00')
    cy.get('[data-testid="confirm-deposit-button"]').click()
    cy.get('[data-testid="deposit-success"]', { timeout: 15000 }).should('be.visible')

    // Now test withdrawal
    cy.get('[data-testid="withdraw-button"]').click()
    cy.get('[data-testid="withdrawal-modal"]').should('be.visible')

    // Test validation - amount too high
    cy.get('[data-testid="withdrawal-amount-input"]').type('200.00')
    cy.get('[data-testid="confirm-withdrawal-button"]').click()
    cy.get('[data-testid="insufficient-funds-error"]').should('be.visible')

    // Valid withdrawal
    cy.get('[data-testid="withdrawal-amount-input"]').clear().type('50.00')
    cy.get('[data-testid="withdrawal-destination-select"]').select('checking')
    cy.get('[data-testid="confirm-withdrawal-button"]').click()

    // Confirm withdrawal with security check
    cy.get('[data-testid="withdrawal-confirmation-modal"]').should('be.visible')
    cy.get('[data-testid="confirm-final-withdrawal"]').click()

    // Wait for processing
    cy.get('[data-testid="withdrawal-processing"]').should('be.visible')
    cy.get('[data-testid="withdrawal-success"]', { timeout: 15000 }).should('be.visible')

    // Verify balance update
    cy.get('[data-testid="savings-balance"]').should('contain', '50.00')
  })

  it('should display accurate yield calculations', () => {
    // Make a deposit to start earning yield
    cy.get('[data-testid="manual-deposit-button"]').click()
    cy.get('[data-testid="deposit-amount-input"]').type('1000.00')
    cy.get('[data-testid="confirm-deposit-button"]').click()
    cy.get('[data-testid="deposit-success"]', { timeout: 15000 }).should('be.visible')

    // Check yield display components
    cy.get('[data-testid="yield-display"]').should('be.visible')
    cy.get('[data-testid="current-apy"]').should('match', /\d+\.\d+%/)
    cy.get('[data-testid="daily-yield"]').should('be.visible')
    cy.get('[data-testid="total-yield-earned"]').should('be.visible')

    // Check yield projection
    cy.get('[data-testid="yield-projection-button"]').click()
    cy.get('[data-testid="projection-modal"]').should('be.visible')
    cy.get('[data-testid="one-month-projection"]').should('contain', '$')
    cy.get('[data-testid="one-year-projection"]').should('contain', '$')
  })

  it('should handle emergency withdrawal', () => {
    // Make a deposit first
    cy.get('[data-testid="manual-deposit-button"]').click()
    cy.get('[data-testid="deposit-amount-input"]').type('500.00')
    cy.get('[data-testid="confirm-deposit-button"]').click()
    cy.get('[data-testid="deposit-success"]', { timeout: 15000 }).should('be.visible')

    // Access emergency withdrawal
    cy.get('[data-testid="settings-menu"]').click()
    cy.get('[data-testid="emergency-options"]').click()
    cy.get('[data-testid="emergency-withdrawal-button"]').click()

    // Confirm emergency withdrawal with warnings
    cy.get('[data-testid="emergency-warning-modal"]').should('be.visible')
    cy.get('[data-testid="understand-risks-checkbox"]').check()
    cy.get('[data-testid="confirm-emergency-withdrawal"]').click()

    // Wait for emergency processing
    cy.get('[data-testid="emergency-processing"]').should('be.visible')
    cy.get('[data-testid="emergency-success"]', { timeout: 30000 }).should('be.visible')

    // Verify all funds withdrawn
    cy.get('[data-testid="savings-balance"]').should('contain', '0.00')
  })
})