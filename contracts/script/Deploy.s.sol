// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/AnnotationMarketV2.sol";
import "../src/DatasetRegistry.sol";
import "../src/ModelRegistry.sol";
import "../src/PipelineSubscription.sol";
import "../src/DeviceRegistry.sol";

contract Deploy is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        // 1. Relayer Signer
        address relayerSigner;
        try vm.envAddress("RELAYER_SIGNER") returns (address s) {
            relayerSigner = s;
        } catch {
            relayerSigner = vm.addr(deployerPrivateKey);
        }

        // 2. Deploy Full Isolated Suite for Hardware Integration
        AnnotationMarketV2   marketV2     = new AnnotationMarketV2(relayerSigner);
        DatasetRegistry      registry     = new DatasetRegistry();
        ModelRegistry        models       = new ModelRegistry();
        PipelineSubscription subscription = new PipelineSubscription();
        DeviceRegistry       deviceReg    = new DeviceRegistry();

        // Allow relayer to record ingests on DeviceRegistry
        deviceReg.setRelayerAdmin(relayerSigner);

        vm.stopBroadcast();

        console.log("==================================================");
        console.log("  0G HEDA HARDWARE INTEGRATION DEPLOYED CONTRACTS ");
        console.log("==================================================");
        console.log("AnnotationMarketV2:  ", address(marketV2));
        console.log("DatasetRegistry:     ", address(registry));
        console.log("ModelRegistry:       ", address(models));
        console.log("PipelineSubscription:", address(subscription));
        console.log("DeviceRegistry:      ", address(deviceReg));
        console.log("RelayerSigner:       ", relayerSigner);
        console.log("==================================================");
    }
}
