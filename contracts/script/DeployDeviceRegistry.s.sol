// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/DeviceRegistry.sol";

contract DeployDeviceRegistryScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        DeviceRegistry registry = new DeviceRegistry();

        vm.stopBroadcast();

        console.log("DeviceRegistry deployed to:", address(registry));
    }
}
