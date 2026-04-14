#!/usr/bin/env bash
# Deploy WhaleTownPoints + WhaleTownStaking + grant MINTER_ROLE.
#
# Tempo's actual deploy gas is ~5-6x what EVM simulation reports, because
# the protocol charges extra gas for TIP-20 fee metering. `forge script`
# uses eth_estimateGas and silently truncates, so deployments revert with
# status=0 and consume the full gasLimit. This script bypasses that by
# sending each tx via `cast send` with explicit --gas-limit.
#
# Usage:
#   cd contracts
#   RPC=tempo_testnet NFT=0x1A8E6629937F4E88315C3a65DC9eC3740e3b567C ./script/deploy-economy.sh
#   RPC=tempo         NFT=0x1065ef5996C86C8C90D97974F3c9E5234416839F ./script/deploy-economy.sh

set -euo pipefail

: "${RPC:?RPC (tempo_testnet or tempo) required}"
: "${NFT:?NFT contract address required}"
: "${PRIVATE_KEY:?PRIVATE_KEY required (without 0x)}"

FORGE_BUILD_DIR="$(dirname "$0")/.."
cd "$FORGE_BUILD_DIR"

DEPLOYER=$(cast wallet address "0x$PRIVATE_KEY")
MINTER_ROLE=$(cast keccak "MINTER_ROLE")

echo "=== Deploying Whale Town Economy ==="
echo "RPC:      $RPC"
echo "Deployer: $DEPLOYER"
echo "NFT:      $NFT"
echo ""

forge build --silent

# -------- 1. WhaleTownPoints ---------------------------------------------
POINTS_BYTECODE=$(python3 -c "import json; print(json.load(open('artifacts/WhaleTownPoints.sol/WhaleTownPoints.json'))['bytecode']['object'])")
POINTS_ARGS=$(cast abi-encode "constructor(address)" "$DEPLOYER")
POINTS_CALLDATA="${POINTS_BYTECODE}${POINTS_ARGS:2}"

echo "-> Deploying WhaleTownPoints..."
POINTS_RECEIPT=$(cast send --rpc-url "$RPC" --private-key "0x$PRIVATE_KEY" \
  --gas-limit 10000000 --create "$POINTS_CALLDATA" --json)
POINTS_ADDR=$(echo "$POINTS_RECEIPT" | python3 -c "import json,sys; print(json.load(sys.stdin)['contractAddress'])")
echo "   WhaleTownPoints: $POINTS_ADDR"

# -------- 2. WhaleTownStaking --------------------------------------------
STAKING_BYTECODE=$(python3 -c "import json; print(json.load(open('artifacts/WhaleTownStaking.sol/WhaleTownStaking.json'))['bytecode']['object'])")
STAKING_ARGS=$(cast abi-encode "constructor(address,address,address)" "$DEPLOYER" "$NFT" "$POINTS_ADDR")
STAKING_CALLDATA="${STAKING_BYTECODE}${STAKING_ARGS:2}"

echo "-> Deploying WhaleTownStaking..."
STAKING_RECEIPT=$(cast send --rpc-url "$RPC" --private-key "0x$PRIVATE_KEY" \
  --gas-limit 15000000 --create "$STAKING_CALLDATA" --json)
STAKING_ADDR=$(echo "$STAKING_RECEIPT" | python3 -c "import json,sys; print(json.load(sys.stdin)['contractAddress'])")
echo "   WhaleTownStaking: $STAKING_ADDR"

# -------- 3. Grant MINTER_ROLE to staking contract -----------------------
echo "-> Granting MINTER_ROLE to staking contract..."
cast send --rpc-url "$RPC" --private-key "0x$PRIVATE_KEY" --gas-limit 5000000 \
  "$POINTS_ADDR" "grantRole(bytes32,address)" "$MINTER_ROLE" "$STAKING_ADDR" >/dev/null
HAS_ROLE=$(cast call "$POINTS_ADDR" "hasRole(bytes32,address)(bool)" "$MINTER_ROLE" "$STAKING_ADDR" --rpc-url "$RPC")
echo "   staking has MINTER_ROLE: $HAS_ROLE"

echo ""
echo "=== DONE ==="
echo "POINTS=$POINTS_ADDR"
echo "STAKING=$STAKING_ADDR"
echo ""
echo "Next: seed per-tokenId rates via setTokenRatesBatch, then wire the frontend."
