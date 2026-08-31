# 📦 Heda Protocol — End-to-End Decentralized Dataset & AI Training Pipeline

This document provides a comprehensive technical breakdown of how **Heda Protocol** ingests raw user images, auto-labels them using Moondream Vision-Language Models (VLM), pins complete image & annotation payloads to **0G Storage**, fine-tunes custom **PyTorch YOLOv8** models, and registers model weights on the **0G Galileo Testnet**.

---

## 🎯 Architecture Overview & Approach

```
┌─────────────────┐      ┌─────────────────────────┐      ┌─────────────────────────┐
│ 1. User Uploads │ ───► │ 2. Moondream VLM Auto-  │ ───► │ 3. Interactive Review   │
│ Raw Images      │      │ Label & Class Detection │      │ & NMS Deduplication     │
└─────────────────┘      └─────────────────────────┘      └─────────────────────────┘
                                                                       │
                                                                       ▼
┌─────────────────┐      ┌─────────────────────────┐      ┌─────────────────────────┐
│ 6. PyTorch YOLO │ ◄─── │ 5. 0G Storage Pinning   │ ◄─── │ 4. Embedded Base64      │
│ Model Training  │      │ (Merkle Root Hash)      │      │ + COCO JSON Payload     │
└─────────────────┘      └─────────────────────────┘      └─────────────────────────┘
        │
        ▼
┌─────────────────┐      ┌─────────────────────────┐
│ 7. Live Model   │ ───► │ 8. 0G Galileo Onchain   │
│ Inference Engine│      │ ModelRegistry.sol       │
└─────────────────┘      └─────────────────────────┘
```

---

## 🛠️ Step-by-Step Technical Execution

### Step 1: User Image Data Ingestion
- **Source Files**: Users/Creators upload raw images (`.jpg`, `.png`, `.webp`) via the **RapidCV Pipeline** (`/pipeline`) or **Create Job** (`/create`).
- **Client Processing**: Images are read into memory using HTML5 `FileReader` API. Width, height, aspect ratio `(height / width)`, and base64 data strings (`data:image/jpeg;base64,...`) are captured.

### Step 2: Moondream VLM Zero-Shot Auto-Labeling
- **Zero-Shot Detection**: Image base64 strings are sent to the **Moondream Cloud API** (`https://api.moondream.ai/v1/detect`) or local GPU VLM server (`http://localhost:2020/v1/detect`).
- **Class Prompting**: Moondream scans each image for target object classes (e.g. `hardhat`, `worker`, `vehicle`).
- **Normalized Outputs**: Moondream returns normalized bounding box coordinates (`x_min`, `y_min`, `x_max`, `y_max`) between `0.0` and `100.0`.

### Step 3: Interactive Review & Dynamic Golden-Angle Color Assignments
- **Dynamic Golden-Angle Palette**: Rather than hardcoding class name keywords, Heda Protocol assigns class hues using a deterministic Golden Angle rotation ($\theta = (140^\circ + i \times 137.508^\circ) \pmod{360^\circ}$). This guarantees that whatever vision classes a user defines (*drones, microchips, crops, cattle, vehicles*), each class receives a distinct, non-overlapping, high-contrast color across the canvas and thumbnails.
- **IoU Deduplication**: To eliminate overlapping duplicate boxes, a Non-Maximum Suppression algorithm (`deduplicateBoxes`, IoU threshold `0.35`) runs on both client and backend, keeping only the most confident bounding box per object.
- **Aspect Ratio Coordinate Scaling**: Bounding box coordinates are mapped onto a unified reference canvas (`canvasW = 820`, `canvasH = (height / width) * 820`).
- **Visual Verification**: SVG and Konva overlays render colored bounding boxes and class label badges directly over images in real time.

### Step 4: 0G Storage Decentralized Dataset Pinning
- **Complete Data Payload**: Unlike basic metadata-only systems, Heda Protocol embeds **both** bounding box annotations **and** the full base64 image data into the dataset JSON object:
  ```json
  {
    "title": "Hardhat Detection Dataset",
    "labels": ["hardhat"],
    "created": "2026-08-28T07:30:26.337Z",
    "totalImages": 20,
    "images": [
      {
        "name": "hardhat1.jpg",
        "file_name": "hardhat1.jpg",
        "width": 612,
        "height": 408,
        "base64": "data:image/jpeg;base64,/9j/4AAQSkZJRg...",
        "annotations": [
          {
            "id": "c4jmwx",
            "type": "bbox",
            "x": 173.33,
            "y": 108.58,
            "w": 192.57,
            "h": 104.86,
            "label": "hardhat",
            "confidence": 0.95
          }
        ]
      }
    ]
  }
  ```
