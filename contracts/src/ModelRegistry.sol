// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title ModelRegistry
/// @notice Marketplace for trained ML models.
///         Model weights and eval reports stored on 0G Storage (identified by root hash).
///         Publishers earn ETH when buyers license their models.
///         Designed for upgrade: inferenceEndpoint is empty now, populated when
///         0G adds inference serving infra.
contract ModelRegistry {
    enum ModelType { YOLOv8, CLIP, QwenFineTune, SAM, Other }

    struct Model {
        address publisher;
        bytes32 weightsRootHash;  // 0G Storage root of best.pt / ONNX weights
        bytes32 reportRootHash;   // 0G Storage root of eval_report.json
        string  metadataURI;      // 0G Storage root hash of metadata JSON
        uint256 price;            // wei — 0 = free
        ModelType modelType;
        uint256 sourceDatasetId;  // DatasetRegistry ID (0 if unknown/external)
        bool    exists;
        uint256 downloadCount;
        string  inferenceEndpoint; // empty for now; set when 0G adds GPU serving
    }

    mapping(uint256 => Model) public models;
    mapping(uint256 => mapping(address => bool)) public licenses;

    uint256 public nextId;

    // ── Events ──────────────────────────────────────────────────────────────

    event ModelPublished(
        uint256 indexed modelId,
        address indexed publisher,
        bytes32 weightsRootHash,
        ModelType modelType
    );

    event ModelLicensed(
        uint256 indexed modelId,
        address indexed buyer,
        uint256 price
    );

    event InferenceEndpointUpdated(
        uint256 indexed modelId,
        string endpoint
    );

    // ── Write Functions ──────────────────────────────────────────────────────

    /// @notice Publish a trained model to the registry.
    /// @param weightsRootHash 0G Storage root hash of model weights (best.pt / ONNX)
    /// @param reportRootHash  0G Storage root hash of evaluation report JSON
    /// @param metadataURI     0G Storage root hash of model metadata JSON
    /// @param price           License price in wei (0 = free)
    /// @param modelType       Type of model (YOLOv8, CLIP, etc.)
    /// @param sourceDatasetId DatasetRegistry ID of training dataset (0 if N/A)
    function publish(
        bytes32 weightsRootHash,
        bytes32 reportRootHash,
        string calldata metadataURI,
        uint256 price,
        ModelType modelType,
        uint256 sourceDatasetId
    ) external returns (uint256 modelId) {
        require(weightsRootHash != bytes32(0), "weights root hash required");
        require(bytes(metadataURI).length > 0, "metadata URI required");

        modelId = nextId++;
        models[modelId] = Model({
            publisher: msg.sender,
            weightsRootHash: weightsRootHash,
            reportRootHash: reportRootHash,
            metadataURI: metadataURI,
            price: price,
            modelType: modelType,
            sourceDatasetId: sourceDatasetId,
            exists: true,
            downloadCount: 0,
            inferenceEndpoint: ""
        });

        // Publisher gets free license to their own model
        licenses[modelId][msg.sender] = true;

        emit ModelPublished(modelId, msg.sender, weightsRootHash, modelType);
    }

    /// @notice Purchase a license for a model.
    ///         Exact payment required (excess returned).
    function purchase(uint256 modelId) external payable {
        Model storage m = models[modelId];
        require(m.exists, "model not found");
        require(!licenses[modelId][msg.sender], "already licensed");
        require(msg.value >= m.price, "insufficient payment");

        licenses[modelId][msg.sender] = true;
        models[modelId].downloadCount++;

        // Pay publisher (0 price = free, no transfer needed)
        if (m.price > 0) {
            payable(m.publisher).transfer(m.price);
        }

        // Return excess
        uint256 excess = msg.value - m.price;
        if (excess > 0) {
            payable(msg.sender).transfer(excess);
        }

        emit ModelLicensed(modelId, msg.sender, m.price);
    }

    /// @notice Set inference endpoint when 0G GPU infra becomes available.
    ///         Only the model publisher can set this.
    function setInferenceEndpoint(uint256 modelId, string calldata endpoint) external {
        require(models[modelId].publisher == msg.sender, "not publisher");
        models[modelId].inferenceEndpoint = endpoint;
        emit InferenceEndpointUpdated(modelId, endpoint);
    }

    // ── Read Functions ───────────────────────────────────────────────────────

    function hasLicense(uint256 modelId, address user) external view returns (bool) {
        return licenses[modelId][user];
    }

    function getModel(uint256 modelId) external view returns (Model memory) {
        require(models[modelId].exists, "model not found");
        return models[modelId];
    }

    function totalModels() external view returns (uint256) {
        return nextId;
    }
}
