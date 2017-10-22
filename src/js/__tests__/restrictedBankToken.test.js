"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs = require("fs");
const BankToken_1 = require("../BankToken");
const testContractOwner = '0xF55583FF8461DB9dfbBe90b5F3324f2A290c3356', depositor1 = '0x8Ae386892b59bD2A7546a9468E8e847D61955991', depositor2 = '0x0013a861865d784d97c57e70814b13ba94713d4e', depositor3 = '0xD9D72D466637e8408BB3B17d3ff6DB02e8BeBf27';
const bankTokenABIFile = './bin/contracts/restrictedBankToken.abi', bankTokenBinaryFile = './bin/contracts/restrictedBankToken.bin';
describe("BankToken", () => {
    const defaultJsonInterfaceStr = fs.readFileSync(bankTokenABIFile, 'utf8');
    const jsonInterface = JSON.parse(defaultJsonInterfaceStr);
    const contractBinary = '0x' + fs.readFileSync(bankTokenBinaryFile, 'utf8');
    const bankToken = new BankToken_1.default("ws://localhost:8647", testContractOwner, jsonInterface, contractBinary, null // test contract
    );
    describe("Deploy contract", () => {
        test('with default arguments', async () => {
            expect.assertions(5);
            const contractAddress = await bankToken.deployContract(testContractOwner);
            expect(contractAddress).toHaveLength(42);
            expect(await bankToken.getSymbol()).toEqual('DAD');
            expect(await bankToken.getName()).toEqual('Digital Australian Dollar');
            expect(await bankToken.getTotalSupply()).toEqual(0);
            expect(await bankToken.getDecimals()).toEqual(2);
        }, 60000);
        test('with specified arguments', async () => {
            expect.assertions(3);
            const contractAddress = await bankToken.deployContract(testContractOwner, "Test", "Test name");
            expect(contractAddress).toHaveLength(42);
            expect(await bankToken.getSymbol()).toEqual('Test');
            expect(await bankToken.getName()).toEqual('Test name');
        }, 60000);
    });
    describe("deposit", async () => {
        beforeAll(async () => {
            await bankToken.deployContract(testContractOwner);
        }, 30000);
        test("checks before any deposits", async () => {
            expect.assertions(4);
            expect(await bankToken.getTotalSupply()).toEqual(0);
            expect(await bankToken.getBalanceOf(depositor1)).toEqual(0);
            expect(await bankToken.getBalanceOf(depositor2)).toEqual(0);
            const events = await bankToken.getEvents('Deposit', 0);
            expect(events).toHaveLength(0);
        }, 60000);
        test("to first token holder", async () => {
            expect.assertions(5);
            expect(await bankToken.isTokenHolder(depositor1)).toEqual(false);
            const hash = await bankToken.deposit(depositor1, 100, '1111', '10000');
            expect(await bankToken.isTokenHolder(depositor1)).toEqual(true);
            expect(hash).toHaveLength(66);
            expect(await bankToken.getTotalSupply()).toEqual(100);
            expect(await bankToken.getBalanceOf(depositor1)).toEqual(100);
        }, 60000);
        test("get event from first deposit", async () => {
            expect.assertions(5);
            const events = await bankToken.getEvents('Deposit', 0);
            expect(events).toHaveLength(1);
            expect(events[0].returnValues.toAddress).toEqual(depositor1);
            expect(events[0].returnValues.amount).toEqual("100");
            expect(events[0].returnValues.externalId).toEqual('1111');
            expect(events[0].returnValues.bankTransactionId).toEqual('10000');
        });
        test("to second token holder", async () => {
            expect.assertions(5);
            expect(await bankToken.isTokenHolder(depositor2)).toEqual(false);
            const hash = await bankToken.deposit(depositor2, 200, '2222', '10001');
            expect(await bankToken.isTokenHolder(depositor2)).toEqual(true);
            expect(hash).toHaveLength(66);
            expect(await bankToken.getTotalSupply()).toEqual(300);
            expect(await bankToken.getBalanceOf(depositor2)).toEqual(200);
        }, 40000);
        test("to first token holder again", async () => {
            expect.assertions(5);
            expect(await bankToken.hasBankTransactionId('10003')).toEqual(false);
            const hash = await bankToken.deposit(depositor1, 10, '1111', '10003');
            expect(await bankToken.hasBankTransactionId('10003')).toEqual(true);
            expect(hash).toHaveLength(66);
            expect(await bankToken.getTotalSupply()).toEqual(310);
            expect(await bankToken.getBalanceOf(depositor1)).toEqual(110);
        }, 40000);
        test("get events from three deposits", async () => {
            expect.assertions(13);
            const events = await bankToken.getEvents('Deposit', 0);
            expect(events).toHaveLength(3);
            expect(events[0].returnValues.toAddress.toUpperCase()).toEqual(depositor1.toUpperCase());
            expect(events[0].returnValues.amount).toEqual("100");
            expect(events[0].returnValues.externalId).toEqual('1111');
            expect(events[0].returnValues.bankTransactionId).toEqual('10000');
            expect(events[1].returnValues.toAddress.toUpperCase()).toEqual(depositor2.toUpperCase());
            expect(events[1].returnValues.amount).toEqual("200");
            expect(events[1].returnValues.externalId).toEqual('2222');
            expect(events[1].returnValues.bankTransactionId).toEqual('10001');
            expect(events[2].returnValues.toAddress.toUpperCase()).toEqual(depositor1.toUpperCase());
            expect(events[2].returnValues.amount).toEqual("10");
            expect(events[2].returnValues.externalId).toEqual('1111');
            expect(events[2].returnValues.bankTransactionId).toEqual('10003');
        });
        test("duplicate to first token holder again", async () => {
            expect.assertions(3);
            try {
                await bankToken.deposit(depositor1, 20, '11', '10003');
            }
            catch (err) {
                expect(err instanceof Error).toBeTruthy();
            }
            expect(await bankToken.getTotalSupply()).toEqual(310);
            expect(await bankToken.getBalanceOf(depositor1)).toEqual(110);
        }, 40000);
        test("to first token holder but not as the contract owner", async () => {
            expect.assertions(3);
            bankToken.contractOwner = depositor2;
            try {
                await bankToken.deposit(depositor1, 30, '111', '10004');
            }
            catch (err) {
                expect(err instanceof Error).toBeTruthy();
            }
            expect(await bankToken.getTotalSupply()).toEqual(310);
            expect(await bankToken.getBalanceOf(depositor1)).toEqual(110);
        }, 40000);
        test("to third token holder with > 1000 tokens", async () => {
            expect.assertions(3);
            bankToken.contractOwner = testContractOwner;
            try {
                await bankToken.deposit(depositor3, 10001, '3333', '10010');
            }
            catch (err) {
                expect(err instanceof Error).toBeTruthy();
            }
            expect(await bankToken.getTotalSupply()).toEqual(310);
            expect(await bankToken.getBalanceOf(depositor3)).toEqual(0);
        }, 40000);
        test("to first token holder so they have more than 1000 tokens", async () => {
            expect.assertions(3);
            try {
                await bankToken.deposit(depositor1, 900, '1111', '10020');
            }
            catch (err) {
                expect(err instanceof Error).toBeTruthy();
            }
            expect(await bankToken.getTotalSupply()).toEqual(310);
            expect(await bankToken.getBalanceOf(depositor1)).toEqual(110);
        }, 40000);
    });
    describe("transfers", () => {
        beforeAll(async () => {
            await bankToken.deployContract(testContractOwner);
            await bankToken.deposit(depositor1, 999, '3333', '10100');
            await bankToken.deposit(depositor2, 888, '4444', '10200');
        }, 60000);
        test("from first depositor to an address not registered as a depositor", async () => {
            expect.assertions(3);
            try {
                const hash = await bankToken.transfer(depositor1, depositor3, 100);
            }
            catch (err) {
                expect(err instanceof Error).toBeTruthy();
            }
            expect(await bankToken.getBalanceOf(depositor1)).toEqual(999);
            expect(await bankToken.getBalanceOf(depositor2)).toEqual(888);
        }, 40000);
        test("from an address with no tokens", async () => {
            expect.assertions(3);
            try {
                const hash = await bankToken.transfer(depositor3, depositor1, 1);
            }
            catch (err) {
                expect(err instanceof Error).toBeTruthy();
            }
            expect(await bankToken.getBalanceOf(depositor1)).toEqual(999);
            expect(await bankToken.getBalanceOf(depositor2)).toEqual(888);
        }, 40000);
        test("from first to second depositor where the second depositor will have > 1000 tokens", async () => {
            expect.assertions(3);
            try {
                const hash = await bankToken.transfer(depositor1, depositor2, 200);
            }
            catch (err) {
                expect(err instanceof Error).toBeTruthy();
            }
            expect(await bankToken.getBalanceOf(depositor1)).toEqual(999);
            expect(await bankToken.getBalanceOf(depositor2)).toEqual(888);
        }, 40000);
        test("12 tokens from first to second depositor", async () => {
            expect.assertions(3);
            const hash = await bankToken.transfer(depositor1, depositor2, 12);
            expect(hash).toHaveLength(66);
            expect(await bankToken.getBalanceOf(depositor1)).toEqual(987);
            expect(await bankToken.getBalanceOf(depositor2)).toEqual(900);
        }, 40000);
        test("event from transfer", async () => {
            expect.assertions(4);
            const events = await bankToken.getEvents("Transfer");
            expect(events).toHaveLength(3);
            // the third event as the two deposits in the beforeAll function will also emit Transfer events
            expect(events[2].returnValues.fromAddress.toUpperCase()).toEqual(depositor1.toUpperCase());
            expect(events[2].returnValues.toAddress.toUpperCase()).toEqual(depositor2.toUpperCase());
            expect(events[2].returnValues.amount).toEqual("12");
        }, 40000);
        test("13 tokens from second to first depositor", async () => {
            expect.assertions(3);
            const hash = await bankToken.transfer(depositor2, depositor1, 13);
            expect(hash).toHaveLength(66);
            expect(await bankToken.getBalanceOf(depositor1)).toEqual(1000);
            expect(await bankToken.getBalanceOf(depositor2)).toEqual(887);
        }, 40000);
        test("0 tokens from first to second depositor", async () => {
            expect.assertions(3);
            const hash = await bankToken.transfer(depositor1, depositor2, 0);
            expect(hash).toHaveLength(66);
            expect(await bankToken.getBalanceOf(depositor1)).toEqual(1000);
            expect(await bankToken.getBalanceOf(depositor2)).toEqual(887);
        }, 40000);
    });
    describe("withdrawals", () => {
        beforeAll(async () => {
            try {
                let hash = await bankToken.deployContract(testContractOwner);
                hash = await bankToken.deposit(depositor1, 1000, '5555', '10501');
                hash = await bankToken.deposit(depositor2, 1000, '6666', '10601');
            }
            catch (err) {
                console.log(err.stack);
            }
        }, 60000);
        test("test suite setup was successful", async () => {
            expect.assertions(3);
            expect(await bankToken.getBalanceOf(depositor1)).toEqual(1000);
            expect(await bankToken.getBalanceOf(depositor2)).toEqual(1000);
            expect(await bankToken.getTotalSupply()).toEqual(2000);
        }, 20000);
        test("request withdraw when no tokens", async () => {
            expect.assertions(3);
            try {
                await bankToken.requestWithdrawal(depositor3, 100);
            }
            catch (err) {
                expect(err instanceof Error).toBeTruthy();
            }
            expect(await bankToken.getBalanceOf(depositor3)).toEqual(0);
            expect(await bankToken.getTotalSupply()).toEqual(2000);
        }, 30000);
        test("request withdraw too much", async () => {
            expect.assertions(3);
            try {
                await bankToken.requestWithdrawal(depositor1, 1001);
            }
            catch (err) {
                expect(err instanceof Error).toBeTruthy();
            }
            expect(await bankToken.getBalanceOf(depositor1)).toEqual(1000);
            expect(await bankToken.getTotalSupply()).toEqual(2000);
        }, 30000);
        test("request withdraw from first depositor", async () => {
            expect.assertions(3);
            const hash = await bankToken.requestWithdrawal(depositor1, 100);
            expect(hash).toHaveLength(66);
            expect(await bankToken.getBalanceOf(depositor1)).toEqual(900);
            expect(await bankToken.getTotalSupply()).toEqual(1900);
        }, 30000);
        test("event from request withdrawal", async () => {
            expect.assertions(4);
            const events = await bankToken.getEvents("RequestWithdrawal");
            expect(events).toHaveLength(1);
            expect(events[0].returnValues.withdrawalNumber).toEqual("1");
            expect(events[0].returnValues.fromAddress.toUpperCase()).toEqual(depositor1.toUpperCase());
            expect(events[0].returnValues.amount).toEqual("100");
        }, 40000);
        test("get token holder balances", async () => {
            expect.assertions(5);
            const tokenHolderBalances = await bankToken.getHolderBalances();
            const keys = Object.keys(tokenHolderBalances);
            expect(keys).toHaveLength(2);
            expect(keys[0].toUpperCase()).toEqual(depositor1.toUpperCase());
            expect(tokenHolderBalances[keys[0]]).toEqual(900);
            expect(keys[1].toUpperCase()).toEqual(depositor2.toUpperCase());
            expect(tokenHolderBalances[keys[1]]).toEqual(1000);
        }, 30000);
        test("transfer and then withdraw", async () => {
            expect.assertions(7);
            // need a deposit before a transfer can be done to a new token holder
            const depositHash = await bankToken.deposit(depositor3, 0, '6666', '10502');
            expect(depositHash).toHaveLength(66);
            const transferHash = await bankToken.transfer(depositor1, depositor3, 99);
            expect(transferHash).toHaveLength(66);
            const withdrawalHash = await bankToken.requestWithdrawal(depositor1, 100);
            expect(withdrawalHash).toHaveLength(66);
            expect(await bankToken.getBalanceOf(depositor1)).toEqual(701);
            expect(await bankToken.getBalanceOf(depositor2)).toEqual(1000);
            expect(await bankToken.getBalanceOf(depositor3)).toEqual(99);
            expect(await bankToken.getTotalSupply()).toEqual(1800);
        }, 60000);
        test("get token holder balances after transfer and withdrawal", async () => {
            expect.assertions(7);
            const tokenHolderBalances = await bankToken.getHolderBalances();
            const keys = Object.keys(tokenHolderBalances);
            expect(keys).toHaveLength(3);
            expect(keys[0].toUpperCase()).toEqual(depositor1.toUpperCase());
            expect(tokenHolderBalances[keys[0]]).toEqual(701);
            expect(keys[1].toUpperCase()).toEqual(depositor2.toUpperCase());
            expect(tokenHolderBalances[keys[1]]).toEqual(1000);
            expect(keys[2].toUpperCase()).toEqual(depositor3.toUpperCase());
            expect(tokenHolderBalances[keys[2]]).toEqual(99);
        }, 20000);
    });
});
//# sourceMappingURL=restrictedBankToken.test.js.map