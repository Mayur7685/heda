# 📜 Heda Protocol Smart Contracts

Solidity smart contracts deployed on **0G Galileo Testnet** (Chain ID `16602`) managing data bounty escrows, dataset registry licensing, model weights registry, and pipeline subscription quotas.

---

## 🚀 Deployed Galileo Addresses

| Contract | Address | Explorer |
| :--- | :--- | :--- |
| **`AnnotationMarket`** | `0x0577d4422B9065E2C8B7A29794DD176601Cf2c19` | [View Address](https://chainscan-galileo.0g.ai/address/0x0577d4422B9065E2C8B7A29794DD176601Cf2c19) |
| **`DatasetRegistry`** | `0x27F3343C6e3e28Df23E14D0A1eB3c6E6BEff349c` | [View Address](https://chainscan-galileo.0g.ai/address/0x27F3343C6e3e28Df23E14D0A1eB3c6E6BEff349c) |
| **`ModelRegistry`** | `0x93d4b1Ea040dA189B32D42AC6814585cE674FB8D` | [View Address](https://chainscan-galileo.0g.ai/address/0x93d4b1Ea040dA189B32D42AC6814585cE674FB8D) |
| **`PipelineSubscription`** | `0x07231896B7dF2F51E6a56A6118850b43522E8f44` | [View Address](https://chainscan-galileo.0g.ai/address/0x07231896B7dF2F51E6a56A6118850b43522E8f44) |

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
