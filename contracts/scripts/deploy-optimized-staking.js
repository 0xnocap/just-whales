const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("=== Whale Town Optimized Staking Deploy ===");
  console.log("Network:", hre.network.name);
  console.log("Deployer:", deployer.address);

  // Address for WhaleTown NFT
  const nftAddress = hre.network.name === "tempo" 
    ? "0x1065ef5996C86C8C90D97974F3c9E5234416839F" // Mainnet
    : "0x1A8E6629937F4E88315C3a65DC9eC3740e3b567C"; // Testnet

  // 1. Deploy WhaleTownPoints
  console.log("Deploying WhaleTownPoints...");
  const Points = await hre.ethers.getContractFactory("WhaleTownPoints");
  const points = await Points.deploy(deployer.address);
  await points.waitForDeployment();
  const pointsAddress = await points.getAddress();
  console.log("WhaleTownPoints deployed to:", pointsAddress);

  // 2. Deploy Optimized WhaleTownStaking
  console.log("Deploying WhaleTownStaking...");
  const Staking = await hre.ethers.getContractFactory("WhaleTownStaking");
  const staking = await Staking.deploy(deployer.address, nftAddress, pointsAddress);
  await staking.waitForDeployment();
  const stakingAddress = await staking.getAddress();
  console.log("WhaleTownStaking deployed to:", stakingAddress);

  // 3. Grant MINTER_ROLE on points to staking contract
  console.log("Setting up roles...");
  const MINTER_ROLE = await points.MINTER_ROLE();
  const tx = await points.grantRole(MINTER_ROLE, stakingAddress);
  await tx.wait();
  console.log("Granted MINTER_ROLE to staking contract.");

  // 4. Set Base Rates (Shark=10, Whale=20, SeaLion=5)
  console.log("Setting base rates...");
  const sharkRate = hre.ethers.parseEther("10");
  const whaleRate = hre.ethers.parseEther("20");
  const seaLionRate = hre.ethers.parseEther("5");
  const rateTx = await staking.setBaseRates(sharkRate, whaleRate, seaLionRate);
  await rateTx.wait();
  console.log("Base rates initialized.");

  console.log("\n=== Deployment Complete ===");
  console.log("STAKING_CONTRACT:", stakingAddress);
  console.log("POINTS_CONTRACT:", pointsAddress);
  
  // Save addresses for future use
  const addresses = `
NEW_TEST_POINTS_CONTRACT="${pointsAddress}"
NEW_TEST_STAKING_CONTRACT="${stakingAddress}"
`;
  fs.appendFileSync("economy-addresses-optimized.txt", addresses);
  console.log("Addresses saved to economy-addresses-optimized.txt");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
