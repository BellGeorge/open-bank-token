"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const Web3 = require("web3");
const VError = require("verror");
const logger = require("config-logger");
// TODO make this a contructor argument
const ethSigner_hardcoded_1 = require("./ethSigner/ethSigner-hardcoded");
class Token {
    constructor(url, contractOwner, jsonInterface, binary, contractAddress) {
        this.url = url;
        this.defaultGas = 120000;
        this.defaultGasPrice = 2000000000;
        this.transactions = {};
        this.contractAddress = contractAddress;
        this.contractOwner = contractOwner;
        this.binary = binary;
        const description = `connect to Ethereum node using url ${url}`;
        logger.debug(`About to ${description}`);
        this.web3 = new Web3(url);
        this.contract = new this.web3.eth.Contract(jsonInterface, contractAddress, {
            from: contractOwner
        });
        this.ethSigner = new ethSigner_hardcoded_1.default(this.web3);
        // TODO need a way to validate that web3 connected to a node. The following will not work as web3 1.0 no longer supports web3.isCOnnected()
        // https://github.com/ethereum/web3.js/issues/440
        // if (!this.web3.isConnected())
        // {
        //     const error = new VError(`Failed to ${description}.`);
        //     logger.error(error.stack);
        //     throw(error);
        // }
    }
    // deploy a new contract
    deployContract(contractOwner, symbol, tokenName, gas = 1900000, gasPrice = 4000000000) {
        const self = this;
        this.contractOwner = contractOwner;
        const description = `deploy token with symbol ${symbol}, name "${tokenName}" from sender address ${self.contractOwner}, gas ${gas} and gasPrice ${gasPrice}`;
        return new Promise(async (resolve, reject) => {
            logger.debug(`About to ${description}`);
            if (!self.binary) {
                const error = new VError(`Binary for smart contract has not been set so can not ${description}.`);
                logger.error(error.stack);
                return reject(error);
            }
            try {
                const encodedParams = self.web3.eth.abi.encodeParameters(['string', 'string'], [symbol, tokenName]);
                const data = self.binary + encodedParams.slice(2); // remove the 0x at the start of the encoded parameters
                const signedTx = await self.ethSigner.signTransaction({
                    nonce: await self.web3.eth.getTransactionCount(self.contractOwner),
                    from: contractOwner,
                    gas: gas,
                    gasPrice: gasPrice,
                    data: data
                });
                self.web3.eth.sendSignedTransaction(signedTx.rawTransaction)
                    .on('transactionHash', (hash) => {
                    logger.debug(`Got transaction hash ${hash} from ${description}`);
                    self.transactions[hash] = 0;
                })
                    .on('receipt', (receipt) => {
                    logger.debug(`Created contract with address ${receipt.contractAddress} using ${receipt.gasUsed} gas for ${description}`);
                    self.contractAddress = receipt.contractAddress;
                    self.contract.options.address = receipt.contractAddress;
                    resolve(receipt.contractAddress);
                })
                    .on('confirmation', (confirmationNumber, receipt) => {
                    logger.trace(`${confirmationNumber} confirmations for ${description} with transaction hash ${receipt.transactionHash}`);
                    self.transactions[receipt.transactionHash] = confirmationNumber;
                })
                    .on('error', (err) => {
                    const error = new VError(err, `Failed to ${description}.`);
                    logger.error(error.stack);
                    reject(error);
                });
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
        const description = `transfer ${amount} tokens from address ${fromAddress}, to address ${toAddress}, contract ${this.contract._address}, gas limit ${gas} and gas price ${gasPrice}`;
        return new Promise(async (resolve, reject) => {
            const signedTx = await self.ethSigner.signTransaction({
                nonce: await self.web3.eth.getTransactionCount(self.contractOwner),
                from: self.contractOwner,
                to: self.contract.options.address,
                gas: gas,
                gasPrice: gasPrice,
                data: self.contract.methods.transfer(toAddress, amount).encodeABI()
            });
            self.web3.eth.sendSignedTransaction(signedTx.rawTransaction)
                .on('transactionHash', (hash) => {
                logger.debug(`transaction hash ${hash} returned for ${description}`);
                self.transactions[hash] = 0;
            })
                .on('receipt', (receipt) => {
                if (receipt.status == '0x0') {
                    const error = new VError(`Exception thrown for ${description}`);
                    logger.error(error.stack);
                    return reject(error);
                }
                logger.debug(`${receipt.gasUsed} gas used of a ${gas} gas limit for ${description}`);
                resolve(receipt.transactionHash);
            })
                .on('confirmation', (confirmationNumber, receipt) => {
                logger.trace(`${confirmationNumber} confirmations for ${description} with transaction hash ${receipt.transactionHash}`);
                self.transactions[receipt.transactionHash] = confirmationNumber;
            })
                .on('error', (err) => {
                const error = new VError(err, `Could not ${description}`);
                logger.error(error.stack);
                reject(error);
            });
        });
    }
    async getSymbol() {
        const description = `symbol of contract at address ${this.contract._address}`;
        try {
            const symbol = await this.contract.methods.symbol().call();
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
        const description = `name of contract at address ${this.contract._address}`;
        try {
            const name = await this.contract.methods.name().call();
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
        const description = `number of decimals for contract at address ${this.contract._address}`;
        try {
            const decimalsStr = await this.contract.methods.decimals().call();
            const decimals = Number(decimalsStr);
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
        const description = `total supply of contract at address ${this.contract._address}`;
        try {
            const totalSupplyStr = await this.contract.methods.totalSupply().call();
            const totalSupply = Number(totalSupplyStr);
            logger.info(`Got ${totalSupply} ${description}`);
            return totalSupply;
        }
        catch (err) {
            const error = new VError(err, `Could not get ${description}`);
            logger.error(error.stack);
            throw error;
        }
    }
    async getBalanceOf(address) {
        const description = `balance of address ${address} in contract at address ${this.contract._address}`;
        try {
            const balanceStr = await this.contract.methods.balanceOf(address).call();
            const balance = Number(balanceStr);
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
        const description = `${eventName} events from block ${fromBlock} and contract address ${this.contract._address}`;
        const options = {
            fromBlock: fromBlock
        };
        try {
            logger.debug(`About to get ${description}`);
            const events = await this.contract.getPastEvents(eventName, options);
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
        const description = `all token holder balances from contract address ${this.contract._address}`;
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
}
exports.default = Token;
//# sourceMappingURL=token.js.map