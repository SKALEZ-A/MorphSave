import { ethers } from 'ethers';
import { encrypt, decrypt, generateSecureToken } from '../utils/encryption';
import { prisma } from '../db/prisma';
import { isValidAddress } from '../blockchain/transactionTracker';

export interface WalletCreationResult {
  address: string;
  encryptedPrivateKey: string;
  mnemonic?: string;
}

export interface WalletInfo {
  address: string;
  balance: string;
  nonce: number;
  isContract: boolean;
}

export interface SignedTransaction {
  hash: string;
  from: string;
  to: string;
  value: string;
  gasLimit: string;
  gasPrice: string;
  nonce: number;
  data: string;
}

/**
 * Create a new wallet with encrypted private key storage
 */
export async function createWallet(userId: string): Promise<WalletCreationResult> {
  try {
    // Generate new wallet
    const wallet = ethers.Wallet.createRandom();
    
    // Encrypt the private key
    const encryptedPrivateKey = encrypt(wallet.privateKey);
    
    // Store wallet info in database
    await prisma.user.update({
      where: { id: userId },
      data: {
        walletAddress: wallet.address,
        privateKeyEncrypted: encryptedPrivateKey,
        updatedAt: new Date()
      }
    });

    return {
      address: wallet.address,
      encryptedPrivateKey,
      mnemonic: wallet.mnemonic?.phrase
    };
  } catch (error) {
    console.error('Error creating wallet:', error);
    throw new Error('Failed to create wallet');
  }
}

/**
 * Import existing wallet from private key
 */
export async function importWalletFromPrivateKey(
  userId: string, 
  privateKey: string
): Promise<WalletCreationResult> {
  try {
    // Validate private key format
    if (!privateKey.startsWith('0x')) {
      privateKey = '0x' + privateKey;
    }
    
    // Create wallet from private key
    const wallet = new ethers.Wallet(privateKey);
    
    // Encrypt the private key
    const encryptedPrivateKey = encrypt(wallet.privateKey);
    
    // Store wallet info in database
    await prisma.user.update({
      where: { id: userId },
      data: {
        walletAddress: wallet.address,
        privateKeyEncrypted: encryptedPrivateKey,
        updatedAt: new Date()
      }
    });

    return {
      address: wallet.address,
      encryptedPrivateKey
    };
  } catch (error) {
    console.error('Error importing wallet:', error);
    throw new Error('Invalid private key or failed to import wallet');
  }
}

/**
 * Import wallet from mnemonic phrase
 */
export async function importWalletFromMnemonic(
  userId: string,
  mnemonic: string,
  derivationPath: string = "m/44'/60'/0'/0/0"
): Promise<WalletCreationResult> {
  try {
    // Create wallet from mnemonic
    const wallet = ethers.Wallet.fromPhrase(mnemonic, undefined, derivationPath);
    
    // Encrypt the private key
    const encryptedPrivateKey = encrypt(wallet.privateKey);
    
    // Store wallet info in database
    await prisma.user.update({
      where: { id: userId },
      data: {
        walletAddress: wallet.address,
        privateKeyEncrypted: encryptedPrivateKey,
        updatedAt: new Date()
      }
    });

    return {
      address: wallet.address,
      encryptedPrivateKey,
      mnemonic: wallet.mnemonic?.phrase
    };
  } catch (error) {
    console.error('Error importing wallet from mnemonic:', error);
    throw new Error('Invalid mnemonic phrase or failed to import wallet');
  }
}

/**
 * Get wallet instance for a user (decrypts private key)
 */
export async function getUserWallet(userId: string): Promise<ethers.Wallet | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { privateKeyEncrypted: true, walletAddress: true }
    });

    if (!user?.privateKeyEncrypted || !user.walletAddress) {
      return null;
    }

    // Decrypt private key
    const privateKey = decrypt(user.privateKeyEncrypted);
    
    // Create wallet instance
    const wallet = new ethers.Wallet(privateKey);
    
    // Verify address matches
    if (wallet.address.toLowerCase() !== user.walletAddress.toLowerCase()) {
      throw new Error('Wallet address mismatch');
    }

    return wallet;
  } catch (error) {
    console.error('Error getting user wallet:', error);
    return null;
  }
}

/**
 * Get wallet information without exposing private key
 */
