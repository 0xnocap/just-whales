import { recoverTypedDataAddress } from 'viem';

async function main() {
  const CLAIMER = "0xb2877314D63dF74FF66dcdE91B6afe7D36AFa687";
  const CHAIN_ID = 42431;
  const AUTHORIZED_SIGNER = "0x7831959816fAA58B5Dc869b7692cebdb6EFC311E";
  
  const wallet = "0x7831959816faa58b5dc869b7692cebdb6efc311e";
  const amount = BigInt("50000000000000000000"); // 50 $OP
  const nonce = BigInt(0);
  const signature = "0x9454b588c0fdd41ea379feae88abcd7dde44f4a844d7b7a2b9ae6ef83624d79727208a1f15bcc815c3b955e37fd6af3343bab83895274932bbfa14966a1c01961b";

  const recoveredAddress = await recoverTypedDataAddress({
    domain: {
      name: 'WhaleTownRewards',
      version: '1',
      chainId: CHAIN_ID,
      verifyingContract: CLAIMER as `0x${string}`,
    },
    types: {
      FishingClaim: [
        { name: 'wallet', type: 'address' },
        { name: 'amount', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
      ],
    },
    primaryType: 'FishingClaim',
    message: {
      wallet: wallet as `0x${string}`,
      amount,
      nonce,
    },
    signature: signature as `0x${string}`,
  });

  console.log("Recovered Signer:", recoveredAddress);
  console.log("Authorized Signer:", AUTHORIZED_SIGNER);
  console.log("Match:", recoveredAddress.toLowerCase() === AUTHORIZED_SIGNER.toLowerCase());
}

main().catch(console.error);
