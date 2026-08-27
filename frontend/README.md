# 🎨 Heda Protocol — Web Frontend

React 18 application built with **Vite**, **TypeScript**, **Ethers v6**, and **Reown WalletConnect** for interacting with Heda Protocol smart contracts and 0G Storage.

---

## 🌟 Key Application Pages

- **`Jobs.tsx` (`/jobs`)**: Bounties Marketplace where annotators discover active annotation tasks.
- **`CreateJob.tsx` (`/create`)**: 3-step wizard to upload dataset images to 0G Storage and lock bounty ETH in escrow.
- **`Workspace.tsx` (`/workspace/:jobId`)**: High-performance canvas annotation tool with bounding box drawing, polygon masks, zero-shot VLM auto-labeling, and batch signing.
- **`Dashboard.tsx` (`/dashboard`)**: Creator management hub to review submissions, approve rewards, and publish datasets.
- **`Datasets.tsx` & `DatasetDetail.tsx` (`/datasets`)**: Search datasets, license data, and download standard COCO ZIP packages.
- **`Models.tsx` & `ModelDetail.tsx` (`/models`)**: Fine-tune YOLO models, view eval metrics, download `.pt` weights, and run live PyTorch inference.
- **`RapidCVPipeline.tsx` (`/pipeline`)**: 8-step end-to-end Computer Vision pipeline wizard.

---

## 🚀 Running Frontend Locally

```bash
# 1. Install dependencies
npm install

# 2. Run local dev server
npm run dev

# 3. Build production bundle
npm run build
```
