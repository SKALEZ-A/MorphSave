// Wallet Management
export {
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
  getMultipleWalletBalances,
  exportWalletPrivateKey,
  hasWallet,
  removeWallet,
  type WalletCreationResult,
  type WalletInfo,
  type SignedTransaction
} from './walletManager';

// External Wallets (MetaMask, WalletConnect)
export {
  isMetaMaskAvailable,
  connectMetaMask,
  switchToMorphNetwork,
  addMorphNetwork,
  getWalletConnectionStatus,
  signMessageWithExternalWallet,
  connectExternalWalletToAccount,
  disconnectExternalWallet,
  setupWalletEventListeners,
  requestWalletPermissions,
  getWalletPermissions,
  sendTransactionWithExternalWallet,
  isOnMorphNetwork,
  getNetworkInfo,
  type ExternalWalletConnection,
  type WalletConnectionResult
} from './externalWallets';

// Hardware Wallets
export {
  isHardwareWalletSupported,
  detectHardwareWallets,
  connectLedger,
  connectTrezor,
  signTransactionWithHardwareWallet,
  signMessageWithHardwareWallet,
  getHardwareWalletAddresses,
  validateHardwareWalletConnection,
  getHardwareWalletAppVersion,
  isHardwareWalletAppUpToDate,
  type HardwareWalletInfo,
  type HardwareWalletConnection
} from './hardwareWallets';

// Transaction History
export {
  getUserTransactionHistory,
  addTransactionToHistory,
  updateTransactionHistoryStatus,
  syncTransactionHistoryFromBlockchain,
  getTransactionDetails,
  getUserTransactionStats,
  exportTransactionHistoryToCSV,
  type TransactionHistoryEntry,
  type TokenTransfer,
  type TransactionFilter
} from './transactionHistory';

// Re-export blockchain utilities
export {
  getBlockchainTransaction,
  checkTransactionConfirmation,
  monitorPendingTransactions,
  estimateGas,
  getNetworkStatus,
  startBlockWatcher,
  stopBlockWatcher,
  getAddressTransactionHistory,
  isValidTransactionHash,
  isValidAddress,
  formatTransactionHash,
  getTransactionExplorerUrl,
  getAddressExplorerUrl,
  batchCheckTransactionConfirmations,
  type BlockchainTransaction,
  type TransactionReceipt
} from '../blockchain/transactionTracker';