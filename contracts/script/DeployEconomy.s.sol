// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {WhaleTownPoints} from "../contracts/economy/WhaleTownPoints.sol";
import {WhaleTownStaking, IMintablePoints} from "../contracts/economy/WhaleTownStaking.sol";
import {IERC721} from "@openzeppelin/contracts/token/ERC721/IERC721.sol";

/**
 * @notice Deploys WhaleTownPoints + WhaleTownStaking and wires them together.
 *
 *         Usage:
 *           # Tempo testnet
 *           forge script script/DeployEconomy.s.sol \
 *             --rpc-url tempo_testnet --broadcast --slow \
 *             --private-key 0x$PRIVATE_KEY \
 *             --sig "run(address)" 0x1A8E6629937F4E88315C3a65DC9eC3740e3b567C
 *
 *           # Tempo mainnet
 *           forge script script/DeployEconomy.s.sol \
 *             --rpc-url tempo --broadcast --slow \
 *             --private-key 0x$PRIVATE_KEY \
 *             --sig "run(address)" 0x1065ef5996C86C8C90D97974F3c9E5234416839F
 *
 *         The deployer (key passed via --private-key) becomes DEFAULT_ADMIN_ROLE
 *         + MINTER_ROLE on WhaleTownPoints and DEFAULT_ADMIN_ROLE + RATE_MANAGER_ROLE
 *         on WhaleTownStaking.
 */
contract DeployEconomy is Script {
    function run(address nftAddress) external {
        require(nftAddress != address(0), "nft=0");

        console.log("=== Whale Town Economy Deploy ===");
        console.log("NFT contract:", nftAddress);
        console.log("Chain ID:", block.chainid);

        vm.startBroadcast();
        address deployer = msg.sender;
        console.log("Deployer (admin + MINTER_ROLE):", deployer);

        // 1. Deploy ERC20 points token. Deployer gets DEFAULT_ADMIN_ROLE + MINTER_ROLE.
        WhaleTownPoints points = new WhaleTownPoints(deployer);
        console.log("WhaleTownPoints:", address(points));

        // 2. Deploy staking contract.
        WhaleTownStaking staking = new WhaleTownStaking(
            deployer,
            IERC721(nftAddress),
            IMintablePoints(address(points))
        );
        console.log("WhaleTownStaking:", address(staking));

        // 3. Grant MINTER_ROLE on the points token to the staking contract so
        //    claim() can mint rewards directly.
        points.grantRole(points.MINTER_ROLE(), address(staking));
        console.log("Granted MINTER_ROLE to staking contract");

        vm.stopBroadcast();

        console.log("=== DONE ===");
        console.log("Next: seed tokenRate via setTokenRatesBatch once you have");
        console.log("the per-tokenId rate table derived from reward_rates + traits.");
    }
}
