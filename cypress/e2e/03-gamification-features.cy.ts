describe('Gamification Features', () => {
  beforeEach(() => {
    cy.login()
    cy.visit('/dashboard')
  })

  it('should unlock achievements for savings milestones', () => {
    // Make first deposit to unlock "First Deposit" achievement
    cy.get('[data-testid="manual-deposit-button"]').click()
    cy.get('[data-testid="deposit-amount-input"]').type('25.00')
    cy.get('[data-testid="confirm-deposit-button"]').click()
    cy.get('[data-testid="deposit-success"]', { timeout: 15000 }).should('be.visible')

    // Check for achievement notification
    cy.get('[data-testid="achievement-notification"]', { timeout: 10000 })
      .should('be.visible')
      .and('contain', 'First Deposit')

    // Visit achievements page
    cy.get('[data-testid="achievements-link"]').click()
    cy.url().should('include', '/achievements')

    // Verify achievement is unlocked
    cy.get('[data-testid="achievement-first-deposit"]')
      .should('have.class', 'unlocked')
      .and('be.visible')

    // Check achievement details
    cy.get('[data-testid="achievement-first-deposit"]').click()
    cy.get('[data-testid="achievement-modal"]').should('be.visible')
    cy.get('[data-testid="achievement-title"]').should('contain', 'First Deposit')
    cy.get('[data-testid="achievement-description"]').should('be.visible')
    cy.get('[data-testid="achievement-date-earned"]').should('be.visible')
  })

  it('should track and display savings streaks', () => {
    // Simulate daily savings for streak
    for (let day = 0; day < 3; day++) {
      cy.simulateTransaction(15.99, `Daily Purchase ${day}`)
      cy.wait(2000) // Wait for processing
    }

    // Check streak display
    cy.get('[data-testid="current-streak"]').should('contain', '3')
    cy.get('[data-testid="streak-fire-icon"]').should('be.visible')

    // Visit achievements to see streak achievements
    cy.get('[data-testid="achievements-link"]').click()
    cy.get('[data-testid="achievement-3-day-streak"]')
      .should('have.class', 'unlocked')

    // Check streak leaderboard
    cy.get('[data-testid="streak-leaderboard"]').should('be.visible')
    cy.get('[data-testid="my-streak-rank"]').should('be.visible')
  })

  it('should create and join savings challenges', () => {
    // Navigate to challenges page
    cy.get('[data-testid="challenges-link"]').click()
    cy.url().should('include', '/challenges')

    // Create a new challenge
    cy.get('[data-testid="create-challenge-button"]').click()
    cy.get('[data-testid="challenge-creation-modal"]').should('be.visible')

    // Fill challenge details
    cy.get('[data-testid="challenge-title-input"]').type('Save $100 in 7 Days')
    cy.get('[data-testid="challenge-description-input"]')
      .type('Let\'s save $100 together in one week!')
    cy.get('[data-testid="challenge-target-amount"]').type('100')
    cy.get('[data-testid="challenge-duration"]').select('7')
    cy.get('[data-testid="challenge-type"]').select('savings_amount')

    // Set challenge rewards
    cy.get('[data-testid="challenge-reward-points"]').type('500')
    cy.get('[data-testid="challenge-reward-badge"]').select('challenge_creator')

    // Create challenge
    cy.get('[data-testid="create-challenge-submit"]').click()
    cy.get('[data-testid="challenge-created-success"]').should('be.visible')

    // Verify challenge appears in list
    cy.get('[data-testid="challenge-list"]').should('contain', 'Save $100 in 7 Days')

    // Join the challenge (as creator)
    cy.get('[data-testid="challenge-card"]').first().click()
    cy.get('[data-testid="challenge-details-modal"]').should('be.visible')
    cy.get('[data-testid="join-challenge-button"]').click()
    cy.get('[data-testid="challenge-joined-success"]').should('be.visible')

    // Check challenge progress
    cy.get('[data-testid="my-progress"]').should('contain', '$0.00')
    cy.get('[data-testid="challenge-leaderboard"]').should('be.visible')
  })

  it('should update leaderboards in real-time', () => {
    // Join an existing challenge or create one
    cy.get('[data-testid="challenges-link"]').click()
    
    // Find and join a challenge
    cy.get('[data-testid="challenge-card"]').first().click()
    cy.get('[data-testid="join-challenge-button"]').click()
    cy.get('[data-testid="challenge-joined-success"]').should('be.visible')

    // Make a deposit to contribute to challenge
    cy.visit('/dashboard')
    cy.get('[data-testid="manual-deposit-button"]').click()
    cy.get('[data-testid="deposit-amount-input"]').type('50.00')
    cy.get('[data-testid="confirm-deposit-button"]').click()
    cy.get('[data-testid="deposit-success"]', { timeout: 15000 }).should('be.visible')

    // Return to challenge and check updated leaderboard
    cy.get('[data-testid="challenges-link"]').click()
    cy.get('[data-testid="challenge-card"]').first().click()
    
    // Verify progress updated
    cy.get('[data-testid="my-progress"]').should('contain', '$50.00')
    cy.get('[data-testid="leaderboard-position"]').should('be.visible')

    // Check real-time updates (simulate another user's progress)
    cy.window().then((win) => {
      win.postMessage({
        type: 'CHALLENGE_UPDATE',
        data: {
          challengeId: 'test-challenge',
          userId: 'other-user',
          progress: 75.00
        }
      }, '*')
    })

    // Verify leaderboard updates
    cy.get('[data-testid="leaderboard-item"]').should('have.length.greaterThan', 1)
  })

  it('should display and share achievements on social media', () => {
    // Unlock an achievement first
    cy.get('[data-testid="manual-deposit-button"]').click()
    cy.get('[data-testid="deposit-amount-input"]').type('100.00')
    cy.get('[data-testid="confirm-deposit-button"]').click()
    cy.get('[data-testid="deposit-success"]', { timeout: 15000 }).should('be.visible')

    // Wait for achievement
    cy.get('[data-testid="achievement-notification"]', { timeout: 10000 })
      .should('be.visible')

    // Click on achievement to open celebration modal
    cy.get('[data-testid="achievement-notification"]').click()
    cy.get('[data-testid="celebration-modal"]').should('be.visible')

    // Test social sharing
    cy.get('[data-testid="share-twitter"]').should('be.visible')
    cy.get('[data-testid="share-facebook"]').should('be.visible')
    cy.get('[data-testid="share-linkedin"]').should('be.visible')

    // Test copy link functionality
    cy.get('[data-testid="copy-achievement-link"]').click()
    cy.get('[data-testid="link-copied-message"]').should('be.visible')

    // Test download achievement image
    cy.get('[data-testid="download-achievement"]').click()
    // Note: File download testing in Cypress requires special handling
  })

  it('should show comprehensive user statistics', () => {
    // Navigate to profile/stats page
    cy.get('[data-testid="user-menu"]').click()
    cy.get('[data-testid="profile-link"]').click()

    // Check various statistics
    cy.get('[data-testid="total-saved"]').should('be.visible')
    cy.get('[data-testid="total-achievements"]').should('be.visible')
    cy.get('[data-testid="current-level"]').should('be.visible')
    cy.get('[data-testid="total-points"]').should('be.visible')
    cy.get('[data-testid="longest-streak"]').should('be.visible')

    // Check progress bars
    cy.get('[data-testid="level-progress-bar"]').should('be.visible')
    cy.get('[data-testid="next-level-points"]').should('be.visible')

    // Check achievement gallery
    cy.get('[data-testid="achievement-gallery"]').should('be.visible')
    cy.get('[data-testid="achievement-item"]').should('have.length.greaterThan', 0)

    // Check challenge history
    cy.get('[data-testid="challenge-history"]').should('be.visible')
    cy.get('[data-testid="completed-challenges"]').should('be.visible')
  })

  it('should handle challenge completion and rewards', () => {
    // Create a small challenge for quick completion
    cy.get('[data-testid="challenges-link"]').click()
    cy.get('[data-testid="create-challenge-button"]').click()
    
    cy.get('[data-testid="challenge-title-input"]').type('Quick $10 Challenge')
    cy.get('[data-testid="challenge-target-amount"]').type('10')
    cy.get('[data-testid="challenge-duration"]').select('1')
    cy.get('[data-testid="create-challenge-submit"]').click()

    // Join the challenge
    cy.get('[data-testid="challenge-card"]').first().click()
    cy.get('[data-testid="join-challenge-button"]').click()

    // Complete the challenge by making a deposit
    cy.visit('/dashboard')
    cy.get('[data-testid="manual-deposit-button"]').click()
    cy.get('[data-testid="deposit-amount-input"]').type('15.00')
    cy.get('[data-testid="confirm-deposit-button"]').click()
    cy.get('[data-testid="deposit-success"]', { timeout: 15000 }).should('be.visible')

    // Check for challenge completion notification
    cy.get('[data-testid="challenge-completed-notification"]', { timeout: 10000 })
      .should('be.visible')
      .and('contain', 'Challenge Completed!')

    // Verify rewards were distributed
    cy.get('[data-testid="points-earned"]').should('be.visible')
    cy.get('[data-testid="badge-earned"]').should('be.visible')

    // Check challenge status
    cy.get('[data-testid="challenges-link"]').click()
    cy.get('[data-testid="completed-challenges-tab"]').click()
    cy.get('[data-testid="challenge-card"]').first()
      .should('contain', 'Completed')
      .and('have.class', 'completed')
  })
})