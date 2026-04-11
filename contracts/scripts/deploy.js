const hre = require("hardhat");
const fs = require("fs");

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Deploying WhaleTownMarketplace...");
  console.log("Deployer:", deployer.address);
  console.log("Network:", hre.network.name);

  const feeRecipient = deployer.address;
  const platformFeeBps = 100; // 1%
  const pathUSD = "0x20c0000000000000000000000000000000000000";

  const Marketplace = await hre.ethers.getContractFactory("WhaleTownMarketplace");
  const marketplace = await Marketplace.deploy(pathUSD, feeRecipient, platformFeeBps);
  await marketplace.waitForDeployment();

  const address = await marketplace.getAddress();
  console.log("\nWhaleTownMarketplace deployed!");
  console.log("Address:", address);
  console.log("Platform fee: 1%");
  console.log("Fee recipient:", feeRecipient);

  fs.writeFileSync("marketplace-address.txt", address);
  console.log("Saved to marketplace-address.txt");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
