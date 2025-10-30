pragma solidity ^0.8.24;

import { FHE, euint32, ebool } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

contract AiPreferenceNFT_FHE is SepoliaConfig {
    using FHE for euint32;
    using FHE for ebool;

    address public owner;
    mapping(address => bool) public isProvider;
    bool public paused;
    uint256 public cooldownSeconds;
    mapping(address => uint256) public lastSubmissionTime;
    mapping(address => uint256) public lastDecryptionRequestTime;

    uint256 public currentBatchId;
    mapping(uint256 => bool) public batchClosed;

    struct DecryptionContext {
        uint256 batchId;
        bytes32 stateHash;
        bool processed;
    }
    mapping(uint256 => DecryptionContext) public decryptionContexts;

    struct EncryptedPreference {
        euint32 tone;
        euint32 knowledgeScope;
        euint32 interactionStyle;
    }
    mapping(uint256 => mapping(address => EncryptedPreference)) public encryptedPreferences;

    event OwnershipTransferred(address indexed oldOwner, address indexed newOwner);
    event ProviderAdded(address indexed provider);
    event ProviderRemoved(address indexed provider);
    event Paused(address indexed account);
    event Unpaused(address indexed account);
    event CooldownSecondsChanged(uint256 oldCooldownSeconds, uint256 newCooldownSeconds);
    event BatchOpened(uint256 indexed batchId);
    event BatchClosed(uint256 indexed batchId);
    event PreferenceSubmitted(address indexed user, uint256 indexed batchId);
    event DecryptionRequested(uint256 indexed requestId, uint256 indexed batchId);
    event DecryptionCompleted(uint256 indexed requestId, uint256 indexed batchId, uint256 tone, uint256 knowledgeScope, uint256 interactionStyle);

    error NotOwner();
    error NotProvider();
    error PausedError();
    error CooldownActive();
    error BatchClosedError();
    error InvalidBatchId();
    error ReplayAttempt();
    error StateMismatch();
    error InvalidProof();

    modifier onlyOwner() {
        if (msg.sender != owner) revert NotOwner();
        _;
    }

    modifier onlyProvider() {
        if (!isProvider[msg.sender]) revert NotProvider();
        _;
    }

    modifier whenNotPaused() {
        if (paused) revert PausedError();
        _;
    }

    constructor() {
        owner = msg.sender;
        isProvider[owner] = true;
        emit ProviderAdded(owner);
        currentBatchId = 1;
        emit BatchOpened(currentBatchId);
        cooldownSeconds = 60; // Default cooldown
    }

    function transferOwnership(address newOwner) external onlyOwner {
        address oldOwner = owner;
        owner = newOwner;
        emit OwnershipTransferred(oldOwner, newOwner);
    }

    function addProvider(address provider) external onlyOwner {
        if (!isProvider[provider]) {
            isProvider[provider] = true;
            emit ProviderAdded(provider);
        }
    }

    function removeProvider(address provider) external onlyOwner {
        if (isProvider[provider]) {
            isProvider[provider] = false;
            emit ProviderRemoved(provider);
        }
    }

    function pause() external onlyOwner whenNotPaused {
        paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external onlyOwner {
        if (!paused) revert PausedError(); // Revert if already unpaused
        paused = false;
        emit Unpaused(msg.sender);
    }

    function setCooldownSeconds(uint256 newCooldownSeconds) external onlyOwner {
        uint256 oldCooldownSeconds = cooldownSeconds;
        cooldownSeconds = newCooldownSeconds;
        emit CooldownSecondsChanged(oldCooldownSeconds, newCooldownSeconds);
    }

    function openNewBatch() external onlyOwner {
        currentBatchId++;
        emit BatchOpened(currentBatchId);
    }

    function closeBatch(uint256 batchId) external onlyOwner {
        if (batchId == 0 || batchId > currentBatchId) revert InvalidBatchId();
        if (batchClosed[batchId]) revert BatchClosedError();
        batchClosed[batchId] = true;
        emit BatchClosed(batchId);
    }

    function submitEncryptedPreference(
        address user,
        euint32 _tone,
        euint32 _knowledgeScope,
        euint32 _interactionStyle
    ) external onlyProvider whenNotPaused {
        if (block.timestamp < lastSubmissionTime[user] + cooldownSeconds) {
            revert CooldownActive();
        }
        if (batchClosed[currentBatchId]) revert BatchClosedError();

        _initIfNeeded(_tone);
        _initIfNeeded(_knowledgeScope);
        _initIfNeeded(_interactionStyle);

        encryptedPreferences[currentBatchId][user] = EncryptedPreference(_tone, _knowledgeScope, _interactionStyle);
        lastSubmissionTime[user] = block.timestamp;
        emit PreferenceSubmitted(user, currentBatchId);
    }

    function requestDecryptionForUser(uint256 batchId, address user) external whenNotPaused {
        if (block.timestamp < lastDecryptionRequestTime[user] + cooldownSeconds) {
            revert CooldownActive();
        }
        if (batchId == 0 || batchId > currentBatchId || !FHE.isInitialized(encryptedPreferences[batchId][user].tone)) {
            revert InvalidBatchId();
        }
        if (!batchClosed[batchId]) revert BatchClosedError(); // Must be closed for decryption

        EncryptedPreference storage pref = encryptedPreferences[batchId][user];

        euint32[] memory ctsArray = new euint32[](3);
        ctsArray[0] = pref.tone;
        ctsArray[1] = pref.knowledgeScope;
        ctsArray[2] = pref.interactionStyle;

        bytes32 stateHash = _hashCiphertexts(ctsArray);
        uint256 requestId = FHE.requestDecryption(ctsArray, this.myCallback.selector);
        decryptionContexts[requestId] = DecryptionContext(batchId, stateHash, false);
        lastDecryptionRequestTime[user] = block.timestamp;
        emit DecryptionRequested(requestId, batchId);
    }

    function myCallback(uint256 requestId, bytes memory cleartexts, bytes memory proof) public {
        if (decryptionContexts[requestId].processed) revert ReplayAttempt();

        // Rebuild ciphertexts from storage in the exact same order
        uint256 batchId = decryptionContexts[requestId].batchId;
        EncryptedPreference storage pref = encryptedPreferences[batchId][msg.sender]; // msg.sender is the user from requestDecryptionForUser
        euint32[] memory ctsArray = new euint32[](3);
        ctsArray[0] = pref.tone;
        ctsArray[1] = pref.knowledgeScope;
        ctsArray[2] = pref.interactionStyle;

        // State Verification: Ensure ciphertexts haven't changed since request
        bytes32 currentHash = _hashCiphertexts(ctsArray);
        if (currentHash != decryptionContexts[requestId].stateHash) revert StateMismatch();

        // Proof Verification
        if (!FHE.checkSignatures(requestId, cleartexts, proof)) revert InvalidProof();

        // Decode cleartexts in the same order
        uint256 tone = abi.decode(cleartexts, (uint256));
        cleartexts = cleartexts[32:];
        uint256 knowledgeScope = abi.decode(cleartexts, (uint256));
        cleartexts = cleartexts[32:];
        uint256 interactionStyle = abi.decode(cleartexts, (uint256));

        decryptionContexts[requestId].processed = true;
        emit DecryptionCompleted(requestId, batchId, tone, knowledgeScope, interactionStyle);
    }

    function _hashCiphertexts(euint32[] memory ctsArray) internal pure returns (bytes32) {
        bytes32[3] memory ctsBytes;
        for (uint i = 0; i < ctsArray.length; i++) {
            ctsBytes[i] = FHE.toBytes32(ctsArray[i]);
        }
        return keccak256(abi.encode(ctsBytes, address(this)));
    }

    function _initIfNeeded(euint32 val) internal pure {
        if (!FHE.isInitialized(val)) {
            FHE.asEuint32(0); // Initialize if not already
        }
    }

    function _requireInitialized(euint32 val) internal pure {
        if (!FHE.isInitialized(val)) revert("Not initialized");
    }
}