import {Wallet} from 'ethers';
import * as VError from 'verror';
import * as logger from 'config-logger';

import {Transaction, TransactionReceipt} from "./index.d";

export default class EthSigner
{
    async signTransaction(tx: Transaction): Promise<TransactionReceipt>
    {
        const privateKey = await this.getPrivateKey(tx.from);

        const wallet = new Wallet(privateKey);
        logger.debug(`created wallet from private key for address ${wallet.address}`);

        //TODO check wallet address matches transaction from address

        const signedTx = wallet.sign(tx);

        logger.debug(`Signed transaction for ${JSON.stringify(tx)} was:\n${signedTx}`);

        return signedTx;
    }

    getPrivateKey(fromAddress: string): Promise<string>
    {
        return new Promise<string>(async(resolve, reject) =>
        {
            if (fromAddress == '0xF55583FF8461DB9dfbBe90b5F3324f2A290c3356') {
                resolve('0xfa643e0ded9fd96209545b6cc9230376627012d8fb01cfa8d338b8a3aa4aeaaf');
            }
            else if(fromAddress == '0x8Ae386892b59bD2A7546a9468E8e847D61955991') {
                resolve('0x26a1887e3a3ee4e632394256f4da44a2d364db682398fc2c3f8176ef2dacebda');
            }
            else if(fromAddress == '0x0013a861865d784d97c57e70814b13ba94713d4e') {
                resolve('0x146b37e6a2eb2b3593bd5d5da7c71232fc9548a150cd2507d322f8e0c0cdd2f5');
            }
            else if(fromAddress == '0xD9D72D466637e8408BB3B17d3ff6DB02e8BeBf27') {
                resolve('0x25f77bc6483be54b2efc748c511f3955534b4366563bfef7e8e4c8382a7ccd29');
            }
            else {
                const error = new VError(`could not get private key for address ${fromAddress}`);
                reject(error);
            }
        });
    }
}