// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title AnnotationMarketV2
/// @notice Multi-annotator trustless annotation marketplace.
///
///  Design decisions (locked):
///  1. Up to `maxAnnotatorsPerTask` annotators (1–5) can submit per task — OPEN, no claim lock.
///  2. Rewards are distributed proportionally by IoU quality score, computed off-chain by the
///     backend relayer (Moondream VLM) and then pushed on-chain via distributeRewards().
///  3. distributeRewards() can be called by the trusted relayerSigner (auto) OR by the job
///     creator (manual override). The job creator can also emit EvaluationTriggered on-chain
///     to request early evaluation before slots are full.
contract AnnotationMarketV2 {

    enum DataType { Image, Text }

    struct Job {
        address  creator;
        bytes32  dataRootHash;
        string   metadataURI;
        uint256  rewardPerTask;
        uint256  taskCount;
        uint8    maxAnnotatorsPerTask;
        uint256  approvedTaskCount;
        DataType dataType;
        bool     active;
    }

    struct TaskSubmission {
        address  annotator;
        bytes32  annotationRootHash;
        uint256  timestamp;
        bool     rewarded;
    }

    address public relayerSigner;
    uint256 public nextJobId;

    mapping(uint256 => Job) public jobs;
    mapping(uint256 => mapping(uint256 => TaskSubmission[])) public taskSubmissions;
    mapping(uint256 => mapping(uint256 => mapping(address => bool))) public hasSubmitted;

    event JobCreated(
        uint256 indexed jobId,
        address indexed creator,
        bytes32 dataRootHash,
        uint256 rewardPerTask,
        uint256 taskCount,
        uint8   maxAnnotators,
        DataType dataType
    );
    event WorkSubmitted(
        uint256 indexed jobId,
        uint256 indexed taskId,
        address indexed annotator,
        bytes32 annotationRootHash,
        uint256 slotIndex
    );
    event EvaluationTriggered(
        uint256 indexed jobId,
        uint256 indexed taskId,
        address triggeredBy
    );
    event RewardsDistributed(
        uint256 indexed jobId,
        uint256 indexed taskId,
        address[] annotators,
        uint256[] amounts
    );
    event JobClosed(uint256 indexed jobId, uint256 unspentReturned);

    modifier onlyRelayerOrCreator(uint256 jobId) {
        require(
            msg.sender == relayerSigner || msg.sender == jobs[jobId].creator,
            "not authorized"
        );
        _;
    }

    constructor(address _relayerSigner) {
        require(_relayerSigner != address(0), "zero relayer address");
        relayerSigner = _relayerSigner;
    }

    function createJob(
        bytes32  dataRootHash,
        string   calldata metadataURI,
        uint256  rewardPerTask,
        uint256  taskCount,
        uint8    maxAnnotatorsPerTask,
        DataType dataType
    ) external payable returns (uint256 jobId) {
        require(msg.value == rewardPerTask * taskCount, "budget mismatch");
        require(taskCount > 0 && rewardPerTask > 0, "invalid params");
        require(maxAnnotatorsPerTask >= 1 && maxAnnotatorsPerTask <= 5, "max annotators 1-5");

        jobId = nextJobId++;
        jobs[jobId] = Job({
            creator:               msg.sender,
            dataRootHash:          dataRootHash,
            metadataURI:           metadataURI,
            rewardPerTask:         rewardPerTask,
            taskCount:             taskCount,
            maxAnnotatorsPerTask:  maxAnnotatorsPerTask,
            approvedTaskCount:     0,
            dataType:              dataType,
            active:                true
        });

        emit JobCreated(jobId, msg.sender, dataRootHash, rewardPerTask, taskCount, maxAnnotatorsPerTask, dataType);
    }

    function submitWork(
        uint256 jobId,
        uint256 taskId,
        bytes32 annotationRootHash
    ) external {
        Job storage job = jobs[jobId];
        require(job.active, "job not active");
        require(taskId < job.taskCount, "invalid taskId");
        require(!hasSubmitted[jobId][taskId][msg.sender], "already submitted for this task");
        require(
            taskSubmissions[jobId][taskId].length < job.maxAnnotatorsPerTask,
            "task slots full"
        );

        hasSubmitted[jobId][taskId][msg.sender] = true;
        uint256 slotIndex = taskSubmissions[jobId][taskId].length;

        taskSubmissions[jobId][taskId].push(TaskSubmission({
            annotator:           msg.sender,
            annotationRootHash:  annotationRootHash,
            timestamp:           block.timestamp,
            rewarded:            false
        }));

        emit WorkSubmitted(jobId, taskId, msg.sender, annotationRootHash, slotIndex);

        if (taskSubmissions[jobId][taskId].length == job.maxAnnotatorsPerTask) {
            emit EvaluationTriggered(jobId, taskId, address(0));
        }
    }

    function triggerEvaluation(uint256 jobId, uint256 taskId) external {
        require(msg.sender == jobs[jobId].creator, "only creator");
        require(taskId < jobs[jobId].taskCount, "invalid taskId");
        require(taskSubmissions[jobId][taskId].length >= 1, "no submissions yet");
        emit EvaluationTriggered(jobId, taskId, msg.sender);
    }

    function distributeRewards(
        uint256   jobId,
        uint256   taskId,
        address[] calldata annotators,
        uint256[] calldata sharesBps
    ) external onlyRelayerOrCreator(jobId) {
        require(annotators.length == sharesBps.length, "length mismatch");
        require(annotators.length > 0, "empty annotator list");

        Job storage job = jobs[jobId];
        require(job.active, "job not active");
        require(taskId < job.taskCount, "invalid taskId");

        TaskSubmission[] storage subs = taskSubmissions[jobId][taskId];
        require(subs.length > 0, "no submissions for task");
        require(!subs[0].rewarded, "task already rewarded");

        uint256 totalBps = 0;
        for (uint256 i = 0; i < sharesBps.length; i++) {
            totalBps += sharesBps[i];
        }
        require(totalBps == 10000, "shares must sum to 10000");

        uint256 taskBudget = job.rewardPerTask;
        address[] memory paid    = new address[](annotators.length);
        uint256[] memory amounts = new uint256[](annotators.length);

        for (uint256 i = 0; i < annotators.length; i++) {
            uint256 amount = (taskBudget * sharesBps[i]) / 10000;
            if (amount > 0) {
                payable(annotators[i]).transfer(amount);
            }
            paid[i]    = annotators[i];
            amounts[i] = amount;
        }

        for (uint256 i = 0; i < subs.length; i++) {
            subs[i].rewarded = true;
        }

        job.approvedTaskCount++;

        if (job.approvedTaskCount == job.taskCount) {
            job.active = false;
            emit JobClosed(jobId, 0);
        }

        emit RewardsDistributed(jobId, taskId, paid, amounts);
    }

    function closeJob(uint256 jobId) external {
        Job storage job = jobs[jobId];
        require(msg.sender == job.creator, "not creator");
        require(job.active, "already closed");

        job.active = false;
        uint256 unspent = (job.taskCount - job.approvedTaskCount) * job.rewardPerTask;
        if (unspent > 0) payable(job.creator).transfer(unspent);

        emit JobClosed(jobId, unspent);
    }

    function getJob(uint256 jobId) external view returns (Job memory) {
        return jobs[jobId];
    }

    function getTaskSubmissions(uint256 jobId, uint256 taskId)
        external view returns (TaskSubmission[] memory)
    {
        return taskSubmissions[jobId][taskId];
    }

    function getSubmissionCount(uint256 jobId, uint256 taskId)
        external view returns (uint256)
    {
        return taskSubmissions[jobId][taskId].length;
    }

    function hasAnnotatorSubmitted(uint256 jobId, uint256 taskId, address annotator)
        external view returns (bool)
    {
        return hasSubmitted[jobId][taskId][annotator];
    }

    function totalJobs() external view returns (uint256) {
        return nextJobId;
    }
}
