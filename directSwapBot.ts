import { ethers } from 'ethers';
import { Currency, Token } from '@uniswap/sdk-core';
import { PoolKey } from '@uniswap/v4-sdk';
import { TOKEN_INFO, getTokenInfoByAddress, POOL_CONFIGS, PoolConfig } from './sharedConfig';

// --- CONFIG ---
const RPC_URL = 'https://base-sepolia.drpc.org';
const CHAIN_ID = 84532; // Base Sepolia Chain ID
const WALLET_PRIVATE_KEY = ''; // Hardcoded for immediate testing
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

// --- NEW CONFIG FOR DIRECT SWAPS (Contract Addresses) ---
const POOL_SWAP_TEST_ADDRESS = '0x8b5bcc363dde2614281ad875bad385e0a785d3b9'; // POOL_SWAP_TEST_ROUTER_BASE_SEPOLIA
const POOL_MANAGER_ADDRESS = '0x5FbDB2315678afecb367f032d93F642f64180aa3'; // POOL_MANAGER_BASE_SEPOLIA
const STATE_VIEW_ADDRESS = '0x571291b572ed32ce6751a2cb2486ebee8defb9b4';

// Correct, more detailed ABI based on user-provided structure
const SWAP_TEST_ABI = [
  'function swap((address currency0, address currency1, uint24 fee, int24 tickSpacing, address hooks) key, (bool zeroForOne, int256 amountSpecified, uint160 sqrtPriceLimitX96) params, (bool takeClaims, bool settleUsingBurn) testSettings, bytes hookData) external payable returns (int256 amount0, int256 amount1)'
];

async function executeDirectSwap(
  provider: ethers.providers.JsonRpcProvider,
  wallet: ethers.Wallet,
  poolConfig: PoolConfig, // Pass the entire pool config
  amountSpecified: ethers.BigNumber, // Use BigNumber for amountSpecified
  sqrtPriceLimitX96: ethers.BigNumber, // Directly pass the calculated limit
  zeroForOne: boolean // NEW PARAMETER
) {
  let inputTokenSymbol: string;
  let outputTokenSymbol: string;

  // Determine input and output token symbols based on zeroForOne flag
  if (zeroForOne) {
    inputTokenSymbol = poolConfig.token0;
    outputTokenSymbol = poolConfig.token1;
  } else {
    inputTokenSymbol = poolConfig.token1;
    outputTokenSymbol = poolConfig.token0;
  }

  const inputTokenAddress = TOKEN_INFO[inputTokenSymbol].address;
  const outputTokenAddress = TOKEN_INFO[outputTokenSymbol].address;

  const inputTokenInfo = getTokenInfoByAddress(inputTokenAddress);
  const outputTokenInfo = getTokenInfoByAddress(outputTokenAddress);

  if (!inputTokenInfo || !outputTokenInfo) {
    throw new Error(`Could not find token info for input: ${inputTokenAddress} or output: ${outputTokenAddress}`);
  }

  // The 'zeroForOne' parameter is now explicitly passed in.
  // const zeroForOne = poolConfig.token0 === inputTokenInfo.symbol; // REMOVE OR COMMENT THIS LINE

  const tokenA = new Token(
    CHAIN_ID,
    TOKEN_INFO[poolConfig.token0].address,
    TOKEN_INFO[poolConfig.token0].decimals,
    poolConfig.token0,
    poolConfig.token0.toUpperCase()
  );
  const tokenB = new Token(
    CHAIN_ID,
    TOKEN_INFO[poolConfig.token1].address,
    TOKEN_INFO[poolConfig.token1].decimals,
    poolConfig.token1,
    poolConfig.token1.toUpperCase()
  );

  const [currency0, currency1] = tokenA.sortsBefore(tokenB) ? [tokenA, tokenB] : [tokenB, tokenA];

  const poolKey = {
    currency0: currency0.address,
    currency1: currency1.address,
    fee: poolConfig.fee,
    tickSpacing: poolConfig.tickSpacing,
    hooks: poolConfig.hooks,
  };

  const computedPoolId = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ['address', 'address', 'uint24', 'int24', 'address'],
      [currency0.address, currency1.address, poolConfig.fee, poolConfig.tickSpacing, poolConfig.hooks]
    )
  );
  console.log(`Computed poolId from PoolKey: ${computedPoolId}`);

  const hookData = '0x';
  const testSettings = { takeClaims: false, settleUsingBurn: false };

  console.log(`Using sqrtPriceLimitX96: ${sqrtPriceLimitX96.toString()}`);

  const inputToken = new ethers.Contract(inputTokenAddress, ['function balanceOf(address) view returns (uint256)', 'function approve(address, uint256)'], wallet);
  const balance = await inputToken.balanceOf(wallet.address);
  console.log(`Wallet balance of ${inputTokenInfo.symbol}: ${ethers.utils.formatUnits(balance, inputTokenInfo.decimals)}`);

  const swapTest = new ethers.Contract(POOL_SWAP_TEST_ADDRESS, SWAP_TEST_ABI, wallet);

  const absAmount = amountSpecified.abs();
  console.log(`Approving ${ethers.utils.formatUnits(absAmount, inputTokenInfo.decimals)} of ${inputTokenInfo.symbol} (${inputTokenAddress}) to PoolSwapTest...`);
  await inputToken.approve(POOL_SWAP_TEST_ADDRESS, ethers.constants.MaxUint256);
  console.log('Approval successful.');

  const params = {
    zeroForOne,
    amountSpecified,
    sqrtPriceLimitX96
  };

  console.log(`Swap params: ${JSON.stringify({
    key: poolKey,
    params: {
      zeroForOne,
      amountSpecified: amountSpecified.toString(),
      sqrtPriceLimitX96: sqrtPriceLimitX96.toString()
    },
    testSettings,
    hookData,
  }, null, 2)}`);

  // Manually encode the swap transaction data for detailed logging
  const iface = new ethers.utils.Interface(SWAP_TEST_ABI);
  const encodedData = iface.encodeFunctionData("swap", [
    poolKey,
    params,
    testSettings,
    hookData,
  ]);

  console.log(`
Function: swap(tuple key,tuple params,tuple testSettings,bytes hookData)

MethodID: ${encodedData.substring(0, 10)}`);
  for (let i = 10; i < encodedData.length; i += 64) {
    console.log(`[${(i - 10) / 64}]:  ${encodedData.substring(i, i + 64)}`);
  }

  console.log('Executing swap directly (simulation disabled)...');
  
  console.log('Executing swap with gas override...');
  const tx = await swapTest.swap(poolKey, params, testSettings, hookData, {
    gasLimit: 500000
  });
  const receipt = await tx.wait();
  console.log('Swap executed. Transaction hash:', receipt.transactionHash);
}

