import { ethers } from 'ethers';
import { prisma } from '../db/prisma';

export interface ExternalWalletConnection {
  address: string;
  chainId: number;
  isConnected: boolean;
  walletType: 'metamask' | 'walletconnect' | 'coinbase' | 'other';
}

export interface WalletConnectionResult {
  success: boolean;
  address?: string;
  chainId?: number;
  error?: string;
}

/**
 * Check if MetaMask is available
 */
export function isMetaMaskAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  return !!(window as any).ethereum?.isMetaMask;
}

/**
 * Connect to MetaMask wallet
 */
export async function connectMetaMask(): Promise<WalletConnectionResult> {
  try {
    if (!isMetaMaskAvailable()) {
      return {
        success: false,
        error: 'MetaMask is not installed'
      };
    }

    const ethereum = (window as any).ethereum;
    
    // Request account access
    const accounts = await ethereum.request({
      method: 'eth_requestAccounts'
    });

    if (!accounts || accounts.length === 0) {
      return {
        success: false,
        error: 'No accounts found'
      };
    }

    // Get chain ID
    const chainId = await ethereum.request({
      method: 'eth_chainId'
    });

    return {
      success: true,
      address: accounts[0],
      chainId: parseInt(chainId, 16)
    };
  } catch (error: any) {
    console.error('Error connecting to MetaMask:', error);
    
    // Handle specific MetaMask errors
    if (error.code === 4001) {
      return {
        success: false,
        error: 'User rejected the connection request'
      };
    }
    
    return {
      success: false,
      error: error.message || 'Failed to connect to MetaMask'
    };
  }
}

/**
 * Switch to Morph L2 network in MetaMask
 */
export async function switchToMorphNetwork(): Promise<WalletConnectionResult> {
  try {
    if (!isMetaMaskAvailable()) {
      return {
        success: false,
        error: 'MetaMask is not installed'
      };
    }

    const ethereum = (window as any).ethereum;
    const morphChainId = process.env.NEXT_PUBLIC_MORPH_CHAIN_ID || '0x8b6'; // 2230 in hex

    try {
      // Try to switch to Morph network
      await ethereum.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: morphChainId }]
      });

      return {
        success: true,
        chainId: parseInt(morphChainId, 16)
      };
    } catch (switchError: any) {
      // If network doesn't exist, add it
      if (switchError.code === 4902) {
        return await addMorphNetwork();
      }
      throw switchError;
    }
  } catch (error: any) {
    console.error('Error switching to Morph network:', error);
    return {
      success: false,
      error: error.message || 'Failed to switch network'
    };
  }
}

/**
 * Add Morph L2 network to MetaMask
 */
export async function addMorphNetwork(): Promise<WalletConnectionResult> {
  try {
    if (!isMetaMaskAvailable()) {
      return {
        success: false,
        error: 'MetaMask is not installed'
      };
    }

    const ethereum = (window as any).ethereum;
    const morphChainId = process.env.NEXT_PUBLIC_MORPH_CHAIN_ID || '0x8b6';

    await ethereum.request({
      method: 'wallet_addEthereumChain',
      params: [{
        chainId: morphChainId,
        chainName: 'Morph Holesky',
        nativeCurrency: {
          name: 'Ether',
          symbol: 'ETH',
          decimals: 18
        },
        rpcUrls: [
          process.env.NEXT_PUBLIC_MORPH_RPC_URL || 'https://rpc-quicknode-holesky.morphl2.io'
        ],
        blockExplorerUrls: [
          process.env.NEXT_PUBLIC_MORPH_EXPLORER_URL || 'https://explorer-holesky.morphl2.io'
        ]
      }]
    });

    return {
      success: true,
      chainId: parseInt(morphChainId, 16)
    };
  } catch (error: any) {
    console.error('Error adding Morph network:', error);
    return {
      success: false,
      error: error.message || 'Failed to add Morph network'
    };
  }
}

/**
 * Get current wallet connection status
 */
export async function getWalletConnectionStatus(): Promise<ExternalWalletConnection | null> {
  try {
    if (!isMetaMaskAvailable()) {
      return null;
    }

    const ethereum = (window as any).ethereum;
    
    // Check if already connected
    const accounts = await ethereum.request({
      method: 'eth_accounts'
    });

    if (!accounts || accounts.length === 0) {
      return {
        address: '',
        chainId: 0,
        isConnected: false,
        walletType: 'metamask'
      };
    }

    // Get chain ID
    const chainId = await ethereum.request({
      method: 'eth_chainId'
    });

    return {
      address: accounts[0],
      chainId: parseInt(chainId, 16),
      isConnected: true,
      walletType: 'metamask'
    };
  } catch (error) {
    console.error('Error getting wallet connection status:', error);
    return null;
  }
}

/**
 * Sign message with external wallet
 */
export async function signMessageWithExternalWallet(
  message: string,
  address: string
): Promise<string | null> {
  try {
    if (!isMetaMaskAvailable()) {
      throw new Error('MetaMask is not available');
    }

    const ethereum = (window as any).ethereum;
    
    // Sign the message
    const signature = await ethereum.request({
      method: 'personal_sign',
      params: [message, address]
    });

    return signature;
  } catch (error) {
    console.error('Error signing message with external wallet:', error);
    return null;
  }
}

/**
 * Connect external wallet to user account
 */
