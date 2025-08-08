describe('AI Insights and Recommendations', () => {
  beforeEach(() => {
    cy.login()
    cy.visit('/insights')
  })

  it('should display spending analysis and insights', () => {
    // Check main insights panel
    cy.get('[data-testid="insights-panel"]').should('be.visible')
    cy.get('[data-testid="spending-analysis-chart"]').should('be.visible')

    // Verify spending categories
    cy.get('[data-testid="category-breakdown"]').should('be.visible')
    cy.get('[data-testid="category-item"]').should('have.length.greaterThan', 0)

    // Check spending trends
    cy.get('[data-testid="trend-analysis-chart"]').should('be.visible')
    cy.get('[data-testid="trend-period-selector"]').should('be.visible')

    // Test period selection
    cy.get('[data-testid="trend-period-selector"]').select('3months')
    cy.get('[data-testid="trend-analysis-chart"]').should('be.visible')
    cy.get('[data-testid="trend-data-loading"]').should('not.exist')
  })

  it('should provide personalized financial recommendations', () => {
    // Check recommendations card
    cy.get('[data-testid="recommendations-card"]').should('be.visible')
    cy.get('[data-testid="recommendation-item"]').should('have.length.greaterThan', 0)

    // Test recommendation interaction
    cy.get('[data-testid="recommendation-item"]').first().within(() => {
      cy.get('[data-testid="recommendation-title"]').should('be.visible')
      cy.get('[data-testid="recommendation-description"]').should('be.visible')
      cy.get('[data-testid="recommendation-impact"]').should('be.visible')
    })

    // Apply a recommendation
    cy.get('[data-testid="apply-recommendation"]').first().click()
    cy.get('[data-testid="recommendation-applied"]').should('be.visible')

    // Dismiss a recommendation
    cy.get('[data-testid="dismiss-recommendation"]').first().click()
    cy.get('[data-testid="recommendation-dismissed"]').should('be.visible')

    // Check for new recommendations
    cy.get('[data-testid="refresh-recommendations"]').click()
    cy.get('[data-testid="recommendations-loading"]').should('be.visible')
    cy.get('[data-testid="recommendations-updated"]').should('be.visible')
  })

  it('should show savings projections and goals', () => {
    // Check savings projection card
    cy.get('[data-testid="savings-projection-card"]').should('be.visible')
    cy.get('[data-testid="projection-chart"]').should('be.visible')

    // Test different projection scenarios
    cy.get('[data-testid="projection-scenario"]').select('optimistic')
    cy.get('[data-testid="projection-chart"]').should('be.visible')
    cy.get('[data-testid="optimistic-projection"]').should('be.visible')

    cy.get('[data-testid="projection-scenario"]').select('conservative')
    cy.get('[data-testid="conservative-projection"]').should('be.visible')

    // Test goal setting
    cy.get('[data-testid="set-savings-goal"]').click()
    cy.get('[data-testid="goal-modal"]').should('be.visible')
    
    cy.get('[data-testid="goal-amount-input"]').type('5000')
    cy.get('[data-testid="goal-timeframe"]').select('12months')
    cy.get('[data-testid="save-goal"]').click()

    // Verify goal is set
    cy.get('[data-testid="current-goal"]').should('contain', '$5,000')
    cy.get('[data-testid="goal-progress"]').should('be.visible')
    cy.get('[data-testid="goal-timeline"]').should('contain', '12 months')
  })

  it('should detect and alert on spending anomalies', () => {
    // Simulate unusual spending pattern
    cy.request('POST', '/api/test/simulate-anomaly', {
      type: 'unusual_spending',
      category: 'entertainment',
      amount: 500,
      normalAmount: 50
    })

    // Check for anomaly alert
    cy.get('[data-testid="anomaly-alert"]', { timeout: 10000 })
      .should('be.visible')
      .and('contain', 'Unusual spending detected')

    // Click on anomaly for details
    cy.get('[data-testid="anomaly-alert"]').click()
    cy.get('[data-testid="anomaly-details-modal"]').should('be.visible')
    cy.get('[data-testid="anomaly-category"]').should('contain', 'entertainment')
    cy.get('[data-testid="anomaly-amount"]').should('contain', '$500')
    cy.get('[data-testid="anomaly-comparison"]').should('be.visible')

    // Test anomaly actions
    cy.get('[data-testid="acknowledge-anomaly"]').click()
    cy.get('[data-testid="anomaly-acknowledged"]').should('be.visible')

    // Check anomaly history
    cy.get('[data-testid="anomaly-history-tab"]').click()
    cy.get('[data-testid="anomaly-history-item"]').should('be.visible')
  })

  it('should provide contextual financial advice', () => {
    // Test advice request
    cy.get('[data-testid="ask-ai-advisor"]').click()
    cy.get('[data-testid="ai-advisor-modal"]').should('be.visible')

    // Ask a financial question
    cy.get('[data-testid="advice-question-input"]')
      .type('How can I save more money on groceries?')
    cy.get('[data-testid="submit-question"]').click()

    // Wait for AI response
    cy.get('[data-testid="ai-thinking"]').should('be.visible')
    cy.get('[data-testid="ai-response"]', { timeout: 15000 }).should('be.visible')
    cy.get('[data-testid="ai-response"]').should('contain', 'groceries')

    // Test follow-up questions
    cy.get('[data-testid="follow-up-question"]').first().click()
    cy.get('[data-testid="ai-response"]', { timeout: 15000 }).should('be.visible')

    // Rate the advice
    cy.get('[data-testid="rate-advice"]').should('be.visible')
    cy.get('[data-testid="advice-rating-5"]').click()
    cy.get('[data-testid="advice-rated"]').should('be.visible')
  })

  it('should generate monthly financial reports', () => {
    // Navigate to reports section
    cy.get('[data-testid="reports-tab"]').click()

    // Check current month report
    cy.get('[data-testid="monthly-report"]').should('be.visible')
    cy.get('[data-testid="report-summary"]').should('be.visible')

    // Verify report sections
    cy.get('[data-testid="income-summary"]').should('be.visible')
    cy.get('[data-testid="expenses-summary"]').should('be.visible')
    cy.get('[data-testid="savings-summary"]').should('be.visible')
    cy.get('[data-testid="goals-progress"]').should('be.visible')

    // Test report period selection
    cy.get('[data-testid="report-period"]').select('last_month')
    cy.get('[data-testid="report-loading"]').should('be.visible')
    cy.get('[data-testid="monthly-report"]').should('be.visible')

    // Test report export
    cy.get('[data-testid="export-report"]').click()
    cy.get('[data-testid="export-format"]').select('pdf')
    cy.get('[data-testid="confirm-export"]').click()
    cy.get('[data-testid="export-success"]').should('be.visible')

    // Test report sharing
    cy.get('[data-testid="share-report"]').click()
    cy.get('[data-testid="share-email-input"]').type('advisor@example.com')
    cy.get('[data-testid="send-report"]').click()
    cy.get('[data-testid="report-shared"]').should('be.visible')
  })

  it('should customize insight preferences', () => {
    // Navigate to insights settings
    cy.get('[data-testid="insights-settings"]').click()
    cy.get('[data-testid="insights-preferences-modal"]').should('be.visible')

    // Test notification preferences
    cy.get('[data-testid="anomaly-notifications"]').check()
    cy.get('[data-testid="weekly-insights"]').check()
    cy.get('[data-testid="goal-reminders"]').uncheck()

    // Test insight frequency
    cy.get('[data-testid="insight-frequency"]').select('daily')

    // Test categories to analyze
    cy.get('[data-testid="analyze-food"]').check()
    cy.get('[data-testid="analyze-transport"]').check()
    cy.get('[data-testid="analyze-entertainment"]').uncheck()

    // Save preferences
    cy.get('[data-testid="save-preferences"]').click()
    cy.get('[data-testid="preferences-saved"]').should('be.visible')

    // Verify preferences are applied
    cy.get('[data-testid="insights-preferences-modal"]').should('not.exist')
    cy.get('[data-testid="preferences-indicator"]').should('be.visible')
  })

  it('should handle AI service errors gracefully', () => {
    // Mock AI service error
    cy.intercept('POST', '/api/insights/analysis', {
      statusCode: 500,
      body: { error: 'AI service temporarily unavailable' }
    }).as('aiError')

    // Trigger AI analysis
    cy.get('[data-testid="refresh-insights"]').click()
    cy.wait('@aiError')

    // Check error handling
    cy.get('[data-testid="ai-error-message"]').should('be.visible')
    cy.get('[data-testid="ai-error-message"]')
      .should('contain', 'temporarily unavailable')

    // Test retry functionality
    cy.get('[data-testid="retry-ai-analysis"]').click()
    cy.get('[data-testid="ai-retrying"]').should('be.visible')

    // Test fallback to cached insights
    cy.get('[data-testid="cached-insights-notice"]').should('be.visible')
    cy.get('[data-testid="insights-panel"]').should('be.visible')
  })

  it('should provide budget recommendations', () => {
    // Navigate to budget section
    cy.get('[data-testid="budget-tab"]').click()

    // Check AI budget suggestions
    cy.get('[data-testid="ai-budget-suggestions"]').should('be.visible')
    cy.get('[data-testid="suggested-budget-item"]').should('have.length.greaterThan', 0)

    // Apply a budget suggestion
    cy.get('[data-testid="apply-budget-suggestion"]').first().click()
    cy.get('[data-testid="budget-applied"]').should('be.visible')

    // Check budget tracking
    cy.get('[data-testid="budget-progress"]').should('be.visible')
    cy.get('[data-testid="budget-category"]').should('have.length.greaterThan', 0)

    // Test budget alerts
    cy.get('[data-testid="budget-alert-threshold"]').type('80')
    cy.get('[data-testid="save-alert-settings"]').click()
    cy.get('[data-testid="alert-settings-saved"]').should('be.visible')

    // Simulate budget threshold reached
    cy.request('POST', '/api/test/simulate-budget-alert', {
      category: 'food',
      spent: 400,
      budget: 500,
      threshold: 80
    })

    cy.get('[data-testid="budget-alert"]', { timeout: 5000 })
      .should('be.visible')
      .and('contain', '80% of budget used')
  })
})