# ⚡ Heda Protocol — Relayer & Event Indexer

Node.js Express microservice and **SQLite WAL event indexer** that listens to 0G Galileo Testnet smart contract events (`JobCreated`, `Published`, `ModelPublished`) and relays 0G Storage metadata queries.

---

## 🌟 REST API Endpoints

- **`GET /indexer/status`**: Returns current syncing state, last indexed block number, and total counts.
- **`GET /indexer/jobs`**: Returns all indexed annotation jobs from `AnnotationMarket.sol`.
- **`GET /indexer/datasets`**: Returns all indexed datasets from `DatasetRegistry.sol`.
- **`GET /indexer/models`**: Returns all indexed AI model weights from `ModelRegistry.sol`.
- **`POST /upload-json`**: Relays raw JSON payloads to 0G Storage nodes and returns the Merkle data root hash.

---

## 🚀 Running the Relayer & Indexer

```bash
# 1. Install dependencies
npm install

# 2. Run indexer service
npm start
# Server listening on http://localhost:3001
```
