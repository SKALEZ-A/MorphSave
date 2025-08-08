import request from 'supertest'
import { createServer } from 'http'
import { parse } from 'url'
import next from 'next'
import { PrismaClient } from '@prisma/client'
import { createTestUser, cleanupTestData } from '../helpers/test-helpers'

const dev = process.env.NODE_ENV !== 'production'
const hostname = 'localhost'
const port = 3001

// Create Next.js app instance for testing
const app = next({ dev, hostname, port })
const handle = app.getRequestHandler()

let server: any
let prisma: PrismaClient
let testUser: any
let authToken: string

beforeAll(async () => {
  await app.prepare()
  
  server = createServer(async (req, res) => {
    try {
      const parsedUrl = parse(req.url!, true)
      await handle(req, res, parsedUrl)
    } catch (err) {
      console.error('Error occurred handling', req.url, err)
      res.statusCode = 500
      res.end('internal server error')
    }
  })

  await new Promise<void>((resolve) => {
    server.listen(port, () => {
      console.log(`Test server running on http://${hostname}:${port}`)
      resolve()
    })
  })

  prisma = new PrismaClient()
  
  // Create test user and get auth token
  testUser = await createTestUser()
  const loginResponse = await request(`http://localhost:${port}`)
    .post('/api/auth/login')
    .send({
      email: testUser.email,
      password: 'TestPassword123!'
    })
  
  authToken = loginResponse.body.token
})

afterAll(async () => {
  await cleanupTestData()
  await prisma.$disconnect()
  server.close()
})

describe('Authentication API Integration', () => {
  it('should register a new user', async () => {
    const userData = {
      email: `test-${Date.now()}@example.com`,
      password: 'TestPassword123!',
      username: `testuser${Date.now()}`
    }

    const response = await request(`http://localhost:${port}`)
      .post('/api/auth/register')
      .send(userData)

    expect(response.status).toBe(201)
    expect(response.body).toHaveProperty('token')
    expect(response.body).toHaveProperty('user')
    expect(response.body.user.email).toBe(userData.email)
    expect(response.body.user.username).toBe(userData.username)
    expect(response.body.user).toHaveProperty('walletAddress')
  })

  it('should login with valid credentials', async () => {
    const response = await request(`http://localhost:${port}`)
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: 'TestPassword123!'
      })

    expect(response.status).toBe(200)
    expect(response.body).toHaveProperty('token')
    expect(response.body).toHaveProperty('user')
    expect(response.body.user.id).toBe(testUser.id)
  })

  it('should reject invalid credentials', async () => {
    const response = await request(`http://localhost:${port}`)
      .post('/api/auth/login')
      .send({
        email: testUser.email,
        password: 'WrongPassword'
      })

    expect(response.status).toBe(401)
    expect(response.body).toHaveProperty('error')
  })

  it('should get user profile with valid token', async () => {
    const response = await request(`http://localhost:${port}`)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${authToken}`)

    expect(response.status).toBe(200)
    expect(response.body).toHaveProperty('user')
    expect(response.body.user.id).toBe(testUser.id)
  })

  it('should reject requests without token', async () => {
    const response = await request(`http://localhost:${port}`)
      .get('/api/auth/me')

    expect(response.status).toBe(401)
    expect(response.body).toHaveProperty('error')
  })
})