export async function getWalletInfo(address: string): Promise<WalletInfo | null> {
  try {
    if (!isValidAddress(address)) {
      throw new Error('Invalid wallet address');
    }

    const provider = new ethers.JsonRpcProvider(
      process.env.MORPH_RPC_URL || 'https://rpc-quicknode-holesky.morphl2.io'
    );

    const [balance, nonce, code] = await Promise.all([
      provider.getBalance(address),
      provider.getTransactionCount(address),
      provider.getCode(address)
    ]);

    return {
      address,
      balance: ethers.formatEther(balance),
      nonce,
      isContract: code !== '0x'
    };
  } catch (error) {
    console.error('Error getting wallet info:', error);
    return null;
  }
}

/**
 * Sign a transaction with user's wallet
 */
export async function signTransaction(
  userId: string,
  transaction: {
    to: string;
    value?: string;
    data?: string;
    gasLimit?: string;
    gasPrice?: string;
  }
): Promise<SignedTransaction | null> {
  try {
    const wallet = await getUserWallet(userId);
    if (!wallet) {
      throw new Error('Wallet not found for user');
    }

    const provider = new ethers.JsonRpcProvider(
      process.env.MORPH_RPC_URL || 'https://rpc-quicknode-holesky.morphl2.io'
    );

    // Connect wallet to provider
    const connectedWallet = wallet.connect(provider);

    // Prepare transaction
    const tx = {
      to: transaction.to,
      value: transaction.value ? ethers.parseEther(transaction.value) : 0,
      data: transaction.data || '0x',
      gasLimit: transaction.gasLimit ? BigInt(transaction.gasLimit) : undefined,
      gasPrice: transaction.gasPrice ? BigInt(transaction.gasPrice) : undefined
    };

    // Estimate gas if not provided
    if (!tx.gasLimit) {
      tx.gasLimit = await provider.estimateGas(tx);
    }

    // Get gas price if not provided
    if (!tx.gasPrice) {
      const feeData = await provider.getFeeData();
      tx.gasPrice = feeData.gasPrice || ethers.parseUnits('20', 'gwei');
    }

    // Sign the transaction
    const signedTx = await connectedWallet.signTransaction(tx);
    const parsedTx = ethers.Transaction.from(signedTx);

    return {
      hash: parsedTx.hash || '',
      from: parsedTx.from || wallet.address,
      to: parsedTx.to || '',
      value: ethers.formatEther(parsedTx.value),
      gasLimit: parsedTx.gasLimit.toString(),
      gasPrice: parsedTx.gasPrice?.toString() || '0',
      nonce: parsedTx.nonce,
      data: parsedTx.data
    };
  } catch (error) {
    console.error('Error signing transaction:', error);
    return null;
  }
}/**

 * Send a signed transaction to the network
 */
export async function sendTransaction(
  userId: string,
  transaction: {
    to: string;
    value?: string;
    data?: string;
    gasLimit?: string;
    gasPrice?: string;
  }
): Promise<{ hash: string; receipt?: ethers.TransactionReceipt } | null> {
  try {
    const wallet = await getUserWallet(userId);
    if (!wallet) {
      throw new Error('Wallet not found for user');
    }

    const provider = new ethers.JsonRpcProvider(
      process.env.MORPH_RPC_URL || 'https://rpc-quicknode-holesky.morphl2.io'
    );

    // Connect wallet to provider
    const connectedWallet = wallet.connect(provider);

    // Prepare transaction
    const tx = {
      to: transaction.to,
      value: transaction.value ? ethers.parseEther(transaction.value) : 0,
      data: transaction.data || '0x',
      gasLimit: transaction.gasLimit ? BigInt(transaction.gasLimit) : undefined,
      gasPrice: transaction.gasPrice ? BigInt(transaction.gasPrice) : undefined
    };

    // Send transaction
    const txResponse = await connectedWallet.sendTransaction(tx);
    
    return {
      hash: txResponse.hash,
      receipt: await txResponse.wait()
    };
  } catch (error) {
    console.error('Error sending transaction:', error);
    return null;
  }
}

/**
 * Sign a message with user's wallet
 */
export async function signMessage(userId: string, message: string): Promise<string | null> {
  try {
    const wallet = await getUserWallet(userId);
    if (!wallet) {
      throw new Error('Wallet not found for user');
    }

    return await wallet.signMessage(message);
  } catch (error) {
    console.error('Error signing message:', error);
    return null;
  }
}

/**
 * Verify a signed message
 */
export function verifySignedMessage(
  message: string,
  signature: string,
  expectedAddress: string
): boolean {
  try {
    const recoveredAddress = ethers.verifyMessage(message, signature);
    return recoveredAddress.toLowerCase() === expectedAddress.toLowerCase();
  } catch (error) {
    console.error('Error verifying signed message:', error);
    return false;
  }
}

