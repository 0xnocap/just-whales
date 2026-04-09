// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/interfaces/IERC2981.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title WhaleTownMarketplace
 * @notice Fixed-price NFT marketplace for the Whale Town collection.
 *         Supports EIP-2981 royalties and a configurable platform fee.
 */
contract WhaleTownMarketplace is Ownable, ReentrancyGuard {

    struct Listing {
        address seller;
        address nftContract;
        uint256 tokenId;
        uint256 price;
        bool active;
    }

    // --- State ---

    uint256 public nextListingId;
    uint256 public platformFeeBps; // basis points (100 = 1%)
    address public feeRecipient;

    mapping(uint256 => Listing) public listings;

    // --- Events ---

    event Listed(uint256 indexed listingId, address indexed seller, address nftContract, uint256 tokenId, uint256 price);
    event Sale(uint256 indexed listingId, address indexed buyer, address indexed seller, address nftContract, uint256 tokenId, uint256 price);
    event Cancelled(uint256 indexed listingId);
    event PlatformFeeUpdated(uint256 newFeeBps);
    event FeeRecipientUpdated(address newRecipient);

    // --- Constructor ---

    constructor(address _feeRecipient, uint256 _platformFeeBps) Ownable(msg.sender) {
        require(_platformFeeBps <= 1000, "Fee too high"); // max 10%
        feeRecipient = _feeRecipient;
        platformFeeBps = _platformFeeBps;
    }

    // --- Listing ---

    /**
     * @notice List an NFT for sale at a fixed price.
     * @dev Caller must have approved this contract for the token.
     */
    function list(address _nftContract, uint256 _tokenId, uint256 _price) external returns (uint256) {
        require(_price > 0, "Price must be > 0");

        IERC721 nft = IERC721(_nftContract);
        require(nft.ownerOf(_tokenId) == msg.sender, "Not token owner");
        require(
            nft.isApprovedForAll(msg.sender, address(this)) ||
            nft.getApproved(_tokenId) == address(this),
            "Marketplace not approved"
        );

        uint256 listingId = nextListingId++;
        listings[listingId] = Listing({
            seller: msg.sender,
            nftContract: _nftContract,
            tokenId: _tokenId,
            price: _price,
            active: true
        });

        emit Listed(listingId, msg.sender, _nftContract, _tokenId, _price);
        return listingId;
    }

    /**
     * @notice Buy a listed NFT. Send exact price as msg.value.
     */
    function buy(uint256 _listingId) external payable nonReentrant {
        Listing storage item = listings[_listingId];
        require(item.active, "Not active");
        require(msg.value == item.price, "Wrong price");

        item.active = false;

        // Calculate fees
        uint256 platformFee = (item.price * platformFeeBps) / 10000;
        uint256 royaltyAmount = 0;
        address royaltyRecipient = address(0);

        // Check EIP-2981 royalties
        if (_supportsERC2981(item.nftContract)) {
            (royaltyRecipient, royaltyAmount) = IERC2981(item.nftContract).royaltyInfo(item.tokenId, item.price);
            // Cap royalty at 10%
            if (royaltyAmount > item.price / 10) {
                royaltyAmount = item.price / 10;
            }
        }

        uint256 sellerProceeds = item.price - platformFee - royaltyAmount;

        // Transfer NFT to buyer
        IERC721(item.nftContract).safeTransferFrom(item.seller, msg.sender, item.tokenId);

        // Distribute funds
        if (platformFee > 0) {
            _transferFunds(feeRecipient, platformFee);
        }
        if (royaltyAmount > 0 && royaltyRecipient != address(0)) {
            _transferFunds(royaltyRecipient, royaltyAmount);
        }
        _transferFunds(item.seller, sellerProceeds);

        emit Sale(_listingId, msg.sender, item.seller, item.nftContract, item.tokenId, item.price);
    }

    /**
     * @notice Cancel your listing.
     */
    function cancel(uint256 _listingId) external {
        Listing storage item = listings[_listingId];
        require(item.active, "Not active");
        require(item.seller == msg.sender || msg.sender == owner(), "Not authorized");

        item.active = false;
        emit Cancelled(_listingId);
    }

    // --- Views ---

    function getListing(uint256 _listingId) external view returns (Listing memory) {
        return listings[_listingId];
    }

    // --- Owner ---

    function setPlatformFee(uint256 _feeBps) external onlyOwner {
        require(_feeBps <= 1000, "Fee too high");
        platformFeeBps = _feeBps;
        emit PlatformFeeUpdated(_feeBps);
    }

    function setFeeRecipient(address _recipient) external onlyOwner {
        require(_recipient != address(0), "Zero address");
        feeRecipient = _recipient;
        emit FeeRecipientUpdated(_recipient);
    }

    // --- Internal ---

    function _transferFunds(address _to, uint256 _amount) internal {
        (bool success, ) = payable(_to).call{value: _amount}("");
        require(success, "Transfer failed");
    }

    function _supportsERC2981(address _contract) internal view returns (bool) {
        try IERC165(_contract).supportsInterface(type(IERC2981).interfaceId) returns (bool supported) {
            return supported;
        } catch {
            return false;
        }
    }
}
