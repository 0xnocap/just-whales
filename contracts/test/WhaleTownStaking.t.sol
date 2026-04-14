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
        staking = new WhaleTownStaking(admin, IERC721(address(nft)), IMintablePoints(address(points)));

        // Grant staking contract permission to mint points.
        vm.prank(admin);
        points.grantRole(MINTER_ROLE, address(staking));

        // Mint test NFTs.
        nft.mint(alice, 1); // Whale
        nft.mint(alice, 2); // Golden Whale + Diamond Watch
        nft.mint(bob,   3); // Shark
        nft.mint(bob,   4); // Sea Lion

        // Configure rates per token.
        vm.startPrank(admin);
        staking.setTokenRate(1, WHALE_RATE);
        staking.setTokenRate(2, GOLDEN_WHALE_DIAMOND_RATE);
        staking.setTokenRate(3, SHARK_RATE);
        staking.setTokenRate(4, SEALION_RATE);
        vm.stopPrank();

        // Approve staking contract.
        vm.prank(alice);
        nft.setApprovalForAll(address(staking), true);
        vm.prank(bob);
        nft.setApprovalForAll(address(staking), true);
    }

    // -----------------------------------------------------------------------
    // Deploy
    // -----------------------------------------------------------------------

    function test_Deploy_RolesAndImmutables() public view {
        assertEq(address(staking.nft()), address(nft));
        assertEq(address(staking.points()), address(points));
        assertTrue(staking.hasRole(DEFAULT_ADMIN_ROLE, admin));
        assertTrue(staking.hasRole(RATE_MANAGER_ROLE, admin));
    }

    function test_Deploy_RejectsZeroArgs() public {
        vm.expectRevert(bytes("admin=0"));
        new WhaleTownStaking(address(0), IERC721(address(nft)), IMintablePoints(address(points)));

        vm.expectRevert(bytes("nft=0"));
        new WhaleTownStaking(admin, IERC721(address(0)), IMintablePoints(address(points)));

        vm.expectRevert(bytes("points=0"));
        new WhaleTownStaking(admin, IERC721(address(nft)), IMintablePoints(address(0)));
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

    function test_Stake_RevertsIfAlreadyStaked() public {
        uint256[] memory ids = _single(1);
        vm.prank(alice);
        staking.stake(ids);

        // Even the same owner can't double-stake the same tokenId.
        vm.prank(alice);
        vm.expectRevert(bytes("already staked"));
        staking.stake(ids);
    }

    function test_Stake_RevertsIfNotOwner() public {
        uint256[] memory ids = _single(1); // alice owns tokenId 1
        vm.prank(bob);
        vm.expectRevert(); // ERC721: transferFrom will revert
        staking.stake(ids);
    }

    function test_Stake_EmptyArrayReverts() public {
        uint256[] memory ids = new uint256[](0);
        vm.prank(alice);
        vm.expectRevert(bytes("no tokens"));
        staking.stake(ids);
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

    function test_Unstake_OnlyOriginalStaker() public {
        uint256[] memory ids = _single(1);
        vm.prank(alice);
        staking.stake(ids);

        vm.prank(eve);
        vm.expectRevert(bytes("not staker"));
        staking.unstake(ids);
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
        // Spec §4.5: Golden Whale + Diamond Watch = 65 points/day
        assertEq(staking.rewardsOf(alice), GOLDEN_WHALE_DIAMOND_RATE);
    }

    function test_Accrual_MultipleTokens_Sum() public {
        _stake(bob, 3);
        _stake(bob, 4);
        vm.warp(block.timestamp + 1 days);
        // Shark 10 + Sea Lion 5 = 15/day
        assertEq(staking.rewardsOf(bob), SHARK_RATE + SEALION_RATE);
    }

    function test_Accrual_HalfDay() public {
        _stake(alice, 1);
        vm.warp(block.timestamp + 12 hours);
        assertEq(staking.rewardsOf(alice), WHALE_RATE / 2);
    }

    function test_Accrual_ProportionalBySeconds() public {
        _stake(alice, 1);
        uint256 elapsed = 37 minutes + 14 seconds;
        vm.warp(block.timestamp + elapsed);
        uint256 expected = (elapsed * WHALE_RATE) / 1 days;
        assertEq(staking.rewardsOf(alice), expected);
    }

    // -----------------------------------------------------------------------
    // Claim
    // -----------------------------------------------------------------------

    function test_Claim_MintsPointsAndResetsAccrual() public {
        _stake(alice, 1);
        vm.warp(block.timestamp + 2 days);

        vm.prank(alice);
        staking.claim();

        assertEq(points.balanceOf(alice), 2 * WHALE_RATE);
        // Accrual resets to now
        assertEq(staking.rewardsOf(alice), 0);
        assertEq(staking.stakedAt(1), block.timestamp);
    }

    function test_Claim_FlushesPendingAndLiveAccrual() public {
        _stake(alice, 1);
        vm.warp(block.timestamp + 1 days);

        // Unstake buffers 1 day into pending, then re-stake after some wait
        uint256[] memory ids = _single(1);
        vm.prank(alice);
        staking.unstake(ids);

        assertEq(staking.pendingRewards(alice), WHALE_RATE);

        // Re-approve + re-stake
        vm.prank(alice);
        nft.setApprovalForAll(address(staking), true);
        vm.prank(alice);
        staking.stake(ids);

        vm.warp(block.timestamp + 1 days);

        vm.prank(alice);
        staking.claim();

        assertEq(points.balanceOf(alice), 2 * WHALE_RATE);
        assertEq(staking.pendingRewards(alice), 0);
    }

    function test_Claim_RevertsIfNothing() public {
        vm.prank(alice);
        vm.expectRevert(bytes("nothing to claim"));
        staking.claim();
    }

    // -----------------------------------------------------------------------
    // Rate updates (spec §2.8 — admin tunable without redeploy)
    // -----------------------------------------------------------------------

    function test_SetTokenRate_CheckpointsPriorAccrual() public {
        _stake(alice, 1);
        vm.warp(block.timestamp + 1 days);

        // Admin bumps the Whale's rate from 20 to 45 (spec §4.5 Gold Watch Whale)
        vm.prank(admin);
        staking.setTokenRate(1, 45 ether);

        // Pending should have captured 1 day at 20/day
        assertEq(staking.pendingRewards(alice), WHALE_RATE);

        vm.warp(block.timestamp + 1 days);
        // rewardsOf = pending (20) + 1 day at new rate (45) = 65
        assertEq(staking.rewardsOf(alice), 20 ether + 45 ether);
    }

    function test_SetTokenRate_UnauthorizedReverts() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                eve,
                RATE_MANAGER_ROLE
            )
        );
        vm.prank(eve);
        staking.setTokenRate(1, 1 ether);
    }

    function test_SetTokenRatesBatch_Happy() public {
        uint256[] memory ids = new uint256[](2);
        ids[0] = 3; ids[1] = 4;
        uint256[] memory rates = new uint256[](2);
        rates[0] = 25 ether; // Shark + Pirate Coat (spec §4.5)
        rates[1] = 15 ether; // Sea Lion + Gold Chain (spec §4.5)

        vm.prank(admin);
        staking.setTokenRatesBatch(ids, rates);

        assertEq(staking.tokenRate(3), 25 ether);
        assertEq(staking.tokenRate(4), 15 ether);
    }

    function test_SetTokenRatesBatch_LengthMismatch() public {
        uint256[] memory ids = new uint256[](2);
        uint256[] memory rates = new uint256[](1);
        vm.prank(admin);
        vm.expectRevert(bytes("length mismatch"));
        staking.setTokenRatesBatch(ids, rates);
    }

    // -----------------------------------------------------------------------
    // Pause / minter revocation safety
    // -----------------------------------------------------------------------

    function test_Pause_BlocksStakeAndClaim() public {
        _stake(alice, 1);
        vm.warp(block.timestamp + 1 days);

        vm.prank(admin);
        staking.pause();

        uint256[] memory ids = _single(2);
        vm.prank(alice);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        staking.stake(ids);

        vm.prank(alice);
        vm.expectRevert(Pausable.EnforcedPause.selector);
        staking.claim();

        // Unstake still works so users aren't trapped.
        uint256[] memory unstakeIds = _single(1);
        vm.prank(alice);
        staking.unstake(unstakeIds);
        assertEq(nft.ownerOf(1), alice);
    }

    function test_Claim_FailsIfMinterRoleRevoked() public {
        _stake(alice, 1);
        vm.warp(block.timestamp + 1 days);

        // Ops revokes the staking contract's mint permission (e.g. migration)
        vm.prank(admin);
        points.revokeRole(MINTER_ROLE, address(staking));

        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                address(staking),
                MINTER_ROLE
            )
        );
        staking.claim();
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
