// SPDX-License-Identifier: Apache-2.0

pragma solidity ^0.8.0;

import "./ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "hardhat/console.sol";

/*
New feature I suggest:

1. We can add a new function `acceptGrant`, which is called by the recipient and accepts the grant.
Once a grant is accepted, the funder can remove it only with the acceptance of the recipient.
In this way, we can assure the recipients that the grants will keep valid.
*/

contract Vault is Ownable {
    struct Grant {
        address funder;
        address recipient;
        uint amount;
        uint unlockTimestamp;
    }

    mapping(uint => Grant) public grants;
    uint public grantCount;
    ERC20 token;

    constructor(ERC20 token_) {
        token = token_;
    }

    function createGrant(address funder, address recipient, uint amount, uint unlockTimestamp) public onlyOwner returns (uint grantId)  {
        require(funder != address(0), "Funder cannot be zero address!");
        require(recipient != address(0), "Recipient cannot be zero address1");

        token.transferFrom(funder, address(this), amount);
        
        Grant memory grant;
        grant.funder = funder;
        grant.recipient = recipient;
        grant.amount = amount;
        grant.unlockTimestamp = unlockTimestamp;

        grants[grantCount] = grant;
        grantId = grantCount;
        grantCount++;
    }

    function removeGrant(uint grantId) public {
        Grant memory grant = grants[grantId];
        require(grant.funder != address(0), "The grant does not exist!");
        require(grant.funder == msg.sender, "Only the funder can remove a grant!");
        require(block.timestamp < grant.unlockTimestamp, "The grant has already been unlocked!");

        delete grants[grantId];
        token.transfer(grant.funder, grant.amount);
    }

    function claimGrant(uint grantId) public {
        Grant memory grant = grants[grantId];
        require(grant.recipient != address(0), "The grant does not exist!");
        require(grant.recipient == msg.sender, "Only the recipient can claim a grant!");
        require(block.timestamp >= grant.unlockTimestamp, "The grant has not been unlocked yet!");

        token.transfer(grant.recipient, grant.amount);
        delete grants[grantId];
    }
}