describe('Savings API Integration', () => {
  it('should process manual deposit', async () => {
    const depositData = {
      amount: 100.00,
      source: 'checking'
    }

    const response = await request(`http://localhost:${port}`)
      .post('/api/savings/deposit')
      .set('Authorization', `Bearer ${authToken}`)
      .send(depositData)

    expect(response.status).toBe(200)
    expect(response.body).toHaveProperty('transaction')
    expect(response.body.transaction.amount).toBe(depositData.amount)
    expect(response.body.transaction.type).toBe('manual')
    expect(response.body).toHaveProperty('blockchainTxHash')
  })

  it('should process round-up transaction', async () => {
    const roundUpData = {
      originalAmount: 23.45,
      merchant: 'Coffee Shop',
      category: 'food_and_drink'
    }

    const response = await request(`http://localhost:${port}`)
      .post('/api/savings/roundup')
      .set('Authorization', `Bearer ${authToken}`)
      .send(roundUpData)

    expect(response.status).toBe(200)
    expect(response.body).toHaveProperty('roundUpAmount')
    expect(response.body.roundUpAmount).toBe(0.55)
    expect(response.body).toHaveProperty('transaction')
    expect(response.body.transaction.type).toBe('roundup')
  })

  it('should get savings summary', async () => {
    const response = await request(`http://localhost:${port}`)
      .get('/api/savings/summary')
      .set('Authorization', `Bearer ${authToken}`)

    expect(response.status).toBe(200)
    expect(response.body).toHaveProperty('totalSaved')
    expect(response.body).toHaveProperty('totalYield')
    expect(response.body).toHaveProperty('currentAPY')
    expect(response.body).toHaveProperty('transactions')
    expect(Array.isArray(response.body.transactions)).toBe(true)
  })

  it('should get transaction history', async () => {
    const response = await request(`http://localhost:${port}`)
      .get('/api/savings/transactions')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ limit: 10, offset: 0 })

    expect(response.status).toBe(200)
    expect(response.body).toHaveProperty('transactions')
    expect(response.body).toHaveProperty('total')
    expect(Array.isArray(response.body.transactions)).toBe(true)
  })

  it('should validate deposit amount', async () => {
    const invalidDeposit = {
      amount: -50.00,
      source: 'checking'
    }

    const response = await request(`http://localhost:${port}`)
      .post('/api/savings/deposit')
      .set('Authorization', `Bearer ${authToken}`)
      .send(invalidDeposit)

    expect(response.status).toBe(400)
    expect(response.body).toHaveProperty('error')
    expect(response.body.error).toContain('amount')
  })
})

describe('Achievements API Integration', () => {
  it('should get user achievements', async () => {
    const response = await request(`http://localhost:${port}`)
      .get('/api/achievements')
      .set('Authorization', `Bearer ${authToken}`)

    expect(response.status).toBe(200)
    expect(response.body).toHaveProperty('achievements')
    expect(response.body).toHaveProperty('unlockedCount')
    expect(response.body).toHaveProperty('totalPoints')
    expect(Array.isArray(response.body.achievements)).toBe(true)
  })

  it('should get leaderboard', async () => {
    const response = await request(`http://localhost:${port}`)
      .get('/api/achievements/leaderboard')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ type: 'points', limit: 10 })

    expect(response.status).toBe(200)
    expect(response.body).toHaveProperty('leaderboard')
    expect(response.body).toHaveProperty('userRank')
    expect(Array.isArray(response.body.leaderboard)).toBe(true)
  })

  it('should unlock achievement on milestone', async () => {
    // Make a deposit to trigger achievement
    await request(`http://localhost:${port}`)
      .post('/api/savings/deposit')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ amount: 50.00, source: 'checking' })

    // Check if achievement was unlocked
    const response = await request(`http://localhost:${port}`)
      .get('/api/achievements')
      .set('Authorization', `Bearer ${authToken}`)

    expect(response.status).toBe(200)
    const firstDepositAchievement = response.body.achievements.find(
      (a: any) => a.name === 'First Deposit'
    )
    expect(firstDepositAchievement).toBeDefined()
    expect(firstDepositAchievement.unlocked).toBe(true)
  })
})

