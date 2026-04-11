// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "forge-std/Test.sol";
import "../contracts/WhaleTownMarketplace.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";

contract MockERC20 is ERC20 {
    constructor() ERC20("Mock USD", "mUSD") {}
    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MockERC721 is ERC721 {
    constructor() ERC721("Mock NFT", "MNFT") {}
    function mint(address to, uint256 tokenId) external {
        _mint(to, tokenId);
    }
}

contract WhaleTownMarketplaceTest is Test {
    WhaleTownMarketplace marketplace;
    MockERC20 paymentToken;
    MockERC721 nft;

    address admin = address(1);
    address feeRecipient = address(2);
    address seller = address(3);
    address buyer = address(4);

    uint256 platformFeeBps = 100; // 1%

    function setUp() public {
        vm.startPrank(admin);
        paymentToken = new MockERC20();
        nft = new MockERC721();
        marketplace = new WhaleTownMarketplace(address(paymentToken), feeRecipient, platformFeeBps);
        vm.stopPrank();

        // Setup seller
        nft.mint(seller, 1);
        nft.mint(seller, 2);
        
        vm.startPrank(seller);
        nft.setApprovalForAll(address(marketplace), true);
        vm.stopPrank();

        // Setup buyer
        paymentToken.mint(buyer, 10000 ether);
        vm.startPrank(buyer);
        paymentToken.approve(address(marketplace), type(uint256).max);
        vm.stopPrank();
    }

    function test_Expiration() public {
        vm.prank(seller);
        uint256 expiresAt = block.timestamp + 1 hours;
        uint256 listingId = marketplace.list(address(nft), 1, 100 ether, expiresAt);

        // Advance time past expiration
        vm.warp(block.timestamp + 2 hours);

        // Attempting to buy should fail
        vm.prank(buyer);
        vm.expectRevert("Listing expired");
        marketplace.buy(listingId);
    }

    function test_CancelAll() public {
        vm.startPrank(seller);
        uint256 list1 = marketplace.list(address(nft), 1, 100 ether, 0);
        uint256 list2 = marketplace.list(address(nft), 2, 200 ether, 0);
        vm.stopPrank();

        // Verify active
        assertTrue(marketplace.getListing(list1).active);
        assertTrue(marketplace.getListing(list2).active);

        // Admin cancels all
        vm.prank(admin);
        marketplace.cancelAll();

        // Verify inactive
        assertFalse(marketplace.getListing(list1).active);
        assertFalse(marketplace.getListing(list2).active);

        // Buying should revert
        vm.prank(buyer);
        vm.expectRevert("Not active");
        marketplace.buy(list1);
    }

    function test_WithdrawERC20() public {
        // Send tokens directly to marketplace contract (simulating stuck tokens)
        paymentToken.mint(address(marketplace), 500 ether);
        assertEq(paymentToken.balanceOf(address(marketplace)), 500 ether);

        // Admin withdraws 
        vm.prank(admin);
        marketplace.withdrawERC20(address(paymentToken), 500 ether);

        // Verify balances
        assertEq(paymentToken.balanceOf(address(marketplace)), 0);
        assertEq(paymentToken.balanceOf(admin), 500 ether);
    }

    function test_WithdrawERC20_NotAdminReverts() public {
        paymentToken.mint(address(marketplace), 500 ether);
        
        vm.prank(buyer);
        vm.expectRevert(abi.encodeWithSignature("OwnableUnauthorizedAccount(address)", buyer));
        marketplace.withdrawERC20(address(paymentToken), 500 ether);
    }
}
