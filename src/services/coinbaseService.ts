import { CoinbaseWalletSDK } from '@coinbase/wallet-sdk';
import { farcasterService } from './farcasterService';

let coinbaseProvider: any = null;

function getCoinbaseProvider() {
  if (!coinbaseProvider) {
    try {
      const sdk = new CoinbaseWalletSDK({
        appName: 'Th3vault',
        appLogoUrl: 'https://th3scr1b3.art/icon.png',
      });
      coinbaseProvider = sdk.makeWeb3Provider();
    } catch (err) {
      console.error('Failed to initialize Coinbase Wallet SDK:', err);
      throw new Error('Coinbase Wallet SDK is not available or failed to initialize.');
    }
  }
  return coinbaseProvider;
}

// The address that receives the crypto payments on Base
export const VAULT_COLLECTOR_ADDRESS = import.meta.env.VITE_VAULT_COLLECTOR_ADDRESS || '0x985606faaad78887df96002a3555ccf2c8640a08';
const BASE_USDC_CONTRACT = '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';

function isBaseNetwork(chainId: unknown): boolean {
  if (typeof chainId === 'number') return chainId === 8453;
  if (typeof chainId === 'string') {
    const clean = chainId.trim().toLowerCase();
    return clean === '0x2105' || clean === '8453' || clean === 'eip155:8453';
  }
  return false;
}

/**
 * Handle crypto payment via native Farcaster action, browser wallet, or Coinbase Wallet SDK on Base Mainnet.
 */
export async function payWithCrypto(amountUsd: number): Promise<string> {
  const isFarcaster = farcasterService.isFarcaster();

  // 1. In Farcaster, attempt the native Warpcast sendToken action first
  if (isFarcaster) {
    try {
      console.log(`[payWithCrypto] Attempting native Farcaster sendToken for $${amountUsd}...`);
      const usdcUnits = String(Math.floor(amountUsd * 1000000));
      const txHash = await farcasterService.sendToken({
        token: `eip155:8453/erc20:${BASE_USDC_CONTRACT}`,
        amount: usdcUnits,
        recipientAddress: VAULT_COLLECTOR_ADDRESS,
      });
      if (txHash) {
        console.log(`[payWithCrypto] Farcaster payment confirmed: ${txHash}`);
        return txHash;
      }
    } catch (fcErr: any) {
      if (fcErr.message === 'Payment cancelled by user' || fcErr.message === 'Transaction cancelled by user') {
        throw fcErr;
      }
      console.warn('[payWithCrypto] Farcaster sendToken fallback to EVM provider:', fcErr);
    }
  }

  // 2. Select EVM Provider: Farcaster embedded provider > window.ethereum > Coinbase Wallet SDK
  let prov: any = null;
  if (isFarcaster) {
    prov = await farcasterService.getEthereumProvider();
  }
  if (!prov && typeof window !== 'undefined' && (window as any).ethereum) {
    prov = (window as any).ethereum;
  }
  if (!prov) {
    prov = getCoinbaseProvider();
  }

  if (!prov) {
    throw new Error('No compatible Web3 wallet found. Please connect your wallet.');
  }

  // 3. Ensure wallet is on Base Mainnet (Chain ID 8453 / 0x2105)
  try {
    const currentChain = await prov.request({ method: 'eth_chainId' });
    if (!isBaseNetwork(currentChain)) {
      console.log('[payWithCrypto] Switching to Base Mainnet...');
      try {
        await prov.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: '0x2105' }],
        });
      } catch (switchError: any) {
        if (switchError.code === 4902) {
          try {
            await prov.request({
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
            if (!isFarcaster) {
              throw new Error('Please add the Base network to your wallet to proceed.');
            }
          }
        } else if (isFarcaster) {
          // Warpcast does not implement wallet_switchEthereumChain RPC
          console.warn('[payWithCrypto] In Farcaster, chain switch RPC unsupported; routing via tx chainId:', switchError);
        } else {
          console.error('Failed to switch to Base network:', switchError);
          throw new Error('Please switch your wallet network to Base Mainnet to proceed.');
        }
      }
    }
  } catch (chainErr: any) {
    if (!isFarcaster) {
      throw chainErr;
    }
    console.warn('[payWithCrypto] Farcaster chain check bypassed:', chainErr);
  }

  // 4. Ensure we have the account
  const accounts = (await prov.request({ method: 'eth_requestAccounts' })) as string[];
  const from = accounts?.[0];
  if (!from) throw new Error('No account found in connected wallet.');

  // 5. Formulate Base USDC (6 decimals) transfer function data
  const recipient = VAULT_COLLECTOR_ADDRESS;
  const usdcAmount = BigInt(Math.floor(amountUsd * 1000000));

  const selector = '0xa9059cbb'; // transfer(address,uint256) selector
  const paddedAddress = recipient.replace(/^0x/, '').toLowerCase().padStart(64, '0');
  const paddedAmount = usdcAmount.toString(16).padStart(64, '0');
  const txData = selector + paddedAddress + paddedAmount;

  console.log(`[payWithCrypto] Initiating USDC payment for $${amountUsd} to ${recipient} from ${from}`);

  // 6. Send Transaction with explicit chainId
  const txHash = (await prov.request({
    method: 'eth_sendTransaction',
    params: [
      {
        from,
        to: BASE_USDC_CONTRACT,
        value: '0x0',
        data: txData,
        chainId: '0x2105',
      },
    ],
  })) as string;

  if (!txHash) throw new Error('Transaction rejected or failed');

  console.log(`[payWithCrypto] Transaction sent: ${txHash}`);
  return txHash;
}
