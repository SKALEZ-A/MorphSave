const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying SavingsVault contract...");

  // Get the ContractFactory and Signers here.
  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);
  console.log("Account balance:", (await ethers.provider.getBalance(deployer.address)).toString());

  // Deploy SavingsVault
  const SavingsVault = await ethers.getContractFactory("SavingsVault");
  const savingsVault = await SavingsVault.deploy();

  await savingsVault.waitForDeployment();
  const address = await savingsVault.getAddress();

  console.log("SavingsVault deployed to:", address);
  console.log("Owner:", await savingsVault.owner());
  console.log("Minimum deposit:", ethers.formatEther(await savingsVault.MINIMUM_DEPOSIT()), "ETH");
  console.log("Minimum investment:", ethers.formatEther(await savingsVault.minimumInvestmentAmount()), "ETH");

  // Verify basic functionality
  console.log("\nTesting basic functionality...");
  
  try {
    // Test deposit
    const depositAmount = ethers.parseEther("0.1");
    const tx = await savingsVault.deposit({ value: depositAmount });
    await tx.wait();
    console.log("✅ Deposit successful");

    // Check balance
    const balance = await savingsVault.getUserBalance(deployer.address);
    console.log("User balance:", ethers.formatEther(balance), "ETH");

    // Test withdrawal
    const withdrawAmount = ethers.parseEther("0.05");
    const withdrawTx = await savingsVault.withdraw(withdrawAmount);
    await withdrawTx.wait();
    console.log("✅ Withdrawal successful");

    // Check final balance
    const finalBalance = await savingsVault.getUserBalance(deployer.address);
    console.log("Final balance:", ethers.formatEther(finalBalance), "ETH");

    console.log("\n🎉 SavingsVault contract deployed and tested successfully!");
    
  } catch (error) {
    console.error("❌ Error testing contract:", error);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });