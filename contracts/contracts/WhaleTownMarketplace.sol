// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/interfaces/IERC2981.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

/**
 * @title WhaleTownMarketplace
 * @notice Fixed-price NFT marketplace for the Whale Town collection.
 *         Supports pathUSD (ERC20) payments, EIP-2981 royalties,
 *         per-collection royalty overrides, listing expiration,
 *         batch buying (sweep), and admin safety features.
 */
contract WhaleTownMarketplace is Ownable, ReentrancyGuard, Pausable {

    struct Listing {
        address seller;
        address nftContract;
        uint256 tokenId;
        uint256 price;
        uint256 expiresAt;  // Unix timestamp, 0 = no expiration
        bool active;
    }

    struct CollectionRoyalty {
        address recipient;
        uint96 bps;         // basis points, e.g. 700 = 7%
        bool set;
    }

    // --- State ---

    uint256 public nextListingId;
    uint256 public platformFeeBps; // basis points (100 = 1%)
    address public feeRecipient;
    IERC20 public immutable paymentToken;

    mapping(uint256 => Listing) public listings;

    /// @notice Per-collection royalty overrides (takes precedence over ERC2981)
    mapping(address => CollectionRoyalty) public collectionRoyalties;

    // --- Events ---

    event Listed(uint256 indexed listingId, address indexed seller, address nftContract, uint256 tokenId, uint256 price, uint256 expiresAt);
    event Sale(uint256 indexed listingId, address indexed buyer, address indexed seller, address nftContract, uint256 tokenId, uint256 price);
    event Cancelled(uint256 indexed listingId);
    event PlatformFeeUpdated(uint256 newFeeBps);
    event FeeRecipientUpdated(address newRecipient);
    event CollectionRoyaltySet(address indexed nftContract, address recipient, uint96 bps);
    event BatchBuyResult(uint256 indexed listingId, bool success, string reason);

    // --- Constructor ---

    constructor(address _paymentToken, address _feeRecipient, uint256 _platformFeeBps) Ownable(msg.sender) {
        require(_platformFeeBps <= 1000, "Fee too high"); // max 10%
        paymentToken = IERC20(_paymentToken);
        feeRecipient = _feeRecipient;
        platformFeeBps = _platformFeeBps;
    }

    // --- Listing ---

    /**
     * @notice Create a fixed-price listing with optional expiration.
     * @param _nftContract The NFT contract address.
     * @param _tokenId The token ID to list.
     * @param _price The price in payment token units (pathUSD, 6 decimals).
     * @param _expiresAt Unix timestamp when listing expires. 0 = no expiration.
     */
    function list(address _nftContract, uint256 _tokenId, uint256 _price, uint256 _expiresAt) external whenNotPaused returns (uint256) {
        require(_price > 0, "Price must be > 0");
        require(_expiresAt == 0 || _expiresAt > block.timestamp, "Expiration must be in the future");

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
            expiresAt: _expiresAt,
            active: true
        });

        emit Listed(listingId, msg.sender, _nftContract, _tokenId, _price, _expiresAt);
        return listingId;
    }

    /**
     * @notice Buy a listed NFT. Buyer must have approved payment token.
     */
    function buy(uint256 _listingId) external nonReentrant whenNotPaused {
        _executeBuy(_listingId, msg.sender);
    }

    /**
     * @notice Sweep / batch buy multiple listings in one transaction.
     *         Individual failures are skipped — the transaction does NOT revert
     *         if a listing is unavailable, expired, or otherwise fails.
     *         Buyer must have approved sufficient pathUSD for the total.
     * @param _listingIds Array of listing IDs to purchase.
     * @return succeeded Boolean array indicating which listing IDs were bought.
     */
    function batchBuy(uint256[] calldata _listingIds) external nonReentrant whenNotPaused returns (bool[] memory succeeded) {
        uint256 len = _listingIds.length;
        require(len > 0, "Empty list");
        require(len <= 50, "Too many at once");

        succeeded = new bool[](len);

        // Pre-check total cost for valid listings to attempt a single allowance check
        uint256 totalCost = 0;
        for (uint256 i = 0; i < len; i++) {
            Listing storage item = listings[_listingIds[i]];
            if (item.active && (item.expiresAt == 0 || block.timestamp <= item.expiresAt)) {
                totalCost += item.price;
            }
        }

        require(
            paymentToken.allowance(msg.sender, address(this)) >= totalCost,
            "Insufficient allowance for batch"
        );

        for (uint256 i = 0; i < len; i++) {
            uint256 listingId = _listingIds[i];
            Listing storage item = listings[listingId];

            // Quick validity checks before attempting the buy
            if (!item.active) {
                emit BatchBuyResult(listingId, false, "Not active");
                continue;
            }
            if (item.expiresAt != 0 && block.timestamp > item.expiresAt) {
                emit BatchBuyResult(listingId, false, "Expired");
                continue;
            }

            // Attempt the buy — catch any revert so we can skip and continue
            try this._internalBuy(listingId, msg.sender) {
                succeeded[i] = true;
                emit BatchBuyResult(listingId, true, "");
            } catch Error(string memory reason) {
                emit BatchBuyResult(listingId, false, reason);
            } catch {
                emit BatchBuyResult(listingId, false, "Unknown error");
            }
        }
    }

    /**
     * @dev Internal buy hook used by batchBuy via external self-call for try/catch.
     *      Only callable by this contract itself.
     */
    function _internalBuy(uint256 _listingId, address _buyer) external {
        require(msg.sender == address(this), "Internal only");
        _executeBuy(_listingId, _buyer);
    }

    // --- Core Buy Logic ---

    function _executeBuy(uint256 _listingId, address _buyer) internal {
        Listing storage item = listings[_listingId];
        require(item.active, "Not active");
        require(item.expiresAt == 0 || block.timestamp <= item.expiresAt, "Listing expired");

        item.active = false;

        // Calculate fees
        uint256 platformFee = (item.price * platformFeeBps) / 10000;
        (address royaltyRecipient, uint256 royaltyAmount) = _getRoyalty(
            item.nftContract, item.tokenId, item.price
        );

        uint256 sellerProceeds = item.price - platformFee - royaltyAmount;

        // Transfer funds from buyer to this contract
        require(paymentToken.transferFrom(_buyer, address(this), item.price), "Payment failed");

        // Transfer NFT to buyer
        IERC721(item.nftContract).safeTransferFrom(item.seller, _buyer, item.tokenId);

        // Distribute funds
        if (platformFee > 0) {
            require(paymentToken.transfer(feeRecipient, platformFee), "Fee transfer failed");
        }
        if (royaltyAmount > 0 && royaltyRecipient != address(0)) {
            require(paymentToken.transfer(royaltyRecipient, royaltyAmount), "Royalty transfer failed");
        }
        require(paymentToken.transfer(item.seller, sellerProceeds), "Seller transfer failed");

        emit Sale(_listingId, _buyer, item.seller, item.nftContract, item.tokenId, item.price);
    }

    // --- Royalty Resolution ---

    /**
     * @dev Resolves royalty for a sale. Collection override takes priority over ERC2981.
     *      Royalty is capped at 10% to prevent abuse.
     */
    function _getRoyalty(address _nftContract, uint256 _tokenId, uint256 _price)
        internal
        view
        returns (address recipient, uint256 amount)
    {
        CollectionRoyalty storage override_ = collectionRoyalties[_nftContract];

        if (override_.set) {
            // Use the owner-configured royalty override
            amount = (_price * override_.bps) / 10000;
            recipient = override_.recipient;
        } else if (_supportsERC2981(_nftContract)) {
            // Fall back to on-chain ERC2981
            (recipient, amount) = IERC2981(_nftContract).royaltyInfo(_tokenId, _price);
        }

        // Cap at 10% regardless of source
        if (amount > _price / 10) {
            amount = _price / 10;
        }
    }

    // --- Cancel ---

    /**
     * @notice Cancel a listing. Only seller or owner can cancel.
     */
    function cancel(uint256 _listingId) external {
        Listing storage item = listings[_listingId];
        require(item.active, "Not active");
        require(item.seller == msg.sender || msg.sender == owner(), "Not authorized");

        item.active = false;
        emit Cancelled(_listingId);
    }

    // --- Admin Safety ---

    /**
     * @notice Batch cancel all active listings. Owner only.
     */
    function cancelAll() external onlyOwner {
        for (uint256 i = 0; i < nextListingId; i++) {
            if (listings[i].active) {
                listings[i].active = false;
                emit Cancelled(i);
            }
        }
    }

    /**
     * @notice Set a royalty override for a specific NFT collection. Owner only.
     *         Use this for collections that don't implement ERC2981 (e.g. Whale Town).
     * @param _nftContract The NFT collection address.
     * @param _recipient The royalty recipient address.
     * @param _bps Royalty in basis points (700 = 7%). Max 1000 (10%).
     */
    function setCollectionRoyalty(address _nftContract, address _recipient, uint96 _bps) external onlyOwner {
        require(_bps <= 1000, "Royalty too high");
        require(_recipient != address(0), "Zero recipient");
        collectionRoyalties[_nftContract] = CollectionRoyalty({
            recipient: _recipient,
            bps: _bps,
            set: true
        });
        emit CollectionRoyaltySet(_nftContract, _recipient, _bps);
    }

    /**
     * @notice Remove a royalty override for a collection. Owner only.
     */
    function clearCollectionRoyalty(address _nftContract) external onlyOwner {
        delete collectionRoyalties[_nftContract];
        emit CollectionRoyaltySet(_nftContract, address(0), 0);
    }

    /**
     * @notice Pause all trading (list + buy). Owner only.
     */
    function pause() external onlyOwner {
        _pause();
    }

    /**
     * @notice Unpause trading. Owner only.
     */
    function unpause() external onlyOwner {
        _unpause();
    }

    /**
     * @notice Rescue any ERC20/TIP20 tokens stuck in the contract.
     */
    function withdrawERC20(address _token, uint256 _amount) external onlyOwner {
        require(IERC20(_token).transfer(msg.sender, _amount), "Withdraw failed");
    }

    // --- Views ---

    function getListing(uint256 _listingId) external view returns (Listing memory) {
        return listings[_listingId];
    }

    /**
     * @notice Check if a listing is still valid (active and not expired).
     */
    function isListingValid(uint256 _listingId) external view returns (bool) {
        Listing memory item = listings[_listingId];
        return item.active && (item.expiresAt == 0 || block.timestamp <= item.expiresAt);
    }

    /**
     * @notice Preview royalty that would be paid on a given listing.
     */
    function getRoyaltyInfo(address _nftContract, uint256 _tokenId, uint256 _price)
        external
        view
        returns (address recipient, uint256 amount)
    {
        return _getRoyalty(_nftContract, _tokenId, _price);
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

    function _supportsERC2981(address _contract) internal view returns (bool) {
        try IERC165(_contract).supportsInterface(type(IERC2981).interfaceId) returns (bool supported) {
            return supported;
        } catch {
            return false;
        }
    }
}
