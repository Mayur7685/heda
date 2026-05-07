// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title AnnotationMarket
/// @notice Trustless annotation job escrow.
///         Creator posts job with ETH bounty locked in contract.
///         Annotators submit work (stored on 0G Storage, identified by root hash).
///         Creator approves → annotator paid instantly. Reject → task reopens.
contract AnnotationMarket {
    enum DataType { Image, Text }

    struct Job {
        address creator;
        bytes32 dataRootHash;   // 0G Storage root hash of raw data
        string  metadataURI;    // 0G Storage root hash of metadata JSON (instructions, classes)
        uint256 rewardPerTask;  // wei per approved task
        uint256 taskCount;
        uint256 approvedCount;
        DataType dataType;
        bool active;
    }

    struct Submission {
        address annotator;
        bytes32 annotationRootHash; // 0G Storage root hash of annotation file
        bool    approved;
        bool    exists;
    }

    mapping(uint256 => Job) public jobs;
    mapping(uint256 => mapping(uint256 => Submission)) public submissions;
    // Claim system: prevents multiple annotators wasting work on the same task
    mapping(uint256 => mapping(uint256 => address)) public claims;
    mapping(uint256 => mapping(uint256 => uint256)) public claimExpiry;
    uint256 public constant CLAIM_DURATION = 30 minutes;
    uint256 public nextJobId;

    event TaskClaimed(uint256 indexed jobId, uint256 indexed taskId, address indexed annotator);

    event JobCreated(
        uint256 indexed jobId,
        address indexed creator,
        bytes32 dataRootHash,
        uint256 rewardPerTask,
        uint256 taskCount,
        DataType dataType
    );
    event WorkSubmitted(uint256 indexed jobId, uint256 indexed taskId, address indexed annotator, bytes32 annotationRootHash);
    event WorkApproved(uint256 indexed jobId, uint256 indexed taskId, address indexed annotator, uint256 reward);
    event WorkRejected(uint256 indexed jobId, uint256 indexed taskId);
    event JobClosed(uint256 indexed jobId, uint256 unspentReturned);

    function createJob(
        bytes32 dataRootHash,
        string calldata metadataURI,
        uint256 rewardPerTask,
        uint256 taskCount,
        DataType dataType
    ) external payable returns (uint256 jobId) {
        require(msg.value == rewardPerTask * taskCount, "budget mismatch");
        require(taskCount > 0 && rewardPerTask > 0, "invalid params");

        jobId = nextJobId++;
        jobs[jobId] = Job({
            creator: msg.sender,
            dataRootHash: dataRootHash,
            metadataURI: metadataURI,
            rewardPerTask: rewardPerTask,
            taskCount: taskCount,
            approvedCount: 0,
            dataType: dataType,
            active: true
        });

        emit JobCreated(jobId, msg.sender, dataRootHash, rewardPerTask, taskCount, dataType);
    }

    /// @notice Reserve a task before annotating. Expires in 30 min if not submitted.
    function claimTask(uint256 jobId, uint256 taskId) external {
        Job storage job = jobs[jobId];
        require(job.active, "job not active");
        require(taskId < job.taskCount, "invalid taskId");
        require(!submissions[jobId][taskId].exists, "already submitted");
        // Allow claim if unclaimed or previous claim expired
        require(
            claims[jobId][taskId] == address(0) || block.timestamp > claimExpiry[jobId][taskId],
            "task already claimed"
        );
        claims[jobId][taskId] = msg.sender;
        claimExpiry[jobId][taskId] = block.timestamp + CLAIM_DURATION;
        emit TaskClaimed(jobId, taskId, msg.sender);
    }

    function isTaskAvailable(uint256 jobId, uint256 taskId) external view returns (bool) {
        if (submissions[jobId][taskId].exists) return false;
        if (claims[jobId][taskId] == address(0)) return true;
        return block.timestamp > claimExpiry[jobId][taskId];
    }

    function getTaskClaimer(uint256 jobId, uint256 taskId) external view returns (address claimer, uint256 expiry) {
        return (claims[jobId][taskId], claimExpiry[jobId][taskId]);
    }

    function submitWork(
        uint256 jobId,
        uint256 taskId,
        bytes32 annotationRootHash
    ) external {
        _submitWork(jobId, taskId, annotationRootHash);
    }

    /// @notice Submit annotations for multiple tasks in one transaction — one wallet signature total.
    function submitBatch(
        uint256 jobId,
        uint256[] calldata taskIds,
        bytes32[] calldata annotationRootHashes
    ) external {
        require(taskIds.length == annotationRootHashes.length, "length mismatch");
        for (uint256 i = 0; i < taskIds.length; i++) {
            _submitWork(jobId, taskIds[i], annotationRootHashes[i]);
        }
    }

    function _submitWork(uint256 jobId, uint256 taskId, bytes32 annotationRootHash) internal {
        Job storage job = jobs[jobId];
        require(job.active, "job not active");
        require(taskId < job.taskCount, "invalid taskId");
        require(!submissions[jobId][taskId].exists, "task already submitted");
        // Must have claimed this task (or claim expired and they're reclaiming implicitly)
        require(
            claims[jobId][taskId] == msg.sender ||
            claims[jobId][taskId] == address(0) ||
            block.timestamp > claimExpiry[jobId][taskId],
            "task claimed by another annotator"
        );

        submissions[jobId][taskId] = Submission({
            annotator: msg.sender,
            annotationRootHash: annotationRootHash,
            approved: false,
            exists: true
        });

        emit WorkSubmitted(jobId, taskId, msg.sender, annotationRootHash);
    }    function approveWork(uint256 jobId, uint256 taskId) external {
        Job storage job = jobs[jobId];
        require(msg.sender == job.creator, "not creator");
        Submission storage sub = submissions[jobId][taskId];
        require(sub.exists && !sub.approved, "invalid submission");

        sub.approved = true;
        job.approvedCount++;
        payable(sub.annotator).transfer(job.rewardPerTask);

        emit WorkApproved(jobId, taskId, sub.annotator, job.rewardPerTask);

        // Auto-close when all tasks approved
        if (job.approvedCount == job.taskCount) {
            job.active = false;
            emit JobClosed(jobId, 0);
        }
    }

    function rejectWork(uint256 jobId, uint256 taskId) external {
        Job storage job = jobs[jobId];
        require(msg.sender == job.creator, "not creator");
        Submission storage sub = submissions[jobId][taskId];
        require(sub.exists && !sub.approved, "invalid submission");

        delete submissions[jobId][taskId];
        emit WorkRejected(jobId, taskId);
    }

    function closeJob(uint256 jobId) external {
        Job storage job = jobs[jobId];
        require(msg.sender == job.creator, "not creator");
        require(job.active, "already closed");

        job.active = false;
        uint256 unspent = (job.taskCount - job.approvedCount) * job.rewardPerTask;
        if (unspent > 0) payable(job.creator).transfer(unspent);

        emit JobClosed(jobId, unspent);
    }

    function getJob(uint256 jobId) external view returns (Job memory) {
        return jobs[jobId];
    }

    function getSubmission(uint256 jobId, uint256 taskId) external view returns (Submission memory) {
        return submissions[jobId][taskId];
    }

    function totalJobs() external view returns (uint256) {
        return nextJobId;
    }
}
