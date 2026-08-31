# 📷 Heda 0G Edge Camera Firmware (ESP32-CAM)

Decentralized physical IoT camera firmware that captures edge video frames, automatically pins them to **0G Decentralized Storage Network**, registers frame provenance on **0G Galileo Testnet**, and receives Over-The-Air (OTA) fine-tuned YOLO model weights.

---

## ⚡ Key Features

- **Decentralized 0G Storage Pinning:** Automatically uploads raw JPEG frames directly to the 0G Storage Indexer via the Heda Relayer.
- **On-Chain Hardware Provenance:** Derives a unique hardware identity `ESP32-<MAC_ADDRESS>` paired with the user's Web3 wallet via `DeviceRegistry.sol`.
- **Flexible Trigger Modes:**
  - **Auto-Timer:** Captures and uploads every 30 seconds (configurable).
  - **Physical Shutter Button:** Connect a tactile button between GPIO 1 and GND for instant manual snapshot capture.
- **OTA Model Weights Sync:** Polls for new on-chain PyTorch/ONNX model checkpoints assigned to the camera.
- **Multi-Board Support:** Compatible with **Seeed Studio XIAO ESP32-S3 Sense** and **AI-Thinker ESP32-CAM (OV2640)**.

---

## 🛠️ Supported Hardware

| Hardware Board | Processor | Camera Sensor | PSRAM | Status |
| :--- | :--- | :--- | :--- | :--- |
| **Seeed Studio XIAO ESP32-S3 Sense** | ESP32-S3 Dual-Core 240MHz | OV2640 (DVP) | 8MB OPI PSRAM | **Default** |
| **AI-Thinker ESP32-CAM** | ESP32 Dual-Core 240MHz | OV2640 | 4MB QSPI PSRAM | Supported |
| **M5Stack ESP32 Unit Cam** | ESP32 Dual-Core 240MHz | OV2640 | 4MB PSRAM | Supported |

---

## 📐 Hardware Wiring & Pinouts

### 1. Default: Seeed Studio XIAO ESP32S3 Sense
- Pre-mounted camera module on the expansion board.
- **Optional Shutter Button:** Connect momentary pushbutton between **`D1 (GPIO 1)`** and **`GND`**.

### 2. AI-Thinker ESP32-CAM Pinout
To select the AI-Thinker board, edit [`camera_pins.h`](./camera_pins.h):
```cpp
// #define CAMERA_MODEL_XIAO_ESP32S3
#define CAMERA_MODEL_AI_THINKER
```
- **FTDI USB-to-UART Programmer Connection:**
  - `ESP32-CAM 5V` $\rightarrow$ `FTDI VCC (5V)`
  - `ESP32-CAM GND` $\rightarrow$ `FTDI GND`
  - `ESP32-CAM U0T (TX)` $\rightarrow$ `FTDI RX`
  - `ESP32-CAM U0R (RX)` $\rightarrow$ `FTDI TX`
  - `ESP32-CAM IO0` $\rightarrow$ `GND` *(Bridge to GND only while flashing firmware)*

---

## 💻 Arduino IDE Setup Guide

### Step 1: Install ESP32 Board Package
1. In Arduino IDE, open **Preferences** (`Cmd + ,` or `Ctrl + ,`).
2. Add the following URL to **Additional Boards Manager URLs**:
   ```
   https://raw.githubusercontent.com/espressif/arduino-esp32/gh-pages/package_esp32_index.json
   ```
3. Open **Tools** $\rightarrow$ **Board** $\rightarrow$ **Boards Manager...**, search for `esp32` by **Espressif Systems**, and install version **`2.0.14`** or newer.

### Step 2: Configure Arduino Tools Menu

#### For Seeed Studio XIAO ESP32-S3:
- **Board:** `XIAO_ESP32S3`
- **PSRAM:** `OPI PSRAM` ⚠️ *(Required)*
- **Flash Mode:** `QIO 80MHz`
- **Flash Size:** `8MB (64Mb)`
- **USB CDC On Boot:** `Enabled`
- **Upload Speed:** `921600`

#### For AI-Thinker ESP32-CAM:
- **Board:** `AI Thinker ESP32-CAM`
- **CPU Frequency:** `240MHz (WiFi/BT)`
- **Flash Frequency:** `80MHz`
- **Flash Mode:** `QIO`
- **Partition Scheme:** `Huge APP (3MB No OTA/1MB SPIFFS)`
- **Upload Speed:** `115200`

---

