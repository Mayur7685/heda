# 📜 Heda Protocol Smart Contracts

Solidity smart contracts deployed on **0G Galileo Testnet** (Chain ID `16602`) managing data bounty escrows, multi-annotator IoU quality rewards, dataset registry licensing, model weights registry, and pipeline subscription quotas.

---

## 🚀 Deployed Galileo Addresses

| Contract | Address | Explorer |
| :--- | :--- | :--- |
| **`AnnotationMarketV2`** ⭐ | `0xCBbb84EB5740630B4654Fbf963a503d86E67b939` | [View Address](https://chainscan-galileo.0g.ai/address/0xCBbb84EB5740630B4654Fbf963a503d86E67b939) |
| **`DatasetRegistry`** | `0x63988395140a19662B3C1dC13B0B64286B0c7cc5` | [View Address](https://chainscan-galileo.0g.ai/address/0x63988395140a19662B3C1dC13B0B64286B0c7cc5) |
| **`ModelRegistry`** | `0xffc1A5A9a1bE52027142686079d8A78D9dBF4987` | [View Address](https://chainscan-galileo.0g.ai/address/0xffc1A5A9a1bE52027142686079d8A78D9dBF4987) |
| **`PipelineSubscription`** | `0x313BC8CA6b0aa5258b612715a3fda3e70C007260` | [View Address](https://chainscan-galileo.0g.ai/address/0x313BC8CA6b0aa5258b612715a3fda3e70C007260) |

---

## 📋 Contract Summary

### `AnnotationMarketV2.sol` (new — multi-annotator)
- **Open submission**: up to `maxAnnotatorsPerTask` (1–5) wallets can submit per task — no claim/lock.
- **Batch Submission (`submitWorkBatch`)**: submit $N$ tasks in 1 single transaction & signature.
- **Batch Reward Settlement (`distributeRewardsBatch`)**: distribute rewards for $N$ tasks in 1 single transaction & signature.
- **`distributeRewards(jobId, taskId, annotators[], bpsShares[])`**: called by the backend relayer after Moondream IoU scoring. Sends proportional ETH shares.
- **`triggerEvaluation(jobId, taskId)`**: creator manual override to request early evaluation.
- **`closeJob(jobId)`**: reclaims unspent ETH from unrewarded tasks.
- Relayer signer set at deploy time via `RELAYER_SIGNER` env var.

### `AnnotationMarket.sol` (V1 — retained for backward compat)
- Single annotator per task with 30-minute claim locks.
- Manual creator `approveWork()` / `rejectWork()` flow.

---

## 🧪 Testing Smart Contracts

Run the Foundry unit test suite:

```bash
forge test
```

**Output:**
```
Ran 3 test suites: 33 passed, 0 failed, 0 skipped
  - AnnotationMarket.t.sol:   15 tests
  - AnnotationMarketV2.t.sol: 18 tests
  - DatasetRegistry.t.sol:     (remaining)
```

---

## 🛠️ Deploying to 0G Galileo Testnet

To re-deploy all smart contracts using Foundry script:

```bash
# Set RELAYER_SIGNER in .env if running the annotation indexer backend
echo "RELAYER_SIGNER=0x25c268C068890EE75eF2423171b4d55d1961002D" >> .env

forge script script/Deploy.s.sol:Deploy \
  --rpc-url https://evmrpc-testnet.0g.ai \
  --broadcast \
  --gas-price 2000000000 \
  --priority-gas-price 2000000000 \
  --private-key <YOUR_PRIVATE_KEY>
```

Update `frontend/src/config.ts` with the newly printed addresses after deployment.
