# Phala Cloud Integration for Heda
## Confidential GPU Fine-Tuning Pipeline

> Research date: May 2026 | Source: https://docs.phala.com

---

## What is Phala Cloud?

Phala Cloud is a **Confidential AI native Neocloud** — it runs AI workloads inside **Trusted Execution Environments (TEE)** backed by real GPU hardware. The key property: the cloud provider itself cannot access your models, data, or computation. Every run produces a **cryptographic attestation** proving it executed in genuine TEE hardware.

For Heda, this is directly relevant: annotators upload sensitive datasets, creators want their fine-tuned models to remain private, and buyers want proof that the model they purchased was actually trained on the claimed data.

---

## Phala vs 0G Compute — Honest Comparison

| | 0G Compute | Phala Cloud |
|---|---|---|
| **Fine-tuning** | LoRA on Qwen/text models only | Any model, any framework (PyTorch, HuggingFace) |
| **Vision models** | ❌ Not supported | ✅ Full support (YOLOv8, CLIP, ViT, etc.) |
| **Privacy** | TEE-verified providers | Hardware TEE (Intel TDX + NVIDIA CC) |
| **Attestation** | Provider-level | Cryptographic proof per job |
| **GPU hardware** | Unknown | H200 ($2.30/hr), B200 ($3.80/hr) |
| **Custom code** | Limited | Full Docker, Jupyter, any framework |
| **On-demand** | Yes | Yes (pay-as-you-go) |
| **Integration** | SDK-based | REST API + Docker |

**Conclusion:** Phala fills the exact gap 0G Compute has — **vision model fine-tuning with privacy guarantees**. Use both: 0G for text LLM fine-tuning (cheaper, simpler), Phala for vision model training (more powerful, private).

---

## Three Integration Paths

### Path 1 — On-Demand API (Inference only)
Pre-deployed models, OpenAI-compatible, pay per request.
- Base URL: `https://api.redpill.ai/v1`
- Models: DeepSeek V3, Qwen2.5 VL 72B, Llama 3.3 70B, etc.
- Min deposit: $5
- **Use in Heda:** Replace the disabled "vision inference" placeholder with real Phala inference

### Path 2 — GPU TEE (Custom training/fine-tuning)
Rent dedicated H200/B200 GPUs inside TEE. Full Docker support.
- H200 India: $2.30/GPU/hour
- H200 US: $2.56/GPU/hour  
- B200 US: $3.80/GPU/hour
- Scale: 1–8 GPUs per instance
- Templates: Jupyter Notebook (PyTorch), vLLM, Custom Docker Compose
- **Use in Heda:** Fine-tune YOLOv8/CLIP on purchased datasets

### Path 3 — Dedicated Models (Hourly dedicated GPU)
Same pre-deployed models as Path 1 but with dedicated GPU resources and hourly billing. Best for high-volume inference.

---

## Implementation Plan for Heda

### Phase 1 — Inference API (1 day, unblocks demo)

Replace the "Vision fine-tuning coming soon" disabled state with real Phala inference for **image understanding tasks** using `qwen/qwen2.5-vl-72b-instruct` (vision-language model).

**What it enables:**
- Dataset quality check: "Describe what's in this image" before annotation
- Auto-label suggestions: Phala VLM suggests bounding box labels, annotator confirms
- Model evaluation: After fine-tuning, run inference on test images

```typescript
// src/lib/phala.ts
const PHALA_BASE = "https://api.redpill.ai/v1";

export async function describeImage(imageBase64: string, apiKey: string): Promise<string> {
  const res = await fetch(`${PHALA_BASE}/chat/completions`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "qwen/qwen2.5-vl-72b-instruct",
      messages: [{
        role: "user",
        content: [
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
          { type: "text", text: "Describe the objects in this image. List each object and its approximate location." }
        ]
      }]
    })
  });
  const data = await res.json();
  return data.choices[0].message.content;
}

export async function suggestLabels(imageBase64: string, labels: string[], apiKey: string): Promise<string[]> {
  const res = await fetch(`${PHALA_BASE}/chat/completions`, {
    method: "POST",
    headers: { "Authorization": `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "qwen/qwen2.5-vl-72b-instruct",
      messages: [{
        role: "user",
        content: [
          { type: "image_url", image_url: { url: `data:image/jpeg;base64,${imageBase64}` } },
          { type: "text", text: `From this list of labels: ${labels.join(", ")} — which ones are present in this image? Return only the matching labels as a JSON array.` }
        ]
      }],
      response_format: { type: "json_object" }
    })
  });
  const data = await res.json();
  return JSON.parse(data.choices[0].message.content).labels ?? [];
}
```

**Where to add in Heda:**
- `Workspace.tsx` — "AI Suggest Labels" button in toolbar → calls `suggestLabels()` → pre-fills active label
- `CreateJob.tsx` — "Preview Dataset" step → calls `describeImage()` on sample images

### Phase 2 — Vision Fine-Tuning Pipeline (3–5 days)

Replace the current "text datasets only" fine-tuning with a full vision model pipeline using Phala GPU TEE.

**Architecture:**

```
User selects image dataset (licensed from Heda marketplace)
         ↓
