const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying GameEngine contract...");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // Deploy GameEngine
  const GameEngine = await ethers.getContractFactory("GameEngine");
  const gameEngine = await GameEngine.deploy();

  await gameEngine.waitForDeployment();
  const address = await gameEngine.getAddress();

  console.log("GameEngine deployed to:", address);
  console.log("Owner:", await gameEngine.owner());
  console.log("Total users:", await gameEngine.totalUsers());

  // Test basic functionality
  console.log("\nTesting GameEngine functionality...");
  
  try {
    // Test user savings update
    const savingsAmount = ethers.parseEther("100");
    await gameEngine.updateUserSavings(deployer.address, savingsAmount);
    console.log("✅ User savings updated");

    // Check user stats
    const stats = await gameEngine.getUserStats(deployer.address);
    console.log("User stats:", {
      totalPoints: stats.totalPoints.toString(),
      level: stats.level.toString(),
      totalSaved: ethers.formatEther(stats.totalSaved),
      currentStreak: stats.currentStreak.toString()
    });

    // Test streak update
    await gameEngine.updateStreak(deployer.address);
    console.log("✅ Streak updated");

    // Check achievements
    const hasFirstSave = await gameEngine.hasAchievement(deployer.address, 1);
    const hasCenturyClub = await gameEngine.hasAchievement(deployer.address, 2);
    console.log("Achievements unlocked:", {
      firstSave: hasFirstSave,
      centuryClub: hasCenturyClub
    });

    // Test challenge creation
    const challengeTx = await gameEngine.createChallenge(
      "Test Challenge",
      "Save $10 in 30 days",
      0, // SAVINGS_AMOUNT
      ethers.parseEther("10"),
      30, // 30 days
      ethers.parseEther("0.1"), // entry fee
      { value: ethers.parseEther("0.1") }
    );
    
    await challengeTx.wait();
    console.log("✅ Challenge created");

    console.log("\n🎉 GameEngine contract deployed and tested successfully!");
    
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