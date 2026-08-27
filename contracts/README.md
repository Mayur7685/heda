# 📜 Heda Protocol Smart Contracts

Solidity smart contracts deployed on **0G Galileo Testnet** (Chain ID `16602`) managing data bounty escrows, dataset registry licensing, model weights registry, and pipeline subscription quotas.

---

## 🚀 Deployed Galileo Addresses

| Contract | Address | Explorer |
| :--- | :--- | :--- |
| **`AnnotationMarket`** | `0x999C386123c7BD76754756335C254b82EB51efe8` | [View Address](https://chainscan-galileo.0g.ai/address/0x999C386123c7BD76754756335C254b82EB51efe8) |
| **`DatasetRegistry`** | `0xd22C7e9109E2fc4712eA990d100166834a2067A0` | [View Address](https://chainscan-galileo.0g.ai/address/0xd22C7e9109E2fc4712eA990d100166834a2067A0) |
| **`ModelRegistry`** | `0xB828cfd2e57d2594Cbe54fE293991e48f6B5fbA7` | [View Address](https://chainscan-galileo.0g.ai/address/0xB828cfd2e57d2594Cbe54fE293991e48f6B5fbA7) |
| **`PipelineSubscription`** | `0x0b52211F340aB9cd867be80ec9Fc2B45861229Ac` | [View Address](https://chainscan-galileo.0g.ai/address/0x0b52211F340aB9cd867be80ec9Fc2B45861229Ac) |

---

## 🧪 Testing Smart Contracts

Run the Foundry unit test suite:

```bash
forge test
```

**Output:**
```
Ran 2 test suites in 16.77ms: 17 tests passed, 0 failed, 0 skipped
```

---

## 🛠️ Deploying to 0G Galileo Testnet

To re-deploy all smart contracts using Foundry script:

```bash
forge script script/Deploy.s.sol:Deploy \
  --rpc-url https://evmrpc-testnet.0g.ai \
  --broadcast \
  --legacy \
  --private-key <YOUR_PRIVATE_KEY>
```
