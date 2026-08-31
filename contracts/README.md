# 📜 Heda Protocol Smart Contracts

Solidity smart contracts deployed on **0G Galileo Testnet** (Chain ID `16602`) managing data bounty escrows, multi-annotator IoU quality rewards, dataset registry licensing, model weights registry, and pipeline subscription quotas.

---

## 🚀 Deployed Galileo Addresses

| Contract | Address | Explorer |
| :--- | :--- | :--- |
| **`AnnotationMarketV2`** ⭐ | `0xA93b5bB49Ef86ceB8Cb06d06e984bAaf25683Ff0` | [View Address](https://chainscan-galileo.0g.ai/address/0xA93b5bB49Ef86ceB8Cb06d06e984bAaf25683Ff0) |
| **`DatasetRegistry`** | `0x22eBC4856744a628d19992d12304C951c7F5E1aD` | [View Address](https://chainscan-galileo.0g.ai/address/0x22eBC4856744a628d19992d12304C951c7F5E1aD) |
| **`ModelRegistry`** | `0xed6Ba6EC7c9ada63e0b37f97a4cA36042E3D6698` | [View Address](https://chainscan-galileo.0g.ai/address/0xed6Ba6EC7c9ada63e0b37f97a4cA36042E3D6698) |
| **`PipelineSubscription`** | `0x6952ec1f73626BdBF7BD8C549589710b25cfE622` | [View Address](https://chainscan-galileo.0g.ai/address/0x6952ec1f73626BdBF7BD8C549589710b25cfE622) |
| **`DeviceRegistry`** 📷 | `0xae5f90a24513ca825a30C66aA279f5f363bdbbAb` | [View Address](https://chainscan-galileo.0g.ai/address/0xae5f90a24513ca825a30C66aA279f5f363bdbbAb) |

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
