import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';
import { ethers } from 'ethers';
import { prisma } from '../lib/db/prisma';
import {
  createWallet,
  generateWalletSessionToken,
  validateWalletSessionToken,
  exportWalletPrivateKey,
  removeWallet
} from '../lib/web3/walletManager';
import {
  connectExternalWalletToAccount,
  signMessageWithExternalWallet
} from '../lib/web3/externalWallets';

// Mock the encryption module
jest.mock('../lib/utils/encryption', () => ({
  encrypt: jest.fn((data: string) => `encrypted_${data}`),
  decrypt: jest.fn((data: string) => data.replace('encrypted_', '')),
  generateSecureToken: jest.fn(() => 'secure_token_123')
}));

describe('Wallet Security', () => {
  const mockUserId = 'security-test-user';
  const mockMaliciousUserId = 'malicious-user';

  beforeEach(async () => {
    // Clean up test data
    await prisma.user.deleteMany({
      where: { id: { in: [mockUserId, mockMaliciousUserId] } }
    });
    
    await prisma.session.deleteMany({
      where: { userId: { in: [mockUserId, mockMaliciousUserId] } }
    });

    // Create test users
    await prisma.user.create({
      data: {
        id: mockUserId,
        email: 'security@example.com',
        username: 'securityuser',
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

    await prisma.user.create({
      data: {
        id: mockMaliciousUserId,
        email: 'malicious@example.com',
        username: 'malicioususer',
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
      where: { id: { in: [mockUserId, mockMaliciousUserId] } }
    });
    
    await prisma.session.deleteMany({
      where: { userId: { in: [mockUserId, mockMaliciousUserId] } }
    });
  });

  describe('Session Token Security', () => {
    let userSessionToken: string;

    beforeEach(async () => {
      await createWallet(mockUserId);
      userSessionToken = (await generateWalletSessionToken(mockUserId))!;
    });

    it('should prevent cross-user session token usage', async () => {
      // Try to use user A's session token for user B
      const result = await exportWalletPrivateKey(mockMaliciousUserId, userSessionToken);
      expect(result).toBeNull();
    });

    it('should prevent session token reuse after expiration', async () => {
      // Manually expire the session token
      await prisma.session.update({
        where: { id: userSessionToken },
        data: { expiresAt: new Date(Date.now() - 1000) }
      });

      const result = await exportWalletPrivateKey(mockUserId, userSessionToken);
      expect(result).toBeNull();
    });

    it('should prevent session token reuse after revocation', async () => {
      // Remove wallet (which should revoke session)
      await removeWallet(mockUserId, userSessionToken);

      // Try to use the revoked token
      const result = await exportWalletPrivateKey(mockUserId, userSessionToken);
      expect(result).toBeNull();
    });

    it('should validate session token format', async () => {
      const invalidTokens = [
        '',
        'invalid-token',
        '123',
        'a'.repeat(1000), // Very long token
        null,
        undefined
      ];

      for (const token of invalidTokens) {
        const result = await validateWalletSessionToken(token as string);
        expect(result).toBeNull();
      }
    });
  });

  describe('Private Key Protection', () => {
    beforeEach(async () => {
      await createWallet(mockUserId);
    });

    it('should never expose private key without valid session', async () => {
      const result = await exportWalletPrivateKey(mockUserId, 'invalid-session');
      expect(result).toBeNull();
    });

    it('should encrypt private keys in database', async () => {
      const user = await prisma.user.findUnique({
        where: { id: mockUserId },
        select: { privateKeyEncrypted: true }
      });

      expect(user!.privateKeyEncrypted).toContain('encrypted_');
      expect(user!.privateKeyEncrypted).not.toMatch(/^0x[a-fA-F0-9]{64}$/);
    });

    it('should validate private key format during import', async () => {
      const invalidPrivateKeys = [
        '',
        'invalid-key',
        '0x123', // Too short
        '0x' + 'g'.repeat(64), // Invalid hex characters
        'not-hex-at-all'
      ];

      for (const invalidKey of invalidPrivateKeys) {
        await expect(async () => {
          const { importWalletFromPrivateKey } = await import('../lib/web3/walletManager');
          await importWalletFromPrivateKey(mockUserId, invalidKey);
        }).rejects.toThrow();
      }
    });
  });

  describe('Address Validation', () => {
    it('should validate Ethereum addresses', () => {
      const { isValidAddress } = require('../lib/blockchain/transactionTracker');
      
      const validAddresses = [
        '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6',
        '0x0000000000000000000000000000000000000000',
        '0xFFfFfFffFFfffFFfFFfFFFFFffFFFffffFfFFFfF'
      ];

      const invalidAddresses = [
        '',
        '0x123',
        'not-an-address',
        '742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6', // Missing 0x
        '0x742d35Cc6634C0532925a3b8D4C9db96C4b4d8b6x', // Extra character
        '0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG' // Invalid hex
      ];

      validAddresses.forEach(address => {
        expect(isValidAddress(address)).toBe(true);
      });

      invalidAddresses.forEach(address => {
        expect(isValidAddress(address)).toBe(false);
      });
    });
  });

  describe('Transaction Hash Validation', () => {
    it('should validate transaction hashes', () => {
      const { isValidTransactionHash } = require('../lib/blockchain/transactionTracker');
      
      const validHashes = [
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        '0x0000000000000000000000000000000000000000000000000000000000000000',
        '0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff'
      ];

      const invalidHashes = [
        '',
        '0x123',
        'not-a-hash',
        '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef', // Missing 0x
        '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdefx', // Extra character
        '0xGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGG' // Invalid hex
      ];

      validHashes.forEach(hash => {
        expect(isValidTransactionHash(hash)).toBe(true);
      });

      invalidHashes.forEach(hash => {
        expect(isValidTransactionHash(hash)).toBe(false);
      });
    });
  });

  describe('Signature Verification', () => {
    it('should prevent signature replay attacks', () => {
      const { verifySignedMessage } = require('../lib/web3/walletManager');
      
      const wallet = ethers.Wallet.createRandom();
      const message = 'Authenticate user for MorphSave';
      const signature = wallet.signMessageSync(message);

      // Valid signature should work
      expect(verifySignedMessage(message, signature, wallet.address)).toBe(true);

      // Same signature with different message should fail
      expect(verifySignedMessage('Different message', signature, wallet.address)).toBe(false);

      // Same signature with different address should fail
      const differentWallet = ethers.Wallet.createRandom();
      expect(verifySignedMessage(message, signature, differentWallet.address)).toBe(false);
    });

    it('should handle malformed signatures gracefully', () => {
      const { verifySignedMessage } = require('../lib/web3/walletManager');
      
      const wallet = ethers.Wallet.createRandom();
      const message = 'Test message';
      
      const malformedSignatures = [
        '',
        '0x123',
        'not-a-signature',
        '0x' + 'g'.repeat(130), // Invalid hex
        '0x' + '1'.repeat(129), // Wrong length
        '0x' + '1'.repeat(131)  // Wrong length
      ];

      malformedSignatures.forEach(signature => {
        expect(verifySignedMessage(message, signature, wallet.address)).toBe(false);
      });
    });
  });

  describe('Input Sanitization', () => {
    it('should handle SQL injection attempts', async () => {
      const maliciousInputs = [
        "'; DROP TABLE users; --",
        "' OR '1'='1",
        "'; UPDATE users SET walletAddress = 'hacked'; --",
        "<script>alert('xss')</script>",
        "../../etc/passwd"
      ];

      for (const maliciousInput of maliciousInputs) {
        // These should not cause errors or security issues
        const result = await validateWalletSessionToken(maliciousInput);
        expect(result).toBeNull();
      }
    });

    it('should handle extremely long inputs', async () => {
      const longInput = 'a'.repeat(10000);
      
      const result = await validateWalletSessionToken(longInput);
      expect(result).toBeNull();
    });

    it('should handle null and undefined inputs', async () => {
      const result1 = await validateWalletSessionToken(null as any);
      expect(result1).toBeNull();

      const result2 = await validateWalletSessionToken(undefined as any);
      expect(result2).toBeNull();
    });
  });

  describe('Rate Limiting Simulation', () => {
    it('should handle multiple rapid requests gracefully', async () => {
      await createWallet(mockUserId);
      
      // Simulate rapid session token generation requests
      const promises = Array(10).fill(null).map(() => 
        generateWalletSessionToken(mockUserId)
      );

      const results = await Promise.allSettled(promises);
      
      // All requests should either succeed or fail gracefully
      results.forEach(result => {
        if (result.status === 'fulfilled') {
          expect(result.value).toBeDefined();
        } else {
          expect(result.reason).toBeInstanceOf(Error);
        }
      });
    });
  });

  describe('Error Handling', () => {
    it('should not leak sensitive information in error messages', async () => {
      try {
        await exportWalletPrivateKey('non-existent-user', 'invalid-token');
      } catch (error: any) {
        // Error messages should not contain sensitive data
        expect(error.message).not.toContain('encrypted_');
        expect(error.message).not.toContain('0x');
        expect(error.message).not.toContain('private');
      }
    });

    it('should handle database connection errors gracefully', async () => {
      // Mock database error
      const originalFindUnique = prisma.user.findUnique;
      prisma.user.findUnique = jest.fn().mockRejectedValue(new Error('Database connection failed'));

      const result = await validateWalletSessionToken('any-token');
      expect(result).toBeNull();

      // Restore original method
      prisma.user.findUnique = originalFindUnique;
    });
  });

  describe('Concurrent Access', () => {
    it('should handle concurrent wallet operations safely', async () => {
      // Create multiple concurrent wallet creation requests
      const promises = Array(5).fill(null).map((_, index) => 
        createWallet(`concurrent-user-${index}`)
      );

      const results = await Promise.allSettled(promises);
      
      // Clean up created users
      const userIds = results
        .filter(result => result.status === 'fulfilled')
        .map((_, index) => `concurrent-user-${index}`);
      
      if (userIds.length > 0) {
        await prisma.user.deleteMany({
          where: { id: { in: userIds } }
        });
      }

      // All operations should complete without errors
      results.forEach(result => {
        if (result.status === 'rejected') {
          console.error('Concurrent operation failed:', result.reason);
        }
      });
    });
  });
});