async function main() {
  const provider = new ethers.providers.JsonRpcProvider(RPC_URL);
  const wallet = new ethers.Wallet(WALLET_PRIVATE_KEY, provider);

  console.log('Starting direct swap bot...');

  const targetPoolConfig = POOL_CONFIGS.find(pool => pool.name === 'aBTC/aETH');

  if (!targetPoolConfig) {
    console.error('Error: Target pool configuration not found.');
    process.exit(1);
  }

  const stateView = new ethers.Contract(STATE_VIEW_ADDRESS, STATE_VIEW_ABI, provider);

  const tokenA = new Token(
    CHAIN_ID,
    TOKEN_INFO[targetPoolConfig.token0].address,
    TOKEN_INFO[targetPoolConfig.token0].decimals
  );
  const tokenB = new Token(
    CHAIN_ID,
    TOKEN_INFO[targetPoolConfig.token1].address,
    TOKEN_INFO[targetPoolConfig.token1].decimals
  );
  const [currency0, currency1] = tokenA.sortsBefore(tokenB) ? [tokenA, tokenB] : [tokenB, tokenA];

  const poolKeyForSlot0 = {
    currency0: currency0.address,
    currency1: currency1.address,
    fee: targetPoolConfig.fee,
    tickSpacing: targetPoolConfig.tickSpacing,
    hooks: targetPoolConfig.hooks,
  };

  const poolIdForSlot0 = ethers.utils.keccak256(
    ethers.utils.defaultAbiCoder.encode(
      ['address', 'address', 'uint24', 'int24', 'address'],
      [poolKeyForSlot0.currency0, poolKeyForSlot0.currency1, poolKeyForSlot0.fee, poolKeyForSlot0.tickSpacing, poolKeyForSlot0.hooks]
    )
  );

  console.log(`Fetching slot0 for poolId: ${poolIdForSlot0}`);
  const { sqrtPriceX96: currentSqrtPriceX96 } = await stateView.getSlot0(poolIdForSlot0);
  console.log(`Current sqrtPriceX96: ${currentSqrtPriceX96.toString()}`);

  // Since Pool Price > Market Price, we sell the overvalued asset (BTC) for the undervalued one (ETH)
  const amountToSwap = ethers.BigNumber.from('-' + ethers.utils.parseUnits('1', TOKEN_INFO.btc.decimals).toString()); // Sell 1 BTC
  const marketSqrtPriceX96 = ethers.BigNumber.from('46865067822634247380986681253429248'); // Market price is the limit

  console.log(`Using marketSqrtPriceLimitX96: ${marketSqrtPriceX96.toString()}`);
  
  await executeDirectSwap(
    provider,
    wallet,
    targetPoolConfig,
    amountToSwap,
    marketSqrtPriceX96,
    true // zeroForOne is true (selling token0 'btc' for token1 'eth')
  );

  console.log('Direct swap bot finished.');
}

main().catch(console.error);