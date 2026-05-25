import { CoinbaseWalletSDK } from '@coinbase/wallet-sdk';

const sdk = new CoinbaseWalletSDK({
  appName: 'Th3vault',
  appLogoUrl: 'https://th3scr1b3.art/icon.png',
});

// v4 uses makeWeb3Provider() — getProvider() was removed in SDK v4
const provider = sdk.makeWeb3Provider();

// The address that receives the crypto payments on Base
export const VAULT_COLLECTOR_ADDRESS = import.meta.env.VITE_VAULT_COLLECTOR_ADDRESS || 'th3scr1b3.eth';

/**
 * Handle crypto payment via Coinbase Wallet SDK on Base Mainnet.
 */
export async function payWithCrypto(amountUsd: number) {
  // 1. Ensure we have the account
  const accounts = await provider.request({ method: 'eth_requestAccounts' }) as string[];
  const from = accounts[0];
  if (!from) throw new Error('No account found');

  // 2. Fetch current ETH price for conversion (using a public API or a conservative fixed rate for demo)
  // For production, consider using USDC or a real price oracle.
  // Here we use a placeholder rate: 1 ETH = $3000 USD
  const ethPrice = 3000; 
  const ethAmount = amountUsd / ethPrice;
  const weiAmount = '0x' + BigInt(Math.floor(ethAmount * 1e18)).toString(16);

  console.log(`[Coinbase] Initiating payment for $${amountUsd} (${ethAmount.toFixed(6)} ETH)`);

  // 3. Send Transaction
  const txHash = await provider.request({
    method: 'eth_sendTransaction',
    params: [{
      from,
      to: VAULT_COLLECTOR_ADDRESS,
      value: weiAmount,
      data: '0x', // Optional: could include pack metadata
    }]
  }) as string;

  if (!txHash) throw new Error('Transaction rejected or failed');

  console.log(`[Coinbase] Transaction sent: ${txHash}`);
  return txHash;
}
