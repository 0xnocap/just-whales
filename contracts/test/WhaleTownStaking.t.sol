// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../contracts/economy/WhaleTownPoints.sol";
import "../contracts/economy/WhaleTownStaking.sol";
import "../contracts/mocks/MockERC721.sol";
import "@openzeppelin/contracts/access/IAccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract WhaleTownStakingTest is Test {
    WhaleTownPoints points;
    WhaleTownStaking staking;
    MockERC721 nft;

    address admin = address(0xA11CE);
    address alice = address(0xA1);
    address bob = address(0xB1);
    address eve = address(0xE);

    bytes32 constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 constant RATE_MANAGER_ROLE = keccak256("RATE_MANAGER_ROLE");
    bytes32 constant DEFAULT_ADMIN_ROLE = 0x00;

    // Default rates: Whale=20/day, Shark=10/day, Sea Lion=5/day (spec §4.1)
    uint256 constant WHALE_RATE = 20 ether;
    uint256 constant SHARK_RATE = 10 ether;
    uint256 constant SEALION_RATE = 5 ether;

    // Rare: Golden Whale = 35, with Diamond Watch +30 = 65/day (spec §4.5)
    uint256 constant GOLDEN_WHALE_DIAMOND_RATE = 65 ether;

    function setUp() public {
        points = new WhaleTownPoints(admin);
        nft = new MockERC721();
        staking = new WhaleTownStaking(admin, IWhaleTown(address(nft)), IMintablePoints(address(points)));

        // Grant staking contract permission to mint points.
        vm.prank(admin);
        points.grantRole(MINTER_ROLE, address(staking));

        // Configure global base rates.
        vm.prank(admin);
        staking.setBaseRates(SHARK_RATE, WHALE_RATE, SEALION_RATE);

        // Mint test NFTs and set DNA.
        // DNA logic: highest nibble (dna >> 28) is animal type
        // 0=Shark, 1=Whale, 2=SeaLion
        
        nft.mint(alice, 1); // Whale
        nft.setDNA(1, 0x10000000); 

        nft.mint(alice, 2); // Golden Whale + Diamond Watch (Custom)
        nft.setDNA(2, 0x10000000); 

        nft.mint(bob,   3); // Shark
        nft.setDNA(3, 0x00000000);

        nft.mint(bob,   4); // Sea Lion
        nft.setDNA(4, 0x20000000);

        // Configure custom rate for #2.
        vm.prank(admin);
        staking.setTokenRate(2, GOLDEN_WHALE_DIAMOND_RATE);

        // Approve staking contract.
        vm.prank(alice);
        nft.setApprovalForAll(address(staking), true);
        vm.prank(bob);
        nft.setApprovalForAll(address(staking), true);
    }

    // -----------------------------------------------------------------------
    // Dynamic Rate Verification
    // -----------------------------------------------------------------------

    function test_TokenRate_DynamicResolution() public view {
        // Fallback to DNA-based base rates
        assertEq(staking.tokenRate(1), WHALE_RATE);
        assertEq(staking.tokenRate(3), SHARK_RATE);
        assertEq(staking.tokenRate(4), SEALION_RATE);

        // Use custom override
        assertEq(staking.tokenRate(2), GOLDEN_WHALE_DIAMOND_RATE);
    }

    function test_SetBaseRates_Happy() public {
        vm.prank(admin);
        staking.setBaseRates(100 ether, 200 ether, 50 ether);

        assertEq(staking.tokenRate(1), 200 ether);
        assertEq(staking.tokenRate(3), 100 ether);
        assertEq(staking.tokenRate(4), 50 ether);
        
        // Custom rate for #2 remains unchanged
        assertEq(staking.tokenRate(2), GOLDEN_WHALE_DIAMOND_RATE);
    }

    // -----------------------------------------------------------------------
    // Stake / Unstake
    // -----------------------------------------------------------------------

    function test_Stake_TransfersNftAndRecords() public {
        uint256[] memory ids = _single(1);
        vm.prank(alice);
        staking.stake(ids);

        assertEq(nft.ownerOf(1), address(staking));
        assertEq(staking.stakerOf(1), alice);
        assertEq(staking.stakedAt(1), block.timestamp);
        uint256[] memory staked = staking.stakedTokensOf(alice);
        assertEq(staked.length, 1);
        assertEq(staked[0], 1);
    }

    function test_Unstake_ReturnsNftAndBuffersRewards() public {
        uint256[] memory ids = _single(1);
        vm.prank(alice);
        staking.stake(ids);

        vm.warp(block.timestamp + 1 days);

        vm.prank(alice);
        staking.unstake(ids);

        assertEq(nft.ownerOf(1), alice);
        assertEq(staking.stakerOf(1), address(0));
        // One full day at 20/day rate = 20 points buffered
        assertEq(staking.pendingRewards(alice), WHALE_RATE);
    }

    // -----------------------------------------------------------------------
    // Accrual math (spec §4.5)
    // -----------------------------------------------------------------------

    function test_Accrual_WhaleOneDay() public {
        _stake(alice, 1);
        vm.warp(block.timestamp + 1 days);
        assertEq(staking.rewardsOf(alice), WHALE_RATE);
    }

    function test_Accrual_GoldenWhaleDiamond_OneDay() public {
        _stake(alice, 2);
        vm.warp(block.timestamp + 1 days);
        assertEq(staking.rewardsOf(alice), GOLDEN_WHALE_DIAMOND_RATE);
    }

    function test_Accrual_MultipleTokens_Sum() public {
        _stake(bob, 3);
        _stake(bob, 4);
        vm.warp(block.timestamp + 1 days);
        assertEq(staking.rewardsOf(bob), SHARK_RATE + SEALION_RATE);
    }

    // -----------------------------------------------------------------------
    // Rate updates (spec §2.8 — admin tunable without redeploy)
    // -----------------------------------------------------------------------

    function test_SetTokenRate_CheckpointsPriorAccrual() public {
        _stake(alice, 1);
        vm.warp(block.timestamp + 1 days);

        // Admin bumps the Whale's rate from 20 to 45
        vm.prank(admin);
        staking.setTokenRate(1, 45 ether);

        // Pending should have captured 1 day at 20/day
        assertEq(staking.pendingRewards(alice), WHALE_RATE);

        vm.warp(block.timestamp + 1 days);
        // rewardsOf = pending (20) + 1 day at new rate (45) = 65
        assertEq(staking.rewardsOf(alice), 20 ether + 45 ether);
    }

    function test_SetTokenRatesBatch_Happy() public {
        uint256[] memory ids = new uint256[](2);
        ids[0] = 3; ids[1] = 4;
        uint256[] memory rates = new uint256[](2);
        rates[0] = 25 ether; 
        rates[1] = 15 ether; 

        vm.prank(admin);
        staking.setTokenRatesBatch(ids, rates);

        assertEq(staking.tokenRate(3), 25 ether);
        assertEq(staking.tokenRate(4), 15 ether);
    }

    // -----------------------------------------------------------------------
    // helpers
    // -----------------------------------------------------------------------

    function _single(uint256 id) internal pure returns (uint256[] memory arr) {
        arr = new uint256[](1);
        arr[0] = id;
    }

    function _stake(address who, uint256 id) internal {
        uint256[] memory ids = _single(id);
        vm.prank(who);
        staking.stake(ids);
    }
}
