// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721Receiver.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IMintablePoints {
    function mintTo(address to, uint256 amount) external;
}

interface IWhaleTown is IERC721 {
    function tokenDNA(uint256 tokenId) external view returns (uint32);
}

/**
 * @title  WhaleTownStaking
 * @notice ERC721 staking contract for Whale Town NFTs. Forks the functional
 *         shape of Thirdweb's Staking721Upgradeable (per-token accrual, onchain
 *         claim) using OpenZeppelin v5 primitives.
 *
 *         - Rates are set per tokenId by RATE_MANAGER_ROLE. The backend reads
 *           trait + body data and pushes rates onchain. Rate changes checkpoint
 *           accrued points into `pendingRewards` so holders never lose accrual.
 *         - Rates are expressed as POINTS PER DAY (18-decimal ERC20 units).
 *         - Rewards accrue per second: amount = elapsed * rate / 1 days.
 *         - Claim mints WhaleTownPoints directly; this contract must hold
 *           MINTER_ROLE on the points token.
 *
 *         - OPTIMIZATION: Most tokens use a base rate derived from their DNA
 *           (Shark=10, Whale=20, SeaLion=5). Only rare/bonus tokens require
 *           on-chain custom mappings.
 */
contract WhaleTownStaking is AccessControl, Pausable, ReentrancyGuard, IERC721Receiver {
    bytes32 public constant RATE_MANAGER_ROLE = keccak256("RATE_MANAGER_ROLE");

    IWhaleTown public immutable nft;
    IMintablePoints public immutable points;

    uint256 public constant SECONDS_PER_DAY = 1 days;

    /// tokenId => original staker (who can unstake / claim)
    mapping(uint256 => address) public stakerOf;

    /// tokenId => timestamp accrual last checkpointed from
    mapping(uint256 => uint64) public stakedAt;

    /// tokenId => current points-per-day rate (18 decimals, i.e. 20e18 = 20/day)
    /// This is now used only for CUSTOM OVERRIDES (Goldens, Watches, etc.)
    mapping(uint256 => uint256) public customTokenRate;

    /// global base rates for Animal Types (extracted from DNA)
    /// 0 = Shark, 1 = Whale, 2 = SeaLion
    mapping(uint8 => uint256) public baseRates;

    /// wallet => accumulated rewards not yet claimed (buffered on rate change / unstake)
    mapping(address => uint256) public pendingRewards;

    /// wallet => list of tokenIds currently staked by that wallet
    mapping(address => uint256[]) private _stakedTokens;
    mapping(uint256 => uint256) private _stakedIndex; // tokenId => index in _stakedTokens[staker]

    event Staked(address indexed staker, uint256 indexed tokenId, uint256 rate);
    event Unstaked(address indexed staker, uint256 indexed tokenId, uint256 accruedAtUnstake);
    event Claimed(address indexed staker, uint256 amount);
    event RateUpdated(uint256 indexed tokenId, uint256 oldRate, uint256 newRate);
    event BaseRatesUpdated(uint256 shark, uint256 whale, uint256 seaLion);

    constructor(address admin, IWhaleTown _nft, IMintablePoints _points) {
        require(admin != address(0), "admin=0");
        require(address(_nft) != address(0), "nft=0");
        require(address(_points) != address(0), "points=0");
        nft = _nft;
        points = _points;
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(RATE_MANAGER_ROLE, admin);
    }

    // -------------------------------------------------------------------
    // Views
    // -------------------------------------------------------------------

    /// @notice The daily rate for a token, resolving either from custom mapping
    ///         or falling back to DNA-based base rate.
    function tokenRate(uint256 tokenId) public view returns (uint256) {
        uint256 custom = customTokenRate[tokenId];
        if (custom > 0) return custom;

        // Extract Animal Type from DNA (first 4 bits / highest nibble)
        uint32 dna = nft.tokenDNA(tokenId);
        uint8 animalType = uint8(dna >> 28);
        return baseRates[animalType];
    }

    /// @notice Rewards that would be minted if `staker` claimed right now.
    function rewardsOf(address staker) external view returns (uint256) {
        uint256 total = pendingRewards[staker];
        uint256[] storage tokens = _stakedTokens[staker];
        for (uint256 i = 0; i < tokens.length; i++) {
            total += _accrued(tokens[i]);
        }
        return total;
    }

    /// @notice Tokens currently staked by `staker`.
    function stakedTokensOf(address staker) external view returns (uint256[] memory) {
        return _stakedTokens[staker];
    }

    function _accrued(uint256 tokenId) internal view returns (uint256) {
        uint256 last = stakedAt[tokenId];
        if (last == 0) return 0;
        uint256 elapsed = block.timestamp - last;
        return (elapsed * tokenRate(tokenId)) / SECONDS_PER_DAY;
    }

    // -------------------------------------------------------------------
    // Staking actions
    // -------------------------------------------------------------------

    function stake(uint256[] calldata tokenIds) external nonReentrant whenNotPaused {
        require(tokenIds.length > 0, "no tokens");
        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];
            require(stakerOf[tokenId] == address(0), "already staked");
            stakerOf[tokenId] = msg.sender;
            stakedAt[tokenId] = uint64(block.timestamp);
            _stakedIndex[tokenId] = _stakedTokens[msg.sender].length;
            _stakedTokens[msg.sender].push(tokenId);
            // pulls the NFT (reverts if not approved/owned)
            nft.safeTransferFrom(msg.sender, address(this), tokenId);
            emit Staked(msg.sender, tokenId, tokenRate(tokenId));
        }
    }

    function unstake(uint256[] calldata tokenIds) external nonReentrant {
        require(tokenIds.length > 0, "no tokens");
        for (uint256 i = 0; i < tokenIds.length; i++) {
            uint256 tokenId = tokenIds[i];
            require(stakerOf[tokenId] == msg.sender, "not staker");
            uint256 earned = _accrued(tokenId);
            pendingRewards[msg.sender] += earned;
            stakedAt[tokenId] = 0;
            stakerOf[tokenId] = address(0);
            _removeFromStaked(msg.sender, tokenId);
            nft.safeTransferFrom(address(this), msg.sender, tokenId);
            emit Unstaked(msg.sender, tokenId, earned);
        }
    }

    function claim() external nonReentrant whenNotPaused {
        uint256 owed = pendingRewards[msg.sender];
        pendingRewards[msg.sender] = 0;
        uint256[] storage tokens = _stakedTokens[msg.sender];
        for (uint256 i = 0; i < tokens.length; i++) {
            uint256 tokenId = tokens[i];
            owed += _accrued(tokenId);
            stakedAt[tokenId] = uint64(block.timestamp);
        }
        require(owed > 0, "nothing to claim");
        points.mintTo(msg.sender, owed);
        emit Claimed(msg.sender, owed);
    }

    // -------------------------------------------------------------------
    // Admin: rate updates (spec §2.8)
    // -------------------------------------------------------------------

    function setBaseRates(uint256 shark, uint256 whale, uint256 seaLion)
        external
        onlyRole(RATE_MANAGER_ROLE)
    {
        baseRates[0] = shark;
        baseRates[1] = whale;
        baseRates[2] = seaLion;
        emit BaseRatesUpdated(shark, whale, seaLion);
    }

    function setTokenRate(uint256 tokenId, uint256 newRate)
        external
        onlyRole(RATE_MANAGER_ROLE)
    {
        _checkpointRate(tokenId, newRate);
    }

    function setTokenRatesBatch(uint256[] calldata tokenIds, uint256[] calldata rates)
        external
        onlyRole(RATE_MANAGER_ROLE)
    {
        require(tokenIds.length == rates.length, "length mismatch");
        for (uint256 i = 0; i < tokenIds.length; i++) {
            _checkpointRate(tokenIds[i], rates[i]);
        }
    }

    function _checkpointRate(uint256 tokenId, uint256 newRate) internal {
        uint256 oldRate = tokenRate(tokenId);
        address staker = stakerOf[tokenId];
        if (staker != address(0)) {
            pendingRewards[staker] += _accrued(tokenId);
            stakedAt[tokenId] = uint64(block.timestamp);
        }
        customTokenRate[tokenId] = newRate;
        emit RateUpdated(tokenId, oldRate, newRate);
    }

    // -------------------------------------------------------------------
    // Admin: pause
    // -------------------------------------------------------------------

    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) { _pause(); }
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) { _unpause(); }

    // -------------------------------------------------------------------
    // Internals
    // -------------------------------------------------------------------

    function _removeFromStaked(address staker, uint256 tokenId) internal {
        uint256[] storage arr = _stakedTokens[staker];
        uint256 idx = _stakedIndex[tokenId];
        uint256 last = arr.length - 1;
        if (idx != last) {
            uint256 lastTokenId = arr[last];
            arr[idx] = lastTokenId;
            _stakedIndex[lastTokenId] = idx;
        }
        arr.pop();
        delete _stakedIndex[tokenId];
    }

    function onERC721Received(address, address, uint256, bytes calldata)
        external
        pure
        override
        returns (bytes4)
    {
        return IERC721Receiver.onERC721Received.selector;
    }
}
