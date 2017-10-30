"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Web3 = require("web3");
const ethers_1 = require("ethers");
const logger = require("config-logger");
const VError = require("verror");
class Token {
    constructor(url, contractOwner, ethSigner, jsonInterface, binary, contractAddress) {
        this.url = url;
        this.ethSigner = ethSigner;
        this.jsonInterface = jsonInterface;
        this.defaultGas = 120000;
        this.defaultGasPrice = 2000000000;
        this.transactions = {};
        this.contractOwner = contractOwner;
        this.contractBinary = binary;
        const description = `connect to Ethereum node using url ${url}`;
        logger.debug(`About to ${description}`);
        this.web3 = new Web3(url);
        this.provider = new ethers_1.providers.JsonRpcProvider(url, true, 100); // ChainId 100 = 0x64
        this.web3Contract = new this.web3.eth.Contract(jsonInterface, contractAddress, {
            from: contractOwner
        });
        this.contract = new ethers_1.Contract(contractAddress, jsonInterface, this.provider);
        this.ethSigner = ethSigner;
    }
    // deploy a new web3Contract
    deployContract(contractOwner, symbol, tokenName, gas = 1900000, gasPrice = 4000000000) {
        const self = this;
        this.contractOwner = contractOwner;
        const description = `deploy token with symbol ${symbol}, name "${tokenName}" from sender address ${self.contractOwner}, gas ${gas} and gasPrice ${gasPrice}`;
        return new Promise(async (resolve, reject) => {
            logger.debug(`About to ${description}`);
            if (!self.contractBinary) {
                const error = new VError(`Binary for smart contract has not been set so can not ${description}.`);
                logger.error(error.stack);
                return reject(error);
            }
            try {
                const deployTransaction = ethers_1.Contract.getDeployTransaction(self.contractBinary, self.jsonInterface, symbol, tokenName);
                const wallet = new ethers_1.Wallet(await self.ethSigner.getPrivateKey(contractOwner), self.provider);
                // Send the transaction
                const broadcastTransaction = await wallet.sendTransaction(deployTransaction);
                logger.debug(`${broadcastTransaction.hash} is transaction hash for ${description}`);
                // wait for the transaction to be mined
                const minedTransaction = await self.provider.waitForTransaction(broadcastTransaction.hash);
                logger.debug(`Created contract with address ${minedTransaction.creates} using ? gas for ${description}`);
                // TODO once all is switched to Ethers then the following can be removed
                self.web3Contract.options.address = minedTransaction.creates;
                self.contract = new ethers_1.Contract(minedTransaction.creates, self.jsonInterface, wallet);
                resolve(minedTransaction.creates);
            }
            catch (err) {
                const error = new VError(err, `Failed to ${description}.`);
                logger.error(error.stack);
                reject(error);
            }
        });
    }
    // transfer an amount of tokens from one address to another
    transfer(fromAddress, toAddress, amount, _gas, _gasPrice) {
        const self = this;
        const gas = _gas || self.defaultGas;
        const gasPrice = _gasPrice || self.defaultGasPrice;
        const description = `transfer ${amount} tokens from address ${fromAddress}, to address ${toAddress}, contract ${this.web3Contract._address}, gas limit ${gas} and gas price ${gasPrice}`;
        return new Promise(async (resolve, reject) => {
            try {
                const privateKey = await self.ethSigner.getPrivateKey(fromAddress);
                const wallet = new ethers_1.Wallet(privateKey, self.provider);
                const contract = new ethers_1.Contract(self.contract.address, self.jsonInterface, wallet);
                // send the transaction
                const broadcastTransaction = await contract.transfer(toAddress, amount, {
                    gasPrice: gasPrice,
                    gasLimit: gas
                });
                logger.debug(`${broadcastTransaction.hash} is transaction hash and nonce ${broadcastTransaction.nonce} for ${description}`);
                const transactionReceipt = await self.processTransaction(broadcastTransaction.hash, description, gas);
                resolve(broadcastTransaction.hash);
            }
            catch (err) {
                const error = new VError(err, `Failed to ${description}.`);
                logger.error(error.stack);
                reject(error);
            }
        });
    }
    async getSymbol() {
        const description = `symbol of contract at address ${this.contract.address}`;
        try {
            const result = await this.contract.symbol();
            const symbol = result[0];
            logger.info(`Got ${symbol} ${description}`);
            return symbol;
        }
        catch (err) {
            const error = new VError(err, `Could not get ${description}`);
            logger.error(error.stack);
            throw error;
        }
    }
    async getName() {
        const description = `name of contract at address ${this.contract.address}`;
        try {
            const result = await this.contract.name();
            const name = result[0];
            logger.info(`Got "${name}" ${description}`);
            return name;
        }
        catch (err) {
            const error = new VError(err, `Could not get ${description}`);
            logger.error(error.stack);
            throw error;
        }
    }
    async getDecimals() {
        const description = `number of decimals for contract at address ${this.contract.address}`;
        try {
            const result = await this.contract.decimals();
            const decimals = result[0];
            logger.info(`Got ${decimals} ${description}`);
            return decimals;
        }
        catch (err) {
            const error = new VError(err, `Could not get ${description}`);
            logger.error(error.stack);
            throw error;
        }
    }
    async getTotalSupply() {
        const description = `total supply of contract at address ${this.contract.address}`;
        try {
            const result = await this.contract.totalSupply();
            const totalSupply = result[0]._bn;
            logger.info(`Got ${totalSupply.toString()} ${description}`);
            return totalSupply;
        }
        catch (err) {
            const error = new VError(err, `Could not get ${description}`);
            logger.error(error.stack);
            throw error;
        }
    }
    async getBalanceOf(address) {
        const description = `balance of address ${address} in contract at address ${this.contract.address}`;
        try {
            const result = await this.contract.balanceOf(address);
            const balance = result[0]._bn;
            logger.info(`Got ${balance} ${description}`);
            return balance;
        }
        catch (err) {
            const error = new VError(err, `Could not get ${description}`);
            logger.error(error.stack);
            throw error;
        }
    }
    async getEvents(eventName, fromBlock = 0) {
        const description = `${eventName} events from block ${fromBlock} and contract address ${this.contract.address}`;
        const options = {
            fromBlock: fromBlock
        };
        try {
            logger.debug(`About to get ${description}`);
            const events = await this.web3Contract.getPastEvents(eventName, options);
            logger.debug(`${events.length} events successfully returned from ${description}`);
            return events;
        }
        catch (err) {
            const error = new VError(err, `Could not get ${description}`);
            console.log(error.stack);
            throw error;
        }
    }
    async getHolderBalances() {
        const description = `all token holder balances from contract address ${this.contract.address}`;
        try {
            const transferEvents = await this.getEvents("Transfer");
            const holderBalances = {};
            transferEvents.forEach(event => {
                const fromAddress = event.returnValues.fromAddress, toAddress = event.returnValues.toAddress, amount = Number(event.returnValues.amount);
                //const {fromAddress: string, toAddress: string, amount: number } = event.returnValues;
                // if deposit
                if (fromAddress == '0x0000000000000000000000000000000000000000') {
                    holderBalances[toAddress] = (holderBalances[toAddress]) ?
                        holderBalances[toAddress] += amount :
                        holderBalances[toAddress] = amount;
                }
                else if (toAddress == '0x0000000000000000000000000000000000000000') {
                    holderBalances[fromAddress] = (holderBalances[fromAddress]) ?
                        holderBalances[fromAddress] -= amount :
                        holderBalances[fromAddress] = -amount;
                }
                else {
                    holderBalances[fromAddress] = (holderBalances[fromAddress]) ?
                        holderBalances[fromAddress] -= amount :
                        holderBalances[fromAddress] = -amount;
                    holderBalances[toAddress] = (holderBalances[toAddress]) ?
                        holderBalances[toAddress] += amount :
                        holderBalances[toAddress] = amount;
                }
            });
            return holderBalances;
        }
        catch (err) {
            const error = new VError(err, `Could not get ${description}`);
            console.log(error.stack);
            throw error;
        }
    }
    async processTransaction(hash, description, gas) {
        // wait for the transaction to be mined
        const minedTransaction = await this.provider.waitForTransaction(hash);
        logger.debug(`${hash} mined in block number ${minedTransaction.blockNumber} for ${description}`);
        const transactionReceipt = await this.provider.getTransactionReceipt(hash);
        logger.debug(`Status ${transactionReceipt.status} and ${transactionReceipt.gasUsed} gas of ${gas} used for ${description}`);
        // If a status of 0 was returned then the transaction failed. Status 1 means the transaction worked
        if (transactionReceipt.status.eq(0)) {
            throw VError(`Failed ${hash} transaction with status code ${transactionReceipt.status} and ${gas} gas used.`);
        }
        return transactionReceipt;
    }
}
exports.default = Token;
//# sourceMappingURL=token.js.map