describe('Mobile Responsiveness and PWA Features', () => {
  beforeEach(() => {
    cy.login()
  })

  it('should display correctly on mobile devices', () => {
    cy.setMobileViewport()
    cy.visit('/dashboard')

    // Check mobile navigation
    cy.get('[data-testid="mobile-nav"]').should('be.visible')
    cy.get('[data-testid="desktop-nav"]').should('not.be.visible')

    // Test hamburger menu
    cy.get('[data-testid="mobile-menu-button"]').click()
    cy.get('[data-testid="mobile-menu"]').should('be.visible')
    cy.get('[data-testid="mobile-menu-item"]').should('have.length.greaterThan', 0)

    // Test mobile dashboard layout
    cy.get('[data-testid="mobile-dashboard"]').should('be.visible')
    cy.get('[data-testid="balance-card"]').should('be.visible')
    cy.get('[data-testid="quick-actions-mobile"]').should('be.visible')

    // Test swipe gestures
    cy.get('[data-testid="dashboard-cards"]')
      .trigger('touchstart', { touches: [{ clientX: 300, clientY: 300 }] })
      .trigger('touchmove', { touches: [{ clientX: 100, clientY: 300 }] })
      .trigger('touchend')

    cy.get('[data-testid="card-swiped"]').should('be.visible')
  })

  it('should work correctly on tablet devices', () => {
    cy.setTabletViewport()
    cy.visit('/dashboard')

    // Check tablet layout
    cy.get('[data-testid="tablet-layout"]').should('be.visible')
    cy.get('[data-testid="sidebar"]').should('be.visible')
    cy.get('[data-testid="main-content"]').should('be.visible')

    // Test tablet navigation
    cy.get('[data-testid="nav-item"]').should('have.length.greaterThan', 0)
    cy.get('[data-testid="nav-item"]').first().click()
    cy.get('[data-testid="active-nav-item"]').should('be.visible')

    // Test tablet-specific interactions
    cy.get('[data-testid="savings-card"]').should('be.visible')
    cy.get('[data-testid="achievements-preview"]').should('be.visible')
  })

  it('should handle touch gestures properly', () => {
    cy.setMobileViewport()
    cy.visit('/dashboard')

    // Test pull-to-refresh
    cy.get('[data-testid="dashboard-content"]')
      .trigger('touchstart', { touches: [{ clientX: 200, clientY: 100 }] })
      .trigger('touchmove', { touches: [{ clientX: 200, clientY: 300 }] })
      .trigger('touchend')

    cy.get('[data-testid="pull-to-refresh-indicator"]').should('be.visible')
    cy.get('[data-testid="refreshing"]').should('be.visible')
    cy.get('[data-testid="refresh-complete"]').should('be.visible')

    // Test swipe navigation
    cy.visit('/achievements')
    cy.get('[data-testid="achievement-gallery"]')
      .trigger('touchstart', { touches: [{ clientX: 300, clientY: 200 }] })
      .trigger('touchmove', { touches: [{ clientX: 100, clientY: 200 }] })
      .trigger('touchend')

    cy.get('[data-testid="next-achievement-page"]').should('be.visible')

    // Test pinch-to-zoom on charts
    cy.visit('/insights')
    cy.get('[data-testid="spending-chart"]')
      .trigger('touchstart', { 
        touches: [
          { clientX: 150, clientY: 150 },
          { clientX: 250, clientY: 250 }
        ] 
      })
      .trigger('touchmove', { 
        touches: [
          { clientX: 100, clientY: 100 },
          { clientX: 300, clientY: 300 }
        ] 
      })
      .trigger('touchend')

    cy.get('[data-testid="chart-zoomed"]').should('be.visible')
  })

  it('should install as PWA', () => {
    cy.setMobileViewport()
    cy.visit('/')

    // Check PWA manifest
    cy.get('link[rel="manifest"]').should('exist')

    // Check service worker registration
    cy.window().then((win) => {
      expect(win.navigator.serviceWorker).to.exist
    })

    // Test install prompt
    cy.window().then((win) => {
      // Mock beforeinstallprompt event
      const installEvent = new Event('beforeinstallprompt')
      win.dispatchEvent(installEvent)
    })

    cy.get('[data-testid="install-pwa-banner"]').should('be.visible')
    cy.get('[data-testid="install-pwa-button"]').click()
    cy.get('[data-testid="pwa-installing"]').should('be.visible')
  })

  it('should work offline with cached data', () => {
    cy.setMobileViewport()
    cy.visit('/dashboard')

    // Wait for initial load and caching
    cy.get('[data-testid="dashboard-loaded"]').should('be.visible')

    // Simulate offline mode
    cy.window().then((win) => {
      win.navigator.onLine = false
      win.dispatchEvent(new Event('offline'))
    })

    // Check offline indicator
    cy.get('[data-testid="offline-indicator"]').should('be.visible')

    // Test cached data access
    cy.visit('/achievements')
    cy.get('[data-testid="cached-achievements"]').should('be.visible')
    cy.get('[data-testid="offline-notice"]').should('be.visible')

    // Test offline functionality
    cy.get('[data-testid="achievement-item"]').should('have.length.greaterThan', 0)

    // Simulate coming back online
    cy.window().then((win) => {
      win.navigator.onLine = true
      win.dispatchEvent(new Event('online'))
    })

    cy.get('[data-testid="online-indicator"]').should('be.visible')
    cy.get('[data-testid="syncing-data"]').should('be.visible')
    cy.get('[data-testid="sync-complete"]').should('be.visible')
  })

  it('should handle push notifications on mobile', () => {
    cy.setMobileViewport()
    cy.visit('/dashboard')

    // Test notification permission request
    cy.get('[data-testid="enable-notifications-banner"]').should('be.visible')
    cy.get('[data-testid="enable-notifications"]').click()

    // Mock notification permission
    cy.window().then((win) => {
      Object.defineProperty(win.Notification, 'permission', {
        value: 'granted',
        writable: false
      })
    })

    cy.get('[data-testid="notifications-enabled"]').should('be.visible')

    // Test push notification settings
    cy.get('[data-testid="user-menu"]').click()
    cy.get('[data-testid="notification-settings"]').click()

    cy.get('[data-testid="push-notifications-toggle"]').should('be.checked')
    cy.get('[data-testid="achievement-notifications"]').check()
    cy.get('[data-testid="savings-reminders"]').check()
    cy.get('[data-testid="save-notification-settings"]').click()

    // Simulate receiving a push notification
    cy.window().then((win) => {
      const notification = new win.Notification('Achievement Unlocked!', {
        body: 'You earned the "First $100" achievement',
        icon: '/icons/achievement.png',
        badge: '/icons/badge.png'
      })
    })

    cy.get('[data-testid="notification-received"]').should('be.visible')
  })

  it('should optimize performance on mobile', () => {
    cy.setMobileViewport()
    
    // Test lazy loading
    cy.visit('/achievements')
    cy.get('[data-testid="achievement-placeholder"]').should('be.visible')
    
    // Scroll to trigger lazy loading
    cy.scrollTo('bottom')
    cy.get('[data-testid="achievement-loaded"]').should('be.visible')
    cy.get('[data-testid="achievement-placeholder"]').should('not.exist')

    // Test image optimization
    cy.get('[data-testid="optimized-image"]').should('have.attr', 'loading', 'lazy')
    cy.get('[data-testid="optimized-image"]').should('have.attr', 'srcset')

    // Test code splitting
    cy.visit('/insights')
    cy.get('[data-testid="insights-loading"]').should('be.visible')
    cy.get('[data-testid="insights-loaded"]').should('be.visible')

    // Check bundle size indicators
    cy.window().then((win) => {
      // Check if critical resources loaded quickly
      const navigation = win.performance.getEntriesByType('navigation')[0]
      expect(navigation.loadEventEnd - navigation.loadEventStart).to.be.lessThan(3000)
    })
  })

  it('should handle mobile-specific interactions', () => {
    cy.setMobileViewport()
    cy.visit('/dashboard')

    // Test bottom sheet modals
    cy.get('[data-testid="quick-deposit"]').click()
    cy.get('[data-testid="bottom-sheet-modal"]').should('be.visible')
    cy.get('[data-testid="modal-handle"]').should('be.visible')

    // Test drag to dismiss
    cy.get('[data-testid="modal-handle"]')
      .trigger('touchstart', { touches: [{ clientX: 200, clientY: 400 }] })
      .trigger('touchmove', { touches: [{ clientX: 200, clientY: 600 }] })
      .trigger('touchend')

    cy.get('[data-testid="bottom-sheet-modal"]').should('not.be.visible')

    // Test mobile-optimized forms
    cy.get('[data-testid="quick-deposit"]').click()
    cy.get('[data-testid="amount-input"]').should('have.attr', 'inputmode', 'decimal')
    cy.get('[data-testid="amount-input"]').should('have.attr', 'pattern', '[0-9]*')

    // Test mobile keyboard optimization
    cy.get('[data-testid="amount-input"]').type('50.00')
    cy.get('[data-testid="mobile-keyboard-done"]').click()
    cy.get('[data-testid="amount-input"]').should('have.value', '50.00')
  })

  it('should maintain accessibility on mobile', () => {
    cy.setMobileViewport()
    cy.visit('/dashboard')

    // Test touch target sizes
    cy.get('[data-testid="nav-button"]').should('have.css', 'min-height', '44px')
    cy.get('[data-testid="nav-button"]').should('have.css', 'min-width', '44px')

    // Test focus management
    cy.get('[data-testid="mobile-menu-button"]').click()
    cy.get('[data-testid="mobile-menu"]').should('have.focus')

    // Test screen reader compatibility
    cy.get('[data-testid="balance-display"]').should('have.attr', 'aria-label')
    cy.get('[data-testid="savings-progress"]').should('have.attr', 'role', 'progressbar')

    // Test high contrast mode
    cy.get('body').invoke('addClass', 'high-contrast')
    cy.get('[data-testid="balance-card"]').should('have.css', 'border-width', '2px')
  })
})