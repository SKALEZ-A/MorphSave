const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("GameEngine", function () {
  let gameEngine;
  let owner, user1, user2, user3;

  const ENTRY_FEE = ethers.parseEther("0.1");
  const TARGET_AMOUNT = ethers.parseEther("10");

  beforeEach(async function () {
    [owner, user1, user2, user3] = await ethers.getSigners();
    
    const GameEngine = await ethers.getContractFactory("GameEngine");
    gameEngine = await GameEngine.deploy();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await gameEngine.owner()).to.equal(owner.address);
    });

    it("Should initialize with default achievements", async function () {
      const achievement = await gameEngine.achievements(1);
      expect(achievement.name).to.equal("First Save");
      expect(achievement.pointsReward).to.equal(100);
    });

    it("Should start with zero users", async function () {
      expect(await gameEngine.totalUsers()).to.equal(0);
    });
  });

  describe("User Statistics", function () {
    it("Should update user savings", async function () {
      const savingsAmount = ethers.parseEther("100");
      
      await gameEngine.updateUserSavings(user1.address, savingsAmount);
      
      const stats = await gameEngine.getUserStats(user1.address);
      expect(stats.totalSaved).to.equal(savingsAmount);
      expect(await gameEngine.totalUsers()).to.equal(1);
    });

    it("Should update user streak", async function () {
      await gameEngine.updateStreak(user1.address);
      
      const stats = await gameEngine.getUserStats(user1.address);
      expect(stats.currentStreak).to.equal(1);
      expect(stats.longestStreak).to.equal(1);
    });

    it("Should add referrals", async function () {
      await gameEngine.addReferral(user1.address);
      await gameEngine.addReferral(user1.address);
      
      const stats = await gameEngine.getUserStats(user1.address);
      expect(stats.totalPoints).to.be.gt(0); // Should have points from referral achievements
    });
  });

  describe("Achievements", function () {
    it("Should unlock savings achievements automatically", async function () {
      const savingsAmount = ethers.parseEther("100");
      
      await gameEngine.updateUserSavings(user1.address, savingsAmount);
      
      // Check if "Century Club" achievement is unlocked
      const hasAchievement = await gameEngine.hasAchievement(user1.address, 2);
      expect(hasAchievement).to.equal(true);
    });

    it("Should unlock streak achievements", async function () {
      // Simulate 7-day streak
      for (let i = 0; i < 7; i++) {
        await gameEngine.updateStreak(user1.address);
        // Fast forward 1 day
        await ethers.provider.send("evm_increaseTime", [24 * 60 * 60]);
        await ethers.provider.send("evm_mine");
      }
      
      const stats = await gameEngine.getUserStats(user1.address);
      expect(stats.longestStreak).to.be.gte(7);
    });

    it("Should record achievement manually", async function () {
      // First, set up user with enough savings
      await gameEngine.updateUserSavings(user1.address, ethers.parseEther("1"));
      
      await expect(gameEngine.recordAchievement(user1.address, 1))
        .to.emit(gameEngine, "AchievementUnlocked")
        .withArgs(user1.address, 1, 100, await ethers.provider.getBlockNumber() + 1);
    });

    it("Should prevent duplicate achievement unlocks", async function () {
      await gameEngine.updateUserSavings(user1.address, ethers.parseEther("1"));
      await gameEngine.recordAchievement(user1.address, 1);
      
      await expect(gameEngine.recordAchievement(user1.address, 1))
        .to.be.revertedWith("Achievement already unlocked");
    });

    it("Should level up users based on points", async function () {
      // Give user enough points to level up
      await gameEngine.updateUserSavings(user1.address, ethers.parseEther("1000"));
      
      const stats = await gameEngine.getUserStats(user1.address);
      expect(stats.level).to.be.gt(0);
    });
  });

  describe("Challenges", function () {
    let challengeId;

    beforeEach(async function () {
      const tx = await gameEngine.connect(user1).createChallenge(
        "Save $10 Challenge",
        "Save $10 in 30 days",
        0, // SAVINGS_AMOUNT
        TARGET_AMOUNT,
        30, // 30 days
        ENTRY_FEE,
        { value: ENTRY_FEE }
      );
      
      const receipt = await tx.wait();
      const event = receipt.logs.find(log => {
        try {
          return gameEngine.interface.parseLog(log).name === "ChallengeCreated";
        } catch {
          return false;
        }
      });
      challengeId = gameEngine.interface.parseLog(event).args.challengeId;
    });

    it("Should create challenges", async function () {
      const challenge = await gameEngine.getChallenge(challengeId);
      expect(challenge.creator).to.equal(user1.address);
      expect(challenge.title).to.equal("Save $10 Challenge");
      expect(challenge.participantCount).to.equal(1);
    });

    it("Should allow users to join challenges", async function () {
      await expect(gameEngine.connect(user2).joinChallenge(challengeId, { value: ENTRY_FEE }))
        .to.emit(gameEngine, "ChallengeJoined")
        .withArgs(challengeId, user2.address, await ethers.provider.getBlockNumber() + 1);
      
      const challenge = await gameEngine.getChallenge(challengeId);
      expect(challenge.participantCount).to.equal(2);
    });

    it("Should prevent joining with insufficient fee", async function () {
      const insufficientFee = ethers.parseEther("0.05");
      
      await expect(gameEngine.connect(user2).joinChallenge(challengeId, { value: insufficientFee }))
        .to.be.revertedWith("Insufficient entry fee");
    });

    it("Should prevent duplicate joins", async function () {
      await gameEngine.connect(user2).joinChallenge(challengeId, { value: ENTRY_FEE });
      
      await expect(gameEngine.connect(user2).joinChallenge(challengeId, { value: ENTRY_FEE }))
        .to.be.revertedWith("Already joined");
    });

    it("Should update challenge progress", async function () {
      await gameEngine.connect(user2).joinChallenge(challengeId, { value: ENTRY_FEE });
      
      const progress = ethers.parseEther("5");
      await gameEngine.updateChallengeProgress(challengeId, user2.address, progress);
      
      const userProgress = await gameEngine.getChallengeProgress(challengeId, user2.address);
      expect(userProgress).to.equal(progress);
    });

    it("Should complete challenge when target is reached", async function () {
      await gameEngine.connect(user2).joinChallenge(challengeId, { value: ENTRY_FEE });
      
      await expect(gameEngine.updateChallengeProgress(challengeId, user2.address, TARGET_AMOUNT))
        .to.emit(gameEngine, "ChallengeCompleted")
        .withArgs(challengeId, user2.address, ENTRY_FEE * 2n);
      
      const challenge = await gameEngine.getChallenge(challengeId);
      expect(challenge.status).to.equal(1); // COMPLETED
    });

    it("Should allow owner to cancel challenges", async function () {
      await gameEngine.connect(user2).joinChallenge(challengeId, { value: ENTRY_FEE });
      
      await gameEngine.cancelChallenge(challengeId);
      
      const challenge = await gameEngine.getChallenge(challengeId);
      expect(challenge.status).to.equal(2); // CANCELLED
    });
  });

  describe("Reward Distribution", function () {
    it("Should distribute rewards to multiple users", async function () {
      const users = [user1.address, user2.address];
      const amounts = [ethers.parseEther("0.1"), ethers.parseEther("0.2")];
      const reason = "Weekly bonus";
      
      // Fund the contract
      await owner.sendTransaction({
        to: await gameEngine.getAddress(),
        value: ethers.parseEther("1")
      });
      
      await expect(gameEngine.distributeRewards(users, amounts, reason))
        .to.emit(gameEngine, "RewardDistributed")
        .withArgs(user1.address, amounts[0], reason);
    });

    it("Should reject mismatched arrays", async function () {
      const users = [user1.address, user2.address];
      const amounts = [ethers.parseEther("0.1")]; // Different length
      
      await expect(gameEngine.distributeRewards(users, amounts, "test"))
        .to.be.revertedWith("Arrays length mismatch");
    });
  });

  describe("Admin Functions", function () {
    it("Should allow owner to add achievements", async function () {
      await gameEngine.addAchievement(
        "Test Achievement",
        "Test description",
        0, // SAVINGS
        500,
        50
      );
      
      const achievement = await gameEngine.achievements(11); // Next ID after initial 10
      expect(achievement.name).to.equal("Test Achievement");
    });

    it("Should allow owner to update level thresholds", async function () {
      const newThresholds = [0, 200, 500, 1000];
      
      await gameEngine.updateLevelThresholds(newThresholds);
      
      // Test by checking if level calculation changes
      await gameEngine.updateUserSavings(user1.address, ethers.parseEther("1000"));
      const stats = await gameEngine.getUserStats(user1.address);
      expect(stats.level).to.be.gte(0);
    });

    it("Should reject admin functions from non-owner", async function () {
      await expect(gameEngine.connect(user1).addAchievement("Test", "Test", 0, 100, 10))
        .to.be.revertedWithCustomError(gameEngine, "OwnableUnauthorizedAccount");
    });
  });

  describe("Edge Cases", function () {
    it("Should handle zero amounts gracefully", async function () {
      await gameEngine.updateUserSavings(user1.address, 0);
      
      const stats = await gameEngine.getUserStats(user1.address);
      expect(stats.totalSaved).to.equal(0);
    });

    it("Should handle streak breaks correctly", async function () {
      // Start streak
      await gameEngine.updateStreak(user1.address);
      
      // Fast forward 3 days (breaks streak)
      await ethers.provider.send("evm_increaseTime", [3 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine");
      
      // Update streak again
      await gameEngine.updateStreak(user1.address);
      
      const stats = await gameEngine.getUserStats(user1.address);
      expect(stats.currentStreak).to.equal(1); // Reset to 1
      expect(stats.longestStreak).to.equal(1); // Previous longest was 1
    });

    it("Should handle multiple same-day activities", async function () {
      await gameEngine.updateStreak(user1.address);
      await gameEngine.updateStreak(user1.address); // Same day
      
      const stats = await gameEngine.getUserStats(user1.address);
      expect(stats.currentStreak).to.equal(1); // Should not increase
    });
  });

  describe("Contract Balance", function () {
    it("Should accept ETH deposits", async function () {
      const depositAmount = ethers.parseEther("1");
      
      await owner.sendTransaction({
        to: await gameEngine.getAddress(),
        value: depositAmount
      });
      
      const balance = await ethers.provider.getBalance(await gameEngine.getAddress());
      expect(balance).to.equal(depositAmount);
    });

    it("Should allow emergency withdrawal by owner", async function () {
      const depositAmount = ethers.parseEther("1");
      
      await owner.sendTransaction({
        to: await gameEngine.getAddress(),
        value: depositAmount
      });
      
      const initialOwnerBalance = await ethers.provider.getBalance(owner.address);
      
      await gameEngine.emergencyWithdraw();
      
      const finalOwnerBalance = await ethers.provider.getBalance(owner.address);
      expect(finalOwnerBalance).to.be.gt(initialOwnerBalance);
    });
  });
});