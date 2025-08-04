import { expect } from "chai";
import { ethers } from "hardhat";

describe("SavingsVault Simple Tests", function () {
  let savingsVault: any;
  let owner: any;
  let user1: any;

  beforeEach(async function () {
    [owner, user1] = await ethers.getSigners();
    
    const SavingsVault = await ethers.getContractFactory("SavingsVault");
    savingsVault = await SavingsVault.deploy();
  });

  it("Should deploy successfully", async function () {
    expect(await savingsVault.owner()).to.equal(owner.address);
  });

  it("Should allow deposits", async function () {
    const depositAmount = ethers.parseEther("1");
    
    await expect(savingsVault.connect(user1).deposit({ value: depositAmount }))
      .to.emit(savingsVault, "Deposit");
  });

  it("Should track user balances", async function () {
    const depositAmount = ethers.parseEther("1");
    
    await savingsVault.connect(user1).deposit({ value: depositAmount });
    
    const balance = await savingsVault.getUserBalance(user1.address);
    expect(balance).to.be.gt(0);
  });

  it("Should allow withdrawals", async function () {
    const depositAmount = ethers.parseEther("1");
    const withdrawAmount = ethers.parseEther("0.5");
    
    await savingsVault.connect(user1).deposit({ value: depositAmount });
    
    await expect(savingsVault.connect(user1).withdraw(withdrawAmount))
      .to.emit(savingsVault, "Withdrawal");
  });

  it("Should calculate yield", async function () {
    const depositAmount = ethers.parseEther("1");
    
    await savingsVault.connect(user1).deposit({ value: depositAmount });
    
    const yield = await savingsVault.getTotalYield(user1.address);
    expect(yield).to.be.gte(0);
  });
});