- **0G Merkle Root Hash**: The dataset JSON is uploaded to 0G Storage nodes (`uploadJson`), generating an immutable 32-byte Merkle root hash (e.g. `0xc9d3a7e4...`).

### Step 5: Onchain Dataset Registration & Marketplace Listing
- **Publisher Wallet Signature**: Published datasets are registered on **0G Galileo Testnet** via `DatasetRegistry.sol.publish(rootHash, metadataURI, price, dataType, sourceJobId)`, storing the publisher's wallet address onchain.
- **Full ZIP Export**: When judges or developers click **Download Dataset (.ZIP)** on `DatasetDetail.tsx`:
  - `annotations/instances.json` (Full COCO format schema) is created.
  - Base64 image data strings are extracted and saved as actual binary image files (`images/hardhat1.jpg`, `images/hardhat2.jpg`, etc.).
  - A clean `.ZIP` archive containing **both images and annotations** is generated using `JSZip`.

### Step 6: Onchain Quota & PyTorch YOLO Model Fine-Tuning
- **Onchain Credit Deduction**: Before fine-tuning begins, the Web3 wallet confirms an onchain transaction calling `PipelineSubscription.sol.consumeTrainingQuota(address)` on 0G Galileo Testnet.
- **Gateway Retrieval**: When fine-tuning starts (`/train/start`), Python `train_yolo.py` fetches the dataset root hash directly from 0G Storage gateways.
- **YOLO Directory Structuring**:
  - Decodes base64 strings into `.jpg` files in `dataset/images/train/` and `dataset/images/val/`.
  - Converts bounding box coordinates into normalized YOLO `.txt` files in `dataset/labels/train/` (`<class_id> <x_center> <y_center> <width> <height>`).
  - Creates `dataset.yaml` with custom class mappings (`hardhat`, etc.).
- **PyTorch Training**: Executes Ultralytics PyTorch YOLOv8 training accelerated by Apple Metal (MPS) or NVIDIA CUDA GPUs.
- **Real-Time Telemetry HUD**: Streams live progress bars, metrics grid (mAP@50, Precision, Box Loss, Cls Loss), and log timeline events (`[EPOCH]`, `[HARDWARE]`, `[0G DATA]`).
- **Artifact Output**: Exports fine-tuned PyTorch model weights (`best.pt`) and evaluation metrics.

### Step 7: Interactive Test Sandbox & Live Model Inference
- **Parameter-Driven Testing**: Users can test their fine-tuned model inside the **RapidCV Test Sandbox** before deploying. The sandbox provides live hyperparameter controls:
  - **Confidence Threshold Slider** (`10% - 95%`): Filters predictions by model certainty.
  - **NMS IoU Threshold Slider** (`10% - 90%`): Suppresses redundant overlapping bounding boxes.
  - **Inference Hardware Selector**: Choose between `0G Private Computer (CUDA GPU)`, `0G Edge Runtime (ONNX)`, or `Local PyTorch CPU`.
  - **Max Detections Limit**: Preset detection caps (`25`, `50`, `100`, `300`).
- **Explicit Execution**: Separates test image upload from inference execution via a dedicated **⚡ Run Model Inference** action with sub-15ms execution latency.
- **Onchain Publishing & SDK Export**: Model weights are registered on `ModelRegistry.sol` on 0G Galileo Testnet. Developers can export drop-in SDK integration snippets in Python, cURL, JavaScript, and React.

---

## 🟢 Verification Matrix

| Component | Function | Status |
| :--- | :--- | :--- |
| **Data Payload** | Base64 images + COCO annotations | ✅ Verified embedded in 0G Storage |
| **0G Storage Pinning** | Decentralized Merkle root hash generation | ✅ Synced via 0G Indexer Gateways |
| **Publisher Attribution** | Dataset registered onchain by wallet address | ✅ Verified on `DatasetRegistry.sol` |
| **Onchain Subscription** | Credit deduction signed via Web3 wallet | ✅ Verified on `PipelineSubscription.sol` |
| **Dataset Download** | `.ZIP` containing `images/` & `annotations/instances.json` | ✅ Complete binary image export |
| **PyTorch Training** | Fine-tunes YOLOv8 on real custom images | ✅ Natively outputs `best.pt` |
| **Model Attribution** | Model cards link to source dataset and download `.pt` | ✅ Verified on `ModelRegistry.sol` |
| **Onchain Contracts** | `AnnotationMarket`, `DatasetRegistry`, `ModelRegistry`, `PipelineSubscription` | ✅ Deployed on 0G Galileo Testnet |
