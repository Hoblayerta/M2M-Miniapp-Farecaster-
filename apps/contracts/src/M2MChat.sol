// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/security/ReentrancyGuard.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";

/**
 * @title M2MChat
 * @notice Sistema de mensajería anti-spam con contactos mutuos gratis y paquetes pagados
 * @dev Integra con XMTP - Vulnerabilidades corregidas + Sin límite de precio
 */
contract M2MChat is ReentrancyGuard, Ownable {
    using ECDSA for bytes32;

    // ═══════════════════════════════════════════════════════════
    // CONSTANTS
    // ═══════════════════════════════════════════════════════════

    address public constant CUSD_TOKEN = 0x765DE816845861e75A25fCA122bb6898B8B1282a;
    uint256 public constant PLATFORM_FEE_PERCENT = 5; // 5%
    uint256 public constant MIN_PACKAGE_SIZE = 10;
    uint256 public constant MAX_PACKAGE_SIZE = 10000;

    // ═══════════════════════════════════════════════════════════
    // STATE VARIABLES
    // ═══════════════════════════════════════════════════════════

    address public immutable feeCollector;
    address public relayer;
    bool public paused;

    // Contactos mutuos
    mapping(address => mapping(address => bool)) public hasAddedContact;

    // Pricing por usuario (sin límite máximo)
    mapping(address => uint256) public pricePerMessage;

    // Balances de mensajes
    struct MessageBalance {
        uint256 purchased;
        uint256 consumed;
        uint256 lastCheckpoint;
        uint256 nonce;
    }

    mapping(address => mapping(address => MessageBalance)) public balances;

    // ═══════════════════════════════════════════════════════════
    // EVENTS
    // ═══════════════════════════════════════════════════════════

    event ContactAdded(address indexed user, address indexed contact);
    event ContactRemoved(address indexed user, address indexed contact);
    event PriceSet(address indexed user, uint256 pricePerMessage);
    event PackagePurchased(
        address indexed sender,
        address indexed receiver,
        uint256 messageCount,
        uint256 totalPaid,
        uint256 pricePerMessage
    );
    event ConsumptionUpdated(
        address indexed sender,
        address indexed receiver,
        uint256 consumed
    );
    event RelayerUpdated(address indexed newRelayer);
    event Paused();
    event Unpaused();

    // ═══════════════════════════════════════════════════════════
    // ERRORS
    // ═══════════════════════════════════════════════════════════

    error ContractPaused();
    error InvalidAddress();
    error InvalidPrice();
    error InvalidPackageSize();
    error AlreadyAdded();
    error NotAdded();
    error PriceNotSet();
    error InsufficientBalance();
    error InvalidSignature();
    error InvalidNonce();
    error Unauthorized();
    error ArithmeticOverflow();

    // ═══════════════════════════════════════════════════════════
    // MODIFIERS
    // ═══════════════════════════════════════════════════════════

    modifier whenNotPaused() {
        if (paused) revert ContractPaused();
        _;
    }

    modifier onlyRelayer() {
        if (msg.sender != relayer) revert Unauthorized();
        _;
    }

    // ═══════════════════════════════════════════════════════════
    // CONSTRUCTOR
    // ═══════════════════════════════════════════════════════════

    constructor(address _feeCollector, address _relayer) {
        if (_feeCollector == address(0) || _relayer == address(0))
            revert InvalidAddress();

        feeCollector = _feeCollector;
        relayer = _relayer;
        _transferOwnership(msg.sender);
    }

    // ═══════════════════════════════════════════════════════════
    // CONTACTOS MUTUOS
    // ═══════════════════════════════════════════════════════════

    function addContact(address contact) external whenNotPaused {
        if (contact == address(0)) revert InvalidAddress();
        if (contact == msg.sender) revert InvalidAddress();
        if (hasAddedContact[msg.sender][contact]) revert AlreadyAdded();

        hasAddedContact[msg.sender][contact] = true;
        emit ContactAdded(msg.sender, contact);
    }

    function removeContact(address contact) external whenNotPaused {
        if (!hasAddedContact[msg.sender][contact]) revert NotAdded();

        hasAddedContact[msg.sender][contact] = false;
        emit ContactRemoved(msg.sender, contact);
    }

    function areMutualContacts(address user1, address user2)
        public
        view
        returns (bool)
    {
        return hasAddedContact[user1][user2] && hasAddedContact[user2][user1];
    }

    // ═══════════════════════════════════════════════════════════
    // PRICING (SIN LÍMITE MÁXIMO)
    // ═══════════════════════════════════════════════════════════

    function setMyMessagePrice(uint256 _pricePerMessage) external whenNotPaused {
        if (_pricePerMessage == 0) revert InvalidPrice();

        pricePerMessage[msg.sender] = _pricePerMessage;
        emit PriceSet(msg.sender, _pricePerMessage);
    }

    // ═══════════════════════════════════════════════════════════
    // COMPRA DE PAQUETES
    // ═══════════════════════════════════════════════════════════

    function buyMessagePackage(address receiver, uint256 messageCount)
        external
        nonReentrant
        whenNotPaused
    {
        // CHECKS
        if (receiver == address(0)) revert InvalidAddress();
        if (receiver == msg.sender) revert InvalidAddress();
        if (messageCount < MIN_PACKAGE_SIZE || messageCount > MAX_PACKAGE_SIZE)
            revert InvalidPackageSize();

        uint256 price = pricePerMessage[receiver];
        if (price == 0) revert PriceNotSet();

        // OVERFLOW PROTECTION
        uint256 maxAllowedCount = type(uint256).max / price;
        if (messageCount > maxAllowedCount) revert ArithmeticOverflow();

        uint256 totalCost = price * messageCount;

        uint256 maxAllowedTotal = type(uint256).max / PLATFORM_FEE_PERCENT;
        if (totalCost > maxAllowedTotal) revert ArithmeticOverflow();

        uint256 platformFee = (totalCost * PLATFORM_FEE_PERCENT) / 100;
        uint256 receiverAmount = totalCost - platformFee;

        // INTERACTIONS 1: Sacar fondos del usuario
        bool success = IERC20(CUSD_TOKEN).transferFrom(
            msg.sender,
            address(this),
            totalCost
        );
        require(success, "Transfer from sender failed");

        // EFFECTS: Actualizar estado
        MessageBalance storage balance = balances[msg.sender][receiver];
        balance.purchased += messageCount;
        balance.lastCheckpoint = block.timestamp;

        // INTERACTIONS 2 y 3: Distribuir fondos
        bool successReceiver = IERC20(CUSD_TOKEN).transfer(receiver, receiverAmount);
        require(successReceiver, "Transfer to receiver failed");

        bool successFee = IERC20(CUSD_TOKEN).transfer(feeCollector, platformFee);
        require(successFee, "Transfer to fee collector failed");

        emit PackagePurchased(msg.sender, receiver, messageCount, totalCost, price);
    }

    // ═══════════════════════════════════════════════════════════
    // VERIFICACIÓN DE PERMISOS
    // ═══════════════════════════════════════════════════════════

    function canChat(address sender, address receiver)
        external
        view
        returns (
            bool allowed,
            string memory accessType,
            uint256 messagesAvailable
        )
    {
        if (areMutualContacts(sender, receiver)) {
            return (true, "mutual", type(uint256).max);
        }

        MessageBalance memory balance = balances[sender][receiver];
        uint256 available = balance.purchased > balance.consumed
            ? balance.purchased - balance.consumed
            : 0;

        if (available > 0) {
            return (true, "paid", available);
        }

        return (false, "none", 0);
    }

    function getAvailableMessages(address sender, address receiver)
        external
        view
        returns (uint256)
    {
        MessageBalance memory balance = balances[sender][receiver];
        return balance.purchased > balance.consumed
            ? balance.purchased - balance.consumed
            : 0;
    }

    // ═══════════════════════════════════════════════════════════
    // CHECKPOINTS
    // ═══════════════════════════════════════════════════════════

    function updateConsumption(
        address sender,
        address receiver,
        uint256 newConsumed,
        bytes memory signature
    ) external onlyRelayer whenNotPaused {
        MessageBalance storage balance = balances[sender][receiver];

        if (newConsumed > balance.purchased) revert InsufficientBalance();
        if (newConsumed < balance.consumed) revert InvalidNonce();

        bytes32 messageHash = keccak256(
            abi.encodePacked(sender, receiver, newConsumed, balance.nonce, block.chainid)
        );
        bytes32 ethSignedHash = messageHash.toEthSignedMessageHash();

        if (ethSignedHash.recover(signature) != relayer) revert InvalidSignature();

        balance.consumed = newConsumed;
        balance.lastCheckpoint = block.timestamp;
        balance.nonce++;

        emit ConsumptionUpdated(sender, receiver, newConsumed);
    }

    // ═══════════════════════════════════════════════════════════
    // ADMIN
    // ═══════════════════════════════════════════════════════════

    function setRelayer(address newRelayer) external onlyOwner {
        if (newRelayer == address(0)) revert InvalidAddress();
        relayer = newRelayer;
        emit RelayerUpdated(newRelayer);
    }

    function pause() external onlyOwner {
        paused = true;
        emit Paused();
    }

    function unpause() external onlyOwner {
        paused = false;
        emit Unpaused();
    }

    function emergencyWithdrawStuckTokens(address token, uint256 amount)
        external
        onlyOwner
    {
        require(IERC20(token).transfer(owner(), amount), "Emergency withdraw failed");
    }
}

interface IERC20 {
    function transferFrom(address from, address to, uint256 amount) external returns (bool);
    function transfer(address to, uint256 amount) external returns (bool);
    function balanceOf(address account) external view returns (uint256);
}
