# Test Pool Arbitrage

This project provides a TypeScript script to inspect Uniswap V4 pool `sqrtPriceX96` values and compare them against market prices fetched from CoinGecko. It helps in identifying potential discrepancies between on-chain liquidity pool prices and off-chain market rates.

## Setup Instructions

1.  **Node.js and npm:** Ensure you have Node.js (which includes npm) installed. You can download it from [nodejs.org](https://nodejs.org/).

2.  **Install Dependencies:** Navigate to the project directory in your terminal and install the required npm packages. This command will read `package.json` and install all necessary dependencies:

    ```bash
    npm install
    ```

## How to Run `arbitrage.ts`

To run the script, use the defined npm scripts:

1.  **Compile TypeScript:**

    ```bash
    npm run build
    ```

    This command compiles `arbitrage.ts` and outputs `arbitrage.js` into the `dist/` directory.

2.  **Execute the Script:**

    ```bash
    npm start
    ```

    This will run the compiled JavaScript file, fetch the latest prices and pool data, and print the comparison and deviations to your console.

Alternatively, for development and quick testing without a full build:

```bash
npm run dev
```

This command uses `ts-node` to directly execute the TypeScript file. 