Backend downloads dataset from 0G Storage
         ↓
Backend provisions Phala GPU TEE instance (H200, on-demand)
         ↓
Uploads dataset + training script to Phala instance via API
         ↓
Training runs inside TEE (YOLOv8 / CLIP fine-tuning)
         ↓
Phala returns: model weights + TEE attestation proof
         ↓
Backend uploads weights to 0G Storage → root hash
         ↓
User lists model on Heda ModelMarketplace with attestation proof
```

**Backend implementation:**

```javascript
// backend/phala.js
import { PhalaCloud } from '@phala/cloud-sdk'; // or REST API directly

const PHALA_API = 'https://cloud.phala.com/api/v1';

// Step 1: Provision GPU TEE instance
async function provisionGPU(apiKey) {
  const res = await fetch(`${PHALA_API}/gpu-instances`, {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      gpu_type: 'H200',
      gpu_count: 1,
      region: 'india',          // $2.30/hr — cheapest
      template: 'jupyter-pytorch',
      name: `heda-finetune-${Date.now()}`
    })
  });
  return res.json(); // { instance_id, jupyter_url, status }
}

// Step 2: Submit training job via Jupyter terminal
async function submitTrainingJob(instanceId, datasetRootHash, baseModel, config) {
  // Upload training script + dataset reference
  // Execute via Jupyter API or SSH
  const trainingScript = generateTrainingScript(datasetRootHash, baseModel, config);
  // ... execute in TEE instance
}

// Step 3: Poll job status
async function pollJobStatus(instanceId) {
  // Check if training is complete
  // Return: { status, modelPath, attestation }
}

// Step 4: Terminate instance (stop billing)
async function terminateInstance(instanceId, apiKey) {
  await fetch(`${PHALA_API}/gpu-instances/${instanceId}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${apiKey}` }
  });
}
```

**Training script template (runs inside Phala TEE):**

```python
# training/finetune_yolo.py — runs inside Phala GPU TEE
import os
from ultralytics import YOLO
import requests

# Download dataset from 0G Storage
dataset_root = os.environ['DATASET_ROOT_HASH']
indexer_url = "https://indexer-storage-testnet-turbo.0g.ai"
response = requests.get(f"{indexer_url}/file?root={dataset_root}")
# ... save and extract dataset

# Fine-tune YOLOv8
model = YOLO(os.environ.get('BASE_MODEL', 'yolov8n.pt'))
results = model.train(
    data='dataset.yaml',
    epochs=int(os.environ.get('EPOCHS', 50)),
    imgsz=640,
    device=0,  # GPU
    project='/output',
    name='heda_finetune'
)

# Save model
model.export(format='onnx')
print(f"MODEL_PATH=/output/heda_finetune/weights/best.pt")
```

### Phase 3 — Attestation Verification (1 day)

After fine-tuning, attach the Phala TEE attestation to the model listing on Heda. Buyers can verify the model was trained in a genuine TEE on the claimed dataset.

```solidity
// Add to ModelMarketplace.sol
struct ModelAttestation {
    bytes32 datasetRootHash;    // 0G Storage root of training data
    bytes32 modelRootHash;      // 0G Storage root of model weights
    bytes   phalaAttestation;   // Phala TEE attestation proof
    address trainer;
    uint256 timestamp;
}

mapping(uint256 => ModelAttestation) public attestations;

