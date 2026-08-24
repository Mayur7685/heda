# Heda Contracts

Solidity smart contracts for the Heda annotation marketplace, deployed on 0G Chain (EVM-compatible).

## Deployed Addresses (Galileo Testnet, Chain ID 16602)

| Contract | Address |
|---|---|
| AnnotationMarket | `0x4822c5F0617665543B94a0668837CdbBDEb54C90` |
| DatasetRegistry | `0x46d4a89e496f3A01785ac5B38ecAc40B081c933c` |

## Contracts

### AnnotationMarket.sol

Trustless annotation job escrow. Handles the full lifecycle of annotation work.

**Key functions:**

| Function | Description |
|---|---|
| `createJob(dataRootHash, metadataURI, rewardPerTask, taskCount, dataType)` | Post a job with ETH bounty locked |
| `claimTask(jobId, taskId)` | Reserve a task for 30 minutes (prevents wasted work) |
| `isTaskAvailable(jobId, taskId)` | Check if a task is unclaimed or claim expired |
| `submitWork(jobId, taskId, annotationRootHash)` | Submit single annotation |
| `submitBatch(jobId, taskIds[], annotationRootHashes[])` | Submit multiple annotations — 1 tx |
| `approveWork(jobId, taskId)` | Creator approves → annotator paid instantly |
| `rejectWork(jobId, taskId)` | Creator rejects → task reopens |
| `closeJob(jobId)` | Creator closes job, unspent bounty returned |

**Auto-close:** When `approvedCount == taskCount`, the job automatically sets `active = false`.

**Claim system:** Prevents multiple annotators wasting work on the same task. Claims expire after 30 minutes (`CLAIM_DURATION = 30 minutes`).

### DatasetRegistry.sol

Onchain marketplace for published datasets. Each dataset is identified by its 0G Storage Merkle root hash.

**Key functions:**

| Function | Description |
|---|---|
| `publish(rootHash, metadataURI, price, dataType, sourceJobId)` | List a dataset for sale |
| `purchase(datasetId)` | Buy a license — payment goes directly to publisher |
| `hasLicense(datasetId, address)` | Check if address has a license |
| `getDataset(datasetId)` | Get full dataset info |

**Note:** `rootHash` stores the COCO JSON root (image datasets) or JSONL root (text datasets) — not the raw data.

## Setup

```bash
# Install Foundry
curl -L https://foundry.paradigm.xyz | bash && foundryup

# Install dependencies
forge install

# Run tests
forge test

# Deploy to Galileo
source .env  # PRIVATE_KEY=0x...
forge script script/Deploy.s.sol \
  --rpc-url https://evmrpc-testnet.0g.ai \
  --private-key $PRIVATE_KEY \
  --broadcast \
  --gas-price 15000000000
```

## Tests

```
forge test --summary
```

All 17 tests pass:
- `AnnotationMarketTest` — 8 tests (create, submit, approve, reject, close, batch)
- `DatasetRegistryTest` — 9 tests (publish, purchase, license, refund, free datasets)

## Critical Rules (0G Chain)

- `evm_version = "cancun"` — mandatory in `foundry.toml`, causes `invalid opcode` otherwise
- `ethers v6` only in frontend — never v5 patterns
- Gas price minimum: ~4 Gneuron on Galileo testnet

## Environment

```bash
# contracts/.env
PRIVATE_KEY=0x...  # funded wallet
```
