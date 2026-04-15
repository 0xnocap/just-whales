const hre = require("hardhat");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  const network = await hre.ethers.provider.getNetwork();
  const chainId = Number(network.chainId);
  console.log("Deploying RewardsClaimer with account:", deployer.address, "on chain:", chainId);

  // Default to Mainnet constants
  let ADMIN = "0x7831959816fAA58B5Dc869b7692cebdb6EFC311E";
  let SIGNER = "0x7831959816fAA58B5Dc869b7692cebdb6EFC311E";
  let POINTS_ADDRESS = "0xCf4A2079A2c058d266A0999F3fCA256d6F1F53a9"; // Mainnet $OP

  if (chainId === 42431) {
    console.log("Using Testnet constants...");
    POINTS_ADDRESS = "0xe5a7d520fbeBAaADb60cB80FD31ffb74f564d15d";
  }

  console.log("Admin:", ADMIN);
  console.log("Signer:", SIGNER);
  console.log("Points Address:", POINTS_ADDRESS);

  // 1. Deploy RewardsClaimer
  const RewardsClaimer = await hre.ethers.getContractFactory("RewardsClaimer");
  const claimer = await RewardsClaimer.deploy(ADMIN, SIGNER, POINTS_ADDRESS);

  await claimer.waitForDeployment();
  const claimerAddress = await claimer.getAddress();
  console.log("RewardsClaimer deployed to:", claimerAddress);

  // 2. Grant MINTER_ROLE on WhaleTownPoints
  const WhaleTownPoints = await hre.ethers.getContractAt("WhaleTownPoints", POINTS_ADDRESS);
  const MINTER_ROLE = await WhaleTownPoints.MINTER_ROLE();
  
  console.log("Granting MINTER_ROLE to RewardsClaimer...");
  const tx = await WhaleTownPoints.grantRole(MINTER_ROLE, claimerAddress);
  await tx.wait();
  console.log("MINTER_ROLE granted.");

  console.log("=== Deployment Complete ===");
  console.log("REWARDS_CLAIMER_CONTRACT=" + claimerAddress);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
