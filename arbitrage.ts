import { ethers } from 'ethers';
import fetch from 'node-fetch';

interface TokenInfo {
  address: string;
  decimals: number;
}

interface Pool {
  name: string;
  poolId: string;
  token0: string;
  token1: string;
}

interface CoinGeckoPriceData {
  bitcoin: { usd: number };
  ethereum: { usd: number };
  'usd-coin': { usd: number };
  tether: { usd: number };
}

interface Prices {
  btc: number;
  eth: number;
  native_eth: number;
  usdc: number;
  usdt: number;
  [key: string]: number; // Allows indexing with string keys
}

// --- CONFIG ---
const RPC_URL = 'https://base-sepolia.drpc.org';
const STATE_VIEW_ADDRESS = '0x571291b572ed32ce6751a2cb2486ebee8defb9b4';
const STATE_VIEW_ABI = [
  {
    "inputs": [{ "name": "poolId", "type": "bytes32" }],
    "name": "getSlot0",
    "outputs": [
      { "name": "sqrtPriceX96", "type": "uint160" },
      { "name": "tick", "type": "int24" },
      { "name": "protocolFee", "type": "uint24" },
      { "name": "lpFee", "type": "uint24" }
    ],
    "stateMutability": "view",
    "type": "function"
  }
];

const TOKEN_INFO: Record<string, TokenInfo> = {
  usdc: { address: '0x24429b8f2C8ebA374Dd75C0a72BCf4dF4C545BeD', decimals: 6 },
  usdt: { address: '0x9F785fEb65DBd0170bd6Ca1A045EEda44ae9b4dC', decimals: 6 },
  eth: { address: '0xE7711aa6557A69592520Bbe7D704D64438f160e7', decimals: 18 },
  btc: { address: '0x9d5F910c91E69ADDDB06919825305eFEa5c9c604', decimals: 8 },
  native_eth: { address: '0x0000000000000000000000000000000000000000', decimals: 18 }
};

const pools: Pool[] = [
  { name: 'aUSDC/aUSDT', poolId: '0xfaa0e80397dda369eb68f6f67c9cd4d4884841f1417078e20844addc11170127', token0: 'usdc', token1: 'usdt' },
  { name: 'aUSDT/aETH', poolId: '0x4e1b037b56e13bea1dfe20e8f592b95732cc52b5b10777b9f9bea856c145e7c7', token0: 'usdt', token1: 'eth' },
  { name: 'aBTC/aETH', poolId: '0xe9b5f2692da366148c42074373f37d00f368edcae46bcf7e39dd1aab5207d7c2', token0: 'btc', token1: 'eth' },
  { name: 'aUSDC/aBTC', poolId: '0x8392f09ccc3c387d027d189f13a1f1f2e9d73f34011191a3d58157b9b2bf8bdd', token0: 'usdc', token1: 'btc' },
  { name: 'ETH/aUSDT', poolId: '0xe6a2c6909de49149dced232f472247979fdc098cd2de74b0923e3cefb5602c15', token0: 'native_eth', token1: 'usdt' }
];

async function getPrices(): Promise<Prices> {
  const res = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=bitcoin,ethereum,usd-coin,tether&vs_currencies=usd');
  const data = await res.json() as CoinGeckoPriceData;
  return {
    btc: data.bitcoin.usd,
    eth: data.ethereum.usd,
    native_eth: data.ethereum.usd,
    usdc: data['usd-coin'].usd,
    usdt: data.tether.usd
  };
}

// We will use native BigInt for calculations
function sqrtPriceX96FromPrice(price: number, decimals0: number, decimals1: number): bigint {
  // Adjust for decimals: price * (10^dec1 / 10^dec0)
  const adjusted = price * (10 ** decimals1 / 10 ** decimals0);
  const sqrt = Math.sqrt(adjusted);
  // sqrtPriceX96 = sqrt(adjusted) * 2^96
  return BigInt(Math.floor(sqrt * (2 ** 96))); // Using BigInt
}

async function main() {
  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  const stateView = new ethers.Contract(STATE_VIEW_ADDRESS, STATE_VIEW_ABI, provider);
  const prices = await getPrices();
  console.log(`Market: BTC=$${prices.btc} | ETH=$${prices.eth} | USDC=$${prices.usdc} | USDT=$${prices.usdt}`);

  for (const pool of pools) {
    const { name, poolId, token0, token1 } = pool;
    // ethers v6 returns bigint from contract calls for uint160
    const slot0 = await stateView.getSlot0(poolId);
    const poolSqrtX96: bigint = slot0.sqrtPriceX96;
    
    // Step 1: Get raw market price ratio (token0/token1)
    const marketPriceRatio = prices[token0] / prices[token1];
    // Step 2: Convert to sqrtPriceX96 (with decimal adjustment)
    const marketSqrtX96: bigint = sqrtPriceX96FromPrice(marketPriceRatio, TOKEN_INFO[token0].decimals, TOKEN_INFO[token1].decimals);
    
    // Step 3: Calculate deviation
    let deviation: string;
    if (marketSqrtX96 === BigInt(0)) {
        deviation = 'NaN';
    } else {
        // Perform all arithmetic operations using Number after converting BigInts
        const diff = Number(poolSqrtX96) - Number(marketSqrtX96);
        deviation = ((diff / Number(marketSqrtX96)) * 100).toFixed(1);
    }
    
    console.log(`${name}: Pool_sqrtX96 ${poolSqrtX96} | Market_sqrtX96 ${marketSqrtX96} | Dev ${deviation}%`);
  }
}

main().catch(console.error);