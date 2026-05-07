// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/AnnotationMarket.sol";
import "../src/DatasetRegistry.sol";

contract Deploy is Script {
    function run() external {
        vm.startBroadcast();

        AnnotationMarket market = new AnnotationMarket();
        DatasetRegistry registry = new DatasetRegistry();

        vm.stopBroadcast();

        console.log("AnnotationMarket:", address(market));
        console.log("DatasetRegistry: ", address(registry));
        console.log("Explorer:         https://chainscan-galileo.0g.ai/address/");
    }
}