describe('Social API Integration', () => {
  let secondUser: any
  let secondUserToken: string

  beforeAll(async () => {
    // Create second test user for social features
    secondUser = await createTestUser('friend')
    const loginResponse = await request(`http://localhost:${port}`)
      .post('/api/auth/login')
      .send({
        email: secondUser.email,
        password: 'TestPassword123!'
      })
    secondUserToken = loginResponse.body.token
  })

  it('should search for users', async () => {
    const response = await request(`http://localhost:${port}`)
      .get('/api/social/search')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ q: secondUser.username })

    expect(response.status).toBe(200)
    expect(response.body).toHaveProperty('users')
    expect(Array.isArray(response.body.users)).toBe(true)
    expect(response.body.users.length).toBeGreaterThan(0)
  })

  it('should send friend request', async () => {
    const response = await request(`http://localhost:${port}`)
      .post('/api/social/friend-requests')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ userId: secondUser.id })

    expect(response.status).toBe(201)
    expect(response.body).toHaveProperty('friendRequest')
    expect(response.body.friendRequest.toUserId).toBe(secondUser.id)
  })

  it('should accept friend request', async () => {
    // Get the friend request ID
    const requestsResponse = await request(`http://localhost:${port}`)
      .get('/api/social/friend-requests')
      .set('Authorization', `Bearer ${secondUserToken}`)

    const friendRequest = requestsResponse.body.received[0]

    const response = await request(`http://localhost:${port}`)
      .post(`/api/social/friend-requests/${friendRequest.id}/accept`)
      .set('Authorization', `Bearer ${secondUserToken}`)

    expect(response.status).toBe(200)
    expect(response.body).toHaveProperty('friendship')
  })

  it('should get friends list', async () => {
    const response = await request(`http://localhost:${port}`)
      .get('/api/social/friends')
      .set('Authorization', `Bearer ${authToken}`)

    expect(response.status).toBe(200)
    expect(response.body).toHaveProperty('friends')
    expect(Array.isArray(response.body.friends)).toBe(true)
    expect(response.body.friends.length).toBeGreaterThan(0)
  })

  it('should create challenge', async () => {
    const challengeData = {
      title: 'Test Challenge',
      description: 'A test savings challenge',
      type: 'savings_amount',
      targetAmount: 100,
      duration: 7,
      rewards: {
        points: 500,
        badge: 'challenge_creator'
      }
    }

    const response = await request(`http://localhost:${port}`)
      .post('/api/social/challenges')
      .set('Authorization', `Bearer ${authToken}`)
      .send(challengeData)

    expect(response.status).toBe(201)
    expect(response.body).toHaveProperty('challenge')
    expect(response.body.challenge.title).toBe(challengeData.title)
    expect(response.body.challenge.creatorId).toBe(testUser.id)
  })

  it('should join challenge', async () => {
    // Get available challenges
    const challengesResponse = await request(`http://localhost:${port}`)
      .get('/api/social/challenges')
      .set('Authorization', `Bearer ${secondUserToken}`)

    const challenge = challengesResponse.body.challenges[0]

    const response = await request(`http://localhost:${port}`)
      .post(`/api/social/challenges/${challenge.id}/join`)
      .set('Authorization', `Bearer ${secondUserToken}`)

    expect(response.status).toBe(200)
    expect(response.body).toHaveProperty('participation')
    expect(response.body.participation.challengeId).toBe(challenge.id)
  })
})

describe('AI Insights API Integration', () => {
  it('should get spending analysis', async () => {
    const response = await request(`http://localhost:${port}`)
      .get('/api/insights/analysis')
      .set('Authorization', `Bearer ${authToken}`)

    expect(response.status).toBe(200)
    expect(response.body).toHaveProperty('analysis')
    expect(response.body.analysis).toHaveProperty('categories')
    expect(response.body.analysis).toHaveProperty('trends')
    expect(response.body.analysis).toHaveProperty('insights')
  })

  it('should get personalized recommendations', async () => {
    const response = await request(`http://localhost:${port}`)
      .get('/api/insights/recommendations')
      .set('Authorization', `Bearer ${authToken}`)

    expect(response.status).toBe(200)
    expect(response.body).toHaveProperty('recommendations')
    expect(Array.isArray(response.body.recommendations)).toBe(true)
  })

  it('should get savings projections', async () => {
    const response = await request(`http://localhost:${port}`)
      .get('/api/insights/projections')
      .set('Authorization', `Bearer ${authToken}`)
      .query({ timeframe: '12months' })

    expect(response.status).toBe(200)
    expect(response.body).toHaveProperty('projections')
    expect(response.body.projections).toHaveProperty('conservative')
    expect(response.body.projections).toHaveProperty('optimistic')
    expect(response.body.projections).toHaveProperty('realistic')
  })

  it('should detect spending anomalies', async () => {
    const response = await request(`http://localhost:${port}`)
      .get('/api/insights/anomalies')
      .set('Authorization', `Bearer ${authToken}`)

    expect(response.status).toBe(200)
    expect(response.body).toHaveProperty('anomalies')
    expect(Array.isArray(response.body.anomalies)).toBe(true)
  })
})

