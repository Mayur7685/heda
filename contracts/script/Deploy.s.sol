// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/AnnotationMarket.sol";
import "../src/AnnotationMarketV2.sol";
import "../src/DatasetRegistry.sol";
import "../src/ModelRegistry.sol";
import "../src/PipelineSubscription.sol";

contract Deploy is Script {
    function run() external {
        vm.startBroadcast();

        AnnotationMarket     market       = new AnnotationMarket();
        DatasetRegistry      registry     = new DatasetRegistry();
        ModelRegistry        models       = new ModelRegistry();
        PipelineSubscription subscription = new PipelineSubscription();

        // V2: multi-annotator IoU market — RELAYER_SIGNER must be set in contracts/.env
        // The relayer signer is the backend wallet that auto-calls distributeRewards().
        // If RELAYER_SIGNER is not set, falls back to the deployer address.
        address relayerSigner;
        try vm.envAddress("RELAYER_SIGNER") returns (address s) {
            relayerSigner = s;
        } catch {
            relayerSigner = msg.sender; // deployer as relayer (dev mode)
        }
        AnnotationMarketV2 marketV2 = new AnnotationMarketV2(relayerSigner);

        vm.stopBroadcast();

        console.log("AnnotationMarket:    ", address(market));
        console.log("AnnotationMarketV2:  ", address(marketV2));
        console.log("  relayerSigner:     ", relayerSigner);
        console.log("DatasetRegistry:     ", address(registry));
        console.log("ModelRegistry:       ", address(models));
        console.log("PipelineSubscription:", address(subscription));
        console.log("Explorer: https://chainscan-galileo.0g.ai/address/");
    }
}
