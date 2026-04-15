// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

interface IMintablePoints {
    function mintTo(address to, uint256 amount) external;
}

/**
 * @title RewardsClaimer
 * @notice Handles signature-based claims for trading and fishing rewards in Whale Town.
 *         Uses EIP-712 signatures from an authorized backend signer to authorize mints.
 */
contract RewardsClaimer is EIP712, AccessControl {
    bytes32 public constant SIGNER_ROLE = keccak256("SIGNER_ROLE");
    
    // EIP-712 Type Hashes
    bytes32 private constant TRADING_CLAIM_TYPEHASH = keccak256("TradingClaim(address wallet,uint256 amount,uint256 nonce)");
    bytes32 private constant FISHING_CLAIM_TYPEHASH = keccak256("FishingClaim(address wallet,uint256 amount,uint256 nonce)");

    IMintablePoints public immutable points;
    address public authorizedSigner;

    mapping(address => uint256) public tradingNonces;
    mapping(address => uint256) public fishingNonces;

    event TradingRewardsClaimed(address indexed wallet, uint256 amount, uint256 nonce);
    event FishingRewardsClaimed(address indexed wallet, uint256 amount, uint256 nonce);
    event SignerUpdated(address indexed oldSigner, address indexed newSigner);

    constructor(address admin, address _signer, address _points) 
        EIP712("WhaleTownRewards", "1") 
    {
        require(admin != address(0), "admin=0");
        require(_signer != address(0), "signer=0");
        require(_points != address(0), "points=0");

        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        authorizedSigner = _signer;
        points = IMintablePoints(_points);
        
        emit SignerUpdated(address(0), _signer);
    }

    /**
     * @notice Claim trading rewards using a backend signature.
     * @param amount The amount of $OP to claim (in wei).
     * @param nonce The current trading nonce for the user.
     * @param signature The EIP-712 signature from the authorized signer.
     */
    function claimTradingRewards(uint256 amount, uint256 nonce, bytes calldata signature) external {
        address wallet = msg.sender;
        require(nonce == tradingNonces[wallet], "Invalid nonce");

        bytes32 structHash = keccak256(abi.encode(TRADING_CLAIM_TYPEHASH, wallet, amount, nonce));
        bytes32 hash = _hashTypedDataV4(structHash);
        
        address signer = ECDSA.recover(hash, signature);
        require(signer == authorizedSigner, "Invalid signature");

        tradingNonces[wallet]++;
        points.mintTo(wallet, amount);

        emit TradingRewardsClaimed(wallet, amount, nonce);
    }

    /**
     * @notice Claim fishing rewards using a backend signature.
     * @param amount The amount of $OP to claim (in wei).
     * @param nonce The current fishing nonce for the user.
     * @param signature The EIP-712 signature from the authorized signer.
     */
    function claimFishingRewards(uint256 amount, uint256 nonce, bytes calldata signature) external {
        address wallet = msg.sender;
        require(nonce == fishingNonces[wallet], "Invalid nonce");

        bytes32 structHash = keccak256(abi.encode(FISHING_CLAIM_TYPEHASH, wallet, amount, nonce));
        bytes32 hash = _hashTypedDataV4(structHash);
        
        address signer = ECDSA.recover(hash, signature);
        require(signer == authorizedSigner, "Invalid signature");

        fishingNonces[wallet]++;
        points.mintTo(wallet, amount);

        emit FishingRewardsClaimed(wallet, amount, nonce);
    }

    /**
     * @notice Update the authorized backend signer.
     * @param _newSigner The new signer address.
     */
    function setSigner(address _newSigner) external onlyRole(DEFAULT_ADMIN_ROLE) {
        require(_newSigner != address(0), "signer=0");
        address oldSigner = authorizedSigner;
        authorizedSigner = _newSigner;
        emit SignerUpdated(oldSigner, _newSigner);
    }
}
