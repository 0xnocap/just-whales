#!/usr/bin/env bash
# Seed per-tokenId staking rates via setTokenRatesBatch.
#
# This is the Phase-2 testnet seed. It picks rates from a flat default of
# 10 points/day unless RATES is passed. Traits-based rates will come from
# the backend seeder (reads `reward_rates` DB table) once the indexer
# covers testnet traits — for now, a flat rate is enough to exercise
# stake → unstake → claim in the UI.
#
# Usage:
#   RPC=tempo_testnet \
#   STAKING=0xC768b6ce7eE238524FD1578581cd8cA51A4bfAC5 \
#   PRIVATE_KEY=abc...                      # admin with RATE_MANAGER_ROLE
#   TOKEN_IDS="0,1,2,3,4" \
#   RATES_PER_DAY="10,10,10,10,10" \
#   ./script/seed-rates.sh

set -euo pipefail

: "${RPC:?RPC required}"
: "${STAKING:?STAKING address required}"
: "${PRIVATE_KEY:?PRIVATE_KEY required (without 0x)}"
: "${TOKEN_IDS:?TOKEN_IDS comma-separated required (e.g. 0,1,2)}"
: "${RATES_PER_DAY:?RATES_PER_DAY comma-separated required (same length as TOKEN_IDS)}"

cd "$(dirname "$0")/.."

# Build solidity-style array literals: [0,1,2,3,4]
IDS_ARR="[${TOKEN_IDS}]"

# Convert each rate (e.g. 10) to 18-dec wei (10e18) and build [10000000000000000000,...]
RATES_WEI=""
IFS=',' read -ra RATES_ARR <<< "$RATES_PER_DAY"
for r in "${RATES_ARR[@]}"; do
  wei=$(python3 -c "print(int($r * 10**18))")
  RATES_WEI="${RATES_WEI:+$RATES_WEI,}$wei"
done
RATES_FINAL="[${RATES_WEI}]"

echo "=== Seeding staking rates ==="
echo "RPC:     $RPC"
echo "Staking: $STAKING"
echo "Tokens:  $IDS_ARR"
echo "Rates:   $RATES_FINAL (wei / 18dec)"
echo ""

cast send --rpc-url "$RPC" --private-key "0x$PRIVATE_KEY" --gas-limit 5000000 \
  "$STAKING" "setTokenRatesBatch(uint256[],uint256[])" "$IDS_ARR" "$RATES_FINAL"

echo ""
echo "=== DONE ==="
echo "Verify:"
for id in "${!RATES_ARR[@]}"; do
  IFS=',' read -ra ID_ARR <<< "$TOKEN_IDS"
  tid="${ID_ARR[$id]}"
  rate=$(cast call "$STAKING" "tokenRate(uint256)(uint256)" "$tid" --rpc-url "$RPC")
  echo "  tokenRate($tid) = $rate"
done
