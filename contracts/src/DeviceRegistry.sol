// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title DeviceRegistry
 * @notice Manages physical IoT camera devices, wallet ownership, and latest 0G Storage frame roots.
 */
contract DeviceRegistry {
    struct Device {
        address owner;
        string deviceName;
        bytes32 latestStorageRoot;
        uint256 totalFramesIngested;
        uint256 lastSeenTimestamp;
        uint256 assignedModelId;
        bool active;
    }

    // deviceId (e.g. "ESP32-94:E6:86:12:AB:CD") => Device details
    mapping(string => Device) public devices;
    mapping(address => string[]) private ownerDevices;

    address public relayerAdmin;

    event DevicePaired(string indexed deviceId, address indexed owner, string deviceName);
    event FrameIngested(string indexed deviceId, bytes32 indexed storageRoot, uint256 totalFrames);
    event ModelAssigned(string indexed deviceId, uint256 indexed modelId, bytes32 weightsRoot);

    modifier onlyOwner(string memory deviceId) {
        require(devices[deviceId].owner == msg.sender, "Not device owner");
        _;
    }

    modifier onlyRelayerOrOwner(string memory deviceId) {
        require(msg.sender == relayerAdmin || devices[deviceId].owner == msg.sender, "Unauthorized");
        _;
    }

    constructor() {
        relayerAdmin = msg.sender;
    }

    function setRelayerAdmin(address newAdmin) external {
        require(msg.sender == relayerAdmin, "Only admin");
        relayerAdmin = newAdmin;
    }

    function pairDevice(string calldata deviceId, string calldata deviceName) external {
        require(devices[deviceId].owner == address(0) || devices[deviceId].owner == msg.sender, "Device already paired to another wallet");

        if (devices[deviceId].owner == address(0)) {
            ownerDevices[msg.sender].push(deviceId);
        }

        devices[deviceId] = Device({
            owner: msg.sender,
            deviceName: deviceName,
            latestStorageRoot: bytes32(0),
            totalFramesIngested: devices[deviceId].totalFramesIngested,
            lastSeenTimestamp: block.timestamp,
            assignedModelId: 0,
            active: true
        });

        emit DevicePaired(deviceId, msg.sender, deviceName);
    }

    function recordIngest(string calldata deviceId, bytes32 storageRoot) external onlyRelayerOrOwner(deviceId) {
        Device storage d = devices[deviceId];
        require(d.active, "Device inactive");
        d.latestStorageRoot = storageRoot;
        d.totalFramesIngested += 1;
        d.lastSeenTimestamp = block.timestamp;

        emit FrameIngested(deviceId, storageRoot, d.totalFramesIngested);
    }

    function assignModelToDevice(string calldata deviceId, uint256 modelId, bytes32 weightsRoot) external onlyOwner(deviceId) {
        devices[deviceId].assignedModelId = modelId;
        emit ModelAssigned(deviceId, modelId, weightsRoot);
    }

    function getOwnerDevices(address owner) external view returns (string[] memory) {
        return ownerDevices[owner];
    }
}
