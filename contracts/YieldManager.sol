// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";

/**
 * @title YieldManager
 * @dev Smart contract for managing automated DeFi protocol integration,
 * yield calculation, compounding, and risk management
 */
contract YieldManager is ReentrancyGuard, Pausable, Ownable {
    using SafeERC20 for IERC20;

    // Events
    event ProtocolAdded(address indexed protocol, string name, uint256 baseAPY);
    event ProtocolRemoved(address indexed protocol);
    event ProtocolSwitched(address indexed oldProtocol, address indexed newProtocol, uint256 amount);
    event YieldDeposited(address indexed user, address indexed protocol, uint256 amount, uint256 timestamp);
    event YieldWithdrawn(address indexed user, address indexed protocol, uint256 amount, uint256 yield);
    event YieldCompounded(address indexed user, uint256 yieldAmount, uint256 newPrincipal);
    event APYUpdated(address indexed protocol, uint256 oldAPY, uint256 newAPY);
    event RiskAssessmentUpdated(address indexed protocol, uint8 oldRisk, uint8 newRisk);
    event EmergencyWithdrawal(address indexed protocol, uint256 amount);

    // Enums
    enum RiskLevel { LOW, MEDIUM, HIGH, CRITICAL }
    enum ProtocolStatus { ACTIVE, PAUSED, DEPRECATED }

    // Structs
    struct YieldProtocol {
        address protocolAddress;
        string name;
        uint256 baseAPY; // Base APY in basis points (100 = 1%)
        uint256 currentAPY; // Current APY in basis points
        RiskLevel riskLevel;
        ProtocolStatus status;
        uint256 totalDeposited;
        uint256 totalYieldGenerated;
        uint256 lastUpdated;
        bool isActive;
    }

    struct UserYieldPosition {
        uint256 principal; // Original deposit amount
        uint256 yieldEarned; // Total yield earned
        uint256 lastCompoundTime; // Last time yield was compounded
        uint256 depositTime; // When the position was created
        address currentProtocol; // Current protocol being used
        bool autoCompound; // Whether to automatically compound yield
    }

    struct YieldStrategy {
        address[] protocols; // Ordered list of protocols by preference
        uint256[] allocations; // Percentage allocation for each protocol (basis points)
        RiskLevel maxRiskLevel; // Maximum acceptable risk level
        uint256 minAPYThreshold; // Minimum APY threshold for switching
        bool isDiversified; // Whether to diversify across multiple protocols
    }

    // State variables
    mapping(address => YieldProtocol) public yieldProtocols;
    mapping(address => UserYieldPosition) public userPositions;
    mapping(address => YieldStrategy) public userStrategies;
    
    address[] public protocolList;
    address public defaultProtocol;
    
    // Risk management
    uint256 public constant MAX_RISK_EXPOSURE = 5000; // 50% max exposure to high-risk protocols
    uint256 public constant COMPOUND_FREQUENCY = 1 days; // Minimum time between compounds
    uint256 public constant APY_UPDATE_FREQUENCY = 1 hours; // How often APY can be updated
    
    // Fee structure
    uint256 public managementFee = 100; // 1% management fee (basis points)
    uint256 public performanceFee = 1000; // 10% performance fee (basis points)
    uint256 public withdrawalFee = 50; // 0.5% withdrawal fee (basis points)
    
    // Protocol integration interfaces (simplified for demo)
    mapping(address => bool) public trustedProtocols;
    
    constructor() Ownable(msg.sender) {
        _initializeDefaultProtocols();
    }

    /**
     * @dev Initialize default yield protocols
     */
    function _initializeDefaultProtocols() internal {
        // Mock protocols for demonstration - in production these would be real DeFi protocols
        // Protocol 1: Conservative stablecoin lending (e.g., Aave-like)
        _addProtocol(
            address(0x1111111111111111111111111111111111111111),
            "StableLend",
            500, // 5% APY
            RiskLevel.LOW
        );
        
        // Protocol 2: Moderate yield farming (e.g., Compound-like)
        _addProtocol(
            address(0x2222222222222222222222222222222222222222),
            "YieldFarm",
            800, // 8% APY
            RiskLevel.MEDIUM
        );
        
        // Protocol 3: High-yield but risky (e.g., experimental DeFi)
        _addProtocol(
            address(0x3333333333333333333333333333333333333333),
            "HighYield",
            1500, // 15% APY
            RiskLevel.HIGH
        );
        
        // Set default protocol to the conservative one
        defaultProtocol = address(0x1111111111111111111111111111111111111111);
    }

    /**
     * @dev Deposit funds into yield-generating protocol
     * @param user User address
     * @param amount Amount to deposit
     */
    function depositForYield(address user, uint256 amount) external onlyOwner nonReentrant whenNotPaused {
        require(amount > 0, "Amount must be greater than 0");
        
        UserYieldPosition storage position = userPositions[user];
        YieldStrategy storage strategy = userStrategies[user];
        
        // Initialize user strategy if not set
        if (strategy.protocols.length == 0) {
            _initializeUserStrategy(user);
        }
        
        // Calculate yield before new deposit
        uint256 pendingYield = _calculatePendingYield(user);
        if (pendingYield > 0 && position.autoCompound) {
            _compoundYield(user, pendingYield);
        }
        
        // Select best protocol based on strategy
        address selectedProtocol = _selectOptimalProtocol(user, amount);
        
        // Update user position
        position.principal += amount;
        position.depositTime = block.timestamp;
        position.currentProtocol = selectedProtocol;
        position.lastCompoundTime = block.timestamp;
        
        // Update protocol stats
        YieldProtocol storage protocol = yieldProtocols[selectedProtocol];
        protocol.totalDeposited += amount;
        
        // In a real implementation, this would interact with the actual DeFi protocol
        // For demo purposes, we'll just emit an event
        emit YieldDeposited(user, selectedProtocol, amount, block.timestamp);
    }

    /**
     * @dev Withdraw funds and yield from protocol
     * @param user User address
     * @param amount Amount to withdraw (0 = withdraw all)
     */
    function withdrawFromYield(address user, uint256 amount) external onlyOwner nonReentrant returns (uint256) {
        UserYieldPosition storage position = userPositions[user];
        require(position.principal > 0, "No position to withdraw");
        
        // Calculate total available (principal + yield)
        uint256 pendingYield = _calculatePendingYield(user);
        uint256 totalAvailable = position.principal + position.yieldEarned + pendingYield;
        
        // Determine withdrawal amount
        uint256 withdrawAmount = amount == 0 ? totalAvailable : amount;
        require(withdrawAmount <= totalAvailable, "Insufficient balance");
        
        // Calculate fees
        uint256 withdrawalFeeAmount = (withdrawAmount * withdrawalFee) / 10000;
        uint256 netWithdrawal = withdrawAmount - withdrawalFeeAmount;
        
        // Update position
        if (withdrawAmount == totalAvailable) {
            // Full withdrawal - reset position
            position.principal = 0;
            position.yieldEarned = 0;
            position.lastCompoundTime = 0;
        } else {
            // Partial withdrawal - proportionally reduce principal and yield
            uint256 remainingRatio = ((totalAvailable - withdrawAmount) * 10000) / totalAvailable;
            position.principal = (position.principal * remainingRatio) / 10000;
            position.yieldEarned = ((position.yieldEarned + pendingYield) * remainingRatio) / 10000;
        }
        
        // Update protocol stats
        YieldProtocol storage protocol = yieldProtocols[position.currentProtocol];
        protocol.totalDeposited = protocol.totalDeposited > withdrawAmount ? 
            protocol.totalDeposited - withdrawAmount : 0;
        
        emit YieldWithdrawn(user, position.currentProtocol, withdrawAmount, pendingYield);
        
        return netWithdrawal;
    }

    /**
     * @dev Compound yield back into principal
     * @param user User address
     */
    function compoundYield(address user) external onlyOwner nonReentrant {
        uint256 pendingYield = _calculatePendingYield(user);
        require(pendingYield > 0, "No yield to compound");
        
        UserYieldPosition storage position = userPositions[user];
        require(
            block.timestamp >= position.lastCompoundTime + COMPOUND_FREQUENCY,
            "Compound frequency not met"
        );
        
        _compoundYield(user, pendingYield);
    }

    /**
     * @dev Switch user's funds to a different protocol
     * @param user User address
     * @param newProtocol New protocol address
     */
    function switchProtocol(address user, address newProtocol) external onlyOwner nonReentrant {
        require(yieldProtocols[newProtocol].isActive, "Protocol not active");
        
        UserYieldPosition storage position = userPositions[user];
        require(position.principal > 0, "No position to switch");
        
        address oldProtocol = position.currentProtocol;
        require(oldProtocol != newProtocol, "Already using this protocol");
        
        // Calculate and compound any pending yield first
        uint256 pendingYield = _calculatePendingYield(user);
        if (pendingYield > 0) {
            _compoundYield(user, pendingYield);
        }
        
        // Update protocol allocations
        uint256 totalAmount = position.principal + position.yieldEarned;
        
        yieldProtocols[oldProtocol].totalDeposited -= totalAmount;
        yieldProtocols[newProtocol].totalDeposited += totalAmount;
        
        // Update user position
        position.currentProtocol = newProtocol;
        position.lastCompoundTime = block.timestamp;
        
        emit ProtocolSwitched(oldProtocol, newProtocol, totalAmount);
    }

    /**
     * @dev Get user's current yield position
     * @param user User address
     * @return principal Current principal amount
     * @return yieldEarned Total yield earned
     * @return pendingYield Pending yield not yet compounded
     * @return currentAPY Current APY of the protocol
     * @return protocolName Name of current protocol
     */
    function getUserYieldPosition(address user) external view returns (
        uint256 principal,
        uint256 yieldEarned,
        uint256 pendingYield,
        uint256 currentAPY,
        string memory protocolName
    ) {
        UserYieldPosition storage position = userPositions[user];
        pendingYield = _calculatePendingYield(user);
        
        YieldProtocol storage protocol = yieldProtocols[position.currentProtocol];
        
        return (
            position.principal,
            position.yieldEarned,
            pendingYield,
            protocol.currentAPY,
            protocol.name
        );
    }

    /**
     * @dev Get total yield earned by user
     * @param user User address
     * @return Total yield including pending
     */
    function getTotalYield(address user) external view returns (uint256) {
        UserYieldPosition storage position = userPositions[user];
        uint256 pendingYield = _calculatePendingYield(user);
        return position.yieldEarned + pendingYield;
    }

    /**
     * @dev Set user's yield strategy
     * @param user User address
     * @param maxRiskLevel Maximum acceptable risk level
     * @param minAPYThreshold Minimum APY threshold
     * @param autoCompound Whether to auto-compound yield
     */
    function setUserStrategy(
        address user,
        RiskLevel maxRiskLevel,
        uint256 minAPYThreshold,
        bool autoCompound
    ) external onlyOwner {
        YieldStrategy storage strategy = userStrategies[user];
        strategy.maxRiskLevel = maxRiskLevel;
        strategy.minAPYThreshold = minAPYThreshold;
        
        UserYieldPosition storage position = userPositions[user];
        position.autoCompound = autoCompound;
        
        // Update protocol preferences based on risk level
        _updateStrategyProtocols(user);
    }

    // Internal functions

    /**
     * @dev Calculate pending yield for a user
     * @param user User address
     * @return Pending yield amount
     */
    function _calculatePendingYield(address user) internal view returns (uint256) {
        UserYieldPosition storage position = userPositions[user];
        
        if (position.principal == 0 || position.lastCompoundTime == 0) {
            return 0;
        }
        
        YieldProtocol storage protocol = yieldProtocols[position.currentProtocol];
        
        uint256 timeElapsed = block.timestamp - position.lastCompoundTime;
        uint256 annualYield = (position.principal * protocol.currentAPY) / 10000;
        uint256 pendingYield = (annualYield * timeElapsed) / 365 days;
        
        return pendingYield;
    }

    /**
     * @dev Compound yield into principal
     * @param user User address
     * @param yieldAmount Amount of yield to compound
     */
    function _compoundYield(address user, uint256 yieldAmount) internal {
        UserYieldPosition storage position = userPositions[user];
        
        // Calculate performance fee
        uint256 performanceFeeAmount = (yieldAmount * performanceFee) / 10000;
        uint256 netYield = yieldAmount - performanceFeeAmount;
        
        // Add to principal for compounding effect
        position.principal += netYield;
        position.yieldEarned += netYield;
        position.lastCompoundTime = block.timestamp;
        
        // Update protocol stats
        YieldProtocol storage protocol = yieldProtocols[position.currentProtocol];
        protocol.totalYieldGenerated += yieldAmount;
        
        emit YieldCompounded(user, netYield, position.principal);
    }

    /**
     * @dev Select optimal protocol based on user strategy
     * @param user User address
     * @param amount Amount to be deposited
     * @return Selected protocol address
     */
    function _selectOptimalProtocol(address user, uint256 amount) internal view returns (address) {
        YieldStrategy storage strategy = userStrategies[user];
        
        address bestProtocol = defaultProtocol;
        uint256 bestAPY = 0;
        
        // Find the best protocol within user's risk tolerance
        for (uint256 i = 0; i < protocolList.length; i++) {
            address protocolAddr = protocolList[i];
            YieldProtocol storage protocol = yieldProtocols[protocolAddr];
            
            if (protocol.isActive && 
                protocol.status == ProtocolStatus.ACTIVE &&
                protocol.riskLevel <= strategy.maxRiskLevel &&
                protocol.currentAPY >= strategy.minAPYThreshold &&
                protocol.currentAPY > bestAPY) {
                
                bestProtocol = protocolAddr;
                bestAPY = protocol.currentAPY;
            }
        }
        
        return bestProtocol;
    }

    /**
     * @dev Initialize default strategy for new user
     * @param user User address
     */
    function _initializeUserStrategy(address user) internal {
        YieldStrategy storage strategy = userStrategies[user];
        
        // Conservative default strategy
        strategy.maxRiskLevel = RiskLevel.MEDIUM;
        strategy.minAPYThreshold = 300; // 3% minimum APY
        strategy.isDiversified = false;
        
        // Set default protocols in order of preference
        strategy.protocols.push(defaultProtocol);
        strategy.allocations.push(10000); // 100% allocation
        
        // Set auto-compound to true by default
        userPositions[user].autoCompound = true;
    }

    /**
     * @dev Update strategy protocols based on risk level
     * @param user User address
     */
    function _updateStrategyProtocols(address user) internal {
        YieldStrategy storage strategy = userStrategies[user];
        
        // Clear existing protocols
        delete strategy.protocols;
        delete strategy.allocations;
        
        // Add protocols within risk tolerance
        for (uint256 i = 0; i < protocolList.length; i++) {
            address protocolAddr = protocolList[i];
            YieldProtocol storage protocol = yieldProtocols[protocolAddr];
            
            if (protocol.isActive && protocol.riskLevel <= strategy.maxRiskLevel) {
                strategy.protocols.push(protocolAddr);
                strategy.allocations.push(10000 / strategy.protocols.length); // Equal allocation
            }
        }
    }

    /**
     * @dev Add a new yield protocol
     * @param protocolAddress Protocol contract address
     * @param name Protocol name
     * @param baseAPY Base APY in basis points
     * @param riskLevel Risk level of the protocol
     */
    function _addProtocol(
        address protocolAddress,
        string memory name,
        uint256 baseAPY,
        RiskLevel riskLevel
    ) internal {
        require(protocolAddress != address(0), "Invalid protocol address");
        require(!yieldProtocols[protocolAddress].isActive, "Protocol already exists");
        
        yieldProtocols[protocolAddress] = YieldProtocol({
            protocolAddress: protocolAddress,
            name: name,
            baseAPY: baseAPY,
            currentAPY: baseAPY,
            riskLevel: riskLevel,
            status: ProtocolStatus.ACTIVE,
            totalDeposited: 0,
            totalYieldGenerated: 0,
            lastUpdated: block.timestamp,
            isActive: true
        });
        
        protocolList.push(protocolAddress);
        trustedProtocols[protocolAddress] = true;
        
        emit ProtocolAdded(protocolAddress, name, baseAPY);
    }

    // Admin functions

    /**
     * @dev Add a new yield protocol (admin only)
     */
    function addProtocol(
        address protocolAddress,
        string memory name,
        uint256 baseAPY,
        RiskLevel riskLevel
    ) external onlyOwner {
        _addProtocol(protocolAddress, name, baseAPY, riskLevel);
    }

    /**
     * @dev Remove a yield protocol
     * @param protocolAddress Protocol to remove
     */
    function removeProtocol(address protocolAddress) external onlyOwner {
        require(yieldProtocols[protocolAddress].isActive, "Protocol not active");
        
        yieldProtocols[protocolAddress].isActive = false;
        yieldProtocols[protocolAddress].status = ProtocolStatus.DEPRECATED;
        trustedProtocols[protocolAddress] = false;
        
        // Remove from protocol list
        for (uint256 i = 0; i < protocolList.length; i++) {
            if (protocolList[i] == protocolAddress) {
                protocolList[i] = protocolList[protocolList.length - 1];
                protocolList.pop();
                break;
            }
        }
        
        emit ProtocolRemoved(protocolAddress);
    }

    /**
     * @dev Update protocol APY
     * @param protocolAddress Protocol address
     * @param newAPY New APY in basis points
     */
    function updateProtocolAPY(address protocolAddress, uint256 newAPY) external onlyOwner {
        YieldProtocol storage protocol = yieldProtocols[protocolAddress];
        require(protocol.isActive, "Protocol not active");
        require(
            block.timestamp >= protocol.lastUpdated + APY_UPDATE_FREQUENCY,
            "Update frequency not met"
        );
        
        uint256 oldAPY = protocol.currentAPY;
        protocol.currentAPY = newAPY;
        protocol.lastUpdated = block.timestamp;
        
        emit APYUpdated(protocolAddress, oldAPY, newAPY);
    }

    /**
     * @dev Update protocol risk assessment
     * @param protocolAddress Protocol address
     * @param newRiskLevel New risk level
     */
    function updateProtocolRisk(address protocolAddress, RiskLevel newRiskLevel) external onlyOwner {
        YieldProtocol storage protocol = yieldProtocols[protocolAddress];
        require(protocol.isActive, "Protocol not active");
        
        RiskLevel oldRisk = protocol.riskLevel;
        protocol.riskLevel = newRiskLevel;
        
        emit RiskAssessmentUpdated(protocolAddress, uint8(oldRisk), uint8(newRiskLevel));
    }

    /**
     * @dev Update fee structure
     * @param newManagementFee New management fee in basis points
     * @param newPerformanceFee New performance fee in basis points
     * @param newWithdrawalFee New withdrawal fee in basis points
     */
    function updateFees(
        uint256 newManagementFee,
        uint256 newPerformanceFee,
        uint256 newWithdrawalFee
    ) external onlyOwner {
        require(newManagementFee <= 500, "Management fee too high"); // Max 5%
        require(newPerformanceFee <= 2000, "Performance fee too high"); // Max 20%
        require(newWithdrawalFee <= 200, "Withdrawal fee too high"); // Max 2%
        
        managementFee = newManagementFee;
        performanceFee = newPerformanceFee;
        withdrawalFee = newWithdrawalFee;
    }

    /**
     * @dev Emergency withdrawal from all protocols
     */
    function emergencyWithdrawAll() external onlyOwner {
        for (uint256 i = 0; i < protocolList.length; i++) {
            address protocolAddr = protocolList[i];
            YieldProtocol storage protocol = yieldProtocols[protocolAddr];
            
            if (protocol.totalDeposited > 0) {
                // In real implementation, this would call the protocol's emergency withdraw
                emit EmergencyWithdrawal(protocolAddr, protocol.totalDeposited);
                protocol.totalDeposited = 0;
            }
        }
    }

    /**
     * @dev Get protocol statistics
     * @param protocolAddress Protocol address
     * @return name Protocol name
     * @return currentAPY Current APY in basis points
     * @return riskLevel Risk level of the protocol
     * @return totalDeposited Total amount deposited in protocol
     * @return totalYieldGenerated Total yield generated by protocol
     * @return status Current status of the protocol
     */
    function getProtocolStats(address protocolAddress) external view returns (
        string memory name,
        uint256 currentAPY,
        RiskLevel riskLevel,
        uint256 totalDeposited,
        uint256 totalYieldGenerated,
        ProtocolStatus status
    ) {
        YieldProtocol storage protocol = yieldProtocols[protocolAddress];
        return (
            protocol.name,
            protocol.currentAPY,
            protocol.riskLevel,
            protocol.totalDeposited,
            protocol.totalYieldGenerated,
            protocol.status
        );
    }

    /**
     * @dev Get all active protocols
     * @return Array of active protocol addresses
     */
    function getActiveProtocols() external view returns (address[] memory) {
        uint256 activeCount = 0;
        
        // Count active protocols
        for (uint256 i = 0; i < protocolList.length; i++) {
            if (yieldProtocols[protocolList[i]].isActive) {
                activeCount++;
            }
        }
        
        // Create array of active protocols
        address[] memory activeProtocols = new address[](activeCount);
        uint256 index = 0;
        
        for (uint256 i = 0; i < protocolList.length; i++) {
            if (yieldProtocols[protocolList[i]].isActive) {
                activeProtocols[index] = protocolList[i];
                index++;
            }
        }
        
        return activeProtocols;
    }
}