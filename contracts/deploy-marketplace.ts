import "dotenv/config";
import { createThirdwebClient } from "thirdweb";
import { defineChain } from "thirdweb/chains";
import { privateKeyToAccount } from "thirdweb/wallets";
import { deployPublishedContract } from "thirdweb/deploys";
import { writeFileSync } from "fs";

// --- Config ---

const DEPLOYER = "0x49CF10c489E60Bcb405AfE8bC4E577B9D7e3a65C";
const PLATFORM_FEE_BPS = 250; // 2.5%

const tempoTestnet = defineChain({
  id: 42431,
  rpc: "https://rpc.moderato.tempo.xyz",
});

// --- Setup ---

const secretKey = process.env.THIRDWEB_SECRET_KEY;
const privateKey = process.env.PRIVATE_KEY;

if (!secretKey) throw new Error("Missing THIRDWEB_SECRET_KEY in .env");
if (!privateKey) throw new Error("Missing PRIVATE_KEY in .env");

const client = createThirdwebClient({ secretKey });

const account = privateKeyToAccount({
  client,
  privateKey,
});

// --- Deploy ---

async function main() {
  console.log("Deploying MarketplaceV3 to Tempo Testnet (chain 42431)...");
  console.log("Deployer:", account.address);

  const marketplaceAddress = await deployPublishedContract({
    client,
    chain: tempoTestnet,
    account,
    contractId: "MarketplaceV3",
    contractParams: {
      _defaultAdmin: DEPLOYER,
      _platformFeeRecipient: DEPLOYER,
      _platformFeeBps: PLATFORM_FEE_BPS,
    },
    publisher: "deployer.thirdweb.eth",
  });

  console.log("\nMarketplaceV3 deployed!");
  console.log("Address:", marketplaceAddress);
  console.log("Chain: Tempo Testnet (42431)");
  console.log("Platform fee: 2.5%");
  console.log("Admin:", DEPLOYER);

  writeFileSync("marketplace-address.txt", marketplaceAddress);
  console.log("\nSaved to marketplace-address.txt");
}

main().catch((err) => {
  console.error("Deployment failed:", err);
  process.exit(1);
});
