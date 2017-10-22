/*
An ERC20 compliant token that is linked to a bank account via a bank API.
This token has the following constraints:
1. No token holder can hold more than 1000 tokens
2. There can not be more than 10 million tokens on issue
3. There is only one token issuer
4. Tokens can only be transferred to other depositors

This software is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  
See MIT Licence for further details.
<https://opensource.org/licenses/MIT>.
*/

pragma solidity ^0.4.18;

import {ERC20Token} from './erc20Token.sol';
import {SafeMath} from './lib/safeMaths.sol';

contract RestrictedBankToken is ERC20Token
{
    using SafeMath for uint256;

    uint8 public decimals = 2;
    address public owner = msg.sender;
    address public newOwner;

    // Map of token holders so transfers can only be made to addresses that have deposited funds
    mapping (address =>  bool) tokenHolders;
    // Map of of bank transaction identifiers so duplciate deposits can be prevented
    mapping (string =>  bool) bankTransactionIds;

    // used to track the state of withdrawals
    uint256 public withdrawalCounter = 0;
    mapping (uint256 => bool) confirmedWithdrawals;
    
    function RestrictedBankToken(string tokenSymbol, string tokenName)
    {
        sym = tokenSymbol;
        nam = tokenName;
    }

    event Deposit(
        address indexed toAddress,
        uint256 amount,
        string externalId,
        string bankTransactionId);

    event RequestWithdrawal(
        uint256 indexed withdrawalNumber,
        address indexed fromAddress,
        uint256 amount);

    event ConfirmWithdrawal(
        uint256 indexed withdrawalNumber
    );

    // Checks an address has previously depositored funds the the bank account
    modifier onlyDepositor (address depositor) {
        require(tokenHolders[depositor]);
        _;
    }

    modifier maxTokens (address toAddress, uint256 amount) {
        require(balances[toAddress] + amount <= 1000);
        _;
    }

    modifier maxSupply (uint256 amount) {
        require(totSupply + amount <= 10000000);
        _;
    }

    // Checks that the caller is the owner of the contract
    modifier onlyOwner () {
        require(owner == msg.sender);
        _;
    }

    modifier onlyNewOwner () {
        require(newOwner == msg.sender);
        _;
    }

    // prevents duplicate deposit calls being made for the same bank transaction which would issue more tokens than what's held in the bank account
    modifier duplcateDepositChecker(string bankTransactionId)
    {
        // check the bank transaction id is false which means tokens have not already been issued for this bank deposit
        require(bankTransactionIds[bankTransactionId] == false);
        bankTransactionIds[bankTransactionId] = true;
        _;
    }

    // Issue takens after cash has been deposited into the bank account
    function deposit(address toAddress, uint256 amount, string externalId, string bankTransactionId) public
        onlyOwner()
        maxTokens(toAddress, amount)
        maxSupply(amount)
        duplcateDepositChecker(bankTransactionId) // check for duplicate deposits
        returns (bool)
    {
        totSupply = totSupply.add(amount);
        balances[toAddress] = balances[toAddress].add(amount);

        // mark as a depositor so they can receive transfers
        tokenHolders[toAddress] = true;
        
        Deposit(toAddress, amount, externalId, bankTransactionId);
        Transfer(0x0, toAddress, amount);

        return true;
    }

    // Used by the token holders to request the token issuer to send them a bank payment for the tokens they are redeeming
    function requestWithdrawal(uint256 amount) public
        returns (uint256)
    {
        totSupply = totSupply.sub(amount);
        balances[msg.sender] = balances[msg.sender].sub(amount);

        RequestWithdrawal(++withdrawalCounter, msg.sender, amount);
        Transfer(msg.sender, 0x0, amount);

        return withdrawalCounter;
    }

    // Used by the contract owner to confirm that they have sent a bank payment to the redeeming token holder
    function confirmWithdrawal(uint256 withdrawalNumber) public
        onlyOwner()
        returns (bool)
    {
        require(confirmedWithdrawals[withdrawalNumber] == false);

        confirmedWithdrawals[withdrawalNumber] = true;

        ConfirmWithdrawal(withdrawalCounter);

        return true;
    }

    // The transaction signer sends an amount of tokens to another depositor.
    function transfer(address toAddress, uint256 amount) public
        onlyDepositor(toAddress)    // the receiving address has to have already deposited funds
        maxTokens (toAddress, amount)   // token holder can't hold more than 1000 tokens
        returns (bool success)
    {
        return super.transfer(toAddress, amount);
    }

    // An allowed third party sends an amount of tokens from one depositor to another depositor
    function transferFrom(address fromAddress, address toAddress, uint256 amount) public
        onlyDepositor(toAddress)    // the receiving address has to have already deposited funds
        maxTokens (toAddress, amount)  // token holder can't hold more than 1000
        returns (bool)
    {
        return super.transferFrom(fromAddress, toAddress, amount);
    }

    function changeOwner(address _owner) public
        onlyOwner()
        returns (bool)
    {
        newOwner = _owner;
        return true;
    }

    function acceptOwnership() public
        onlyNewOwner()
        returns (bool)
    {
        owner = msg.sender;
        return true;
    }

    // checks if an address is a token holder. This will return true even if the token holder now has a zero balance
    function isTokenHolder(address tokenHolder) public view
        returns (bool)
    {
        return tokenHolders[tokenHolder];
    }

    // checks if a bank transaction id has already been processed
    function hasBankTransactionId(string bankTransactionId) public view returns (bool) {
        return bankTransactionIds[bankTransactionId];
    }

    // checks if a withdrawal number has already been confirmed by the custodian
    function hasConfirmedWithdrawal(uint256 withdrawalNumber) public view returns (bool) {
        return confirmedWithdrawals[withdrawalNumber];
    }

    function approve(address spender, uint256 amount) public
        onlyDepositor(spender)    // the receiving address has to have already deposited funds
        returns (bool)
    {
        super.approve(spender, amount);
    }

    function increaseApproval (address spender, uint addedAmount) public
        onlyDepositor(spender)    // the receiving address has to have already deposited funds
        returns (bool success)
    {
        return super.increaseApproval(spender, addedAmount);
    }

    function decreaseApproval (address spender, uint subtractedAmount) public
        onlyDepositor(spender)    // the receiving address has to have already deposited funds
        returns (bool success)
    {
        return super.decreaseApproval(spender, subtractedAmount);
    }
}