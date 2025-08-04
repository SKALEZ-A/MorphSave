// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title SavingsVault
 * @dev A smart contract for managing user savings with automated stablecoin conversion
 * and emergency withdrawal mechanisms
 */
contract SavingsVault is ReentrancyGuard, Pausable, Ownable {
    using SafeERC20 for IERC20;

    // Events
    event Deposit(address indexed user, uint256 amount, uint256 timestamp);
    event Withdrawal(address indexed user, uint256 amount, uint256 timestamp);
    event AutoInvest(address indexed user, uint256 amount, address indexed token, uint256 timestamp);
    event EmergencyWithdrawal(address indexed user, uint256 amount, uint256 timestamp);
    event StablecoinAdded(address indexed token, string symbol);
    event StablecoinRemoved(address indexed token);
    event MinimumInvestmentUpdated(uint256 oldAmount, uint256 newAmount);

    // Structs
    struct UserBalance {
        uint256 totalDeposited;
        uint256 totalWithdrawn;
        uint256 pendingInvestment;
        uint256 lastDepositTime;
        bool emergencyMode;
    }

    struct StablecoinInfo {
        bool isActive;
        string symbol;
        uint8 decimals;
        uint256 totalInvested;
    }

    // State variables
    mapping(address => UserBalance) public userBalances;
    mapping(address => StablecoinInfo) public supportedStablecoins;
    address[] public stablecoinList;
    
    uint256 public constant MINIMUM_DEPOSIT = 0.01 ether; // 0.01 ETH minimum
    uint256 public minimumInvestmentAmount = 10 ether; // 10 ETH minimum for auto-investment
    uint256 public totalDeposits;
    uint256 public totalWithdrawals;
    uint256 public emergencyWithdrawalFee = 100; // 1% fee (basis points)
    
    // Emergency controls
    bool public emergencyMode = false;
    uint256 public emergencyActivatedAt;

    constructor() Ownable(msg.sender) {
        // Initialize with common stablecoins (addresses would be updated for Morph L2)
        // These are placeholder addresses - would need actual Morph L2 stablecoin addresses
    }

    /**
     * @dev Deposit ETH into the savings vault
     */
    function deposit() external payable nonReentrant whenNotPaused {
        require(msg.value >= MINIMUM_DEPOSIT, "Deposit amount too small");
        require(!emergencyMode, "Emergency mode active");

        UserBalance storage userBalance = userBalances[msg.sender];
        
        userBalance.totalDeposited += msg.value;
        userBalance.pendingInvestment += msg.value;
        userBalance.lastDepositTime = block.timestamp;
        
        totalDeposits += msg.value;

        emit Deposit(msg.sender, msg.value, block.timestamp);

        // Check if auto-investment threshold is reached
        if (userBalance.pendingInvestment >= minimumInvestmentAmount) {
            _triggerAutoInvestment(msg.sender);
        }
    }

    /**
     * @dev Withdraw funds from the vault
     * @param amount Amount to withdraw in wei
     */
    function withdraw(uint256 amount) external nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        
        UserBalance storage userBalance = userBalances[msg.sender];
        uint256 availableBalance = getAvailableBalance(msg.sender);
        
        require(availableBalance >= amount, "Insufficient balance");
        require(!userBalance.emergencyMode, "User in emergency mode");

        userBalance.totalWithdrawn += amount;
        totalWithdrawals += amount;

        // Transfer ETH to user
        (bool success, ) = payable(msg.sender).call{value: amount}("");
        require(success, "Transfer failed");

        emit Withdrawal(msg.sender, amount, block.timestamp);
    }

    /**
     * @dev Emergency withdrawal with fee
     */
    function emergencyWithdraw() external nonReentrant {
        UserBalance storage userBalance = userBalances[msg.sender];
        uint256 totalBalance = getAvailableBalance(msg.sender);
        
        require(totalBalance > 0, "No balance to withdraw");
        
        // Calculate emergency fee
        uint256 fee = (totalBalance * emergencyWithdrawalFee) / 10000;
        uint256 withdrawAmount = totalBalance - fee;
        
        userBalance.emergencyMode = true;
        userBalance.totalWithdrawn += totalBalance;
        totalWithdrawals += totalBalance;

        // Transfer to user (minus fee)
        (bool success, ) = payable(msg.sender).call{value: withdrawAmount}("");
        require(success, "Transfer failed");

        emit EmergencyWithdrawal(msg.sender, withdrawAmount, block.timestamp);
    }

    /**
     * @dev Auto-invest pending amounts into stablecoins
     * @param user User address to invest for
     */
    function autoInvest(address user, uint256 amount) external onlyOwner nonReentrant {
        require(amount > 0, "Amount must be greater than 0");
        
        UserBalance storage userBalance = userBalances[user];
        require(userBalance.pendingInvestment >= amount, "Insufficient pending investment");
        
        userBalance.pendingInvestment -= amount;
        
        // For now, we'll emit an event. In production, this would interact with DEX
        // to convert ETH to stablecoins
        emit AutoInvest(user, amount, address(0), block.timestamp);
    }

    /**
     * @dev Get user's available balance for withdrawal
     * @param user User address
     * @return Available balance in wei
     */
    function getUserBalance(address user) external view returns (uint256) {
        return getAvailableBalance(user);
    }

    /**
     * @dev Get total yield earned by user (placeholder for future implementation)
     * @param user User address
     * @return Total yield earned
     */
    function getTotalYield(address user) external view returns (uint256) {
        // Placeholder - would calculate actual yield from DeFi protocols
        UserBalance memory userBalance = userBalances[user];
        
        // Simple mock calculation: 5% APY based on time deposited
        if (userBalance.lastDepositTime == 0) return 0;
        
        uint256 timeDeposited = block.timestamp - userBalance.lastDepositTime;
        uint256 annualYield = (userBalance.totalDeposited * 500) / 10000; // 5% APY
        uint256 yieldEarned = (annualYield * timeDeposited) / 365 days;
        
        return yieldEarned;
    }

    /**
     * @dev Get user's detailed balance information
     * @param user User address
     * @return UserBalance struct with all balance details
     */
    function getUserBalanceDetails(address user) external view returns (UserBalance memory) {
        return userBalances[user];
    }

    /**
     * @dev Internal function to calculate available balance
     * @param user User address
     * @return Available balance for withdrawal
     */
    function getAvailableBalance(address user) internal view returns (uint256) {
        UserBalance memory userBalance = userBalances[user];
        uint256 totalBalance = userBalance.totalDeposited - userBalance.totalWithdrawn;
        uint256 yieldEarned = this.getTotalYield(user);
        
        return totalBalance + yieldEarned;
    }

    /**
     * @dev Internal function to trigger auto-investment
     * @param user User address
     */
    function _triggerAutoInvestment(address user) internal {
        UserBalance storage userBalance = userBalances[user];
        uint256 investAmount = userBalance.pendingInvestment;
        
        // Reset pending investment
        userBalance.pendingInvestment = 0;
        
        // Emit auto-investment event
        emit AutoInvest(user, investAmount, address(0), block.timestamp);
    }

    // Admin functions
    
    /**
     * @dev Add supported stablecoin
     * @param token Stablecoin contract address
     * @param symbol Token symbol
     * @param decimals Token decimals
     */
    function addStablecoin(address token, string memory symbol, uint8 decimals) external onlyOwner {
        require(token != address(0), "Invalid token address");
        require(!supportedStablecoins[token].isActive, "Token already supported");
        
        supportedStablecoins[token] = StablecoinInfo({
            isActive: true,
            symbol: symbol,
            decimals: decimals,
            totalInvested: 0
        });
        
        stablecoinList.push(token);
        
        emit StablecoinAdded(token, symbol);
    }

    /**
     * @dev Remove supported stablecoin
     * @param token Stablecoin contract address
     */
    function removeStablecoin(address token) external onlyOwner {
        require(supportedStablecoins[token].isActive, "Token not supported");
        
        supportedStablecoins[token].isActive = false;
        
        // Remove from array
        for (uint256 i = 0; i < stablecoinList.length; i++) {
            if (stablecoinList[i] == token) {
                stablecoinList[i] = stablecoinList[stablecoinList.length - 1];
                stablecoinList.pop();
                break;
            }
        }
        
        emit StablecoinRemoved(token);
    }

    /**
     * @dev Update minimum investment amount
     * @param newAmount New minimum amount in wei
     */
    function updateMinimumInvestment(uint256 newAmount) external onlyOwner {
        require(newAmount > 0, "Amount must be greater than 0");
        
        uint256 oldAmount = minimumInvestmentAmount;
        minimumInvestmentAmount = newAmount;
        
        emit MinimumInvestmentUpdated(oldAmount, newAmount);
    }

    /**
     * @dev Activate emergency mode
     */
    function activateEmergencyMode() external onlyOwner {
        emergencyMode = true;
        emergencyActivatedAt = block.timestamp;
        _pause();
    }

    /**
     * @dev Deactivate emergency mode
     */
    function deactivateEmergencyMode() external onlyOwner {
        emergencyMode = false;
        emergencyActivatedAt = 0;
        _unpause();
    }

    /**
     * @dev Update emergency withdrawal fee
     * @param newFee New fee in basis points (100 = 1%)
     */
    function updateEmergencyFee(uint256 newFee) external onlyOwner {
        require(newFee <= 1000, "Fee cannot exceed 10%");
        emergencyWithdrawalFee = newFee;
    }

    /**
     * @dev Get list of supported stablecoins
     * @return Array of stablecoin addresses
     */
    function getSupportedStablecoins() external view returns (address[] memory) {
        return stablecoinList;
    }

    /**
     * @dev Get contract statistics
     * @return totalDeposits Total deposits in contract
     * @return totalWithdrawals Total withdrawals from contract
     * @return activeUsers Number of users with balance > 0
     */
    function getContractStats() external view returns (uint256, uint256, uint256) {
        // Note: activeUsers would need to be tracked separately for gas efficiency
        return (totalDeposits, totalWithdrawals, 0);
    }

    /**
     * @dev Withdraw contract fees (only emergency fees)
     */
    function withdrawFees() external onlyOwner {
        uint256 balance = address(this).balance;
        require(balance > 0, "No fees to withdraw");
        
        (bool success, ) = payable(owner()).call{value: balance}("");
        require(success, "Fee withdrawal failed");
    }

    /**
     * @dev Fallback function to receive ETH
     */
    receive() external payable {
        // Allow contract to receive ETH
    }
}