function listWithAttestation(
    bytes32 rootHash,
    string calldata metadataURI,
    uint256 price,
    bytes32 datasetRootHash,
    bytes calldata phalaAttestation
) external returns (uint256 modelId) {
    modelId = list(rootHash, metadataURI, price);
    attestations[modelId] = ModelAttestation({
        datasetRootHash: datasetRootHash,
        modelRootHash: rootHash,
        phalaAttestation: phalaAttestation,
        trainer: msg.sender,
        timestamp: block.timestamp
    });
}
```

---

## Updated FineTune Page Flow

```
Current (broken):
  Text datasets only → 0G Compute Router → Qwen fine-tune

New (with Phala):
  Text datasets  → 0G Compute Router → Qwen/LLM fine-tune  (unchanged)
  Image datasets → Phala GPU TEE     → YOLOv8/CLIP fine-tune (NEW)
```

**UI changes needed in `FineTune.tsx`:**
1. Show image datasets (currently hidden)
2. For image datasets: show Phala GPU selector (H200 India = cheapest)
3. Show estimated cost: `hours × $2.30/GPU`
4. Show TEE attestation badge on completed models

---

## Cost Analysis for Heda Users

| Job type | Hardware | Time | Cost |
|---|---|---|---|
| YOLOv8n fine-tune (1k images, 50 epochs) | H200 India 1× | ~30 min | ~$1.15 |
| YOLOv8m fine-tune (5k images, 100 epochs) | H200 India 1× | ~2 hrs | ~$4.60 |
| CLIP fine-tune (10k image-text pairs) | H200 India 2× | ~3 hrs | ~$13.80 |
| LLM fine-tune (Qwen 0.5B, 1k examples) | 0G Compute | ~7 min | ~$0.025 |

Phala is significantly more expensive than 0G Compute for text, but it's the **only option for vision models** and provides **privacy + attestation** that 0G doesn't.

---

## Risks and Mitigations

| Risk | Assessment | Mitigation |
|---|---|---|
| Phala GPU provisioning takes ~1 day | Real — documented in their docs | Show "provisioning" state; notify via email when ready |
| No official SDK for job orchestration | Real — must use REST API + Jupyter | Build thin wrapper; use their Docker Compose template |
| Cost unpredictability for users | Real — hourly billing | Show cost estimate upfront; set max budget cap |
| TEE attestation verification complexity | Medium — requires NVIDIA tools | Use Phala's pre-built verifier; show badge without requiring user to verify |
| Phala API availability | Low — established platform | Add 0G Compute as fallback for text models |

---

## Open Questions Before Building

1. **Does Phala have a programmatic API for GPU instance provisioning?** The docs show a UI wizard — need to confirm REST API exists for automation.
2. **Can we run custom Docker Compose on GPU TEE?** Docs say yes — need to test with a YOLOv8 training container.
3. **How does Phala handle dataset privacy?** Data uploaded to the TEE instance — confirm it's encrypted at rest and not accessible to Phala operators.
4. **Attestation format** — what exactly is in the attestation proof and how do we store it onchain efficiently (bytes size)?
5. **Billing API** — can we programmatically check remaining credits and terminate instances?

---

## Recommended Build Order

```
Week 1: Phase 1 — Phala Inference API
  Day 1: Add phala.ts lib + API key to .env
  Day 2: "AI Suggest Labels" button in Workspace toolbar
  Day 3: "Preview Dataset" auto-description in CreateJob

Week 2: Phase 2 — Vision Fine-Tuning
  Day 1-2: Backend Phala GPU provisioning + training script
  Day 3-4: FineTune.tsx image dataset support + Phala flow
  Day 5: End-to-end test: upload images → annotate → fine-tune YOLOv8

Week 3: Phase 3 — Attestation
  Day 1: ModelMarketplace.sol update with attestation storage
  Day 2: Attestation badge in model listings
  Day 3: Redeploy contracts + frontend update
```

---

## Resources

- Phala Cloud dashboard: https://cloud.phala.com
- Confidential AI API: https://api.redpill.ai/v1
- Available models: https://redpill.ai/models
- GPU TEE docs: https://docs.phala.com/phala-cloud/confidential-ai/confidential-gpu/deploy-and-verify
- dstack (open source): https://github.com/Dstack-TEE/dstack
- Benchmark (99% native perf on H100/H200): https://docs.phala.com/phala-cloud/confidential-ai/benchmark
