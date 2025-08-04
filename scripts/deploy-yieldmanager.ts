const { ethers } = require("hardhat");

async function main() {
  console.log("Deploying YieldManager contract...");

  const [deployer] = await ethers.getSigners();
  console.log("Deploying contracts with the account:", deployer.address);

  // Deploy YieldManager
  const YieldManager = await ethers.getContractFactory("YieldManager");
  const yieldManager = await YieldManager.deploy();

  await yieldManager.waitForDeployment();
  const address = await yieldManager.getAddress();

  console.log("YieldManager deployed to:", address);
  console.log("Owner:", await yieldManager.owner());
  console.log("Default protocol:", await yieldManager.defaultProtocol());

  // Test basic functionality
  console.log("\nTesting YieldManager functionality...");
  
  try {
    // Check initial protocols
    const activeProtocols = await yieldManager.getActiveProtocols();
    console.log("Active protocols:", activeProtocols.length);

    // Check protocol stats
    const protocol1Stats = await yieldManager.getProtocolStats(activeProtocols[0]);
    console.log("Protocol 1 stats:", {
      name: protocol1Stats.name,
      currentAPY: protocol1Stats.currentAPY.toString() + " basis points",
      riskLevel: protocol1Stats.riskLevel.toString(),
      totalDeposited: ethers.formatEther(protocol1Stats.totalDeposited) + " ETH"
    });

    // Test deposit for yield
    const depositAmount = ethers.parseEther("10");
    await yieldManager.depositForYield(deployer.address, depositAmount);
    console.log("✅ Deposit for yield successful");

    // Check user position
    const position = await yieldManager.getUserYieldPosition(deployer.address);
    console.log("User position:", {
      principal: ethers.formatEther(position.principal) + " ETH",
      yieldEarned: ethers.formatEther(position.yieldEarned) + " ETH",
      pendingYield: ethers.formatEther(position.pendingYield) + " ETH",
      currentAPY: position.currentAPY.toString() + " basis points",
      protocolName: position.protocolName
    });

    // Test user strategy setting
    await yieldManager.setUserStrategy(deployer.address, 1, 400, true); // MEDIUM risk, 4% min APY, auto-compound
    console.log("✅ User strategy set");

    // Test protocol management
    const newProtocol = "0x4444444444444444444444444444444444444444";
    await yieldManager.addProtocol(newProtocol, "TestProtocol", 900, 1); // 9% APY, MEDIUM risk
    console.log("✅ New protocol added");

    // Check updated active protocols
    const updatedProtocols = await yieldManager.getActiveProtocols();
    console.log("Updated active protocols:", updatedProtocols.length);

    // Test fee structure
    const managementFee = await yieldManager.managementFee();
    const performanceFee = await yieldManager.performanceFee();
    const withdrawalFee = await yieldManager.withdrawalFee();
    console.log("Fee structure:", {
      management: (managementFee * 100n / 10000n).toString() + "%",
      performance: (performanceFee * 100n / 10000n).toString() + "%",
      withdrawal: (withdrawalFee * 100n / 10000n).toString() + "%"
    });

    console.log("\n🎉 YieldManager contract deployed and tested successfully!");
    
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