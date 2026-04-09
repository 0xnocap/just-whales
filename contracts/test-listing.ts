import "dotenv/config";
import { createThirdwebClient, getContract } from "thirdweb";
import { defineChain } from "thirdweb/chains";
import { privateKeyToAccount } from "thirdweb/wallets";
import { directListing } from "thirdweb/extensions/marketplace";
import { sendTransaction } from "thirdweb";
import { readFileSync } from "fs";

// --- Config ---

const NFT_CONTRACT = "0x1A8E6629937F4E88315C3a65DC9eC3740e3b567C";
const TOKEN_ID = 0n; // First minted token

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
const account = privateKeyToAccount({ client, privateKey });

// Read marketplace address from deploy output
let marketplaceAddress: string;
try {
  marketplaceAddress = readFileSync("marketplace-address.txt", "utf-8").trim();
} catch {
  throw new Error("marketplace-address.txt not found. Run deploy-marketplace.ts first.");
}

const marketplace = getContract({
  client,
  chain: tempoTestnet,
  address: marketplaceAddress,
});

// --- Test Listing ---

async function main() {
  console.log("Marketplace:", marketplaceAddress);
  console.log("NFT Contract:", NFT_CONTRACT);
  console.log("Token ID:", TOKEN_ID.toString());
  console.log("Seller:", account.address);
  console.log("");

  // Note: Before listing, the seller must have called
  // setApprovalForAll(marketplaceAddress, true) on the NFT contract.
  // This can be done via the whale-town dapp or directly.

  console.log("Creating direct listing...");

  const tx = directListing.createListing({
    contract: marketplace,
    assetContractAddress: NFT_CONTRACT,
    tokenId: TOKEN_ID,
    pricePerToken: "0.01", // 0.01 TEMPO
    quantity: 1n,
  });

  const receipt = await sendTransaction({
    transaction: tx,
    account,
  });

  console.log("Listing created! Tx:", receipt.transactionHash);

  // Verify listing exists
  console.log("\nVerifying listing...");
  const listing = await directListing.getListing({
    contract: marketplace,
    listingId: 0n,
  });

  console.log("Listing found:");
  console.log("  ID:", listing.id.toString());
  console.log("  Asset:", listing.assetContractAddress);
  console.log("  Token ID:", listing.tokenId.toString());
  console.log("  Price:", listing.pricePerToken.toString());
  console.log("  Seller:", listing.creatorAddress);
}

main().catch((err) => {
  console.error("Test failed:", err);
  process.exit(1);
});
