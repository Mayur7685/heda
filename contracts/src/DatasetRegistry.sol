// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title DatasetRegistry
/// @notice Onchain marketplace for published datasets.
///         Each dataset is identified by its 0G Storage Merkle root hash.
///         Purchasing grants a license; payment goes directly to publisher.
contract DatasetRegistry {
    enum DataType { Image, Text }

    struct Dataset {
        address publisher;
        bytes32 rootHash;       // 0G Storage root of the final merged dataset
        string  metadataURI;    // 0G Storage root of metadata JSON (name, classes, size, license)
        uint256 price;          // wei; 0 = free
        DataType dataType;
        uint256 sourceJobId;    // AnnotationMarket jobId that produced this (0 if external)
        bool exists;
    }

    mapping(uint256 => Dataset) public datasets;
    mapping(uint256 => mapping(address => bool)) public licenses;
    uint256 public nextId;

    event Published(
        uint256 indexed datasetId,
        address indexed publisher,
        bytes32 rootHash,
        uint256 price,
        DataType dataType
    );
    event Purchased(uint256 indexed datasetId, address indexed buyer, uint256 price);

    function publish(
        bytes32 rootHash,
        string calldata metadataURI,
        uint256 price,
        DataType dataType,
        uint256 sourceJobId
    ) external returns (uint256 datasetId) {
        require(rootHash != bytes32(0), "invalid root hash");

        datasetId = nextId++;
        datasets[datasetId] = Dataset({
            publisher: msg.sender,
            rootHash: rootHash,
            metadataURI: metadataURI,
            price: price,
            dataType: dataType,
            sourceJobId: sourceJobId,
            exists: true
        });
        licenses[datasetId][msg.sender] = true;

        emit Published(datasetId, msg.sender, rootHash, price, dataType);
    }

    function purchase(uint256 datasetId) external payable {
        Dataset storage d = datasets[datasetId];
        require(d.exists, "dataset not found");
        require(!licenses[datasetId][msg.sender], "already licensed");
        require(msg.value >= d.price, "insufficient payment");

        licenses[datasetId][msg.sender] = true;
        if (d.price > 0) payable(d.publisher).transfer(d.price);
        if (msg.value > d.price) payable(msg.sender).transfer(msg.value - d.price);

        emit Purchased(datasetId, msg.sender, d.price);
    }

    function hasLicense(uint256 datasetId, address user) external view returns (bool) {
        return licenses[datasetId][user];
    }

    function getDataset(uint256 datasetId) external view returns (Dataset memory) {
        return datasets[datasetId];
    }

    function totalDatasets() external view returns (uint256) {
        return nextId;
    }
}