## ⚙️ Firmware Configuration

Open [`heda_camera.ino`](./heda_camera.ino) and update your Wi-Fi credentials:

```cpp
// ── WiFi & 0G Heda Ingest Configuration ───────────────────────────────────────
const char *STA_SSID   = "YOUR_WIFI_SSID";     // 2.4 GHz Wi-Fi network name
const char *STA_PASS   = "YOUR_WIFI_PASSWORD"; // Wi-Fi password

// Production Render Relayer or Local Development IP
const char *INGEST_URL = "https://heda-relayer.onrender.com/api/v1/ingest";
const char *OTA_BASE   = "https://heda-relayer.onrender.com/api/v1/devices/";
```

> **Tip for Local Testing:** If running the Heda relayer locally, replace `INGEST_URL` with your computer's local network IP:
> `const char *INGEST_URL = "http://192.168.1.150:3001/api/v1/ingest";`

---

## 🚀 Flashing & First Run

1. Connect your ESP32 board via USB.
2. Select your Serial Port from **Tools** $\rightarrow$ **Port**.
3. Click **Upload** (`Cmd + U` or `Ctrl + U`).
4. Open the **Serial Monitor** at **`115200 baud`**.

### Serial Monitor Output:
```text
[WiFi] Connecting to MyHomeWiFi.......
[WiFi] Connected! IP Address: 192.168.1.142
========================================
 0G HEDA HARDWARE CAMERA INITIALIZED
 Device ID: ESP32-94:E6:86:12:AB:CD
 Pair this Device ID in Heda WebApp
========================================
[0G Ingest] Capturing frame...
[0G Ingest] Sending 32735 bytes to https://heda-relayer.onrender.com/api/v1/ingest
[0G Storage Pinning SUCCESS] {"success":true,"rootHash":"0x04c1e9...","storageExplorer":"https://storagescan-galileo.0g.ai/root/0x04c1e9..."}
```

---

## 🌐 WebApp Integration Workflow

```
 ┌──────────────┐     Raw JPEG     ┌──────────────────┐    0G Turbo    ┌──────────────────┐
 │  ESP32-CAM   │ ───────────────> │  Heda Relayer    │ ─────────────> │    0G Storage    │
 │  Edge Node   │                  │  /api/v1/ingest  │                │  (Decentralized) │
 └──────────────┘                  └──────────────────┘                └──────────────────┘
                                            │                                    │
                                            ▼ Frame Index                        ▼ Merkle Root
                                   ┌──────────────────┐                ┌──────────────────┐
                                   │   Heda WebApp    │ <───────────── │   Galileo dApp   │
                                   │  /devices (Pair) │   Create Job   │  (Smart Escrow)  │
                                   └──────────────────┘                └──────────────────┘
```

1. **Pairing Camera:**
   - Open **`http://localhost:5173/devices`** in your browser.
   - Connect your Web3 wallet.
   - Click **`+ Pair New Camera`** and enter the `Device ID` printed in the Serial Monitor (e.g. `ESP32-94:E6:86:12:AB:CD`).
   - Sign the on-chain transaction on **0G Galileo Testnet** to register hardware ownership.

2. **Deploying Bounty Jobs:**
   - Go to your camera's gallery (`/devices/<deviceId>`).
   - Select the ingested edge frames.
   - Click **`⚡ Create Bounty Job`**, set instructions, bounding box classes (`hardhat`, `person`), and escrow reward.
   - Annotators annotate on the decentralized workspace, scored automatically via **Moondream IoU Auto-Eval**.

3. **Deploying Model Weights via OTA:**
   - Once a dataset is labeled and trained in the **Rapid CV Studio**, click **`Deploy to Camera`**.
   - The ESP32 camera will detect the assigned ONNX/TFLite weights root hash via `checkOTAModelUpdate()` and sync Over-The-Air!

---

## 🛡️ Troubleshooting

| Issue | Solution |
| :--- | :--- |
| `Init failed: 0x20003` | Camera ribbon cable is loose or pins are not correctly configured in `camera_pins.h`. |
| `WiFi connection timeout` | ESP32 only supports **2.4 GHz Wi-Fi** networks. Make sure you are not on 5 GHz. |
| `HTTP -1 / Connection Failed` | Check if your relayer URL is reachable. If testing locally, ensure firewall allows port 3001. |
| `Brownout detector was triggered` | ESP32-CAM draws high current during Wi-Fi transmission. Use a solid 5V 2A USB power supply. |
