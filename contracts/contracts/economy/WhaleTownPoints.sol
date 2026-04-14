// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/AccessControl.sol";

/**
 * @title  WhaleTownPoints
 * @notice ERC20 points token for the Whale Town economy. Forks the functional
 *         shape of Thirdweb's TokenERC20 (role-gated mint, transferable) using
 *         OpenZeppelin v5 primitives.
 *
 *         - DEFAULT_ADMIN_ROLE: grant/revoke other roles, set cap metadata.
 *         - MINTER_ROLE: mint points to users. Held by the staking contract,
 *           the backend treasury wallet, and anyone else the admin grants.
 *
 *         The rolling 1000-points-per-60-minute cap (spec §6) is enforced
 *         offchain in the backend; this contract stays intentionally simple so
 *         deployment matches the Thirdweb audited pattern.
 */
contract WhaleTownPoints is ERC20, ERC20Burnable, AccessControl {
    bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE");

    constructor(address admin)
        ERC20("Whale Town Points", "OP")
    {
        require(admin != address(0), "admin=0");
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(MINTER_ROLE, admin);
    }

    /// @notice Mint `amount` points to `to`. Restricted to MINTER_ROLE.
    function mintTo(address to, uint256 amount) external onlyRole(MINTER_ROLE) {
        _mint(to, amount);
    }

    /// @notice Batch mint for daily treasury sweeps.
    function mintToBatch(address[] calldata to, uint256[] calldata amounts)
        external
        onlyRole(MINTER_ROLE)
    {
        require(to.length == amounts.length, "length mismatch");
        for (uint256 i = 0; i < to.length; i++) {
            _mint(to[i], amounts[i]);
        }
    }
}
