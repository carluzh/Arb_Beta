import { Token } from '@uniswap/sdk-core';
import { DYNAMIC_FEE_FLAG } from '@uniswap/v4-sdk';

export interface TokenInfo {
  address: string;
  decimals: number;
}

export const TOKEN_INFO: Record<string, TokenInfo> = {
  usdc: { address: '0x24429b8f2C8ebA374Dd75C0a72BCf4dF4C545BeD', decimals: 6 }, // TOKEN0_BASE_SEPOLIA
  usdt: { address: '0x9F785fEb65DBd0170bd6Ca1A045EEda44ae9b4dC', decimals: 6 }, // TOKEN1_BASE_SEPOLIA
  eth: { address: '0xE7711aa6557A69592520Bbe7D704D64438f160e7', decimals: 18 }, // TOKEN2_BASE_SEPOLIA
  btc: { address: '0x9d5F910c91E69ADDDB06919825305eFEa5c9c604', decimals: 8 }, // TOKEN3_BASE_SEPOLIA
  native_eth: { address: '0x0000000000000000000000000000000000000000', decimals: 18 } // ETH_ADDRESS_BASE_SEPOLIA
};

// Helper to find token info by address
export function getTokenInfoByAddress(address: string): { symbol: string, decimals: number, name: string } | undefined {
  for (const [symbol, info] of Object.entries(TOKEN_INFO)) {
    if (info.address.toLowerCase() === address.toLowerCase()) {
      return { symbol: symbol, decimals: info.decimals, name: symbol.toUpperCase() };
    }
  }
  return undefined;
}

export interface PoolConfig {
  name: string;
  token0: string; // Symbol from TOKEN_INFO
  token1: string; // Symbol from TOKEN_INFO
  fee: number;
  tickSpacing: number;
  hooks: string;
}

export const POOL_CONFIGS: PoolConfig[] = [
  // Corrected aUSDC/aUSDT pool config based on user's feedback
  { name: 'aUSDC/aUSDT', token0: 'usdc', token1: 'usdt', fee: DYNAMIC_FEE_FLAG, tickSpacing: 1, hooks: '0xd450f7f8e4C11EE8620a349f73e7aC3905Dfd000' },
  { name: 'aUSDT/aETH', token0: 'usdt', token1: 'eth', fee: DYNAMIC_FEE_FLAG, tickSpacing: 100, hooks: '0xd450f7f8e4C11EE8620a349f73e7aC3905Dfd000' },
  { name: 'aBTC/aETH', token0: 'btc', token1: 'eth', fee: DYNAMIC_FEE_FLAG, tickSpacing: 60, hooks: '0xd450f7f8e4C11EE8620a349f73e7aC3905Dfd000' },
  { name: 'aUSDC/aBTC', token0: 'usdc', token1: 'btc', fee: DYNAMIC_FEE_FLAG, tickSpacing: 80, hooks: '0xd450f7f8e4C11EE8620a349f73e7aC3905Dfd000' },
  { name: 'ETH/aUSDT', token0: 'native_eth', token1: 'usdt', fee: DYNAMIC_FEE_FLAG, tickSpacing: 45, hooks: '0xd450f7f8e4C11EE8620a349f73e7aC3905Dfd000' }
]; 