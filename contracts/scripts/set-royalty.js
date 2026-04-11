const hre = require("hardhat");

// Whale Town NFT collection on Tempo Mainnet
const WHALE_TOWN_NFT = "0x1065ef5996C86C8C90D97974F3c9E5234416839F";
// New marketplace address
const MARKETPLACE = "0x26CC31587Faa3334e7bbfC9A2255E1c1434fDbBe";

const MARKETPLACE_ABI = [
  "function setCollectionRoyalty(address _nftContract, address _recipient, uint96 _bps) external",
  "function collectionRoyalties(address) external view returns (address recipient, uint96 bps, bool set)",
  "function owner() external view returns (address)",
];

async function main() {
  const [deployer] = await hre.ethers.getSigners();
  console.log("Signer:", deployer.address);
  console.log("Network:", hre.network.name);

  const marketplace = new hre.ethers.Contract(MARKETPLACE, MARKETPLACE_ABI, deployer);

  const owner = await marketplace.owner();
  console.log("Marketplace owner:", owner);

  if (owner.toLowerCase() !== deployer.address.toLowerCase()) {
    throw new Error(`Signer is not the owner. Owner: ${owner}, Signer: ${deployer.address}`);
  }

  // Set 7% royalty for the Whale Town collection, paid to the deployer wallet
  const ROYALTY_BPS = 700; // 7%
  const ROYALTY_RECIPIENT = deployer.address; // Adjust to your preferred treasury address

  console.log(`\nSetting ${ROYALTY_BPS / 100}% royalty for Whale Town collection...`);
  console.log("Royalty recipient:", ROYALTY_RECIPIENT);

  const tx = await marketplace.setCollectionRoyalty(WHALE_TOWN_NFT, ROYALTY_RECIPIENT, ROYALTY_BPS);
  console.log("Tx hash:", tx.hash);
  await tx.wait();
  console.log("✓ Confirmed");

  // Verify
  const royalty = await marketplace.collectionRoyalties(WHALE_TOWN_NFT);
  console.log("\nVerification:");
  console.log("  Recipient:", royalty.recipient);
  console.log("  BPS:", royalty.bps.toString(), `(${Number(royalty.bps) / 100}%)`);
  console.log("  Set:", royalty.set);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
