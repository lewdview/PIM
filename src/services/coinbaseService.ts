import { CoinbaseWalletSDK } from '@coinbase/wallet-sdk';

const sdk = new CoinbaseWalletSDK({
  appName: 'Th3vault',
  appLogoUrl: 'https://th3scr1b3.art/icon.png',
});

// v4 uses makeWeb3Provider() — getProvider() was removed in SDK v4
const provider = sdk.makeWeb3Provider();

// The address that receives the crypto payments on Base
export const VAULT_COLLECTOR_ADDRESS = import.meta.env.VITE_VAULT_COLLECTOR_ADDRESS || '0x985606faaad78887df96002a3555ccf2c8640a08';

/**
 * Handle crypto payment via Coinbase Wallet SDK on Base Mainnet.
 */
export async function payWithCrypto(amountUsd: number) {
  // 1. Ensure wallet is on Base Mainnet (Chain ID 8453 / 0x2105)
  try {
    await provider.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: '0x2105' }],
    });
  } catch (switchError: any) {
    // This error code indicates that the chain has not been added to the wallet.
    if (switchError.code === 4902) {
      try {
        await provider.request({
          method: 'wallet_addEthereumChain',
          params: [
            {
              chainId: '0x2105',
              chainName: 'Base Mainnet',
              nativeCurrency: {
                name: 'Ether',
                symbol: 'ETH',
                decimals: 18,
              },
              rpcUrls: ['https://mainnet.base.org'],
              blockExplorerUrls: ['https://basescan.org'],
            },
          ],
        });
      } catch (addError) {
        console.error('Failed to add Base network:', addError);
        throw new Error('Please add the Base network to your wallet to proceed.');
      }
    } else {
      console.error('Failed to switch to Base network:', switchError);
      throw new Error('Please switch your wallet network to Base Mainnet to proceed.');
    }
  }

  // 2. Ensure we have the account
  const accounts = await provider.request({ method: 'eth_requestAccounts' }) as string[];
  const from = accounts[0];
  if (!from) throw new Error('No account found');

  // 3. Formulate Base USDC (6 decimals) transfer function data
  const usdcAddress = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
  const recipient = VAULT_COLLECTOR_ADDRESS;
  const usdcAmount = BigInt(Math.floor(amountUsd * 1000000));

  const selector = '0xa9059cbb'; // transfer(address,uint256) selector
  const paddedAddress = recipient.replace(/^0x/, '').toLowerCase().padStart(64, '0');
  const paddedAmount = usdcAmount.toString(16).padStart(64, '0');
  const txData = selector + paddedAddress + paddedAmount;

  console.log(`[Coinbase] Initiating USDC payment for $${amountUsd} to ${recipient}`);

  // 4. Send Transaction
  const txHash = await provider.request({
    method: 'eth_sendTransaction',
    params: [{
      from,
      to: usdcAddress,
      value: '0x0',
      data: txData,
    }]
  }) as string;

  if (!txHash) throw new Error('Transaction rejected or failed');

  console.log(`[Coinbase] Transaction sent: ${txHash}`);
  return txHash;
}
