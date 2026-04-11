// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @dev Mock ERC20 with 6 decimals (like pathUSD)
contract MockERC20 is ERC20 {
    constructor(address recipient, uint256 supply) ERC20("Mock pathUSD", "pUSD") {
        _mint(recipient, supply);
    }

    function decimals() public pure override returns (uint8) {
        return 6;
    }
}
