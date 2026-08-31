// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/DeviceRegistry.sol";

contract DeviceRegistryTest is Test {
    DeviceRegistry public registry;
    address public owner = address(0x1111);
    address public relayer = address(0x2222);
    address public stranger = address(0x3333);

    string public constant DEVICE_ID = "ESP32-94:E6:86:12:AB:CD";

    function setUp() public {
        registry = new DeviceRegistry();
        registry.setRelayerAdmin(relayer);
    }

    function testPairDevice() public {
        vm.prank(owner);
        registry.pairDevice(DEVICE_ID, "Conveyor Cam 1");

        (
            address devOwner,
            string memory name,
            bytes32 root,
            uint256 count,
            uint256 lastSeen,
            uint256 modelId,
            bool active
        ) = registry.devices(DEVICE_ID);

        assertEq(devOwner, owner);
        assertEq(name, "Conveyor Cam 1");
        assertEq(root, bytes32(0));
        assertEq(count, 0);
        assertTrue(active);

        string[] memory list = registry.getOwnerDevices(owner);
        assertEq(list.length, 1);
        assertEq(list[0], DEVICE_ID);
    }

    function testCannotRePairToDifferentOwner() public {
        vm.prank(owner);
        registry.pairDevice(DEVICE_ID, "Owner Cam");

        vm.prank(stranger);
        vm.expectRevert("Device already paired to another wallet");
        registry.pairDevice(DEVICE_ID, "Stolen Cam");
    }

    function testRecordIngestByRelayer() public {
        vm.prank(owner);
        registry.pairDevice(DEVICE_ID, "Owner Cam");

        bytes32 sampleRoot = keccak256("0g_frame_merkle_root");

        vm.prank(relayer);
        registry.recordIngest(DEVICE_ID, sampleRoot);

        (,, bytes32 root, uint256 count,,, bool active) = registry.devices(DEVICE_ID);
        assertEq(root, sampleRoot);
        assertEq(count, 1);
        assertTrue(active);
    }

    function testAssignModelByOwner() public {
        vm.prank(owner);
        registry.pairDevice(DEVICE_ID, "Owner Cam");

        bytes32 weightsHash = keccak256("yolov8_weights_root");

        vm.prank(owner);
        registry.assignModelToDevice(DEVICE_ID, 42, weightsHash);

        (,,,,, uint256 assignedId,) = registry.devices(DEVICE_ID);
        assertEq(assignedId, 42);
    }

    function testStrangerCannotAssignModel() public {
        vm.prank(owner);
        registry.pairDevice(DEVICE_ID, "Owner Cam");

        bytes32 weightsHash = keccak256("yolov8_weights_root");

        vm.prank(stranger);
        vm.expectRevert("Not device owner");
        registry.assignModelToDevice(DEVICE_ID, 42, weightsHash);
    }
}
