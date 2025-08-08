import { ethers } from 'hardhat'
import { expect } from 'chai'
import { SavingsVault, GameEngine, YieldManager } from '../../typechain-types'
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers'
import { time } from '@nomicfoundation/hardhat-network-helpers'

describe('Blockchain Integration Tests', () => {
  let savingsVault: SavingsVault
  let gameEngine: GameEngine
  let yieldManager: YieldManager
  let owner: SignerWithAddress
  let user1: SignerWithAddress
  let user2: SignerWithAddress
  let mockToken: any

  beforeEach(async () => {
    [owner, user1, user2] = await ethers.getSigners()

    // Deploy mock ERC20 token for testing
    const MockToken = await ethers.getContractFactory('MockERC20')
    mockToken = await MockToken.deploy('Mock USDC', 'mUSDC', 6)

    // Deploy YieldManager first
    const YieldManager = await ethers.getContractFactory('YieldManager')
    yieldManager = await YieldManager.deploy()

    // Deploy GameEngine
    const GameEngine = await ethers.getContractFactory('GameEngine')
    gameEngine = await GameEngine.deploy()

    // Deploy SavingsVault
    const SavingsVault = await ethers.getContractFactory('SavingsVault')
    savingsVault = await SavingsVault.deploy(
      await mockToken.getAddress(),
      await yieldManager.getAddress(),
      await gameEngine.getAddress()
    )

    // Set up permissions
    await yieldManager.setSavingsVault(await savingsVault.getAddress())
    await gameEngine.setSavingsVault(await savingsVault.getAddress())

    // Mint tokens for testing
    await mockToken.mint(user1.address, ethers.parseUnits('10000', 6))
    await mockToken.mint(user2.address, ethers.parseUnits('10000', 6))
  })

  describe('End-to-End Savings Flow', () => {
    it('should complete full savings journey from deposit to yield', async () => {
      const depositAmount = ethers.parseUnits('100', 6)

      // User approves and deposits
      await mockToken.connect(user1).approve(await savingsVault.getAddress(), depositAmount)
      await savingsVault.connect(user1).deposit(depositAmount)

      // Verify deposit
      const balance = await savingsVault.getUserBalance(user1.address)
      expect(balance).to.equal(depositAmount)

      // Check that achievement was recorded
      const achievements = await gameEngine.getUserAchievements(user1.address)
      expect(achievements.length).to.be.greaterThan(0)

      // Simulate yield generation
      await time.increase(86400) // 1 day
      await yieldManager.distributeYield()

      // Check yield was added
      const newBalance = await savingsVault.getUserBalance(user1.address)
      expect(newBalance).to.be.greaterThan(balance)

      // Verify yield tracking
      const totalYield = await savingsVault.getTotalYield(user1.address)
      expect(totalYield).to.be.greaterThan(0)
    })

    it('should handle multiple users with proper isolation', async () => {
      const depositAmount1 = ethers.parseUnits('100', 6)
      const depositAmount2 = ethers.parseUnits('200', 6)

      // Both users deposit
      await mockToken.connect(user1).approve(await savingsVault.getAddress(), depositAmount1)
      await savingsVault.connect(user1).deposit(depositAmount1)

      await mockToken.connect(user2).approve(await savingsVault.getAddress(), depositAmount2)
      await savingsVault.connect(user2).deposit(depositAmount2)

      // Verify balances are isolated
      const balance1 = await savingsVault.getUserBalance(user1.address)
      const balance2 = await savingsVault.getUserBalance(user2.address)
      
      expect(balance1).to.equal(depositAmount1)
      expect(balance2).to.equal(depositAmount2)

      // Verify achievements are separate
      const achievements1 = await gameEngine.getUserAchievements(user1.address)
      const achievements2 = await gameEngine.getUserAchievements(user2.address)
      
      expect(achievements1.length).to.be.greaterThan(0)
      expect(achievements2.length).to.be.greaterThan(0)
    })

    it('should handle withdrawal with proper yield calculation', async () => {
      const depositAmount = ethers.parseUnits('1000', 6)
      const withdrawAmount = ethers.parseUnits('500', 6)

      // Deposit
      await mockToken.connect(user1).approve(await savingsVault.getAddress(), depositAmount)
      await savingsVault.connect(user1).deposit(depositAmount)

      // Generate some yield
      await time.increase(86400 * 30) // 30 days
      await yieldManager.distributeYield()

      const balanceBeforeWithdraw = await savingsVault.getUserBalance(user1.address)
      const initialTokenBalance = await mockToken.balanceOf(user1.address)

      // Withdraw
      await savingsVault.connect(user1).withdraw(withdrawAmount)

      // Verify withdrawal
      const balanceAfterWithdraw = await savingsVault.getUserBalance(user1.address)
      const finalTokenBalance = await mockToken.balanceOf(user1.address)

      expect(balanceAfterWithdraw).to.equal(balanceBeforeWithdraw - withdrawAmount)
      expect(finalTokenBalance).to.equal(initialTokenBalance + withdrawAmount)
    })
  })

  describe('Gamification Integration', () => {
    it('should unlock achievements based on savings milestones', async () => {
      // Test first deposit achievement
      const firstDeposit = ethers.parseUnits('10', 6)
      await mockToken.connect(user1).approve(await savingsVault.getAddress(), firstDeposit)
      await savingsVault.connect(user1).deposit(firstDeposit)

      let achievements = await gameEngine.getUserAchievements(user1.address)
      expect(achievements.length).to.equal(1)

      // Test $100 milestone
      const additionalDeposit = ethers.parseUnits('90', 6)
      await mockToken.connect(user1).approve(await savingsVault.getAddress(), additionalDeposit)
      await savingsVault.connect(user1).deposit(additionalDeposit)

      achievements = await gameEngine.getUserAchievements(user1.address)
      expect(achievements.length).to.equal(2)

      // Test $1000 milestone
      const largeDeposit = ethers.parseUnits('900', 6)
      await mockToken.connect(user1).approve(await savingsVault.getAddress(), largeDeposit)
      await savingsVault.connect(user1).deposit(largeDeposit)

      achievements = await gameEngine.getUserAchievements(user1.address)
      expect(achievements.length).to.equal(3)
    })

    it('should track and reward savings streaks', async () => {
      const dailyDeposit = ethers.parseUnits('10', 6)

      // Simulate daily deposits for a week
      for (let day = 0; day < 7; day++) {
        await mockToken.connect(user1).approve(await savingsVault.getAddress(), dailyDeposit)
        await savingsVault.connect(user1).deposit(dailyDeposit)
        
        // Update streak
        await gameEngine.connect(user1).updateStreak()
        
        // Move to next day
        await time.increase(86400)
      }

      const streak = await gameEngine.getUserStreak(user1.address)
      expect(streak).to.equal(7)

      // Check for streak achievement
      const achievements = await gameEngine.getUserAchievements(user1.address)
      const streakAchievement = achievements.find((a: any) => a.toString().includes('streak'))
      expect(streakAchievement).to.not.be.undefined
    })

    it('should handle challenge creation and participation', async () => {
      const challengeId = ethers.keccak256(ethers.toUtf8Bytes('test-challenge'))
      const targetAmount = ethers.parseUnits('500', 6)
      const duration = 86400 * 7 // 7 days

      // Create challenge
      await gameEngine.connect(owner).createChallenge(challengeId, duration, targetAmount)

      // Users join challenge
      await gameEngine.connect(user1).joinChallenge(challengeId)
      await gameEngine.connect(user2).joinChallenge(challengeId)

      // Users make deposits
      const deposit1 = ethers.parseUnits('300', 6)
      const deposit2 = ethers.parseUnits('200', 6)

      await mockToken.connect(user1).approve(await savingsVault.getAddress(), deposit1)
      await savingsVault.connect(user1).deposit(deposit1)

      await mockToken.connect(user2).approve(await savingsVault.getAddress(), deposit2)
      await savingsVault.connect(user2).deposit(deposit2)

      // Check challenge progress
      const progress1 = await gameEngine.getChallengeProgress(challengeId, user1.address)
      const progress2 = await gameEngine.getChallengeProgress(challengeId, user2.address)

      expect(progress1).to.equal(deposit1)
      expect(progress2).to.equal(deposit2)
    })
  })

  describe('Yield Management Integration', () => {
    it('should automatically invest deposits in yield protocols', async () => {
      const depositAmount = ethers.parseUnits('1000', 6)

      await mockToken.connect(user1).approve(await savingsVault.getAddress(), depositAmount)
      await savingsVault.connect(user1).deposit(depositAmount)

      // Check that funds were moved to yield protocol
      const vaultBalance = await mockToken.balanceOf(await savingsVault.getAddress())
      expect(vaultBalance).to.equal(0) // Should be invested

      const investedAmount = await yieldManager.getTotalInvested()
      expect(investedAmount).to.equal(depositAmount)
    })

    it('should compound yield automatically', async () => {
      const depositAmount = ethers.parseUnits('1000', 6)

      await mockToken.connect(user1).approve(await savingsVault.getAddress(), depositAmount)
      await savingsVault.connect(user1).deposit(depositAmount)

      const initialBalance = await savingsVault.getUserBalance(user1.address)

      // Simulate yield generation over time
      await time.increase(86400 * 30) // 30 days
      await yieldManager.distributeYield()

      const balanceAfterYield = await savingsVault.getUserBalance(user1.address)
      expect(balanceAfterYield).to.be.greaterThan(initialBalance)

      // Simulate another month with compounding
      await time.increase(86400 * 30) // Another 30 days
      await yieldManager.distributeYield()

      const finalBalance = await savingsVault.getUserBalance(user1.address)
      const secondMonthYield = finalBalance - balanceAfterYield
      const firstMonthYield = balanceAfterYield - initialBalance

      // Second month yield should be higher due to compounding
      expect(secondMonthYield).to.be.greaterThan(firstMonthYield)
    })

    it('should handle protocol switching for better yields', async () => {
      const depositAmount = ethers.parseUnits('1000', 6)

      await mockToken.connect(user1).approve(await savingsVault.getAddress(), depositAmount)
      await savingsVault.connect(user1).deposit(depositAmount)

      const initialProtocol = await yieldManager.getCurrentProtocol()

      // Simulate better yield opportunity
      await yieldManager.connect(owner).switchProtocol(1) // Switch to protocol 1

      const newProtocol = await yieldManager.getCurrentProtocol()
      expect(newProtocol).to.not.equal(initialProtocol)

      // Verify funds were moved
      const investedAmount = await yieldManager.getTotalInvested()
      expect(investedAmount).to.equal(depositAmount)
    })
  })

  describe('Emergency and Security Features', () => {
    it('should handle emergency withdrawal', async () => {
      const depositAmount = ethers.parseUnits('1000', 6)

      await mockToken.connect(user1).approve(await savingsVault.getAddress(), depositAmount)
      await savingsVault.connect(user1).deposit(depositAmount)

      const initialTokenBalance = await mockToken.balanceOf(user1.address)

      // Emergency withdrawal
      await savingsVault.connect(user1).emergencyWithdraw()

      const finalTokenBalance = await mockToken.balanceOf(user1.address)
      const userBalance = await savingsVault.getUserBalance(user1.address)

      expect(userBalance).to.equal(0)
      expect(finalTokenBalance).to.be.greaterThan(initialTokenBalance)
    })

    it('should pause and unpause contracts', async () => {
      const depositAmount = ethers.parseUnits('100', 6)

      // Pause the contract
      await savingsVault.connect(owner).pause()

      // Try to deposit while paused
      await mockToken.connect(user1).approve(await savingsVault.getAddress(), depositAmount)
      await expect(
        savingsVault.connect(user1).deposit(depositAmount)
      ).to.be.revertedWith('Pausable: paused')

      // Unpause and try again
      await savingsVault.connect(owner).unpause()
      await expect(
        savingsVault.connect(user1).deposit(depositAmount)
      ).to.not.be.reverted
    })

    it('should enforce access controls', async () => {
      // Try to pause as non-owner
      await expect(
        savingsVault.connect(user1).pause()
      ).to.be.revertedWith('Ownable: caller is not the owner')

      // Try to set yield manager as non-owner
      await expect(
        savingsVault.connect(user1).setYieldManager(user1.address)
      ).to.be.revertedWith('Ownable: caller is not the owner')
    })
  })

  describe('Gas Optimization and Performance', () => {
    it('should batch multiple operations efficiently', async () => {
      const users = [user1, user2]
      const depositAmount = ethers.parseUnits('100', 6)

      // Batch deposits
      const deposits = []
      for (const user of users) {
        await mockToken.connect(user).approve(await savingsVault.getAddress(), depositAmount)
        deposits.push(savingsVault.connect(user).deposit(depositAmount))
      }

      const receipts = await Promise.all(deposits)
      
      // Verify all deposits succeeded
      for (let i = 0; i < users.length; i++) {
        const balance = await savingsVault.getUserBalance(users[i].address)
        expect(balance).to.equal(depositAmount)
      }

      // Check gas usage is reasonable
      for (const receipt of receipts) {
        expect(receipt.gasUsed).to.be.lessThan(200000) // Reasonable gas limit
      }
    })

    it('should handle large numbers of users efficiently', async () => {
      const numUsers = 10
      const depositAmount = ethers.parseUnits('50', 6)

      // Create multiple users and deposits
      const signers = await ethers.getSigners()
      const testUsers = signers.slice(3, 3 + numUsers) // Skip owner, user1, user2

      for (const user of testUsers) {
        await mockToken.mint(user.address, ethers.parseUnits('1000', 6))
        await mockToken.connect(user).approve(await savingsVault.getAddress(), depositAmount)
        await savingsVault.connect(user).deposit(depositAmount)
      }

      // Verify all balances
      for (const user of testUsers) {
        const balance = await savingsVault.getUserBalance(user.address)
        expect(balance).to.equal(depositAmount)
      }

      // Test yield distribution to all users
      await time.increase(86400)
      const tx = await yieldManager.distributeYield()
      const receipt = await tx.wait()

      // Gas should scale reasonably with number of users
      expect(receipt?.gasUsed).to.be.lessThan(500000)
    })
  })

  describe('Cross-Contract Integration', () => {
    it('should maintain data consistency across all contracts', async () => {
      const depositAmount = ethers.parseUnits('500', 6)

      await mockToken.connect(user1).approve(await savingsVault.getAddress(), depositAmount)
      await savingsVault.connect(user1).deposit(depositAmount)

      // Check consistency across contracts
      const vaultBalance = await savingsVault.getUserBalance(user1.address)
      const gameEngineBalance = await gameEngine.getUserSavingsBalance(user1.address)
      const yieldManagerInvested = await yieldManager.getUserInvestedAmount(user1.address)

      expect(vaultBalance).to.equal(depositAmount)
      expect(gameEngineBalance).to.equal(depositAmount)
      expect(yieldManagerInvested).to.equal(depositAmount)
    })

    it('should handle contract upgrades gracefully', async () => {
      const depositAmount = ethers.parseUnits('1000', 6)

      await mockToken.connect(user1).approve(await savingsVault.getAddress(), depositAmount)
      await savingsVault.connect(user1).deposit(depositAmount)

      // Deploy new yield manager
      const NewYieldManager = await ethers.getContractFactory('YieldManager')
      const newYieldManager = await NewYieldManager.deploy()

      // Migrate to new yield manager
      await savingsVault.connect(owner).setYieldManager(await newYieldManager.getAddress())
      await newYieldManager.setSavingsVault(await savingsVault.getAddress())

      // Verify user balance is preserved
      const balance = await savingsVault.getUserBalance(user1.address)
      expect(balance).to.equal(depositAmount)

      // Verify new yield manager works
      await time.increase(86400)
      await newYieldManager.distributeYield()

      const newBalance = await savingsVault.getUserBalance(user1.address)
      expect(newBalance).to.be.greaterThan(balance)
    })
  })
})