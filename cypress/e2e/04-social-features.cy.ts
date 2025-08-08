describe('Social Features', () => {
  beforeEach(() => {
    cy.login()
    cy.visit('/friends')
  })

  it('should search and send friend requests', () => {
    // Test friend search functionality
    cy.get('[data-testid="friend-search-input"]').type('testfriend')
    cy.get('[data-testid="search-button"]').click()

    // Should show search results
    cy.get('[data-testid="search-results"]').should('be.visible')
    cy.get('[data-testid="user-search-result"]').should('have.length.greaterThan', 0)

    // Send friend request
    cy.get('[data-testid="send-friend-request"]').first().click()
    cy.get('[data-testid="friend-request-sent"]').should('be.visible')

    // Verify request appears in sent requests
    cy.get('[data-testid="sent-requests-tab"]').click()
    cy.get('[data-testid="sent-request-item"]').should('contain', 'testfriend')
  })

  it('should handle incoming friend requests', () => {
    // Navigate to friend requests
    cy.get('[data-testid="friend-requests-tab"]').click()

    // Mock incoming friend request
    cy.window().then((win) => {
      win.postMessage({
        type: 'FRIEND_REQUEST_RECEIVED',
        data: {
          id: 'req-123',
          from: {
            id: 'user-456',
            username: 'newfriend',
            profileImage: null
          }
        }
      }, '*')
    })

    // Should show incoming request
    cy.get('[data-testid="incoming-request"]').should('be.visible')
    cy.get('[data-testid="request-from"]').should('contain', 'newfriend')

    // Accept friend request
    cy.get('[data-testid="accept-request"]').click()
    cy.get('[data-testid="request-accepted"]').should('be.visible')

    // Verify friend appears in friends list
    cy.get('[data-testid="friends-list-tab"]').click()
    cy.get('[data-testid="friend-item"]').should('contain', 'newfriend')
  })

  it('should decline friend requests', () => {
    cy.get('[data-testid="friend-requests-tab"]').click()

    // Mock incoming friend request
    cy.window().then((win) => {
      win.postMessage({
        type: 'FRIEND_REQUEST_RECEIVED',
        data: {
          id: 'req-124',
          from: {
            id: 'user-457',
            username: 'unwantedfriend',
            profileImage: null
          }
        }
      }, '*')
    })

    // Decline friend request
    cy.get('[data-testid="decline-request"]').click()
    cy.get('[data-testid="decline-confirmation"]').should('be.visible')
    cy.get('[data-testid="confirm-decline"]').click()

    // Verify request is removed
    cy.get('[data-testid="incoming-request"]').should('not.exist')
    cy.get('[data-testid="request-declined"]').should('be.visible')
  })

  it('should display friends list with activity', () => {
    // Ensure we have friends first
    cy.get('[data-testid="friends-list-tab"]').click()

    // Check friends list structure
    cy.get('[data-testid="friends-list"]').should('be.visible')
    
    // If no friends, add a mock friend
    cy.get('body').then(($body) => {
      if ($body.find('[data-testid="friend-item"]').length === 0) {
        cy.window().then((win) => {
          win.postMessage({
            type: 'FRIEND_ADDED',
            data: {
              id: 'friend-123',
              username: 'activefriend',
              profileImage: null,
              lastActivity: new Date().toISOString(),
              currentStreak: 5,
              totalSaved: 250.00
            }
          }, '*')
        })
      }
    })

    // Check friend item details
    cy.get('[data-testid="friend-item"]').first().within(() => {
      cy.get('[data-testid="friend-username"]').should('be.visible')
      cy.get('[data-testid="friend-streak"]').should('be.visible')
      cy.get('[data-testid="friend-activity"]').should('be.visible')
    })

    // Test friend profile view
    cy.get('[data-testid="friend-item"]').first().click()
    cy.get('[data-testid="friend-profile-modal"]').should('be.visible')
    cy.get('[data-testid="friend-stats"]').should('be.visible')
    cy.get('[data-testid="friend-achievements"]').should('be.visible')
  })

  it('should create group challenges with friends', () => {
    // Navigate to challenges
    cy.visit('/challenges')
    cy.get('[data-testid="create-challenge-button"]').click()

    // Create a group challenge
    cy.get('[data-testid="challenge-title-input"]').type('Friends Save Together')
    cy.get('[data-testid="challenge-type"]').select('group')
    cy.get('[data-testid="challenge-target-amount"]').type('500')
    cy.get('[data-testid="challenge-duration"]').select('14')

    // Invite friends
    cy.get('[data-testid="invite-friends-section"]').should('be.visible')
    cy.get('[data-testid="friend-invite-checkbox"]').first().check()
    cy.get('[data-testid="friend-invite-checkbox"]').eq(1).check()

    // Set group challenge rules
    cy.get('[data-testid="group-challenge-rules"]').should('be.visible')
    cy.get('[data-testid="min-participants"]').type('2')
    cy.get('[data-testid="reward-distribution"]').select('equal')

    // Create challenge
    cy.get('[data-testid="create-challenge-submit"]').click()
    cy.get('[data-testid="challenge-created-success"]').should('be.visible')

    // Verify invitations sent
    cy.get('[data-testid="invitations-sent"]').should('contain', '2 friends invited')
  })

  it('should handle friend blocking and unblocking', () => {
    cy.get('[data-testid="friends-list-tab"]').click()

    // Open friend options menu
    cy.get('[data-testid="friend-item"]').first().within(() => {
      cy.get('[data-testid="friend-options"]').click()
    })

    // Block friend
    cy.get('[data-testid="block-friend"]').click()
    cy.get('[data-testid="block-confirmation-modal"]').should('be.visible')
    cy.get('[data-testid="confirm-block"]').click()

    // Verify friend is blocked
    cy.get('[data-testid="friend-blocked"]').should('be.visible')

    // Check blocked users list
    cy.get('[data-testid="blocked-users-tab"]').click()
    cy.get('[data-testid="blocked-user-item"]').should('be.visible')

    // Unblock friend
    cy.get('[data-testid="unblock-user"]').click()
    cy.get('[data-testid="unblock-confirmation"]').should('be.visible')
    cy.get('[data-testid="confirm-unblock"]').click()

    // Verify friend is unblocked
    cy.get('[data-testid="user-unblocked"]').should('be.visible')
  })

  it('should show friend activity feed', () => {
    cy.get('[data-testid="activity-feed-tab"]').click()

    // Check activity feed structure
    cy.get('[data-testid="activity-feed"]').should('be.visible')

    // Mock some friend activities
    cy.window().then((win) => {
      win.postMessage({
        type: 'FRIEND_ACTIVITY_UPDATE',
        data: [
          {
            id: 'activity-1',
            userId: 'friend-123',
            username: 'activefriend',
            type: 'achievement_unlocked',
            data: { achievementName: 'Savings Streak' },
            timestamp: new Date().toISOString()
          },
          {
            id: 'activity-2',
            userId: 'friend-124',
            username: 'saverfriend',
            type: 'challenge_completed',
            data: { challengeName: 'Weekly Saver' },
            timestamp: new Date(Date.now() - 3600000).toISOString()
          }
        ]
      }, '*')
    })

    // Verify activities appear
    cy.get('[data-testid="activity-item"]').should('have.length', 2)
    cy.get('[data-testid="activity-item"]').first()
      .should('contain', 'unlocked achievement')
    cy.get('[data-testid="activity-item"]').eq(1)
      .should('contain', 'completed challenge')

    // Test activity interactions
    cy.get('[data-testid="like-activity"]').first().click()
    cy.get('[data-testid="activity-liked"]').should('be.visible')

    cy.get('[data-testid="comment-activity"]').first().click()
    cy.get('[data-testid="comment-input"]').type('Great job!')
    cy.get('[data-testid="submit-comment"]').click()
    cy.get('[data-testid="comment-added"]').should('be.visible')
  })

  it('should handle privacy settings for social features', () => {
    // Navigate to privacy settings
    cy.get('[data-testid="user-menu"]').click()
    cy.get('[data-testid="settings-link"]').click()
    cy.get('[data-testid="privacy-tab"]').click()

    // Test profile visibility settings
    cy.get('[data-testid="profile-visibility"]').select('friends_only')
    cy.get('[data-testid="show-savings-amount"]').uncheck()
    cy.get('[data-testid="show-achievements"]').check()
    cy.get('[data-testid="show-activity"]').select('friends_only')

    // Test friend request settings
    cy.get('[data-testid="accept-requests-from"]').select('friends_of_friends')
    cy.get('[data-testid="auto-accept-requests"]').uncheck()

    // Save settings
    cy.get('[data-testid="save-privacy-settings"]').click()
    cy.get('[data-testid="settings-saved"]').should('be.visible')

    // Verify settings are applied
    cy.visit('/friends')
    cy.get('[data-testid="privacy-indicator"]').should('be.visible')
  })

  it('should send and receive friend invitations via email', () => {
    cy.get('[data-testid="invite-friends-tab"]').click()

    // Test email invitation
    cy.get('[data-testid="email-invite-input"]').type('newfriend@example.com')
    cy.get('[data-testid="invitation-message"]')
      .type('Join me on MorphSave and let\'s save together!')
    
    cy.get('[data-testid="send-email-invite"]').click()
    cy.get('[data-testid="invitation-sent"]').should('be.visible')

    // Test multiple invitations
    cy.get('[data-testid="bulk-invite-textarea"]')
      .type('friend1@example.com\nfriend2@example.com\nfriend3@example.com')
    
    cy.get('[data-testid="send-bulk-invites"]').click()
    cy.get('[data-testid="bulk-invites-sent"]').should('contain', '3 invitations sent')

    // Check invitation history
    cy.get('[data-testid="invitation-history"]').should('be.visible')
    cy.get('[data-testid="sent-invitation"]').should('have.length', 4)
  })
})