export async function connectExternalWalletToAccount(
  userId: string,
  walletAddress: string,
  signature: string,
  message: string
): Promise<boolean> {
  try {
    // Verify the signature
    const recoveredAddress = ethers.verifyMessage(message, signature);
    
    if (recoveredAddress.toLowerCase() !== walletAddress.toLowerCase()) {
      throw new Error('Signature verification failed');
    }

    // Update user with external wallet address
    await prisma.user.update({
      where: { id: userId },
      data: {
        walletAddress: walletAddress,
        updatedAt: new Date()
      }
    });

    return true;
  } catch (error) {
    console.error('Error connecting external wallet to account:', error);
    return false;
  }
}

/**
 * Disconnect external wallet from account
 */
export async function disconnectExternalWallet(userId: string): Promise<boolean> {
  try {
    await prisma.user.update({
      where: { id: userId },
      data: {
        walletAddress: null,
        updatedAt: new Date()
      }
    });

    return true;
  } catch (error) {
    console.error('Error disconnecting external wallet:', error);
    return false;
  }
}

/**
 * Listen for wallet events (account changes, network changes)
 */
export function setupWalletEventListeners(
  onAccountsChanged: (accounts: string[]) => void,
  onChainChanged: (chainId: string) => void,
  onConnect: (connectInfo: { chainId: string }) => void,
  onDisconnect: (error: { code: number; message: string }) => void
): () => void {
  if (!isMetaMaskAvailable()) {
    return () => {};
  }

  const ethereum = (window as any).ethereum;

  // Set up event listeners
  ethereum.on('accountsChanged', onAccountsChanged);
  ethereum.on('chainChanged', onChainChanged);
  ethereum.on('connect', onConnect);
  ethereum.on('disconnect', onDisconnect);

  // Return cleanup function
  return () => {
    ethereum.removeListener('accountsChanged', onAccountsChanged);
    ethereum.removeListener('chainChanged', onChainChanged);
    ethereum.removeListener('connect', onConnect);
    ethereum.removeListener('disconnect', onDisconnect);
  };
}

/**
 * Request permission to access accounts
 */
export async function requestWalletPermissions(): Promise<boolean> {
  try {
    if (!isMetaMaskAvailable()) {
      return false;
    }

    const ethereum = (window as any).ethereum;
    
    const permissions = await ethereum.request({
      method: 'wallet_requestPermissions',
      params: [{ eth_accounts: {} }]
    });

    return permissions && permissions.length > 0;
  } catch (error) {
    console.error('Error requesting wallet permissions:', error);
    return false;
  }
}

/**
 * Get wallet permissions
 */
export async function getWalletPermissions(): Promise<any[]> {
  try {
    if (!isMetaMaskAvailable()) {
      return [];
    }

    const ethereum = (window as any).ethereum;
    
    const permissions = await ethereum.request({
      method: 'wallet_getPermissions'
    });

    return permissions || [];
  } catch (error) {
    console.error('Error getting wallet permissions:', error);
    return [];
  }
}

/**
 * Send transaction through external wallet
 */
export async function sendTransactionWithExternalWallet(
  transaction: {
    to: string;
    value?: string;
    data?: string;
    gas?: string;
    gasPrice?: string;
  }
): Promise<string | null> {
  try {
    if (!isMetaMaskAvailable()) {
      throw new Error('MetaMask is not available');
    }

    const ethereum = (window as any).ethereum;
    
    // Prepare transaction parameters
    const txParams = {
      to: transaction.to,
      value: transaction.value ? ethers.parseEther(transaction.value).toString(16) : '0x0',
      data: transaction.data || '0x',
      gas: transaction.gas ? `0x${parseInt(transaction.gas).toString(16)}` : undefined,
      gasPrice: transaction.gasPrice ? `0x${parseInt(transaction.gasPrice).toString(16)}` : undefined
    };

    // Send transaction
    const txHash = await ethereum.request({
      method: 'eth_sendTransaction',
      params: [txParams]
    });

    return txHash;
  } catch (error) {
    console.error('Error sending transaction with external wallet:', error);
    return null;
  }
}

/**
 * Check if current network is Morph L2
 */
export async function isOnMorphNetwork(): Promise<boolean> {
  try {
    const connection = await getWalletConnectionStatus();
    if (!connection) return false;

    const morphChainId = parseInt(process.env.NEXT_PUBLIC_MORPH_CHAIN_ID || '2230');
    return connection.chainId === morphChainId;
  } catch (error) {
    console.error('Error checking network:', error);
    return false;
  }
}

/**
 * Get network information
 */
export async function getNetworkInfo(): Promise<{
  chainId: number;
  chainName: string;
  isSupported: boolean;
} | null> {
  try {
    const connection = await getWalletConnectionStatus();
    if (!connection) return null;

    const morphChainId = parseInt(process.env.NEXT_PUBLIC_MORPH_CHAIN_ID || '2230');
    const isSupported = connection.chainId === morphChainId;

    let chainName = 'Unknown Network';
    if (connection.chainId === 1) chainName = 'Ethereum Mainnet';
    else if (connection.chainId === 5) chainName = 'Goerli Testnet';
    else if (connection.chainId === morphChainId) chainName = 'Morph Holesky';

    return {
      chainId: connection.chainId,
      chainName,
      isSupported
    };
  } catch (error) {
    console.error('Error getting network info:', error);
    return null;
  }
}