/**
 * Generate a secure session token for wallet operations
 */
export async function generateWalletSessionToken(userId: string): Promise<string | null> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { walletAddress: true }
    });

    if (!user?.walletAddress) {
      return null;
    }

    // Generate secure token
    const token = generateSecureToken(32);
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes

    // Store session token in database
    await prisma.session.create({
      data: {
        id: token,
        userId,
        expiresAt,
        type: 'WALLET_SESSION'
      }
    });

    return token;
  } catch (error) {
    console.error('Error generating wallet session token:', error);
    return null;
  }
}

/**
 * Validate wallet session token
 */
export async function validateWalletSessionToken(token: string): Promise<string | null> {
  try {
    const session = await prisma.session.findUnique({
      where: { 
        id: token,
        type: 'WALLET_SESSION',
        expiresAt: { gt: new Date() }
      },
      select: { userId: true }
    });

    return session?.userId || null;
  } catch (error) {
    console.error('Error validating wallet session token:', error);
    return null;
  }
}

/**
 * Revoke wallet session token
 */
export async function revokeWalletSessionToken(token: string): Promise<boolean> {
  try {
    await prisma.session.delete({
      where: { id: token }
    });
    return true;
  } catch (error) {
    console.error('Error revoking wallet session token:', error);
    return false;
  }
}

/**
 * Get multiple wallet balances efficiently
 */
export async function getMultipleWalletBalances(addresses: string[]): Promise<Map<string, string>> {
  const balances = new Map<string, string>();
  
  try {
    const provider = new ethers.JsonRpcProvider(
      process.env.MORPH_RPC_URL || 'https://rpc-quicknode-holesky.morphl2.io'
    );

    // Process in batches to avoid rate limiting
    const batchSize = 10;
    for (let i = 0; i < addresses.length; i += batchSize) {
      const batch = addresses.slice(i, i + batchSize);
      
      const batchPromises = batch.map(async (address) => {
        if (!isValidAddress(address)) {
          return { address, balance: '0' };
        }
        
        try {
          const balance = await provider.getBalance(address);
          return { address, balance: ethers.formatEther(balance) };
        } catch (error) {
          console.error(`Error getting balance for ${address}:`, error);
          return { address, balance: '0' };
        }
      });
      
      const batchResults = await Promise.allSettled(batchPromises);
      
      batchResults.forEach((result) => {
        if (result.status === 'fulfilled') {
          balances.set(result.value.address, result.value.balance);
        }
      });
      
      // Small delay between batches
      if (i + batchSize < addresses.length) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
  } catch (error) {
    console.error('Error getting multiple wallet balances:', error);
  }
  
  return balances;
}

/**
 * Export wallet private key (requires additional authentication)
 */
export async function exportWalletPrivateKey(
  userId: string,
  sessionToken: string
): Promise<string | null> {
  try {
    // Validate session token
    const validUserId = await validateWalletSessionToken(sessionToken);
    if (validUserId !== userId) {
      throw new Error('Invalid session token');
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { privateKeyEncrypted: true }
    });

    if (!user?.privateKeyEncrypted) {
      return null;
    }

    // Decrypt and return private key
    return decrypt(user.privateKeyEncrypted);
  } catch (error) {
    console.error('Error exporting wallet private key:', error);
    return null;
  }
}

/**
 * Check if user has a wallet configured
 */
export async function hasWallet(userId: string): Promise<boolean> {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { walletAddress: true, privateKeyEncrypted: true }
    });

    return !!(user?.walletAddress && user?.privateKeyEncrypted);
  } catch (error) {
    console.error('Error checking if user has wallet:', error);
    return false;
  }
}

/**
 * Remove wallet from user account (dangerous operation)
 */
export async function removeWallet(
  userId: string,
  sessionToken: string
): Promise<boolean> {
  try {
    // Validate session token
    const validUserId = await validateWalletSessionToken(sessionToken);
    if (validUserId !== userId) {
      throw new Error('Invalid session token');
    }

    // Remove wallet data
    await prisma.user.update({
      where: { id: userId },
      data: {
        walletAddress: null,
        privateKeyEncrypted: null,
        updatedAt: new Date()
      }
    });

    // Revoke session token
    await revokeWalletSessionToken(sessionToken);

    return true;
  } catch (error) {
    console.error('Error removing wallet:', error);
    return false;
  }
}