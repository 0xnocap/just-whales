/**
 * End-to-end Phase 4 validation. Runs atomically to avoid schema races
 * with parallel sessions. Does the full round trip:
 *
 *   1. Apply migrations 002/003 if missing
 *   2. Seed 1 $OP unclaimed fishing reward for 0x7831
 *   3. Import signFishingClaim, sign with the real backend signer
 *   4. Read on-chain fishingNonce from testnet claimer
 *   5. Submit claimFishingRewards tx via viem walletClient
 *   6. Wait for receipt, verify $OP balance increased
 *   7. Mark economy_event as claimed
 */
import pg from 'pg';
import dotenv from 'dotenv';
import { readFileSync } from 'node:fs';
import { createPublicClient, createWalletClient, http, parseAbi, type Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { signFishingClaim } from '../api/_signer.ts';

dotenv.config();

const TEST_WALLET = '0x7831959816fAA58B5Dc869b7692cebdb6EFC311E'.toLowerCase();
const AMOUNT_WEI = BigInt(1) * BigInt(10 ** 18); // 1 $OP

// Force testnet regardless of .env ENVIRONMENT
process.env.ENVIRONMENT = 'development';

const RPC_URL = process.env.TEST_RPC_URL!;
const CHAIN_ID = Number(process.env.TEST_CHAIN_ID || '42431');
const CLAIMER = process.env.TEST_REWARDS_CLAIMER_CONTRACT as Address;
const TEST_POINTS = '0xe5a7d520fbeBAaADb60cB80FD31ffb74f564d15d' as Address;
const SIGNER_KEY = process.env.REWARDS_SIGNER_PRIVATE_KEY as `0x${string}`;

async function main() {
  const pool = new pg.Pool({
    connectionString: process.env.POSTGRES_URL,
    ssl: { rejectUnauthorized: false },
  });

  const chain = {
    id: CHAIN_ID,
    name: 'Tempo Testnet',
    nativeCurrency: { name: 'TMP', symbol: 'TMP', decimals: 18 },
    rpcUrls: { default: { http: [RPC_URL] } },
  } as const;

  const publicClient = createPublicClient({ chain, transport: http() });
  const account = privateKeyToAccount(SIGNER_KEY);
  const walletClient = createWalletClient({ account, chain, transport: http() });

  const claimerAbi = parseAbi([
    'function fishingNonces(address) view returns (uint256)',
    'function claimFishingRewards(uint256 amount, uint256 nonce, bytes signature)',
  ]);
  const erc20Abi = parseAbi(['function balanceOf(address) view returns (uint256)']);

  try {
    // ---- Step 1: apply migrations 002/003 (idempotent) ----
    console.log('[1/7] applying migrations 002/003 ...');
    for (const file of ['api/migrations/002_add_tx_hash_to_events.sql', 'api/migrations/003_add_claimed_to_events.sql']) {
      const sql = readFileSync(file, 'utf8');
      await pool.query(sql);
    }
    console.log('     ok');

    // ---- Step 2: seed unclaimed fish reward ----
    console.log('[2/7] seeding unclaimed fish reward ...');
    const clearResult = await pool.query(
      `DELETE FROM economy_events WHERE LOWER(wallet) = $1 AND event_type = 'fish' AND source_id = 999999`,
      [TEST_WALLET]
    );
    console.log(`     cleared ${clearResult.rowCount} prior test rows`);
    const seedResult = await pool.query(
      `INSERT INTO economy_events (wallet, event_type, source_id, points_awarded, claimed)
       VALUES ($1, 'fish', 999999, $2, FALSE) RETURNING id`,
      [TEST_WALLET, AMOUNT_WEI.toString()]
    );
    const seedId = seedResult.rows[0].id;
    console.log(`     seeded id=${seedId} amount=${AMOUNT_WEI}wei (1 $OP)`);

    // ---- Step 3: read on-chain nonce ----
    console.log('[3/7] reading on-chain fishingNonce ...');
    const nonce = await publicClient.readContract({
      address: CLAIMER,
      abi: claimerAbi,
      functionName: 'fishingNonces',
      args: [TEST_WALLET as Address],
    });
    console.log(`     nonce = ${nonce}`);

    // ---- Step 4: sign EIP-712 claim via real backend signer ----
    console.log('[4/7] signing claim via api/_signer ...');
    const signature = await signFishingClaim(TEST_WALLET as Address, AMOUNT_WEI, nonce);
    console.log(`     signature = ${signature.slice(0, 20)}...${signature.slice(-10)}`);

    // ---- Step 5: read pre-claim balance, submit claim tx ----
    console.log('[5/7] reading pre-claim balance + submitting tx ...');
    const balBefore = await publicClient.readContract({
      address: TEST_POINTS,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [TEST_WALLET as Address],
    });
    console.log(`     balance before: ${balBefore}`);

    const txHash = await walletClient.writeContract({
      address: CLAIMER,
      abi: claimerAbi,
      functionName: 'claimFishingRewards',
      args: [AMOUNT_WEI, nonce, signature as `0x${string}`],
    });
    console.log(`     tx submitted: ${txHash}`);

    // ---- Step 6: wait for receipt + verify ----
    console.log('[6/7] waiting for receipt ...');
    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    console.log(`     status: ${receipt.status}, block: ${receipt.blockNumber}, gas: ${receipt.gasUsed}`);
    if (receipt.status !== 'success') {
      throw new Error('Tx reverted');
    }

    const balAfter = await publicClient.readContract({
      address: TEST_POINTS,
      abi: erc20Abi,
      functionName: 'balanceOf',
      args: [TEST_WALLET as Address],
    });
    const nonceAfter = await publicClient.readContract({
      address: CLAIMER,
      abi: claimerAbi,
      functionName: 'fishingNonces',
      args: [TEST_WALLET as Address],
    });
    const delta = balAfter - balBefore;
    console.log(`     balance after: ${balAfter} (delta: ${delta}wei = ${Number(delta) / 1e18} $OP)`);
    console.log(`     nonce after: ${nonceAfter}`);

    if (delta !== AMOUNT_WEI) throw new Error(`Balance delta ${delta} != expected ${AMOUNT_WEI}`);
    if (nonceAfter !== nonce + BigInt(1)) throw new Error(`Nonce did not increment`);

    // ---- Step 7: mark economy_event as claimed ----
    console.log('[7/7] marking economy_event as claimed ...');
    await pool.query(
      `UPDATE economy_events SET claimed = TRUE, claim_tx_hash = $1 WHERE id = $2`,
      [txHash, seedId]
    );
    console.log('     ok');

    console.log('\n=== SUCCESS ===');
    console.log(`Testnet claim tx: ${txHash}`);
    console.log(`Wallet ${TEST_WALLET} minted ${Number(AMOUNT_WEI) / 1e18} $OP on chain ${CHAIN_ID}`);
    console.log(`EIP-712 round-trip: viem-signed → OZ EIP712.verify → $OP.mintTo → PASS`);
  } finally {
    await pool.end();
  }
}

main().catch(e => {
  console.error('\n=== FAIL ===');
  console.error(e);
  process.exit(1);
});
