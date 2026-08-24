// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/AnnotationMarket.sol";

contract AnnotationMarketTest is Test {
    AnnotationMarket market;
    address creator  = makeAddr("creator");
    address annotator = makeAddr("annotator");

    bytes32 constant DATA_ROOT = keccak256("raw-data");
    bytes32 constant ANNO_ROOT = keccak256("annotation");

    function setUp() public {
        market = new AnnotationMarket();
        vm.deal(creator, 10 ether);
        vm.deal(annotator, 1 ether);
    }

    function test_createJob() public {
        vm.prank(creator);
        uint256 jobId = market.createJob{value: 0.1 ether}(
            DATA_ROOT, "meta-uri", 0.01 ether, 10, AnnotationMarket.DataType.Image
        );
        assertEq(jobId, 0);

        AnnotationMarket.Job memory job = market.getJob(0);
        assertEq(job.creator, creator);
        assertEq(job.taskCount, 10);
        assertEq(job.rewardPerTask, 0.01 ether);
        assertTrue(job.active);
    }

    function test_createJob_budgetMismatch_reverts() public {
        vm.prank(creator);
        vm.expectRevert("budget mismatch");
        market.createJob{value: 0.05 ether}(DATA_ROOT, "meta", 0.01 ether, 10, AnnotationMarket.DataType.Image);
    }

    function test_submitWork() public {
        vm.prank(creator);
        market.createJob{value: 0.1 ether}(DATA_ROOT, "meta", 0.01 ether, 10, AnnotationMarket.DataType.Image);

        vm.prank(annotator);
        market.submitWork(0, 0, ANNO_ROOT);

        AnnotationMarket.Submission memory sub = market.getSubmission(0, 0);
        assertEq(sub.annotator, annotator);
        assertEq(sub.annotationRootHash, ANNO_ROOT);
        assertFalse(sub.approved);
    }

    function test_submitWork_duplicate_reverts() public {
        vm.prank(creator);
        market.createJob{value: 0.1 ether}(DATA_ROOT, "meta", 0.01 ether, 10, AnnotationMarket.DataType.Image);

        vm.prank(annotator);
        market.submitWork(0, 0, ANNO_ROOT);

        vm.prank(annotator);
        vm.expectRevert("task already submitted");
        market.submitWork(0, 0, ANNO_ROOT);
    }

    function test_approveWork_paysAnnotator() public {
        vm.prank(creator);
        market.createJob{value: 0.1 ether}(DATA_ROOT, "meta", 0.01 ether, 10, AnnotationMarket.DataType.Image);

        vm.prank(annotator);
        market.submitWork(0, 0, ANNO_ROOT);

        uint256 balBefore = annotator.balance;
        vm.prank(creator);
        market.approveWork(0, 0);

        assertEq(annotator.balance, balBefore + 0.01 ether);
        assertEq(market.getJob(0).approvedCount, 1);
    }

    function test_approveWork_onlyCreator_reverts() public {
        vm.prank(creator);
        market.createJob{value: 0.1 ether}(DATA_ROOT, "meta", 0.01 ether, 10, AnnotationMarket.DataType.Image);

        vm.prank(annotator);
        market.submitWork(0, 0, ANNO_ROOT);

        vm.prank(annotator);
        vm.expectRevert("not creator");
        market.approveWork(0, 0);
    }

    function test_rejectWork_resetsSubmission() public {
        vm.prank(creator);
        market.createJob{value: 0.1 ether}(DATA_ROOT, "meta", 0.01 ether, 10, AnnotationMarket.DataType.Image);

        vm.prank(annotator);
        market.submitWork(0, 0, ANNO_ROOT);

        vm.prank(creator);
        market.rejectWork(0, 0);

        AnnotationMarket.Submission memory sub = market.getSubmission(0, 0);
        assertFalse(sub.exists);
    }

    function test_closeJob_returnsUnspent() public {
        vm.prank(creator);
        market.createJob{value: 0.1 ether}(DATA_ROOT, "meta", 0.01 ether, 10, AnnotationMarket.DataType.Image);

        // approve 1 task
        vm.prank(annotator);
        market.submitWork(0, 0, ANNO_ROOT);
        vm.prank(creator);
        market.approveWork(0, 0);

        uint256 balBefore = creator.balance;
        vm.prank(creator);
        market.closeJob(0);

        // 9 unspent tasks × 0.01 ether = 0.09 ether returned
        assertEq(creator.balance, balBefore + 0.09 ether);
        assertFalse(market.getJob(0).active);
    }
}
