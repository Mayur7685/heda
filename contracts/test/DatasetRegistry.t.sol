// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/DatasetRegistry.sol";

contract DatasetRegistryTest is Test {
    DatasetRegistry registry;
    address publisher = makeAddr("publisher");
    address buyer     = makeAddr("buyer");

    bytes32 constant ROOT = keccak256("dataset-root");

    function setUp() public {
        registry = new DatasetRegistry();
        vm.deal(publisher, 5 ether);
        vm.deal(buyer, 5 ether);
    }

    function test_publish() public {
        vm.prank(publisher);
        uint256 id = registry.publish(ROOT, "meta-uri", 1 ether, DatasetRegistry.DataType.Image, 0);
        assertEq(id, 0);

        DatasetRegistry.Dataset memory d = registry.getDataset(0);
        assertEq(d.publisher, publisher);
        assertEq(d.rootHash, ROOT);
        assertEq(d.price, 1 ether);
        assertTrue(d.exists);
    }

    function test_publish_zeroRootHash_reverts() public {
        vm.prank(publisher);
        vm.expectRevert("invalid root hash");
        registry.publish(bytes32(0), "meta", 0, DatasetRegistry.DataType.Text, 0);
    }

    function test_publisherHasLicenseAutomatically() public {
        vm.prank(publisher);
        registry.publish(ROOT, "meta", 1 ether, DatasetRegistry.DataType.Image, 0);
        assertTrue(registry.hasLicense(0, publisher));
    }

    function test_purchase_grantsLicense() public {
        vm.prank(publisher);
        registry.publish(ROOT, "meta", 1 ether, DatasetRegistry.DataType.Image, 0);

        uint256 pubBalBefore = publisher.balance;
        vm.prank(buyer);
        registry.purchase{value: 1 ether}(0);

        assertTrue(registry.hasLicense(0, buyer));
        assertEq(publisher.balance, pubBalBefore + 1 ether);
    }

    function test_purchase_refundsOverpayment() public {
        vm.prank(publisher);
        registry.publish(ROOT, "meta", 1 ether, DatasetRegistry.DataType.Image, 0);

        uint256 buyerBalBefore = buyer.balance;
        vm.prank(buyer);
        registry.purchase{value: 2 ether}(0); // overpay by 1 ether

        // buyer paid 1 ether, got 1 ether back
        assertEq(buyer.balance, buyerBalBefore - 1 ether);
    }

    function test_purchase_insufficientPayment_reverts() public {
        vm.prank(publisher);
        registry.publish(ROOT, "meta", 1 ether, DatasetRegistry.DataType.Image, 0);

        vm.prank(buyer);
        vm.expectRevert("insufficient payment");
        registry.purchase{value: 0.5 ether}(0);
    }

    function test_purchase_alreadyLicensed_reverts() public {
        vm.prank(publisher);
        registry.publish(ROOT, "meta", 1 ether, DatasetRegistry.DataType.Image, 0);

        vm.prank(buyer);
        registry.purchase{value: 1 ether}(0);

        vm.prank(buyer);
        vm.expectRevert("already licensed");
        registry.purchase{value: 1 ether}(0);
    }

    function test_freeDataset() public {
        vm.prank(publisher);
        registry.publish(ROOT, "meta", 0, DatasetRegistry.DataType.Text, 0);

        vm.prank(buyer);
        registry.purchase{value: 0}(0);
        assertTrue(registry.hasLicense(0, buyer));
    }

    function test_totalDatasets() public {
        vm.startPrank(publisher);
        registry.publish(ROOT, "meta1", 0, DatasetRegistry.DataType.Image, 0);
        registry.publish(keccak256("root2"), "meta2", 0, DatasetRegistry.DataType.Text, 0);
        vm.stopPrank();

        assertEq(registry.totalDatasets(), 2);
    }
}
