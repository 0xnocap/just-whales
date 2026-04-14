// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../contracts/economy/WhaleTownPoints.sol";
import "@openzeppelin/contracts/access/IAccessControl.sol";

contract WhaleTownPointsTest is Test {
    WhaleTownPoints points;

    address admin = address(0xA11CE);
    address minter = address(0xB0B);
    address alice = address(0xA1);
    address bob = address(0xB1);
    address eve = address(0xE);

    bytes32 constant MINTER_ROLE = keccak256("MINTER_ROLE");
    bytes32 constant DEFAULT_ADMIN_ROLE = 0x00;

    function setUp() public {
        points = new WhaleTownPoints(admin);
    }

    function test_Deploy_MetadataAndRoles() public view {
        assertEq(points.name(), "Whale Town Points");
        assertEq(points.symbol(), "OP");
        assertEq(points.decimals(), 18);
        assertEq(points.totalSupply(), 0);
        assertTrue(points.hasRole(DEFAULT_ADMIN_ROLE, admin));
        assertTrue(points.hasRole(MINTER_ROLE, admin));
    }

    function test_Deploy_RejectsZeroAdmin() public {
        vm.expectRevert(bytes("admin=0"));
        new WhaleTownPoints(address(0));
    }

    function test_MintTo_AdminCanMint() public {
        vm.prank(admin);
        points.mintTo(alice, 100 ether);
        assertEq(points.balanceOf(alice), 100 ether);
        assertEq(points.totalSupply(), 100 ether);
    }

    function test_MintTo_GrantedMinterCanMint() public {
        vm.prank(admin);
        points.grantRole(MINTER_ROLE, minter);

        vm.prank(minter);
        points.mintTo(bob, 42 ether);
        assertEq(points.balanceOf(bob), 42 ether);
    }

    function test_MintTo_UnauthorizedReverts() public {
        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                eve,
                MINTER_ROLE
            )
        );
        vm.prank(eve);
        points.mintTo(alice, 1 ether);
    }

    function test_RoleRevocation_PreventsMint() public {
        vm.prank(admin);
        points.grantRole(MINTER_ROLE, minter);
        vm.prank(admin);
        points.revokeRole(MINTER_ROLE, minter);

        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                minter,
                MINTER_ROLE
            )
        );
        vm.prank(minter);
        points.mintTo(alice, 1 ether);
    }

    function test_Transfer_EnabledForUsers() public {
        vm.prank(admin);
        points.mintTo(alice, 100 ether);

        vm.prank(alice);
        points.transfer(bob, 30 ether);
        assertEq(points.balanceOf(alice), 70 ether);
        assertEq(points.balanceOf(bob), 30 ether);
    }

    function test_Burn_ReducesSupply() public {
        vm.prank(admin);
        points.mintTo(alice, 100 ether);
        vm.prank(alice);
        points.burn(40 ether);
        assertEq(points.balanceOf(alice), 60 ether);
        assertEq(points.totalSupply(), 60 ether);
    }

    function test_MintToBatch_Happy() public {
        address[] memory to = new address[](2);
        to[0] = alice;
        to[1] = bob;
        uint256[] memory amts = new uint256[](2);
        amts[0] = 5 ether;
        amts[1] = 7 ether;

        vm.prank(admin);
        points.mintToBatch(to, amts);

        assertEq(points.balanceOf(alice), 5 ether);
        assertEq(points.balanceOf(bob), 7 ether);
        assertEq(points.totalSupply(), 12 ether);
    }

    function test_MintToBatch_LengthMismatch() public {
        address[] memory to = new address[](2);
        uint256[] memory amts = new uint256[](1);
        vm.prank(admin);
        vm.expectRevert(bytes("length mismatch"));
        points.mintToBatch(to, amts);
    }

    function test_MintToBatch_UnauthorizedReverts() public {
        address[] memory to = new address[](1);
        uint256[] memory amts = new uint256[](1);
        to[0] = alice;
        amts[0] = 1 ether;

        vm.expectRevert(
            abi.encodeWithSelector(
                IAccessControl.AccessControlUnauthorizedAccount.selector,
                eve,
                MINTER_ROLE
            )
        );
        vm.prank(eve);
        points.mintToBatch(to, amts);
    }

    function testFuzz_Mint_ArbitraryAmount(uint128 amount) public {
        vm.prank(admin);
        points.mintTo(alice, amount);
        assertEq(points.balanceOf(alice), amount);
    }
}
