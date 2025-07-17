import { ethers } from 'ethers';
import { getTokenInfoByAddress } from './sharedConfig'; // Import shared config

// --- CONFIG ---
const RPC_URL = 'https://base-sepolia.drpc.org';

const provider = new ethers.providers.JsonRpcProvider(RPC_URL);

// Interface for decoding the Swap event, using the correct signature from BaseScan
const pmInterface = new ethers.utils.Interface([
    'event Swap(bytes32 indexed id, address indexed sender, int128 amount0, int128 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick, uint24 fee)'
]);

// Interface for decoding the Transfer event, to find token addresses
const erc20Interface = new ethers.utils.Interface([
    'event Transfer(address indexed from, address indexed to, uint256 value)'
]);

interface SwapInfo {
    from: { address: string; amount: string; symbol?: string; };
    to: { address: string; amount: string; symbol?: string; };
}

/**
 * Gets the swap volume from a transaction hash and formats it with token details.
 * @param txHash The hash of the transaction to inspect.
 * @returns A promise that resolves to an object containing formatted swap amounts and token symbols, or null if no matching event is found.
 */
export async function getSwapVolumeFromTx(txHash:string): Promise<SwapInfo | null> {
    const receipt = await provider.getTransactionReceipt(txHash);
    if (!receipt) {
        console.error(`Transaction receipt not found for hash: ${txHash}`);
        return null;
    }

    const swapTopic = pmInterface.getEventTopic('Swap');
    const transferTopic = erc20Interface.getEventTopic('Transfer');
    let swapLog = null;
    const transferLogs = [];

    for (const log of receipt.logs) {
        if (log.topics[0] === swapTopic) {
            swapLog = log;
        } else if (log.topics[0] === transferTopic) {
            transferLogs.push(log);
        }
    }

    if (!swapLog) {
        console.error('No matching Swap event found in the transaction logs.');
        return null;
    }

    try {
        const txSender = receipt.from;
        let fromToken, toToken;

        for (const log of transferLogs) {
            const decodedTransfer = erc20Interface.decodeEventLog('Transfer', log.data, log.topics);
            const tokenAddress = log.address;
            const tokenInfo = getTokenInfoByAddress(tokenAddress);
            const amount = ethers.utils.formatUnits(decodedTransfer.value, tokenInfo?.decimals);

            if (decodedTransfer.from.toLowerCase() === txSender.toLowerCase()) {
                fromToken = {
                    address: tokenAddress,
                    amount: amount,
                    symbol: tokenInfo?.symbol.toUpperCase()
                };
            } else if (decodedTransfer.to.toLowerCase() === txSender.toLowerCase()) {
                toToken = {
                    address: tokenAddress,
                    amount: amount,
                    symbol: tokenInfo?.symbol.toUpperCase()
                };
            }
        }

        if (!fromToken || !toToken) {
            console.error('Could not determine from/to tokens from Transfer events.');
            return null;
        }

        return { from: fromToken, to: toToken };

    } catch (e) {
        console.error("Error decoding logs:", e);
        return null;
    }
}

async function main() {
    const txHash = process.argv[2];
    if (!txHash) {
        console.error("Please provide a transaction hash as a command-line argument.");
        console.log("Usage: node dist/trackVolume.js <TX_HASH>");
        process.exit(1);
    }

    console.log(`Tracking volume for transaction: ${txHash}`);
    const volume = await getSwapVolumeFromTx(txHash);

    if (volume) {
        console.log('Swap Found:');
        console.log(`  From: ${volume.from.amount} ${volume.from.symbol} (${volume.from.address})`);
        console.log(`  To:   ${volume.to.amount} ${volume.to.symbol} (${volume.to.address})`);
    }
}

// Make the script runnable from the command line
main().catch(console.error); 