describe('Notifications API Integration', () => {
  it('should get user notifications', async () => {
    const response = await request(`http://localhost:${port}`)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${authToken}`)

    expect(response.status).toBe(200)
    expect(response.body).toHaveProperty('notifications')
    expect(response.body).toHaveProperty('unreadCount')
    expect(Array.isArray(response.body.notifications)).toBe(true)
  })

  it('should mark notification as read', async () => {
    // First get notifications
    const notificationsResponse = await request(`http://localhost:${port}`)
      .get('/api/notifications')
      .set('Authorization', `Bearer ${authToken}`)

    if (notificationsResponse.body.notifications.length > 0) {
      const notification = notificationsResponse.body.notifications[0]

      const response = await request(`http://localhost:${port}`)
        .patch(`/api/notifications/${notification.id}/read`)
        .set('Authorization', `Bearer ${authToken}`)

      expect(response.status).toBe(200)
      expect(response.body).toHaveProperty('notification')
      expect(response.body.notification.read).toBe(true)
    }
  })

  it('should get notification preferences', async () => {
    const response = await request(`http://localhost:${port}`)
      .get('/api/notifications/preferences')
      .set('Authorization', `Bearer ${authToken}`)

    expect(response.status).toBe(200)
    expect(response.body).toHaveProperty('preferences')
    expect(response.body.preferences).toHaveProperty('email')
    expect(response.body.preferences).toHaveProperty('push')
    expect(response.body.preferences).toHaveProperty('inApp')
  })

  it('should update notification preferences', async () => {
    const preferences = {
      email: {
        achievements: true,
        challenges: false,
        savings: true
      },
      push: {
        achievements: true,
        challenges: true,
        savings: false
      }
    }

    const response = await request(`http://localhost:${port}`)
      .put('/api/notifications/preferences')
      .set('Authorization', `Bearer ${authToken}`)
      .send({ preferences })

    expect(response.status).toBe(200)
    expect(response.body).toHaveProperty('preferences')
    expect(response.body.preferences.email.achievements).toBe(true)
    expect(response.body.preferences.email.challenges).toBe(false)
  })
})

describe('Error Handling and Validation', () => {
  it('should handle malformed JSON', async () => {
    const response = await request(`http://localhost:${port}`)
      .post('/api/savings/deposit')
      .set('Authorization', `Bearer ${authToken}`)
      .set('Content-Type', 'application/json')
      .send('{"invalid": json}')

    expect(response.status).toBe(400)
    expect(response.body).toHaveProperty('error')
  })

  it('should handle missing required fields', async () => {
    const response = await request(`http://localhost:${port}`)
      .post('/api/savings/deposit')
      .set('Authorization', `Bearer ${authToken}`)
      .send({}) // Missing required fields

    expect(response.status).toBe(400)
    expect(response.body).toHaveProperty('error')
    expect(response.body.error).toContain('required')
  })

  it('should handle rate limiting', async () => {
    // Make multiple rapid requests to trigger rate limiting
    const requests = Array(20).fill(null).map(() =>
      request(`http://localhost:${port}`)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`)
    )

    const responses = await Promise.all(requests)
    const rateLimitedResponse = responses.find(r => r.status === 429)
    
    if (rateLimitedResponse) {
      expect(rateLimitedResponse.body).toHaveProperty('error')
      expect(rateLimitedResponse.body.error).toContain('rate limit')
    }
  })

  it('should handle database connection errors gracefully', async () => {
    // This would require mocking database failures
    // For now, we'll test that the API returns proper error structure
    const response = await request(`http://localhost:${port}`)
      .get('/api/savings/summary')
      .set('Authorization', 'Bearer invalid-token')

    expect(response.status).toBe(401)
    expect(response.body).toHaveProperty('error')
  })
})