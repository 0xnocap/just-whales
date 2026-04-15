// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../contracts/economy/RewardsClaimer.sol";
import "../contracts/economy/WhaleTownPoints.sol";
import "@openzeppelin/contracts/access/IAccessControl.sol";

contract WhaleTownRewardsTest is Test {
    RewardsClaimer claimer;
    WhaleTownPoints points;

    uint256 adminPrivateKey = 0xA11CE;
    uint256 signerPrivateKey = 0x5164E8; // "signer"
    
    address admin = vm.addr(adminPrivateKey);
    address signer = vm.addr(signerPrivateKey);
    address alice = address(0xA1);
    address bob = address(0xB1);

    bytes32 constant MINTER_ROLE = keccak256("MINTER_ROLE");

    // Replicate typehashes from contract
    bytes32 private constant TRADING_CLAIM_TYPEHASH = keccak256("TradingClaim(address wallet,uint256 amount,uint256 nonce)");
    bytes32 private constant FISHING_CLAIM_TYPEHASH = keccak256("FishingClaim(address wallet,uint256 amount,uint256 nonce)");

    function setUp() public {
        points = new WhaleTownPoints(admin);
        claimer = new RewardsClaimer(admin, signer, address(points));

        // Grant MINTER_ROLE to the claimer contract
        vm.prank(admin);
        points.grantRole(MINTER_ROLE, address(claimer));
    }

    function test_Deploy_State() public view {
        assertEq(claimer.authorizedSigner(), signer);
        assertEq(address(claimer.points()), address(points));
        assertTrue(claimer.hasRole(0x00, admin));
    }

    function test_ClaimTradingRewards_HappyPath() public {
        uint256 amount = 100 ether;
        uint256 nonce = 0;

        bytes32 structHash = keccak256(abi.encode(TRADING_CLAIM_TYPEHASH, alice, amount, nonce));
        bytes32 digest = _getEIP712Digest(structHash);

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPrivateKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.prank(alice);
        claimer.claimTradingRewards(amount, nonce, signature);

        assertEq(points.balanceOf(alice), amount);
        assertEq(claimer.tradingNonces(alice), 1);
    }

    function test_ClaimFishingRewards_HappyPath() public {
        uint256 amount = 50 ether;
        uint256 nonce = 0;

        bytes32 structHash = keccak256(abi.encode(FISHING_CLAIM_TYPEHASH, bob, amount, nonce));
        bytes32 digest = _getEIP712Digest(structHash);

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPrivateKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.prank(bob);
        claimer.claimFishingRewards(amount, nonce, signature);

        assertEq(points.balanceOf(bob), amount);
        assertEq(claimer.fishingNonces(bob), 1);
    }

    function test_Claim_InvalidNonce_Reverts() public {
        uint256 amount = 100 ether;
        uint256 nonce = 1; // Expected 0

        bytes32 structHash = keccak256(abi.encode(TRADING_CLAIM_TYPEHASH, alice, amount, nonce));
        bytes32 digest = _getEIP712Digest(structHash);

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPrivateKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.prank(alice);
        vm.expectRevert("Invalid nonce");
        claimer.claimTradingRewards(amount, nonce, signature);
    }

    function test_Claim_WrongSigner_Reverts() public {
        uint256 amount = 100 ether;
        uint256 nonce = 0;
        uint256 wrongPrivateKey = 0xBAD;

        bytes32 structHash = keccak256(abi.encode(TRADING_CLAIM_TYPEHASH, alice, amount, nonce));
        bytes32 digest = _getEIP712Digest(structHash);

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(wrongPrivateKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.prank(alice);
        vm.expectRevert("Invalid signature");
        claimer.claimTradingRewards(amount, nonce, signature);
    }

    function test_Claim_Replay_Reverts() public {
        uint256 amount = 100 ether;
        uint256 nonce = 0;

        bytes32 structHash = keccak256(abi.encode(TRADING_CLAIM_TYPEHASH, alice, amount, nonce));
        bytes32 digest = _getEIP712Digest(structHash);

        (uint8 v, bytes32 r, bytes32 s) = vm.sign(signerPrivateKey, digest);
        bytes memory signature = abi.encodePacked(r, s, v);

        vm.prank(alice);
        claimer.claimTradingRewards(amount, nonce, signature);

        // Replay
        vm.prank(alice);
        vm.expectRevert("Invalid nonce");
        claimer.claimTradingRewards(amount, nonce, signature);
    }

    function test_SetSigner_HappyPath() public {
        address newSigner = address(0x123);
        
        vm.prank(admin);
        claimer.setSigner(newSigner);
        
        assertEq(claimer.authorizedSigner(), newSigner);
    }

    function test_SetSigner_Unauthorized_Reverts() public {
        address newSigner = address(0x123);
        
        vm.prank(alice);
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                alice,
                0x00 // DEFAULT_ADMIN_ROLE
            )
        );
        claimer.setSigner(newSigner);
    }

    // --- Helpers ---

    function _getEIP712Digest(bytes32 structHash) internal view returns (bytes32) {
        bytes32 domainSeparator = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("WhaleTownRewards")),
                keccak256(bytes("1")),
                block.chainid,
                address(claimer)
            )
        );
        return keccak256(abi.encodePacked("\x19\x01", domainSeparator, structHash));
    }
}
