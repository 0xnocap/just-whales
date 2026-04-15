// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import {Script, console} from "forge-std/Script.sol";
import {RewardsClaimer} from "../contracts/economy/RewardsClaimer.sol";
import {WhaleTownPoints} from "../contracts/economy/WhaleTownPoints.sol";

/**
 * @notice Deploys RewardsClaimer and grants it MINTER_ROLE on WhaleTownPoints.
 *
 *         Usage:
 *           # Tempo testnet
 *           forge script script/DeployRewardsClaimer.s.sol \
 *             --rpc-url tempo_testnet --broadcast --slow \
 *             --private-key 0x$PRIVATE_KEY \
 *             --sig "run(address,address,address)" 0x7831959816fAA58B5Dc869b7692cebdb6EFC311E 0x8D4DdF2be88bEd56467eb44D338dcAc8f606BEEC 0x7831959816fAA58B5Dc869b7692cebdb6EFC311E
 *
 *           # Tempo mainnet
 *           forge script script/DeployRewardsClaimer.s.sol \
 *             --rpc-url tempo --broadcast --slow \
 *             --private-key 0x$PRIVATE_KEY \
 *             --sig "run(address,address,address)" 0x7831959816fAA58B5Dc869b7692cebdb6EFC311E 0xCf4A2079A2c058d266A0999F3fCA256d6F1F53a9 0x7831959816fAA58B5Dc869b7692cebdb6EFC311E
 */
contract DeployRewardsClaimer is Script {
    function run(address signer, address pointsAddress, address admin) external {
        require(signer != address(0), "signer=0");
        require(pointsAddress != address(0), "points=0");
        require(admin != address(0), "admin=0");

        console.log("=== Whale Town RewardsClaimer Deploy ===");
        console.log("Signer:", signer);
        console.log("Points contract:", pointsAddress);
        console.log("Admin:", admin);
        console.log("Chain ID:", block.chainid);

        vm.startBroadcast();
        address deployer = msg.sender;
        console.log("Deployer:", deployer);

        // 1. Deploy RewardsClaimer
        RewardsClaimer claimer = new RewardsClaimer(admin, signer, pointsAddress);
        console.log("RewardsClaimer:", address(claimer));

        // 2. Grant MINTER_ROLE on the points token to the claimer contract
        WhaleTownPoints points = WhaleTownPoints(pointsAddress);
        points.grantRole(points.MINTER_ROLE(), address(claimer));
        console.log("Granted MINTER_ROLE to RewardsClaimer");

        vm.stopBroadcast();

        console.log("=== DONE ===");
    }
}
