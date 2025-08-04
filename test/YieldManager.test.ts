const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("YieldManager", function () {
  let yieldManager;
  let owner, user1, user2;

  const DEPOSIT_AMOUNT = ethers.parseEther("100");
  const PROTOCOL_1 = "0x1111111111111111111111111111111111111111";
  const PROTOCOL_2 = "0x2222222222222222222222222222222222222222";
  const PROTOCOL_3 = "0x3333333333333333333333333333333333333333";

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();
    
    const YieldManager = await ethers.getContractFactory("YieldManager");
    yieldManager = await YieldManager.deploy();
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await yieldManager.owner()).to.equal(owner.address);
    });

    it("Should initialize with default protocols", async function () {
      const protocol1 = await yieldManager.getProtocolStats(PROTOCOL_1);
      expect(protocol1.name).to.equal("StableLend");
      expect(protocol1.currentAPY).to.equal(500); // 5%
    });

    it("Should set default protocol", async function () {
      expect(await yieldManager.defaultProtocol()).to.equal(PROTOCOL_1);
    });

    it("Should have correct initial fee structure", async function () {
      expect(await yieldManager.managementFee()).to.equal(100); // 1%
      expect(await yieldManager.performanceFee()).to.equal(1000); // 10%
      expect(await yieldManager.withdrawalFee()).to.equal(50); // 0.5%
    });
  });

  describe("Protocol Management", function () {
    it("Should add new protocols", async function () {
      const newProtocol = "0x4444444444444444444444444444444444444444";
      
      await expect(yieldManager.addProtocol(newProtocol, "NewProtocol", 600, 1))
        .to.emit(yieldManager, "ProtocolAdded")
        .withArgs(newProtocol, "NewProtocol", 600);
      
      const protocol = await yieldManager.getProtocolStats(newProtocol);
      expect(protocol.name).to.equal("NewProtocol");
    });

    it("Should remove protocols", async function () {
      await expect(yieldManager.removeProtocol(PROTOCOL_3))
        .to.emit(yieldManager, "ProtocolRemoved")
        .withArgs(PROTOCOL_3);
      
      const protocol = await yieldManager.getProtocolStats(PROTOCOL_3);
      expect(protocol.status).to.equal(2); // DEPRECATED
    });

    it("Should update protocol APY", async function () {
      const newAPY = 700;
      
      await expect(yieldManager.updateProtocolAPY(PROTOCOL_1, newAPY))
        .to.emit(yieldManager, "APYUpdated")
        .withArgs(PROTOCOL_1, 500, newAPY);
      
      const protocol = await yieldManager.getProtocolStats(PROTOCOL_1);
      expect(protocol.currentAPY).to.equal(newAPY);
    });

    it("Should update protocol risk level", async function () {
      await expect(yieldManager.updateProtocolRisk(PROTOCOL_1, 2)) // HIGH risk
        .to.emit(yieldManager, "RiskAssessmentUpdated")
        .withArgs(PROTOCOL_1, 0, 2); // LOW to HIGH
    });

    it("Should get active protocols", async function () {
      const activeProtocols = await yieldManager.getActiveProtocols();
      expect(activeProtocols.length).to.equal(3);
      expect(activeProtocols).to.include(PROTOCOL_1);
      expect(activeProtocols).to.include(PROTOCOL_2);
      expect(activeProtocols).to.include(PROTOCOL_3);
    });
  });

  describe("Yield Deposits", function () {
    it("Should deposit funds for yield", async function () {
      await expect(yieldManager.depositForYield(user1.address, DEPOSIT_AMOUNT))
        .to.emit(yieldManager, "YieldDeposited")
        .withArgs(user1.address, PROTOCOL_1, DEPOSIT_AMOUNT, await ethers.provider.getBlockNumber() + 1);
      
      const position = await yieldManager.getUserYieldPosition(user1.address);
      expect(position.principal).to.equal(DEPOSIT_AMOUNT);
    });

    it("Should select optimal protocol based on strategy", async function () {
      // Set user strategy to prefer higher yield
      await yieldManager.setUserStrategy(user1.address, 2, 0, true); // HIGH risk, 0% min APY
      
      await yieldManager.depositForYield(user1.address, DEPOSIT_AMOUNT);
      
      const position = await yieldManager.getUserYieldPosition(user1.address);
      expect(position.protocolName).to.equal("HighYield"); // Should select highest APY protocol
    });

    it("Should initialize user strategy on first deposit", async function () {
      await yieldManager.depositForYield(user1.address, DEPOSIT_AMOUNT);
      
      const position = await yieldManager.getUserYieldPosition(user1.address);
      expect(position.principal).to.equal(DEPOSIT_AMOUNT);
      expect(position.protocolName).to.equal("StableLend"); // Default conservative choice
    });

    it("Should reject zero amount deposits", async function () {
      await expect(yieldManager.depositForYield(user1.address, 0))
        .to.be.revertedWith("Amount must be greater than 0");
    });
  });

  describe("Yield Calculations", function () {
    beforeEach(async function () {
      await yieldManager.depositForYield(user1.address, DEPOSIT_AMOUNT);
    });

    it("Should calculate pending yield correctly", async function () {
      // Fast forward time by 30 days
      await ethers.provider.send("evm_increaseTime", [30 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine");
      
      const totalYield = await yieldManager.getTotalYield(user1.address);
      expect(totalYield).to.be.gt(0);
      
      // Rough calculation: 100 ETH * 5% APY * 30/365 days ≈ 0.41 ETH
      const expectedYield = DEPOSIT_AMOUNT * 500n / 10000n * 30n / 365n;
      expect(totalYield).to.be.closeTo(expectedYield, ethers.parseEther("0.1"));
    });

    it("Should return zero yield for new positions", async function () {
      const totalYield = await yieldManager.getTotalYield(user2.address);
      expect(totalYield).to.equal(0);
    });

    it("Should compound yield correctly", async function () {
      // Fast forward time to generate yield
      await ethers.provider.send("evm_increaseTime", [30 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine");
      
      const initialPosition = await yieldManager.getUserYieldPosition(user1.address);
      const initialPrincipal = initialPosition.principal;
      
      await expect(yieldManager.compoundYield(user1.address))
        .to.emit(yieldManager, "YieldCompounded");
      
      const finalPosition = await yieldManager.getUserYieldPosition(user1.address);
      expect(finalPosition.principal).to.be.gt(initialPrincipal);
    });
  });

  describe("Withdrawals", function () {
    beforeEach(async function () {
      await yieldManager.depositForYield(user1.address, DEPOSIT_AMOUNT);
      
      // Fast forward to generate some yield
      await ethers.provider.send("evm_increaseTime", [30 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine");
    });

    it("Should allow partial withdrawals", async function () {
      const withdrawAmount = ethers.parseEther("50");
      
      await expect(yieldManager.withdrawFromYield(user1.address, withdrawAmount))
        .to.emit(yieldManager, "YieldWithdrawn");
      
      const position = await yieldManager.getUserYieldPosition(user1.address);
      expect(position.principal).to.be.lt(DEPOSIT_AMOUNT);
    });

    it("Should allow full withdrawals", async function () {
      await expect(yieldManager.withdrawFromYield(user1.address, 0)) // 0 = withdraw all
        .to.emit(yieldManager, "YieldWithdrawn");
      
      const position = await yieldManager.getUserYieldPosition(user1.address);
      expect(position.principal).to.equal(0);
    });

    it("Should calculate withdrawal fees", async function () {
      const withdrawAmount = ethers.parseEther("50");
      const expectedFee = withdrawAmount * 50n / 10000n; // 0.5% fee
      
      const netWithdrawal = await yieldManager.withdrawFromYield.staticCall(user1.address, withdrawAmount);
      expect(netWithdrawal).to.equal(withdrawAmount - expectedFee);
    });

    it("Should reject withdrawal exceeding balance", async function () {
      const excessiveAmount = ethers.parseEther("200");
      
      await expect(yieldManager.withdrawFromYield(user1.address, excessiveAmount))
        .to.be.revertedWith("Insufficient balance");
    });

    it("Should reject withdrawal from empty position", async function () {
      await expect(yieldManager.withdrawFromYield(user2.address, ethers.parseEther("10")))
        .to.be.revertedWith("No position to withdraw");
    });
  });

  describe("Protocol Switching", function () {
    beforeEach(async function () {
      await yieldManager.depositForYield(user1.address, DEPOSIT_AMOUNT);
    });

    it("Should switch protocols", async function () {
      await expect(yieldManager.switchProtocol(user1.address, PROTOCOL_2))
        .to.emit(yieldManager, "ProtocolSwitched")
        .withArgs(PROTOCOL_1, PROTOCOL_2, DEPOSIT_AMOUNT);
      
      const position = await yieldManager.getUserYieldPosition(user1.address);
      expect(position.protocolName).to.equal("YieldFarm");
    });

    it("Should compound yield before switching", async function () {
      // Generate some yield first
      await ethers.provider.send("evm_increaseTime", [30 * 24 * 60 * 60]);
      await ethers.provider.send("evm_mine");
      
      const initialPosition = await yieldManager.getUserYieldPosition(user1.address);
      const initialTotal = initialPosition.principal + initialPosition.pendingYield;
      
      await yieldManager.switchProtocol(user1.address, PROTOCOL_2);
      
      const finalPosition = await yieldManager.getUserYieldPosition(user1.address);
      expect(finalPosition.principal).to.be.gt(initialPosition.principal);
    });

    it("Should reject switching to inactive protocol", async function () {
      await yieldManager.removeProtocol(PROTOCOL_3);
      
      await expect(yieldManager.switchProtocol(user1.address, PROTOCOL_3))
        .to.be.revertedWith("Protocol not active");
    });

    it("Should reject switching to same protocol", async function () {
      await expect(yieldManager.switchProtocol(user1.address, PROTOCOL_1))
        .to.be.revertedWith("Already using this protocol");
    });
  });

  describe("User Strategies", function () {
    it("Should set user strategy", async function () {
      await yieldManager.setUserStrategy(user1.address, 1, 400, true); // MEDIUM risk, 4% min APY, auto-compound
      
      // Deposit should now select protocol based on new strategy
      await yieldManager.depositForYield(user1.address, DEPOSIT_AMOUNT);
      
      const position = await yieldManager.getUserYieldPosition(user1.address);
      expect(position.protocolName).to.equal("YieldFarm"); // Should select MEDIUM risk protocol with 8% APY
    });

    it("Should respect risk tolerance", async function () {
      // Set conservative strategy
      await yieldManager.setUserStrategy(user1.address, 0, 0, true); // LOW risk only
      
      await yieldManager.depositForYield(user1.address, DEPOSIT_AMOUNT);
      
      const position = await yieldManager.getUserYieldPosition(user1.address);
      expect(position.protocolName).to.equal("StableLend"); // Should only use LOW risk protocol
    });

    it("Should respect minimum APY threshold", async function () {
      // Set high APY requirement
      await yieldManager.setUserStrategy(user1.address, 2, 1000, true); // HIGH risk, 10% min APY
      
      await yieldManager.depositForYield(user1.address, DEPOSIT_AMOUNT);
      
      const position = await yieldManager.getUserYieldPosition(user1.address);
      expect(position.protocolName).to.equal("HighYield"); // Should select highest APY protocol
    });
  });

  describe("Fee Management", function () {
    it("Should update fees within limits", async function () {
      await yieldManager.updateFees(200, 1500, 100); // 2%, 15%, 1%
      
      expect(await yieldManager.managementFee()).to.equal(200);
      expect(await yieldManager.performanceFee()).to.equal(1500);
      expect(await yieldManager.withdrawalFee()).to.equal(100);
    });

    it("Should reject excessive fees", async function () {
      await expect(yieldManager.updateFees(600, 1000, 50)) // 6% management fee
        .to.be.revertedWith("Management fee too high");
      
      await expect(yieldManager.updateFees(100, 2100, 50)) // 21% performance fee
        .to.be.revertedWith("Performance fee too high");
      
      await expect(yieldManager.updateFees(100, 1000, 250)) // 2.5% withdrawal fee
        .to.be.revertedWith("Withdrawal fee too high");
    });
  });

  describe("Emergency Functions", function () {
    beforeEach(async function () {
      await yieldManager.depositForYield(user1.address, DEPOSIT_AMOUNT);
      await yieldManager.depositForYield(user2.address, DEPOSIT_AMOUNT);
    });

    it("Should allow emergency withdrawal from all protocols", async function () {
      await expect(yieldManager.emergencyWithdrawAll())
        .to.emit(yieldManager, "EmergencyWithdrawal");
      
      // Check that protocol deposits are reset
      const protocol1 = await yieldManager.getProtocolStats(PROTOCOL_1);
      expect(protocol1.totalDeposited).to.equal(0);
    });
  });

  describe("Admin Access Control", function () {
    it("Should reject non-owner protocol management", async function () {
      await expect(yieldManager.connect(user1).addProtocol(
        "0x4444444444444444444444444444444444444444",
        "Test",
        500,
        0
      )).to.be.revertedWithCustomError(yieldManager, "OwnableUnauthorizedAccount");
    });

    it("Should reject non-owner yield operations", async function () {
      await expect(yieldManager.connect(user1).depositForYield(user1.address, DEPOSIT_AMOUNT))
        .to.be.revertedWithCustomError(yieldManager, "OwnableUnauthorizedAccount");
    });

    it("Should reject non-owner fee updates", async function () {
      await expect(yieldManager.connect(user1).updateFees(100, 1000, 50))
        .to.be.revertedWithCustomError(yieldManager, "OwnableUnauthorizedAccount");
    });
  });

  describe("Edge Cases", function () {
    it("Should handle zero yield gracefully", async function () {
      await yieldManager.depositForYield(user1.address, DEPOSIT_AMOUNT);
      
      // Immediately check yield (should be zero)
      const totalYield = await yieldManager.getTotalYield(user1.address);
      expect(totalYield).to.equal(0);
    });

    it("Should handle compound frequency limits", async function () {
      await yieldManager.depositForYield(user1.address, DEPOSIT_AMOUNT);
      
      // Try to compound immediately (should fail due to frequency limit)
      await expect(yieldManager.compoundYield(user1.address))
        .to.be.revertedWith("No yield to compound");
    });

    it("Should handle protocol APY update frequency", async function () {
      await yieldManager.updateProtocolAPY(PROTOCOL_1, 600);
      
      // Try to update again immediately (should fail due to frequency limit)
      await expect(yieldManager.updateProtocolAPY(PROTOCOL_1, 700))
        .to.be.revertedWith("Update frequency not met");
    });
  });
});