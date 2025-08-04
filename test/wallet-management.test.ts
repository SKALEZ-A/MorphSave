import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ethers } from 'ethers';
import { prisma } from '../lib/db/prisma';
import {
  createWallet,
  importWalletFromPrivateKey,
  importWalletFromMnemonic,
  getUserWallet,
  getWalletInfo,
  signTransaction,
  sendTransaction,
  signMessage,
  verifySignedMessage,
  generateWalletSessionToken,
  validateWalletSessionToken,
  revokeWalletSessionToken,
  hasWallet,
  removeWallet
} from '../lib/web3/walletManager';

// Mock the encryption module
jest.mock('../lib/utils/encryption', () => ({
  encrypt: jest.fn((data: string) => `encrypted_${data}`),
  decrypt: jest.fn((data: string) => data.replace('encrypted_', '')),
  generateSecureToken: jest.fn(() => 'mock_token_123')
}));

// Mock the blockchain tracker
jest.mock('../lib/blockchain/transactionTracker', () => ({
  isValidAddress: jest.fn((address: string) => ethers.isAddress(address)),
  isValidTransactionHash: jest.fn((hash: string) => /^0x[a-fA-F0-9]{64}$/.test(hash))
}));

describe('Wallet Management', () => {
  const mockUserId = 'test-user-123';
  const mockPrivateKey = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef';
  const mockMnemonic = 'abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon abandon about';

  beforeEach(async () => {
    // Clean up test data
    await prisma.user.deleteMany({
      where: { id: mockUserId }
    });
    
    await prisma.session.deleteMany({
      where: { userId: mockUserId }
    });

    // Create test user
    await prisma.user.create({
      data: {
        id: mockUserId,
        email: 'test@example.com',
        username: 'testuser',
        level: 1,
        totalPoints: 0,
        currentStreak: 0,
        longestStreak: 0,
        totalSaved: 0,
        totalYieldEarned: 0,
        roundUpEnabled: true,
        roundUpAmount: 1.0,
        notificationsEnabled: true,
        autoInvestEnabled: true
      }
    });
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.user.deleteMany({
      where: { id: mockUserId }
    });
    
    await prisma.session.deleteMany({
      where: { userId: mockUserId }
    });
  });

  describe('createWallet', () => {
    it('should create a new wallet for user', async () => {
      const result = await createWallet(mockUserId);

      expect(result).toBeDefined();
      expect(result.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(result.encryptedPrivateKey).toContain('encrypted_');
      expect(result.mnemonic).toBeDefined();

      // Verify wallet was saved to database
      const user = await prisma.user.findUnique({
        where: { id: mockUserId },
        select: { walletAddress: true, privateKeyEncrypted: true }
      });

      expect(user?.walletAddress).toBe(result.address);
      expect(user?.privateKeyEncrypted).toBe(result.encryptedPrivateKey);
    });

    it('should handle errors gracefully', async () => {
      // Test with invalid user ID
      await expect(createWallet('invalid-user')).rejects.toThrow();
    });
  });

  describe('importWalletFromPrivateKey', () => {
    it('should import wallet from private key', async () => {
      const result = await importWalletFromPrivateKey(mockUserId, mockPrivateKey);

      expect(result).toBeDefined();
      expect(result.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(result.encryptedPrivateKey).toContain('encrypted_');

      // Verify the address matches the private key
      const wallet = new ethers.Wallet(mockPrivateKey);
      expect(result.address).toBe(wallet.address);
    });

    it('should handle private key without 0x prefix', async () => {
      const privateKeyWithoutPrefix = mockPrivateKey.slice(2);
      const result = await importWalletFromPrivateKey(mockUserId, privateKeyWithoutPrefix);

      expect(result).toBeDefined();
      expect(result.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });

    it('should reject invalid private key', async () => {
      await expect(importWalletFromPrivateKey(mockUserId, 'invalid-key')).rejects.toThrow();
    });
  });

  describe('importWalletFromMnemonic', () => {
    it('should import wallet from mnemonic', async () => {
      const result = await importWalletFromMnemonic(mockUserId, mockMnemonic);

      expect(result).toBeDefined();
      expect(result.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
      expect(result.encryptedPrivateKey).toContain('encrypted_');
      expect(result.mnemonic).toBe(mockMnemonic);

      // Verify the address matches the mnemonic
      const wallet = ethers.Wallet.fromPhrase(mockMnemonic);
      expect(result.address).toBe(wallet.address);
    });

    it('should use custom derivation path', async () => {
      const customPath = "m/44'/60'/0'/0/1";
      const result = await importWalletFromMnemonic(mockUserId, mockMnemonic, customPath);

      expect(result).toBeDefined();
      
      // Verify the address matches the custom derivation path
      const wallet = ethers.Wallet.fromPhrase(mockMnemonic, undefined, customPath);
      expect(result.address).toBe(wallet.address);
    });

    it('should reject invalid mnemonic', async () => {
      await expect(importWalletFromMnemonic(mockUserId, 'invalid mnemonic phrase')).rejects.toThrow();
    });
  });

  describe('getUserWallet', () => {
    beforeEach(async () => {
      // Create a wallet for the user
      await createWallet(mockUserId);
    });

    it('should retrieve user wallet', async () => {
      const wallet = await getUserWallet(mockUserId);

      expect(wallet).toBeDefined();
      expect(wallet).toBeInstanceOf(ethers.Wallet);
      expect(wallet!.address).toMatch(/^0x[a-fA-F0-9]{40}$/);
    });

    it('should return null for user without wallet', async () => {
      const wallet = await getUserWallet('user-without-wallet');
      expect(wallet).toBeNull();
    });

    it('should verify address matches stored address', async () => {
      const wallet = await getUserWallet(mockUserId);
      const user = await prisma.user.findUnique({
        where: { id: mockUserId },
        select: { walletAddress: true }
      });

      expect(wallet!.address.toLowerCase()).toBe(user!.walletAddress!.toLowerCase());
    });
  });

  describe('signMessage', () => {
    beforeEach(async () => {
      await createWallet(mockUserId);
    });

    it('should sign message with user wallet', async () => {
      const message = 'Hello, MorphSave!';
      const signature = await signMessage(mockUserId, message);

      expect(signature).toBeDefined();
      expect(signature).toMatch(/^0x[a-fA-F0-9]{130}$/);

      // Verify signature
      const wallet = await getUserWallet(mockUserId);
      const isValid = verifySignedMessage(message, signature!, wallet!.address);
      expect(isValid).toBe(true);
    });

    it('should return null for user without wallet', async () => {
      const signature = await signMessage('user-without-wallet', 'test message');
      expect(signature).toBeNull();
    });
  });

  describe('verifySignedMessage', () => {
    it('should verify valid signature', () => {
      const wallet = ethers.Wallet.createRandom();
      const message = 'Test message';
      const signature = wallet.signMessageSync(message);

      const isValid = verifySignedMessage(message, signature, wallet.address);
      expect(isValid).toBe(true);
    });

    it('should reject invalid signature', () => {
      const wallet = ethers.Wallet.createRandom();
      const message = 'Test message';
      const invalidSignature = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef12';

      const isValid = verifySignedMessage(message, invalidSignature, wallet.address);
      expect(isValid).toBe(false);
    });

    it('should reject signature from different address', () => {
      const wallet1 = ethers.Wallet.createRandom();
      const wallet2 = ethers.Wallet.createRandom();
      const message = 'Test message';
      const signature = wallet1.signMessageSync(message);

      const isValid = verifySignedMessage(message, signature, wallet2.address);
      expect(isValid).toBe(false);
    });
  });

  describe('generateWalletSessionToken', () => {
    beforeEach(async () => {
      await createWallet(mockUserId);
    });

    it('should generate session token for user with wallet', async () => {
      const token = await generateWalletSessionToken(mockUserId);

      expect(token).toBeDefined();
      expect(token).toBe('mock_token_123');

      // Verify token was saved to database
      const session = await prisma.session.findUnique({
        where: { id: token! }
      });

      expect(session).toBeDefined();
      expect(session!.userId).toBe(mockUserId);
      expect(session!.type).toBe('WALLET_SESSION');
    });

    it('should return null for user without wallet', async () => {
      const token = await generateWalletSessionToken('user-without-wallet');
      expect(token).toBeNull();
    });
  });

  describe('validateWalletSessionToken', () => {
    let sessionToken: string;

    beforeEach(async () => {
      await createWallet(mockUserId);
      sessionToken = (await generateWalletSessionToken(mockUserId))!;
    });

    it('should validate valid session token', async () => {
      const userId = await validateWalletSessionToken(sessionToken);
      expect(userId).toBe(mockUserId);
    });

    it('should return null for invalid token', async () => {
      const userId = await validateWalletSessionToken('invalid-token');
      expect(userId).toBeNull();
    });

    it('should return null for expired token', async () => {
      // Update token to be expired
      await prisma.session.update({
        where: { id: sessionToken },
        data: { expiresAt: new Date(Date.now() - 1000) }
      });

      const userId = await validateWalletSessionToken(sessionToken);
      expect(userId).toBeNull();
    });
  });

  describe('revokeWalletSessionToken', () => {
    let sessionToken: string;

    beforeEach(async () => {
      await createWallet(mockUserId);
      sessionToken = (await generateWalletSessionToken(mockUserId))!;
    });

    it('should revoke session token', async () => {
      const result = await revokeWalletSessionToken(sessionToken);
      expect(result).toBe(true);

      // Verify token was deleted
      const session = await prisma.session.findUnique({
        where: { id: sessionToken }
      });
      expect(session).toBeNull();
    });

    it('should handle non-existent token gracefully', async () => {
      const result = await revokeWalletSessionToken('non-existent-token');
      expect(result).toBe(false);
    });
  });

  describe('hasWallet', () => {
    it('should return true for user with wallet', async () => {
      await createWallet(mockUserId);
      const result = await hasWallet(mockUserId);
      expect(result).toBe(true);
    });

    it('should return false for user without wallet', async () => {
      const result = await hasWallet(mockUserId);
      expect(result).toBe(false);
    });

    it('should return false for non-existent user', async () => {
      const result = await hasWallet('non-existent-user');
      expect(result).toBe(false);
    });
  });

  describe('removeWallet', () => {
    let sessionToken: string;

    beforeEach(async () => {
      await createWallet(mockUserId);
      sessionToken = (await generateWalletSessionToken(mockUserId))!;
    });

    it('should remove wallet with valid session token', async () => {
      const result = await removeWallet(mockUserId, sessionToken);
      expect(result).toBe(true);

      // Verify wallet was removed
      const user = await prisma.user.findUnique({
        where: { id: mockUserId },
        select: { walletAddress: true, privateKeyEncrypted: true }
      });

      expect(user!.walletAddress).toBeNull();
      expect(user!.privateKeyEncrypted).toBeNull();

      // Verify session token was revoked
      const session = await prisma.session.findUnique({
        where: { id: sessionToken }
      });
      expect(session).toBeNull();
    });

    it('should reject invalid session token', async () => {
      const result = await removeWallet(mockUserId, 'invalid-token');
      expect(result).toBe(false);

      // Verify wallet was not removed
      const user = await prisma.user.findUnique({
        where: { id: mockUserId },
        select: { walletAddress: true, privateKeyEncrypted: true }
      });

      expect(user!.walletAddress).not.toBeNull();
      expect(user!.privateKeyEncrypted).not.toBeNull();
    });

    it('should reject session token for different user', async () => {
      const result = await removeWallet('different-user', sessionToken);
      expect(result).toBe(false);
    });
  });
});