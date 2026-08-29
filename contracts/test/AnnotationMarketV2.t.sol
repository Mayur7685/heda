// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/AnnotationMarketV2.sol";

contract AnnotationMarketV2Test is Test {
    AnnotationMarketV2 market;

    address relayer   = makeAddr("relayer");
    address creator   = makeAddr("creator");
    address alice     = makeAddr("alice");
    address bob       = makeAddr("bob");
    address carol     = makeAddr("carol");
    address dave      = makeAddr("dave");
    address eve       = makeAddr("eve");

    bytes32 constant DATA_ROOT  = keccak256("raw-data");
    bytes32 constant ANNO_ALICE = keccak256("anno-alice");
    bytes32 constant ANNO_BOB   = keccak256("anno-bob");
    bytes32 constant ANNO_CAROL = keccak256("anno-carol");

    uint256 constant REWARD_PER_TASK = 0.01 ether;
    uint256 constant TASK_COUNT      = 5;
    uint256 constant TOTAL_BUDGET    = REWARD_PER_TASK * TASK_COUNT; // 0.05 ether

    function setUp() public {
        market = new AnnotationMarketV2(relayer);
        vm.deal(creator, 10 ether);
        vm.deal(alice,   1 ether);
        vm.deal(bob,     1 ether);
        vm.deal(carol,   1 ether);
        vm.deal(dave,    1 ether);
        vm.deal(eve,     1 ether);
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    function _createJob(uint8 maxAnnotators) internal returns (uint256 jobId) {
        vm.prank(creator);
        jobId = market.createJob{value: TOTAL_BUDGET}(
            DATA_ROOT,
            "meta-uri",
            REWARD_PER_TASK,
            TASK_COUNT,
            maxAnnotators,
            AnnotationMarketV2.DataType.Image
        );
    }

    // ── Test: createJob ───────────────────────────────────────────────────────

    function test_createJob_locksCorrectETH() public {
        uint256 jobId = _createJob(5);
        assertEq(jobId, 0);

        AnnotationMarketV2.Job memory job = market.getJob(0);
        assertEq(job.creator, creator);
        assertEq(job.taskCount, TASK_COUNT);
        assertEq(job.rewardPerTask, REWARD_PER_TASK);
        assertEq(job.maxAnnotatorsPerTask, 5);
        assertTrue(job.active);
        assertEq(address(market).balance, TOTAL_BUDGET);
    }

    function test_createJob_budgetMismatch_reverts() public {
        vm.prank(creator);
        vm.expectRevert("budget mismatch");
        market.createJob{value: 0.01 ether}(
            DATA_ROOT, "meta", REWARD_PER_TASK, TASK_COUNT, 5, AnnotationMarketV2.DataType.Image
        );
    }

    function test_createJob_invalidMaxAnnotators_reverts() public {
        vm.prank(creator);
        vm.expectRevert("max annotators 1-5");
        market.createJob{value: TOTAL_BUDGET}(
            DATA_ROOT, "meta", REWARD_PER_TASK, TASK_COUNT, 6, AnnotationMarketV2.DataType.Image
        );
    }

    // ── Test: submitWork (open, no claim) ─────────────────────────────────────

    function test_submitWork_openNoClaimNeeded() public {
        _createJob(5);

        // Alice submits with no prior claim
        vm.prank(alice);
        market.submitWork(0, 0, ANNO_ALICE);

        AnnotationMarketV2.TaskSubmission[] memory subs = market.getTaskSubmissions(0, 0);
        assertEq(subs.length, 1);
        assertEq(subs[0].annotator, alice);
        assertEq(subs[0].annotationRootHash, ANNO_ALICE);
        assertFalse(subs[0].rewarded);
    }

    function test_submitWork_multipleAnnotators() public {
        _createJob(5);

        vm.prank(alice);  market.submitWork(0, 0, ANNO_ALICE);
        vm.prank(bob);    market.submitWork(0, 0, ANNO_BOB);
        vm.prank(carol);  market.submitWork(0, 0, ANNO_CAROL);

        assertEq(market.getSubmissionCount(0, 0), 3);
    }

    function test_submitWork_duplicateAnnotator_reverts() public {
        _createJob(5);
        vm.prank(alice);
        market.submitWork(0, 0, ANNO_ALICE);

        vm.prank(alice);
        vm.expectRevert("already submitted for this task");
        market.submitWork(0, 0, keccak256("alice-v2"));
    }

    function test_submitWork_slotsFull_reverts() public {
        _createJob(3); // only 3 slots

        vm.prank(alice); market.submitWork(0, 0, ANNO_ALICE);
        vm.prank(bob);   market.submitWork(0, 0, ANNO_BOB);
        vm.prank(carol); market.submitWork(0, 0, ANNO_CAROL);

        vm.prank(dave);
        vm.expectRevert("task slots full");
        market.submitWork(0, 0, keccak256("dave-anno"));
    }

    function test_submitWork_emitsEvaluationTriggered_whenFull() public {
        _createJob(2);

        vm.prank(alice); market.submitWork(0, 0, ANNO_ALICE);

        vm.expectEmit(true, true, false, true);
        emit AnnotationMarketV2.EvaluationTriggered(0, 0, address(0));

        vm.prank(bob); market.submitWork(0, 0, ANNO_BOB);
    }

    // ── Test: triggerEvaluation ───────────────────────────────────────────────

    function test_triggerEvaluation_emitsEvent() public {
        _createJob(5);
        vm.prank(alice); market.submitWork(0, 0, ANNO_ALICE);

        vm.expectEmit(true, true, false, true);
        emit AnnotationMarketV2.EvaluationTriggered(0, 0, creator);

        vm.prank(creator);
        market.triggerEvaluation(0, 0);
    }

    function test_triggerEvaluation_onlyCreator_reverts() public {
        _createJob(5);
        vm.prank(alice); market.submitWork(0, 0, ANNO_ALICE);

        vm.prank(alice);
        vm.expectRevert("only creator");
        market.triggerEvaluation(0, 0);
    }

    function test_triggerEvaluation_noSubmissions_reverts() public {
        _createJob(5);

        vm.prank(creator);
        vm.expectRevert("no submissions yet");
        market.triggerEvaluation(0, 0);
    }

    // ── Test: distributeRewards ───────────────────────────────────────────────

    function test_distributeRewards_byRelayer_proportionalPayout() public {
        _createJob(5);
        vm.prank(alice); market.submitWork(0, 0, ANNO_ALICE);
        vm.prank(bob);   market.submitWork(0, 0, ANNO_BOB);

        address[] memory annotators = new address[](2);
        annotators[0] = alice;
        annotators[1] = bob;

        uint256[] memory shares = new uint256[](2);
        shares[0] = 6000; // 60%
        shares[1] = 4000; // 40%

        uint256 aliceBefore = alice.balance;
        uint256 bobBefore   = bob.balance;

        vm.prank(relayer);
        market.distributeRewards(0, 0, annotators, shares);

        assertEq(alice.balance, aliceBefore + (REWARD_PER_TASK * 6000) / 10000);
        assertEq(bob.balance,   bobBefore   + (REWARD_PER_TASK * 4000) / 10000);
        assertEq(market.getJob(0).approvedTaskCount, 1);
    }

    function test_distributeRewards_byCreator_works() public {
        _createJob(5);
        vm.prank(alice); market.submitWork(0, 0, ANNO_ALICE);

        address[] memory annotators = new address[](1);
        annotators[0] = alice;
        uint256[] memory shares = new uint256[](1);
        shares[0] = 10000;

        uint256 aliceBefore = alice.balance;

        vm.prank(creator); // creator, not relayer
        market.distributeRewards(0, 0, annotators, shares);

        assertEq(alice.balance, aliceBefore + REWARD_PER_TASK);
    }

    function test_distributeRewards_invalidShares_reverts() public {
        _createJob(5);
        vm.prank(alice); market.submitWork(0, 0, ANNO_ALICE);

        address[] memory annotators = new address[](1);
        annotators[0] = alice;
        uint256[] memory shares = new uint256[](1);
        shares[0] = 9999; // not 10000

        vm.prank(relayer);
        vm.expectRevert("shares must sum to 10000");
        market.distributeRewards(0, 0, annotators, shares);
    }

    function test_distributeRewards_unauthorizedCaller_reverts() public {
        _createJob(5);
        vm.prank(alice); market.submitWork(0, 0, ANNO_ALICE);

        address[] memory annotators = new address[](1);
        annotators[0] = alice;
        uint256[] memory shares = new uint256[](1);
        shares[0] = 10000;

        vm.prank(bob); // not relayer, not creator
        vm.expectRevert("not authorized");
        market.distributeRewards(0, 0, annotators, shares);
    }

    function test_distributeRewards_alreadyRewarded_reverts() public {
        _createJob(5);
        vm.prank(alice); market.submitWork(0, 0, ANNO_ALICE);

        address[] memory annotators = new address[](1);
        annotators[0] = alice;
        uint256[] memory shares = new uint256[](1);
        shares[0] = 10000;

        vm.prank(relayer);
        market.distributeRewards(0, 0, annotators, shares);

        // Try again — should revert
        vm.prank(relayer);
        vm.expectRevert("task already rewarded");
        market.distributeRewards(0, 0, annotators, shares);
    }

    function test_autoClose_whenAllTasksRewarded() public {
        _createJob(5); // 5 tasks

        address[] memory annotators = new address[](1);
        uint256[] memory shares = new uint256[](1);
        shares[0] = 10000;

        address[5] memory annotatorList = [alice, bob, carol, dave, eve];

        // Reward each of the 5 tasks one by one
        for (uint256 taskId = 0; taskId < TASK_COUNT; taskId++) {
            vm.prank(annotatorList[taskId]);
            market.submitWork(0, taskId, keccak256(abi.encodePacked("anno", taskId)));

            annotators[0] = annotatorList[taskId];
            vm.prank(relayer);
            market.distributeRewards(0, taskId, annotators, shares);
        }

        assertFalse(market.getJob(0).active); // auto-closed
    }

    // ── Test: closeJob ────────────────────────────────────────────────────────

    function test_closeJob_returnsUnspentToCreator() public {
        _createJob(5);
        vm.prank(alice); market.submitWork(0, 0, ANNO_ALICE);

        address[] memory annotators = new address[](1);
        annotators[0] = alice;
        uint256[] memory shares = new uint256[](1);
        shares[0] = 10000;

        vm.prank(relayer);
        market.distributeRewards(0, 0, annotators, shares); // approve task 0

        uint256 balBefore = creator.balance;
        vm.prank(creator);
        market.closeJob(0);

        // 4 unspent tasks * 0.01 ether = 0.04 ether
        assertEq(creator.balance, balBefore + 4 * REWARD_PER_TASK);
        assertFalse(market.getJob(0).active);
    }
}
