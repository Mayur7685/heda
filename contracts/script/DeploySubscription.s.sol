// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/PipelineSubscription.sol";

contract DeploySubscriptionScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        PipelineSubscription subscription = new PipelineSubscription();

        vm.stopBroadcast();

        console.log("PipelineSubscription deployed to:", address(subscription));
    }
}
