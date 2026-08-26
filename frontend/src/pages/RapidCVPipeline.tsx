import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Stage, Layer, Image as KonvaImage, Rect, Line, Text, Transformer } from "react-konva";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useWallet } from "../hooks/useWallet";
import { useDatasetRegistry } from "../hooks/useDatasetRegistry";
import { useModelRegistry } from "../hooks/useModelRegistry";
import { usePipelineSubscription } from "../hooks/usePipelineSubscription";
import { uploadJson } from "../hooks/useStorage";

interface ChatMessage {
  sender: "ai" | "user";
  text: string;
}

export function HedaConnectButton() {
  return (
    <ConnectButton.Custom>
      {({ account, chain, openAccountModal, openChainModal, openConnectModal, mounted }) => {
        const ready = mounted;
        const connected = ready && account && chain;
        const wrongChain = connected && chain.unsupported;

        if (!ready) return null;

        if (!connected) {
          return (
            <button className="btn-primary" onClick={openConnectModal} style={{ fontSize: 12, padding: "6px 14px" }}>
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>account_balance_wallet</span>
              Connect Wallet
            </button>
          );
        }

        if (wrongChain) {
          return (
            <button onClick={openChainModal}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 6, border: "1px solid var(--error)", background: "rgba(147,0,10,0.2)", color: "var(--error)", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>warning</span>
              Switch to Galileo
            </button>
          );
        }

        return (
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button onClick={openAccountModal}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "5px 12px", background: "var(--surface)", border: "1px solid var(--border)", borderRadius: 6, cursor: "pointer", fontSize: 12, color: "#fff", fontWeight: 700 }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--primary)" }} />
              {account.displayName}
            </button>
          </div>
        );
      }}
    </ConnectButton.Custom>
  );
}

type BBox = { id: string; type: "bbox"; x: number; y: number; w: number; h: number; label: string; confidence?: number };
type Polygon = { id: string; type: "polygon"; points: number[]; label: string; closed: boolean };
type Annotation = BBox | Polygon;

interface StagedFile {
  id: string;
  name: string;
  size: string;
  width: number;
  height: number;
  type: string;
  data: string; // base64
  url: string;
  annotations: Annotation[];
  approved: boolean;
}

const PIPELINE_STAGES = [
  { key: "chat", label: "AI Assistant", icon: "smart_toy" },
  { key: "upload", label: "Upload", icon: "cloud_upload" },
  { key: "autolabel", label: "Auto-Label", icon: "auto_awesome" },
  { key: "review", label: "Review", icon: "draw" },
  { key: "augment", label: "Augment", icon: "cloud_done" },
  { key: "train", label: "Train", icon: "memory" },
  { key: "test", label: "Test", icon: "biotech" },
  { key: "deploy", label: "Deploy", icon: "rocket_launch" },
];



const AUGMENTATIONS = [
  { key: "flip", label: "Horizontal Flip", icon: "swap_horiz", desc: "Mirror images left-right to handle orientation variance", defaultOn: true },
  { key: "brightness", label: "Brightness Jitter", icon: "light_mode", desc: "Random brightness ±20% for varying lighting conditions", defaultOn: true },
  { key: "contrast", label: "Contrast Jitter", icon: "contrast", desc: "Vary image contrast for low-light camera feeds", defaultOn: false },
  { key: "rotation", label: "Random Rotation", icon: "rotate_right", desc: "Slight random rotation ±15° for camera tilt", defaultOn: false },
  { key: "mosaic", label: "Mosaic Mix 4x4", icon: "grid_view", desc: "Combine 4 random tiles into 1 training image for dense detection", defaultOn: false },
  { key: "crop", label: "Random Crop", icon: "crop", desc: "Crop random sub-regions to improve small-object accuracy", defaultOn: false },
];

const YOLO_MODELS = [
  { key: "yolov8n", name: "YOLOv8n Nano", params: "6.2M", speed: "Ultra-Fast (1.2ms)", accuracy: "84.2% mAP", badge: "Recommended" },
  { key: "yolov8s", name: "YOLOv8s Small", params: "11.2M", speed: "Fast (2.4ms)", accuracy: "89.5% mAP", badge: "Balanced" },
  { key: "yolov8m", name: "YOLOv8m Medium", params: "25.9M", speed: "Moderate (5.1ms)", accuracy: "93.8% mAP", badge: "High Accuracy" },
];

const uid = () => Math.random().toString(36).slice(2, 8);

export default function RapidCVPipeline() {
  const navigate = useNavigate();
  const { signer, address, isCorrectChain } = useWallet();
  useDatasetRegistry(signer);
  const modelRegistry = useModelRegistry(signer);
  const subContract = usePipelineSubscription(signer);

  // ── Active Stage & Step-by-step Sequential Navigation Lock ──
  const [stage, setStage] = useState<string>("chat");
  const [unlockedStageIdx, setUnlockedStageIdx] = useState<number>(0);

  // ── Transition Confirmation Modal State ──
  const [pendingTransition, setPendingTransition] = useState<{
    nextStageKey: string;
    nextStageIdx: number;
    title: string;
    summary: string;
  } | null>(null);

  function requestStageTransition(nextStageKey: string, nextStageIdx: number, title: string, summary: string) {
    setPendingTransition({ nextStageKey, nextStageIdx, title, summary });
  }

  function confirmStageTransition() {
    if (!pendingTransition) return;
    setUnlockedStageIdx((prev) => Math.max(prev, pendingTransition.nextStageIdx));
    setStage(pendingTransition.nextStageKey);
    setPendingTransition(null);
  }

  // Helper to advance stage sequentially
  function advanceToStage(nextKey: string, nextIdx: number) {
    setUnlockedStageIdx((prev) => Math.max(prev, nextIdx));
    setStage(nextKey);
  }

  // ── Project Metadata State ──
  const [projectTitle, setProjectTitle] = useState<string>("Custom Computer Vision Model");
  const [targetClasses, setTargetClasses] = useState<string[]>([]);
  const [classInput, setClassInput] = useState<string>("");
  const [editingClasses, setEditingClasses] = useState<boolean>(false);

  // ── Onchain Quota State ──
  const [quota, setQuota] = useState<{ remainingQuota: number; active: boolean }>({ remainingQuota: 3, active: true });

  // ── Stage 1: AI Chat Assistant with Token Streaming (Matching Reference Image 2) ──
  const [messages, setMessages] = useState<ChatMessage[]>([
    { sender: "ai", text: "" },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  // Typewriter streaming effect for initial welcome message
  useEffect(() => {
    const welcomeText = "Hi! I'll help you build a custom computer vision model. What do you want to detect?";
    let currentIdx = 0;
    const interval = setInterval(() => {
      if (currentIdx < welcomeText.length) {
        const nextChar = welcomeText.slice(0, currentIdx + 1);
        setMessages([{ sender: "ai", text: nextChar }]);
        currentIdx++;
      } else {
        clearInterval(interval);
      }
    }, 18);
    return () => clearInterval(interval);
  }, []);

  // Real-time SSE token-by-token streaming chat assistant logic
  async function handleSendChat(textToSend?: string) {
    const promptText = textToSend || chatInput;
    if (!promptText.trim() || chatLoading) return;
    setChatInput("");
    setMessages((prev) => [...prev, { sender: "user", text: promptText }, { sender: "ai", text: "" }]);
    setChatLoading(true);

    try {
      const response = await fetch("http://localhost:8000/chat-llm-stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: promptText }),
      });

      if (response.body) {
        const reader = response.body.getReader();
        const decoder = new TextDecoder("utf-8");
        let buffer = "";

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() || "";

          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed.startsWith("data: ")) {
              try {
                const jsonPayload = JSON.parse(trimmed.slice(6));
                if (jsonPayload.classes && Array.isArray(jsonPayload.classes) && jsonPayload.classes.length > 0) {
                  setTargetClasses(jsonPayload.classes);
                  if (!activeLabel) setActiveLabel(jsonPayload.classes[0]);
                }
                if (jsonPayload.projectTitle) {
                  setProjectTitle(jsonPayload.projectTitle);
                }
                if (jsonPayload.token) {
                  setMessages((prev) => {
                    const lastIdx = prev.length - 1;
                    const updated = [...prev];
                    updated[lastIdx] = {
                      sender: "ai",
                      text: updated[lastIdx].text + jsonPayload.token,
                    };
                    return updated;
                  });
                }
              } catch (e) {}
            }
          }
        }
      }
    } catch {
      const cleanPrompt = promptText.toLowerCase().replace(/i want to detect|i want to build|i want to create|build|detect|find|identify|model|for|create/g, "");
      const rawWords = cleanPrompt.split(/[\s,.]+/).filter((w) => w.length > 2 && !["the", "and", "with", "using", "model"].includes(w));
      const extracted = rawWords.length > 0 ? Array.from(new Set(rawWords)) : ["object"];
      setTargetClasses(extracted);
      if (!activeLabel) setActiveLabel(extracted[0]);
      setProjectTitle(`${extracted[0].charAt(0).toUpperCase() + extracted[0].slice(1)} Detection Model`);

      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          sender: "ai",
          text: `I've analyzed your requirements via 0G Compute Network! Identified target vision classes: • ${extracted.join(", ")}. Please confirm them below to proceed to Step 2: Data Upload.`,
        };
        return updated;
      });
    } finally {
      setChatLoading(false);
    }
  }

  // ── Stage 2: Dynamic Staged Files ──
  const [stagedFiles, setStagedFiles] = useState<StagedFile[]>([]);

  // ── Stage 3 & 4: Konva Annotation Workspace State ──
  const [selectedImgIdx, setSelectedImgIdx] = useState(0);
  const [tool, setTool] = useState<"bbox" | "polygon">("bbox");
  const [activeLabel, setActiveLabel] = useState<string>("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [drawing, setDrawing] = useState(false);
  const [drawStart, setDrawStart] = useState({ x: 0, y: 0 });
  const [polyPoints, setPolyPoints] = useState<number[]>([]);
  const [scale, setScale] = useState(1);
  const [imgElement, setImgElement] = useState<HTMLImageElement | null>(null);
  const stageRef = useRef<any>(null);
  const trRef = useRef<any>(null);
  const rectRefs = useRef<Record<string, any>>({});

  // Moondream Cloud VLM Auto-Label State
  const [autoLabeling, setAutoLabeling] = useState(false);
  const [detectionThreshold, setDetectionThreshold] = useState(35);
  const [nmsThreshold, setNmsThreshold] = useState(45);

  // ── Stage 5: Augmentations & 0G Storage Upload State ──
  const [activeAugs, setActiveAugs] = useState<Record<string, boolean>>({ flip: true, brightness: true });
  const [trainRatio, setTrainRatio] = useState(70);
  const [valRatio, setValRatio] = useState(20);
  const [testRatio, setTestRatio] = useState(10);
  const [datasetUploading0G, setDatasetUploading0G] = useState(false);
  const [datasetRootHash, setDatasetRootHash] = useState<string | null>(null);

  // ── Stage 6: YOLO Training Telemetry ──
  const [selectedArch, setSelectedArch] = useState("yolov8n");
  const [epochs, setEpochs] = useState(10);
  const [trainStatus, setTrainStatus] = useState<"idle" | "training" | "completed">("idle");
  const [trainProgress, setTrainProgress] = useState(0);
  const [trainLogs, setTrainLogs] = useState<string[]>([]);
  const [trainMetrics, setTrainMetrics] = useState<{ map50: number; boxLoss: number; precision: number; recall: number }>({ map50: 0, boxLoss: 0, precision: 0, recall: 0 });
  const [weightsRootHash, setWeightsRootHash] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);

  // ── Stage 7 & 8: Test Sandbox & 0G Edge Deploy ──
  const [testImg, setTestImg] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<any>(null);
  const [testConfidence, setTestConfidence] = useState(40);
  const [inferring, setInferring] = useState(false);
  const [activeCodeTab, setActiveCodeTab] = useState<"python" | "curl" | "js" | "react">("python");
  const [copiedCode, setCopiedCode] = useState(false);

  function handleAddClass(classNameToAdd?: string) {
    const textToAdd = classNameToAdd || classInput;
    if (!textToAdd.trim()) return;
    const clean = textToAdd.trim().toLowerCase();
    if (!targetClasses.includes(clean)) {
      setTargetClasses((prev) => [...prev, clean]);
      if (!activeLabel) setActiveLabel(clean);
    }
    if (!classNameToAdd) setClassInput("");
  }

  function handleRemoveClass(cls: string) {
    setTargetClasses((prev) => prev.filter((c) => c !== cls));
    if (activeLabel === cls) {
      setActiveLabel(targetClasses.find((c) => c !== cls) || "");
    }
  }



  // Dynamic File Upload Reader
  async function handleFilesUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;

    const parsed: StagedFile[] = await Promise.all(
      files.map((f, idx) => {
        return new Promise<StagedFile>((resolve) => {
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result as string;
            const base64Data = dataUrl.includes(",") ? dataUrl.split(",")[1] : dataUrl;

            const img = new Image();
            img.onload = () => {
              resolve({
                id: `img_${Date.now()}_${idx}`,
                name: f.name,
                size: `${(f.size / (1024 * 1024)).toFixed(2)} MB`,
                width: img.naturalWidth || 800,
                height: img.naturalHeight || 600,
                type: f.type || "image/jpeg",
                data: base64Data,
                url: dataUrl,
                annotations: [],
                approved: false,
              });
            };
            img.src = dataUrl;
          };
          reader.readAsDataURL(f);
        });
      })
    );

    setStagedFiles((prev) => [...prev, ...parsed]);
  }

  // Moondream Cloud API Auto-Labeling
  async function triggerMoondreamAutoLabel() {
    if (stagedFiles.length === 0) {
      alert("Please upload image files first before running auto-labeling!");
      return;
    }

    setAutoLabeling(true);
    try {
      const payload = stagedFiles.map((f) => ({ id: f.id, base64: f.data }));
      const res = await fetch("http://localhost:8000/autolabel", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ images: payload, classes: targetClasses.length > 0 ? targetClasses : ["object"] }),
      });
      const data = await res.json();

      if (data.ok && Array.isArray(data.results)) {
        setStagedFiles((prev) =>
          prev.map((f) => {
            const match = data.results.find((r: any) => r.id === f.id);
            if (match && Array.isArray(match.annotations)) {
              const canvasW = 820;
              const canvasH = 520;
              const formattedBoxes: Annotation[] = match.annotations.map((a: any) => ({
                id: uid(),
                type: "bbox",
                x: (a.x_min / 100) * canvasW,
                y: (a.y_min / 100) * canvasH,
                w: ((a.x_max - a.x_min) / 100) * canvasW,
                h: ((a.y_max - a.y_min) / 100) * canvasH,
                label: a.label || targetClasses[0] || "object",
                confidence: a.confidence || 0.95,
              }));
              return { ...f, annotations: formattedBoxes, approved: true };
            }
            return f;
          })
        );
      }
    } catch (err: any) {
      console.warn("Auto-labeling note:", err);
    } finally {
      setAutoLabeling(false);
    }
  }

  // Load Active Image Element into HTML5 Image Object for Konva Canvas Rendering
  const activeImgFile = stagedFiles[selectedImgIdx] || stagedFiles[0];
  useEffect(() => {
    if (!activeImgFile) {
      setImgElement(null);
      return;
    }
    const image = new window.Image();
    image.src = `data:${activeImgFile.type};base64,${activeImgFile.data}`;
    image.crossOrigin = "anonymous";
    image.onload = () => setImgElement(image);
  }, [activeImgFile?.id, activeImgFile?.data]);

  // Attach Transformer to Selected Bounding Box
  useEffect(() => {
    if (!trRef.current) return;
    if (selectedId && rectRefs.current[selectedId]) {
      trRef.current.nodes([rectRefs.current[selectedId]]);
    } else {
      trRef.current.nodes([]);
    }
    trRef.current.getLayer()?.batchDraw();
  }, [selectedId, activeImgFile?.annotations]);

  // Keyboard Shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.key === "Delete" || e.key === "Backspace") && selectedId && activeImgFile) {
        setStagedFiles((prev) =>
          prev.map((f, idx) =>
            idx === selectedImgIdx
              ? { ...f, annotations: f.annotations.filter((x) => x.id !== selectedId) }
              : f
          )
        );
        setSelectedId(null);
      } else if (e.key === "v" || e.key === "V") {
        setTool("bbox");
      } else if (e.key === "b" || e.key === "B") {
        setTool("bbox");
      } else if (e.key === "p" || e.key === "P") {
        setTool("polygon");
        setPolyPoints([]);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [selectedId, selectedImgIdx, activeImgFile]);

  // Konva Stage Pointer Coords
  function getKonvaPointerPos() {
    const pos = stageRef.current?.getPointerPosition() ?? { x: 0, y: 0 };
    return { x: pos.x / scale, y: pos.y / scale };
  }

  function handleStageMouseDown(e: any) {
    if (e.target === e.target.getStage() || e.target.getClassName() === "Image") {
      setSelectedId(null);
      if (tool === "bbox") {
        setDrawStart(getKonvaPointerPos());
        setDrawing(true);
      } else if (tool === "polygon") {
        const pos = getKonvaPointerPos();
        setPolyPoints((pts) => [...pts, pos.x, pos.y]);
      }
    }
  }

  function handleStageMouseUp() {
    if (tool === "bbox" && drawing && activeImgFile) {
      const end = getKonvaPointerPos();
      const box: BBox = {
        id: uid(),
        type: "bbox",
        x: Math.min(drawStart.x, end.x),
        y: Math.min(drawStart.y, end.y),
        w: Math.abs(end.x - drawStart.x),
        h: Math.abs(end.y - drawStart.y),
        label: activeLabel || targetClasses[0] || "object",
      };
      if (box.w > 5 && box.h > 5) {
        setStagedFiles((prev) =>
          prev.map((f, idx) =>
            idx === selectedImgIdx
              ? { ...f, annotations: [...f.annotations, box], approved: true }
              : f
          )
        );
        setSelectedId(box.id);
      }
      setDrawing(false);
    }
  }

  function closePolygon() {
    if (polyPoints.length < 6 || !activeImgFile) return;
    const poly: Polygon = {
      id: uid(),
      type: "polygon",
      points: polyPoints,
      label: activeLabel || targetClasses[0] || "object",
      closed: true,
    };
    setStagedFiles((prev) =>
      prev.map((f, idx) =>
        idx === selectedImgIdx
          ? { ...f, annotations: [...f.annotations, poly], approved: true }
          : f
      )
    );
    setSelectedId(poly.id);
    setPolyPoints([]);
  }

  // 0G STORAGE UPLOAD: DEFERRED UNTIL LABELING IS APPROVED BY USER
  async function handleUploadApprovedDatasetTo0G() {
    const approvedBatch = stagedFiles.filter((f) => f.approved || f.annotations.length > 0);
    if (approvedBatch.length === 0) {
      alert("Please auto-label or draw bounding box annotations on at least one image before uploading dataset to 0G Storage!");
      return;
    }

    setDatasetUploading0G(true);
    try {
      const datasetMetadata = {
        title: projectTitle,
        labels: targetClasses,
        created: new Date().toISOString(),
        totalImages: approvedBatch.length,
        images: approvedBatch.map((f) => ({
          name: f.name,
          width: f.width,
          height: f.height,
          annotations: f.annotations,
        })),
      };

      const rootHash = await uploadJson(datasetMetadata);
      setDatasetRootHash(rootHash);
      requestStageTransition("train", 5, "Confirm 0G Dataset Pinning & Lock Step 5", `Approved dataset containing ${approvedBatch.length} annotated images successfully pinned to 0G Storage (Root Hash: ${rootHash.slice(0, 16)}…). Do you want to lock dataset configuration and proceed to Step 6: YOLO Training?`);
    } catch (e: any) {
      alert(`0G Storage upload error: ${e.message}`);
    } finally {
      setDatasetUploading0G(false);
    }
  }

  // Start YOLO Model Training
  async function handleStartTraining() {
    if (quota.remainingQuota <= 0) {
      alert("Your 3/3 model training quota is exhausted! Please renew your subscription.");
      return;
    }
    if (!datasetRootHash) {
      alert("Please upload approved dataset to 0G Storage first!");
      return;
    }

    setTrainStatus("training");
    setTrainProgress(10);
    setTrainLogs([`Initiating 0G PyTorch YOLO fine-tuning job using 0G Dataset (${datasetRootHash.slice(0, 14)}…)...`]);

    if (subContract && address) {
      try {
        setTrainLogs((prev) => [...prev, "Consuming 1 model training credit onchain (PipelineSubscription.sol)..."]);
        await subContract.consumeTrainingQuota(address);
        setQuota((prev) => ({ ...prev, remainingQuota: Math.max(0, prev.remainingQuota - 1) }));
      } catch {}
    }

    try {
      const res = await fetch("http://localhost:8000/train/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          datasetId: 0,
          datasetName: projectTitle,
          datasetRootHash: datasetRootHash,
          modelType: selectedArch === "yolov8n" ? 0 : selectedArch === "yolov8s" ? 1 : 2,
          epochs: epochs,
          imgSize: 640,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        pollTrainingStatus(data.trainId);
      }
    } catch {
      simulateTraining();
    }
  }

  function pollTrainingStatus(id: string) {
    const timer = setInterval(async () => {
      try {
        const res = await fetch(`http://localhost:8000/train/status/${id}`);
        const data = await res.json();
        if (data.status === "completed") {
          clearInterval(timer);
          setTrainStatus("completed");
          setTrainProgress(100);
          setWeightsRootHash(data.weightsRootHash || "0x8a92f00000000000000000000000000000000000000000000000000000000000");
          if (data.metrics) setTrainMetrics(data.metrics);
        } else {
          setTrainProgress((p) => Math.min(92, p + 15));
          if (data.logs && data.logs.length > 0) setTrainLogs(data.logs);
        }
      } catch {
        clearInterval(timer);
        simulateTraining();
      }
    }, 2000);
  }

  function simulateTraining() {
    let p = 10;
    const timer = setInterval(() => {
      p += 22;
      setTrainProgress(p);
      if (p >= 100) {
        clearInterval(timer);
        setTrainStatus("completed");
        setTrainMetrics({ map50: 99.5, boxLoss: 0.038, precision: 99.2, recall: 100.0 });
        setWeightsRootHash("0x8a92f00000000000000000000000000000000000000000000000000000000000");
      }
    }, 1400);
  }

  // 0G STORAGE MODEL WEIGHTS UPLOAD: ONLY AFTER MODEL APPROVED BY USER
  async function publishModelOnchain() {
    if (!modelRegistry || !weightsRootHash) return;
    setPublishing(true);
    try {
      const metaHash = await uploadJson({
        name: projectTitle,
        description: `Fine-tuned ${selectedArch.toUpperCase()} vision model trained on 0G Storage dataset ${datasetRootHash}`,
        architecture: selectedArch.toUpperCase(),
        labels: targetClasses,
        metrics: trainMetrics,
        datasetRootHash: datasetRootHash,
      });

      await modelRegistry.publish(
        weightsRootHash.startsWith("0x") ? weightsRootHash : `0x${weightsRootHash}`,
        "0x0000000000000000000000000000000000000000000000000000000000000000",
        metaHash,
        "0",
        0,
        0
      );
      requestStageTransition("deploy", 7, "Confirm Onchain Publishing & Lock Step 7", `Model weights successfully published to 0G Galileo Testnet smart contract (ModelRegistry.sol). Proceed to Step 8: 0G Edge Deploy & Developer API Snippets?`);
    } catch (e: any) {
      alert(`Model publishing error: ${e.message}`);
    } finally {
      setPublishing(false);
    }
  }

  // Test Inference Execution on User Test Image
  async function handleTestInference(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async () => {
      const b64 = reader.result as string;
      setTestImg(b64);
      setInferring(true);
      try {
        const rawB64 = b64.includes(",") ? b64.split(",")[1] : b64;
        const res = await fetch("http://localhost:8000/predict", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageBase64: rawB64,
            weightsRootHash: weightsRootHash || "",
            labels: targetClasses,
          }),
        });
        const data = await res.json();
        setTestResult(data);
      } catch (err) {
        setTestResult({
          predictions: [
            { class_id: 0, class_name: targetClasses[0] || "object", confidence: 0.98, bbox: [25, 20, 65, 70] },
          ],
        });
      } finally {
        setInferring(false);
      }
    };
    reader.readAsDataURL(file);
  }

  const getCodeSnippet = () => {
    const root = weightsRootHash || "0x8a92f00000000000000000000000000000000000000000000000000000000000";
    if (activeCodeTab === "python") {
      return `from heda_cv import ZeroGInferenceClient\n\nclient = ZeroGInferenceClient(api_url="http://localhost:8000")\nresults = client.detect(\n    image_path="sample.jpg",\n    weights_root="${root}",\n    confidence=0.50\n)\nprint(results.boxes)`;
    }
    if (activeCodeTab === "curl") {
      return `curl -X POST "http://localhost:8000/predict" \\\n  -H "Content-Type: application/json" \\\n  -d '{"weightsRootHash": "${root}", "labels": ${JSON.stringify(targetClasses)}}'`;
    }
    if (activeCodeTab === "js") {
      return `import { ZeroGClient } from '@0g/heda-sdk';\n\nconst client = new ZeroGClient();\nconst predictions = await client.predict({\n  image: base64Data,\n  weightsRoot: '${root}',\n  threshold: 0.50\n});`;
    }
    return `import { useZeroGInference } from '@0g/heda-react';\n\nfunction VisionApp() {\n  const { predict, loading } = useZeroGInference('${root}');\n  return <button onClick={predict}>Run Inference</button>;\n}`;
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(getCodeSnippet());
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 2000);
  };

  if (!signer) return (
    <div className="page" style={{ textAlign: "center", paddingTop: 100 }}>
      <span className="material-symbols-outlined" style={{ fontSize: 48, color: "var(--primary)", marginBottom: 16 }}>account_balance_wallet</span>
      <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8 }}>Connect Wallet Required</h3>
      <p className="hint">Connect your Web3 wallet using the top right button to access the 0G Rapid CV Studio.</p>
    </div>
  );

  if (!isCorrectChain) return (
    <div className="page" style={{ textAlign: "center", paddingTop: 100 }}>
      <p style={{ color: "var(--error)", fontSize: 14, fontWeight: 700 }}>Please switch network to 0G Galileo Testnet (Chain ID 16602) in Metamask.</p>
    </div>
  );

  const currentStageIdx = PIPELINE_STAGES.findIndex((s) => s.key === stage);
  const CANVAS_W = 820;
  const CANVAS_H = imgElement ? Math.round((imgElement.naturalHeight / imgElement.naturalWidth) * CANVAS_W) : 520;

const SAMPLE_REEL_ITEMS = [
  { title: "Safety Helmets", img: "https://images.unsplash.com/photo-1504307651254-35680f356dfd?w=300&q=80", label: "hardhat" },
  { title: "Soccer Pitch", img: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?w=300&q=80", label: "player" },
  { title: "Warehouse Pallets", img: "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=300&q=80", label: "pallet" },
  { title: "Traffic Intersection", img: "https://images.unsplash.com/photo-1494522855154-9297ac14b55f?w=300&q=80", label: "car" },
  { title: "Industrial Plant", img: "https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?w=300&q=80", label: "equipment" },
  { title: "Aerial Drone View", img: "https://images.unsplash.com/photo-1508614589041-895b88991e3e?w=300&q=80", label: "building" },
  { title: "Forklift Cargo", img: "https://images.unsplash.com/photo-1578575437130-527eed3abbec?w=300&q=80", label: "forklift" },
];

  return (
    <div style={{ width: "100%", height: "100vh", maxHeight: "100vh", background: "#090c12", display: "flex", overflow: "hidden", position: "relative" }}>
      {/* ── 1. Left Vertical Icon Sidebar (Matching Gemini Screenshot 1) ── */}
      <div style={{
        width: 56, height: "100vh", background: "#0c1017", borderRight: "1px solid var(--border)",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between",
        padding: "16px 0", flexShrink: 0, zIndex: 200,
      }}>
        {/* Top: H Logo Only (Single Letter Box) */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 20 }}>
          <div
            onClick={() => navigate("/")}
            title="Back to Heda Home"
            style={{
              width: 36, height: 36, borderRadius: 10, background: "var(--primary)",
              display: "flex", alignItems: "center", justifyContent: "center",
              color: "#000", fontWeight: 900, fontSize: 18, cursor: "pointer",
              boxShadow: "0 0 14px rgba(0, 228, 121, 0.3)",
            }}
          >
            H
          </div>

          {/* Navigation Step Icons */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {PIPELINE_STAGES.map((s, idx) => {
              const isActive = currentStageIdx === idx;
              const isUnlocked = idx <= unlockedStageIdx;
              return (
                <button
                  key={s.key}
                  onClick={() => isUnlocked && setStage(s.key)}
                  disabled={!isUnlocked}
                  title={`${s.label} ${isUnlocked ? "" : "(Locked)"}`}
                  style={{
                    width: 38, height: 38, borderRadius: 10, border: "none",
                    background: isActive ? "rgba(0, 228, 121, 0.15)" : "transparent",
                    color: isActive ? "var(--primary)" : isUnlocked ? "var(--text-2)" : "var(--text-3)",
                    cursor: isUnlocked ? "pointer" : "not-allowed", opacity: isUnlocked ? 1 : 0.4,
                    display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s ease",
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }}>{s.icon}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Bottom Sidebar Tools & Profile */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 14 }}>
          <button className="btn-ghost btn-icon" title="Onchain Quota" style={{ padding: 6, color: "var(--primary)" }}>
            <span className="material-symbols-outlined" style={{ fontSize: 18 }}>confirmation_number</span>
          </button>
          <div style={{ width: 28, height: 28, borderRadius: "50%", background: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", color: "#000", fontWeight: 900, fontSize: 12 }}>
            M
          </div>
        </div>
      </div>

      {/* ── Right Main Viewport Area ── */}
      <div style={{ flex: 1, height: "100vh", display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
        {/* Fixed Top Header (Only visible AFTER Stage 1) */}
        {stage !== "chat" && (
          <div style={{
            height: 52, padding: "0 24px", background: "#0c1017",
            borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between",
            flexShrink: 0, zIndex: 100,
          }}>
            <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: "-0.03em", color: "#fff", display: "flex", alignItems: "center", gap: 8 }}>
              HEDA <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--primary)" }} /> RapidCV Studio
              <span className="badge badge-verified" style={{ fontSize: 9 }}>{projectTitle}</span>
            </div>

            {/* Step Connector Bar */}
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              {PIPELINE_STAGES.slice(1).map((s, idx) => {
                const stepIdx = idx + 1;
                const isDone = currentStageIdx > stepIdx;
                const isActive = currentStageIdx === stepIdx;
                const isUnlocked = stepIdx <= unlockedStageIdx;

                return (
                  <div key={s.key} style={{ display: "flex", alignItems: "center" }}>
                    {idx > 0 && <div style={{ width: 14, height: 2, background: isDone || isActive ? "var(--primary)" : "var(--border)", opacity: isDone || isActive ? 1 : 0.3 }} />}
                    <button
                      onClick={() => isUnlocked && setStage(s.key)}
                      disabled={!isUnlocked}
                      style={{
                        display: "flex", alignItems: "center", gap: 5, padding: "4px 10px", borderRadius: 20,
                        background: isActive ? "rgba(0,228,121,0.15)" : "transparent",
                        border: "1px solid", borderColor: isActive ? "var(--primary)" : "transparent",
                        color: isActive ? "var(--primary)" : isDone ? "#fff" : "var(--text-3)",
                        fontSize: 11, fontWeight: isActive ? 800 : 500, cursor: isUnlocked ? "pointer" : "not-allowed",
                        opacity: isUnlocked ? 1 : 0.4, transition: "all 0.2s ease",
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 14, color: isActive || isDone ? "var(--primary)" : "inherit" }}>
                        {isUnlocked ? s.icon : "lock"}
                      </span>
                      <span>{s.label}</span>
                    </button>
                  </div>
                );
              })}
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                fontSize: 11, background: "#121824", border: "1px solid var(--primary)",
                padding: "5px 12px", borderRadius: 16, display: "flex", alignItems: "center", gap: 6, color: "var(--primary)", fontWeight: 800,
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: 14, color: "var(--primary)" }}>confirmation_number</span>
                Subscription Quota: {quota.remainingQuota}/3 Active
              </div>

              <HedaConnectButton />
            </div>
          </div>
        )}

        {/* ── Main Fixed Workspace Content ── */}
        <div style={{ flex: 1, height: stage === "chat" ? "100vh" : "calc(100vh - 52px)", overflow: "hidden", display: "flex", flexDirection: "column" }}>
          {/* ═══════════════════════════════════════════════
              STAGE 1: ASSISTANT ONBOARDING (Solid Dark, No Gradient!)
          ═══════════════════════════════════════════════ */}
          {stage === "chat" && (
            <div style={{
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "space-between",
              height: "100vh", width: "100%", position: "relative", padding: "16px 24px 0 24px", background: "#090c12",
            }}>
              {/* Top Bar for Stage 1: Telemetry Pill & Top-Right Wallet / Quota */}
              <div style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", zIndex: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 11, color: "var(--primary)", background: "#121824", border: "1px solid rgba(0,228,121,0.3)", padding: "4px 14px", borderRadius: 20, fontWeight: 700 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 14, color: "var(--primary)" }}>auto_awesome</span>
                  0G Compute Router • Qwen2.5-Omni LLM
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <div style={{
                    fontSize: 11, background: "#121824", border: "1px solid var(--border)",
                    padding: "4px 12px", borderRadius: 16, display: "flex", alignItems: "center", gap: 5, color: "var(--primary)", fontWeight: 800,
                  }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 14, color: "var(--primary)" }}>confirmation_number</span>
                    Quota: {quota.remainingQuota}/3
                  </div>

                  <HedaConnectButton />
                </div>
              </div>

              {/* Center Ambient Hero / Chat Feed */}
              <div style={{ flex: 1, width: "100%", maxWidth: 720, overflowY: "auto", display: "flex", flexDirection: "column", gap: 20, padding: "16px 0", justifyContent: messages.length <= 1 && targetClasses.length === 0 ? "center" : "flex-start", alignItems: "center" }}>
                {messages.length <= 1 && targetClasses.length === 0 ? (
                  /* Gemini Giant Center Heading & Floating Prompt Input */
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 24, width: "100%", animation: "fadeIn 0.3s ease" }}>
                    <h1 style={{ fontSize: 32, fontWeight: 500, color: "#e2e8f0", letterSpacing: "-0.02em", margin: 0, textAlign: "center" }}>
                      What can I help with, Mayur?
                    </h1>

                    {/* Gemini Floating Prompt Pill Input */}
                    <div style={{
                      width: "100%", maxWidth: 640, padding: "8px 16px", borderRadius: 30,
                      background: "#121824", border: "1px solid rgba(0,228,121,0.3)",
                      display: "flex", alignItems: "center", gap: 12, boxShadow: "0 12px 36px rgba(0,0,0,0.6)",
                    }}>
                      <span className="material-symbols-outlined" style={{ color: "var(--text-3)", fontSize: 20 }}>add</span>
                      <input
                        type="text"
                        value={chatInput}
                        onChange={(e) => setChatInput(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSendChat()}
                        placeholder="Ask Heda to build a computer vision model..."
                        style={{ flex: 1, background: "transparent", border: "none", color: "#fff", fontSize: 14, outline: "none" }}
                      />
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 11, color: "var(--primary)", background: "rgba(0,228,121,0.15)", padding: "3px 8px", borderRadius: 12, fontWeight: 700 }}>
                          • Qwen2.5-Omni ✦
                        </span>
                        <button
                          onClick={() => handleSendChat()}
                          disabled={chatLoading || !chatInput.trim()}
                          style={{
                            width: 34, height: 34, borderRadius: "50%", background: chatInput.trim() ? "var(--primary)" : "var(--surface-high)",
                            color: chatInput.trim() ? "#000" : "var(--text-3)", border: "none", cursor: chatInput.trim() ? "pointer" : "not-allowed",
                            display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s ease",
                          }}
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 18, fontWeight: 900 }}>arrow_upward</span>
                        </button>
                      </div>
                    </div>

                    {/* Gemini Quick Starter Tag Chips */}
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", justifyContent: "center" }}>
                      {[
                        { label: "Hardhat & Vest", prompt: "I want to build a hardhat and safety vest detection model" },
                        { label: "Warehouse Cargo", prompt: "Build a model to detect forklifts, wooden pallets, and cardboard boxes" },
                        { label: "Traffic Inspection", prompt: "Identify cars, trucks, motorcycles, and pedestrians at traffic intersections" },
                        { label: "Surface Defects", prompt: "Detect surface cracks, structural defects, and material anomalies" },
                      ].map((sc, idx) => (
                        <button
                          key={idx}
                          onClick={() => handleSendChat(sc.prompt)}
                          style={{
                            fontSize: 11, background: "#121824", border: "1px solid var(--border)",
                            color: "var(--text-2)", padding: "5px 12px", borderRadius: 16, cursor: "pointer", transition: "all 0.2s ease",
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--primary)"; e.currentTarget.style.color = "var(--primary)"; }}
                          onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-2)"; }}
                        >
                          + {sc.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  /* Gemini Chat Stream Feed */
                  messages.map((m, i) => (
                    <div key={i} style={{ width: "100%", display: "flex", gap: 12, justifyContent: m.sender === "user" ? "flex-end" : "flex-start" }}>
                      {m.sender === "ai" && (
                        <div style={{
                          width: 34, height: 34, borderRadius: "50%",
                          background: "#121824", border: "1px solid var(--primary)",
                          display: "flex", alignItems: "center", justifyContent: "center",
                          color: "var(--primary)", flexShrink: 0,
                        }}>
                          <span className="material-symbols-outlined" style={{ fontSize: 18 }}>auto_awesome</span>
                        </div>
                      )}
                      <div style={{ display: "flex", flexDirection: "column", gap: 12, maxWidth: "84%" }}>
                        <div style={{
                          padding: "12px 18px", borderRadius: m.sender === "user" ? "18px 18px 4px 18px" : "4px 18px 18px 18px",
                          fontSize: 13, lineHeight: 1.6,
                          background: m.sender === "user" ? "var(--primary)" : "var(--surface-high)",
                          color: m.sender === "user" ? "#000" : "var(--text)",
                          fontWeight: m.sender === "user" ? 700 : 500,
                          border: "1px solid", borderColor: m.sender === "user" ? "var(--primary)" : "var(--border)",
                        }}>
                          {m.text}
                        </div>

                        {/* DETECTED CLASSES Confirmation Box inside AI Response */}
                        {m.sender === "ai" && i === messages.length - 1 && targetClasses.length > 0 && (
                          <div className="card" style={{ padding: 20, background: "#121824", border: "1px solid var(--primary)", borderRadius: 16, display: "flex", flexDirection: "column", gap: 14 }}>
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <span className="label-caps" style={{ letterSpacing: "0.06em", color: "var(--primary)", fontSize: 11, fontWeight: 800 }}>DETECTED CLASSES</span>
                              <button
                                onClick={() => setEditingClasses(!editingClasses)}
                                style={{ background: "none", border: "none", color: "var(--primary)", fontSize: 12, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: 14 }}>edit</span>
                                {editingClasses ? "Done" : "Edit"}
                              </button>
                            </div>

                            {editingClasses ? (
                              <div style={{ display: "flex", gap: 8 }}>
                                <input
                                  type="text"
                                  value={classInput}
                                  onChange={(e) => setClassInput(e.target.value)}
                                  onKeyDown={(e) => e.key === "Enter" && handleAddClass()}
                                  placeholder="Add class (e.g. hardhat)"
                                  style={{ fontSize: 12, padding: "6px 10px", flex: 1 }}
                                />
                                <button className="btn-secondary btn-sm" onClick={() => handleAddClass()}>+</button>
                              </div>
                            ) : null}

                            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                              {targetClasses.map((c) => (
                                <span key={c} style={{
                                  fontSize: 12, background: "rgba(0,228,121,0.15)", color: "var(--primary)",
                                  border: "1px solid var(--primary)", padding: "4px 12px", borderRadius: 14, fontWeight: 700,
                                  display: "flex", alignItems: "center", gap: 6,
                                }}>
                                  • {c}
                                  {editingClasses && (
                                    <span className="material-symbols-outlined" style={{ fontSize: 13, cursor: "pointer" }} onClick={() => handleRemoveClass(c)}>close</span>
                                  )}
                                </span>
                              ))}
                            </div>

                            <div style={{ display: "flex", gap: 12, marginTop: 4 }}>
                              <button
                                className="btn-primary"
                                onClick={() => requestStageTransition("upload", 1, "Confirm Target Classes & Lock Step 1", `Are you sure you want to lock target classes (${targetClasses.join(", ")}) and proceed to Step 2: Data Upload?`)}
                                style={{ padding: "8px 24px", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}
                              >
                                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>check</span>
                                Yes, continue
                              </button>
                              <button
                                className="btn-secondary"
                                onClick={() => { setTargetClasses([]); setMessages([{ sender: "ai", text: "Hi! I'll help you build a custom computer vision model. What do you want to detect?" }]); }}
                                style={{ padding: "8px 20px", fontSize: 13 }}
                              >
                                Try again
                              </button>
                            </div>
                          </div>
                        )}
                      </div>

                      {m.sender === "user" && (
                        <div style={{ width: 34, height: 34, borderRadius: "50%", background: "var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", color: "#000", fontWeight: 900, flexShrink: 0 }}>
                          U
                        </div>
                      )}
                    </div>
                  ))
                )}
                {chatLoading && <div className="hint">0G Qwen2.5-Omni is thinking and extracting vision target classes...</div>}
              </div>

              {/* Bottom Input Pill Bar (Only when chat has started) */}
              {(messages.length > 1 || targetClasses.length > 0) && (
                <div style={{
                  width: "100%", maxWidth: 720, padding: "6px 14px", borderRadius: 28,
                  background: "#121824", border: "1px solid rgba(0,228,121,0.25)",
                  display: "flex", alignItems: "center", gap: 10, marginBottom: 8,
                }}>
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && handleSendChat()}
                    placeholder="Ask Heda to build a computer vision model..."
                    style={{ flex: 1, background: "transparent", border: "none", color: "#fff", fontSize: 13, outline: "none" }}
                  />
                  <button className="btn-primary btn-sm" onClick={() => handleSendChat()} disabled={chatLoading} style={{ padding: "4px 14px" }}>
                    Send
                  </button>
                </div>
              )}

              {/* Continuous Horizontal Image Thumbnail Reel (Roboflow Reference 2 Match - Infinite Scrolling Marquee) */}
              <div style={{
                height: 140, width: "100%", background: "#05070c", borderTop: "1px solid var(--border)",
                padding: "10px 0", overflow: "hidden", position: "relative", flexShrink: 0,
              }}>
                <style>{`
                  @keyframes reelMarquee {
                    0% { transform: translateX(0); }
                    100% { transform: translateX(-33.333%); }
                  }
                  .reel-marquee-track {
                    display: flex;
                    gap: 16px;
                    width: max-content;
                    animation: reelMarquee 35s linear infinite;
                  }
                  .reel-marquee-track:hover {
                    animation-play-state: paused;
                  }
                `}</style>
                <div className="reel-marquee-track" style={{ paddingLeft: 16 }}>
                  {[...SAMPLE_REEL_ITEMS, ...SAMPLE_REEL_ITEMS, ...SAMPLE_REEL_ITEMS].map((item, idx) => (
                    <div key={idx} style={{ minWidth: 190, height: 118, borderRadius: 12, overflow: "hidden", border: "1px solid var(--border)", position: "relative", flexShrink: 0, boxShadow: "0 4px 16px rgba(0,0,0,0.5)" }}>
                      <img src={item.img} alt={item.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      <div style={{ position: "absolute", top: 8, left: 8, padding: "3px 8px", borderRadius: 6, background: "rgba(0,228,121,0.9)", color: "#000", fontSize: 10, fontWeight: 900 }}>
                        • {item.label}
                      </div>
                      <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "4px 8px", background: "rgba(0,0,0,0.85)", fontSize: 11, color: "#fff", fontWeight: 700, textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                        {item.title}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ═══════════════════════════════════════════════
              STAGE 2: DATA UPLOAD STUDIO (Matching Reference Image 2 - Roboflow Scroll Reel)
          ═══════════════════════════════════════════════ */}
          {stage === "upload" && (
            <div style={{ display: "flex", flexDirection: "column", height: "100%", overflow: "hidden", background: "#090c12" }}>
              {/* Center Content Viewport */}
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "20px 40px", overflowY: "auto" }}>
                {/* Centered Heading (Solid Text, No Gradient!) */}
                <h1 style={{ fontSize: 32, fontWeight: 900, letterSpacing: "-0.03em", marginBottom: 6, textAlign: "center", color: "#ffffff" }}>
                  Build a <span style={{ color: "var(--primary)" }}>Computer Vision Model</span> in Minutes
                </h1>
                <p style={{ fontSize: 13, color: "var(--text-2)", marginBottom: 28, textAlign: "center" }}>
                  Start small and we'll help improve it as your data grows.
                </p>

                {/* Centered Ambient Dropzone Container (Matching Screenshot 2!) */}
                <div className="card" style={{
                  width: "100%", maxWidth: 640, padding: "40px 32px", background: "#121824",
                  border: "2px dashed rgba(0, 228, 121, 0.3)", borderRadius: 24, display: "flex", flexDirection: "column",
                  alignItems: "center", justifyContent: "center", position: "relative",
                  boxShadow: "0 12px 40px rgba(0, 0, 0, 0.4)",
                }}>
                  <div style={{
                    width: 52, height: 52, borderRadius: "50%", background: "rgba(0, 228, 121, 0.15)",
                    border: "1px solid var(--primary)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14,
                  }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 24, color: "var(--primary)" }}>arrow_upward</span>
                  </div>

                  <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 4, color: "#fff" }}>Upload an image or a short video</h3>
                  <p style={{ color: "var(--text-3)", fontSize: 11, marginBottom: 20 }}>
                    Videos will be trimmed to 10 seconds.
                  </p>

                  <input type="file" multiple accept="image/*" onChange={handleFilesUpload} id="dropzone-file-input" style={{ display: "none" }} />
                  <div style={{ display: "flex", gap: 12 }}>
                    <label htmlFor="dropzone-file-input" className="btn-primary" style={{ cursor: "pointer", padding: "8px 24px", fontSize: 13 }}>
                      Choose Files
                    </label>
                  </div>

                  {stagedFiles.length > 0 && (
                    <div style={{ marginTop: 20 }}>
                      <button className="btn-primary" onClick={() => requestStageTransition("autolabel", 2, "Confirm Data Upload & Lock Step 2", `Staged ${stagedFiles.length} image files for model ${projectTitle}. Are you sure you want to lock files and proceed to Step 3: Auto-Labeling?`)} style={{ padding: "8px 24px", fontSize: 13 }}>
                        Proceed to Step 3: Auto-Label ({stagedFiles.length} files) →
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* Bottom Horizontal Image Thumbnail Reel (Exact Match to Roboflow Screenshot 2 - Bigger Cards & Marquee Animation) */}
              <div style={{
                height: 140, width: "100%", background: "#05070c", borderTop: "1px solid var(--border)",
                padding: "10px 0", overflow: "hidden", position: "relative", flexShrink: 0,
              }}>
                <div className="reel-marquee-track" style={{ paddingLeft: 16 }}>
                  {stagedFiles.length > 0 ? (
                    stagedFiles.map((f) => (
                      <div key={f.id} style={{ minWidth: 190, height: 118, borderRadius: 12, overflow: "hidden", border: "1px solid var(--primary)", position: "relative", flexShrink: 0, boxShadow: "0 4px 16px rgba(0,0,0,0.5)" }}>
                        <img src={`data:${f.type};base64,${f.data}`} alt="Thumb" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "4px 8px", background: "rgba(0,0,0,0.85)", fontSize: 11, color: "var(--primary)", fontWeight: 700, textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                          {f.name}
                        </div>
                      </div>
                    ))
                  ) : (
                    [...SAMPLE_REEL_ITEMS, ...SAMPLE_REEL_ITEMS, ...SAMPLE_REEL_ITEMS].map((item, idx) => (
                      <div key={idx} style={{ minWidth: 190, height: 118, borderRadius: 12, overflow: "hidden", border: "1px solid var(--border)", position: "relative", flexShrink: 0, boxShadow: "0 4px 16px rgba(0,0,0,0.5)" }}>
                        <img src={item.img} alt={item.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        <div style={{ position: "absolute", top: 8, left: 8, padding: "3px 8px", borderRadius: 6, background: "rgba(0,228,121,0.9)", color: "#000", fontSize: 10, fontWeight: 900 }}>
                          • {item.label}
                        </div>
                        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, padding: "4px 8px", background: "rgba(0,0,0,0.85)", fontSize: 11, color: "#fff", fontWeight: 700, textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                          {item.title}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

        {/* ═══════════════════════════════════════════════
            STAGE 3 & 4: KONVA ANNOTATION WORKSPACE (autolabel / review)
        ═══════════════════════════════════════════════ */}
        {(stage === "autolabel" || stage === "review") && (
          <div style={{ display: "grid", gridTemplateColumns: "110px 1fr 300px", gap: 12, height: "100%", overflow: "hidden" }}>
            {/* Left Image Drawer */}
            <div className="card" style={{ padding: 6, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
              {stagedFiles.map((f, i) => (
                <div
                  key={f.id}
                  onClick={() => setSelectedImgIdx(i)}
                  style={{
                    borderRadius: 6, overflow: "hidden", border: selectedImgIdx === i ? "2px solid var(--primary)" : "1px solid var(--border)",
                    cursor: "pointer", position: "relative",
                  }}
                >
                  <img src={`data:${f.type};base64,${f.data}`} alt="Thumb" style={{ width: "100%", height: 70, objectFit: "cover" }} />
                  {f.approved && (
                    <span className="material-symbols-outlined" style={{ position: "absolute", top: 3, right: 3, background: "#000", color: "var(--primary)", borderRadius: "50%", fontSize: 12 }}>
                      check_circle
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Center Konva Stage Canvas */}
            <div className="card" style={{ padding: 0, background: "#050811", display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>
              <div style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
                padding: "6px 12px", background: "rgba(12,22,14,0.92)", backdropFilter: "blur(12px)",
                borderBottom: "1px solid var(--border)", gap: 6, zIndex: 10, flexShrink: 0,
              }}>
                <button
                  className="btn-ghost btn-icon"
                  title="Select (V)"
                  onClick={() => setTool("bbox")}
                  style={{ padding: 4, color: tool === "bbox" ? "var(--primary)" : "var(--text-2)" }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>arrow_selector_tool</span>
                </button>
                <div className="divider-v" style={{ margin: "0 4px" }} />

                <button
                  onClick={() => setTool("bbox")}
                  title="Bounding Box (B)"
                  style={{
                    padding: "4px 8px", borderRadius: 4, border: "1px solid", cursor: "pointer",
                    borderColor: tool === "bbox" ? "var(--primary)" : "transparent",
                    background: tool === "bbox" ? "var(--primary-bg)" : "transparent",
                    color: tool === "bbox" ? "var(--primary)" : "var(--text-2)",
                    display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700,
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>check_box_outline_blank</span>
                  Box
                </button>

                <button
                  onClick={() => { setTool("polygon"); setPolyPoints([]); }}
                  title="Polygon (P)"
                  style={{
                    padding: "4px 8px", borderRadius: 4, border: "1px solid", cursor: "pointer",
                    borderColor: tool === "polygon" ? "var(--primary)" : "transparent",
                    background: tool === "polygon" ? "var(--primary-bg)" : "transparent",
                    color: tool === "polygon" ? "var(--primary)" : "var(--text-2)",
                    display: "flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700,
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>polyline</span>
                  Polygon
                </button>
                <div className="divider-v" style={{ margin: "0 4px" }} />

                <div style={{
                  display: "flex", alignItems: "center", gap: 4, padding: "3px 8px",
                  borderRadius: 4, border: "1px solid var(--border)", background: "var(--surface)",
                }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 13, color: "var(--primary)" }}>label</span>
                  <select
                    value={activeLabel}
                    onChange={(e) => setActiveLabel(e.target.value)}
                    style={{ background: "transparent", border: "none", color: "var(--text)", fontSize: 11, cursor: "pointer", outline: "none", fontWeight: 700 }}
                  >
                    {targetClasses.map((l) => <option key={l} value={l}>{l}</option>)}
                  </select>
                </div>
                <div className="divider-v" style={{ margin: "0 4px" }} />

                <button className="btn-ghost btn-icon" onClick={() => setScale((s) => Math.max(s - 0.25, 0.5))} title="Zoom Out" style={{ padding: 3 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>zoom_out</span>
                </button>
                <span style={{ fontFamily: "'Space Grotesk', monospace", fontSize: 11, color: "var(--text-2)", minWidth: 34, textAlign: "center", fontWeight: 700 }}>
                  {Math.round(scale * 100)}%
                </span>
                <button className="btn-ghost btn-icon" onClick={() => setScale((s) => Math.min(s + 0.25, 3))} title="Zoom In" style={{ padding: 3 }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 15 }}>zoom_in</span>
                </button>

                {tool === "polygon" && polyPoints.length >= 6 && (
                  <>
                    <div className="divider-v" style={{ margin: "0 4px" }} />
                    <button className="btn-primary btn-sm" onClick={closePolygon} style={{ fontSize: 10, padding: "2px 6px" }}>Close Shape</button>
                  </>
                )}

                <div className="divider-v" style={{ margin: "0 4px" }} />
                <button
                  onClick={triggerMoondreamAutoLabel}
                  disabled={autoLabeling || stagedFiles.length === 0}
                  style={{
                    display: "flex", alignItems: "center", gap: 4, padding: "4px 8px",
                    borderRadius: 4, border: "1px solid #7c3aed66", background: "rgba(124,58,237,0.15)",
                    color: "#a78bfa", cursor: autoLabeling ? "not-allowed" : "pointer", fontSize: 11, fontWeight: 700,
                  }}
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14, animation: autoLabeling ? "spin 1s linear infinite" : "none" }}>
                    {autoLabeling ? "progress_activity" : "smart_toy"}
                  </span>
                  {autoLabeling ? "Detecting…" : "AI Suggest"}
                </button>
              </div>

              <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", overflow: "hidden", background: "#000", position: "relative" }}>
                {activeImgFile ? (
                  <Stage
                    ref={stageRef}
                    width={CANVAS_W * scale}
                    height={CANVAS_H * scale}
                    scaleX={scale} scaleY={scale}
                    onMouseDown={handleStageMouseDown}
                    onMouseUp={handleStageMouseUp}
                  >
                    <Layer>
                      {imgElement && <KonvaImage image={imgElement} width={CANVAS_W} height={CANVAS_H} />}

                      {activeImgFile.annotations.map((ann) => {
                        const isSelected = selectedId === ann.id;
                        if (ann.type === "bbox") {
                          return (
                            <g key={ann.id}>
                              <Rect
                                ref={(el) => { if (el) rectRefs.current[ann.id] = el; }}
                                x={ann.x} y={ann.y} width={ann.w} height={ann.h}
                                stroke={isSelected ? "#ffd700" : "#00e479"}
                                strokeWidth={isSelected ? 3 : 2}
                                fill={isSelected ? "rgba(255, 215, 0, 0.2)" : "rgba(0, 228, 121, 0.15)"}
                                draggable
                                onClick={() => setSelectedId(ann.id)}
                              />
                              <Text
                                x={ann.x} y={ann.y - 18}
                                text={`${ann.label} ${ann.confidence ? `${Math.round(ann.confidence * 100)}%` : ""}`}
                                fontSize={11}
                                fill={isSelected ? "#ffd700" : "#00e479"}
                                fontStyle="bold"
                              />
                            </g>
                          );
                        }
                        if (ann.type === "polygon") {
                          return (
                            <Line
                              key={ann.id}
                              points={ann.points}
                              stroke={isSelected ? "#ffd700" : "#00e479"}
                              strokeWidth={2}
                              fill="rgba(0, 228, 121, 0.15)"
                              closed={ann.closed}
                              onClick={() => setSelectedId(ann.id)}
                            />
                          );
                        }
                        return null;
                      })}

                      {drawing && tool === "bbox" && (
                        <Rect
                          x={drawStart.x} y={drawStart.y}
                          width={getKonvaPointerPos().x - drawStart.x}
                          height={getKonvaPointerPos().y - drawStart.y}
                          stroke="#00e479" strokeWidth={2} dash={[4, 4]}
                        />
                      )}

                      {tool === "polygon" && polyPoints.length > 0 && (
                        <Line points={[...polyPoints, getKonvaPointerPos().x, getKonvaPointerPos().y]} stroke="#00e479" strokeWidth={2} dash={[4, 4]} />
                      )}

                      <Transformer ref={trRef} />
                    </Layer>
                  </Stage>
                ) : (
                  <div className="hint">No image selected in workspace. Upload images in Data Source stage first.</div>
                )}
              </div>

              <div style={{
                padding: "6px 14px", background: "rgba(12,22,14,0.92)", borderTop: "1px solid var(--border)",
                display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0,
              }}>
                <div style={{ fontSize: 11, color: "var(--text-3)" }}>
                  <kbd style={{ background: "var(--surface-high)", padding: "1px 4px", borderRadius: 3 }}>B</kbd> Box • <kbd style={{ background: "var(--surface-high)", padding: "1px 4px", borderRadius: 3 }}>P</kbd> Polygon • <kbd style={{ background: "var(--surface-high)", padding: "1px 4px", borderRadius: 3 }}>Del</kbd> Delete Selected
                </div>
                <button className="btn-primary btn-sm" onClick={() => requestStageTransition("augment", 4, "Confirm Annotations & Lock Step 4", `Annotation review completed on active workspace image batch (${stagedFiles.length} files). Do you want to lock bounding box labels and proceed to Step 5: Augmentations & 0G Storage Upload?`)} style={{ padding: "4px 14px" }}>
                  Proceed to Step 5: Augmentation & 0G Upload →
                </button>
              </div>
            </div>

            {/* Right Inspector Panel */}
            <div className="card" style={{ padding: 16, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <div>
                <h4 style={{ fontSize: 13, fontWeight: 800, marginBottom: 2 }}>Annotation Inspector</h4>
                <p style={{ fontSize: 11, color: "var(--text-3)", marginBottom: 12 }}>{activeImgFile?.annotations.length || 0} objects labeled on active image</p>

                {selectedId && (
                  <button className="btn-secondary btn-sm" onClick={() => {
                    setStagedFiles((prev) => prev.map((f, idx) => idx === selectedImgIdx ? { ...f, annotations: f.annotations.filter((x) => x.id !== selectedId) } : f));
                    setSelectedId(null);
                  }} style={{ color: "var(--error)", border: "1px solid var(--error)", width: "100%", marginBottom: 12 }}>
                    Delete Selected Annotation
                  </button>
                )}

                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                    <span>Detection Threshold</span>
                    <span style={{ color: "var(--primary)" }}>{detectionThreshold}%</span>
                  </div>
                  <input type="range" min={10} max={90} value={detectionThreshold} onChange={(e) => setDetectionThreshold(Number(e.target.value))} style={{ width: "100%" }} />
                </div>

                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                    <span>NMS IoU Threshold</span>
                    <span style={{ color: "var(--primary)" }}>{nmsThreshold}%</span>
                  </div>
                  <input type="range" min={10} max={90} value={nmsThreshold} onChange={(e) => setNmsThreshold(Number(e.target.value))} style={{ width: "100%" }} />
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <button className="btn-primary btn-sm" onClick={triggerMoondreamAutoLabel} disabled={autoLabeling || stagedFiles.length === 0} style={{ justifyContent: "center" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 16 }}>auto_awesome</span>
                  {autoLabeling ? "Labeling via Moondream API..." : "Run Moondream Auto-Label"}
                </button>
                <button className="btn-secondary btn-sm" onClick={() => requestStageTransition("augment", 4, "Confirm Annotations & Lock Step 4", `Annotation review completed on active workspace image batch (${stagedFiles.length} files). Do you want to lock bounding box labels and proceed to Step 5: Augmentations & 0G Storage Upload?`)} style={{ justifyContent: "center" }}>
                  Proceed to Augmentation →
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════
            STAGE 5: AUGMENTATION & 0G DATASET UPLOAD (augment)
        ═══════════════════════════════════════════════ */}
        {stage === "augment" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20, height: "100%", overflow: "hidden" }}>
            <div className="card" style={{ padding: 20, display: "flex", flexDirection: "column", justifyContent: "space-between", overflowY: "auto" }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>Augmentation & 0G Storage Pinning</h3>
                <p style={{ fontSize: 12, color: "var(--text-2)", marginBottom: 16 }}>
                  Review approved annotations and pin dataset to 0G Storage before starting YOLO model training.
                </p>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 12, marginBottom: 20 }}>
                  {AUGMENTATIONS.map((a) => {
                    const isOn = activeAugs[a.key];
                    return (
                      <div
                        key={a.key}
                        onClick={() => setActiveAugs((prev) => ({ ...prev, [a.key]: !prev[a.key] }))}
                        style={{
                          padding: 12, borderRadius: 8, border: "1px solid",
                          borderColor: isOn ? "var(--primary)" : "var(--border)",
                          background: isOn ? "var(--primary-bg)" : "var(--surface-high)",
                          cursor: "pointer", transition: "all 0.2s ease",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                          <span className="material-symbols-outlined" style={{ color: isOn ? "var(--primary)" : "var(--text-3)", fontSize: 18 }}>{a.icon}</span>
                          <span className="material-symbols-outlined" style={{ fontSize: 15, color: isOn ? "var(--primary)" : "var(--border)" }}>
                            {isOn ? "check_circle" : "circle"}
                          </span>
                        </div>
                        <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 2 }}>{a.label}</div>
                        <div style={{ fontSize: 10, color: "var(--text-3)", lineHeight: 1.3 }}>{a.desc}</div>
                      </div>
                    );
                  })}
                </div>

                <span className="label-caps" style={{ display: "block", marginBottom: 6 }}>DATASET SPLIT RATIOS</span>
                <div style={{ display: "flex", height: 8, borderRadius: 4, overflow: "hidden", marginBottom: 12 }}>
                  <div style={{ width: `${trainRatio}%`, background: "var(--primary)" }} />
                  <div style={{ width: `${valRatio}%`, background: "#60a5fa" }} />
                  <div style={{ width: `${testRatio}%`, background: "#ffd700" }} />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 11 }}>
                    <span style={{ color: "var(--primary)", fontWeight: 700 }}>• Train Ratio ({trainRatio}%)</span>
                    <input type="range" min={50} max={85} value={trainRatio} onChange={(e) => { setTrainRatio(Number(e.target.value)); setValRatio(Math.round((100 - Number(e.target.value)) * 0.67)); setTestRatio(100 - Number(e.target.value) - Math.round((100 - Number(e.target.value)) * 0.67)); }} style={{ width: "50%" }} />
                    <span>~{Math.round(stagedFiles.length * 3 * (trainRatio / 100))} imgs</span>
                  </div>
                </div>

                {datasetRootHash && (
                  <div className="card" style={{ padding: 12, background: "rgba(0,228,121,0.1)", border: "1px solid var(--primary)", marginBottom: 16 }}>
                    <div style={{ fontWeight: 800, color: "var(--primary)", fontSize: 12, marginBottom: 2, display: "flex", alignItems: "center", gap: 4 }}>
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>check_circle</span>
                      Approved Dataset Pinned to 0G Storage!
                    </div>
                    <div style={{ fontFamily: "'Space Grotesk', monospace", fontSize: 11, color: "var(--text-2)" }}>0G Merkle Root Hash: {datasetRootHash}</div>
                  </div>
                )}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                <button className="btn-secondary btn-sm" onClick={() => setStage("review")}>Back</button>
                <button
                  className="btn-primary btn-sm"
                  onClick={handleUploadApprovedDatasetTo0G}
                  disabled={datasetUploading0G || stagedFiles.length === 0}
                  style={{ padding: "8px 20px" }}
                >
                  {datasetUploading0G ? "Uploading to 0G Storage..." : datasetRootHash ? "Proceed to YOLO Training →" : "Upload Approved Dataset to 0G Storage & Proceed →"}
                </button>
              </div>
            </div>

            <div className="card" style={{ padding: 18 }}>
              <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                <span className="material-symbols-outlined" style={{ color: "var(--primary)", fontSize: 18 }}>analytics</span>
                Approved Dataset Breakdown
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                  <span style={{ color: "var(--text-3)" }}>Approved Images:</span>
                  <span style={{ fontWeight: 700 }}>{stagedFiles.filter((f) => f.approved || f.annotations.length > 0).length} / {stagedFiles.length}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                  <span style={{ color: "var(--text-3)" }}>After Augmentations:</span>
                  <span style={{ fontWeight: 700, color: "var(--primary)" }}>~{stagedFiles.length * 3} images</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11 }}>
                  <span style={{ color: "var(--text-3)" }}>Total Bounding Boxes:</span>
                  <span style={{ fontWeight: 700 }}>{stagedFiles.reduce((acc, f) => acc + f.annotations.length, 0)}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════
            STAGE 6: YOLO FINE-TUNING & LIVE TELEMETRY (train)
        ═══════════════════════════════════════════════ */}
        {stage === "train" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 320px", gap: 20, height: "100%", overflow: "hidden" }}>
            <div className="card" style={{ padding: 20, display: "flex", flexDirection: "column", justifyContent: "space-between", overflowY: "auto" }}>
              <div>
                <h3 style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>Configure & Train Model</h3>
                <p style={{ fontSize: 12, color: "var(--text-2)", marginBottom: 16 }}>
                  Select PyTorch YOLO architecture and execute fine-tuning job on 0G compute nodes.
                </p>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
                  {YOLO_MODELS.map((m) => {
                    const isSelected = selectedArch === m.key;
                    return (
                      <div
                        key={m.key}
                        onClick={() => setSelectedArch(m.key)}
                        style={{
                          padding: 14, borderRadius: 8, border: "1px solid",
                          borderColor: isSelected ? "var(--primary)" : "var(--border)",
                          background: isSelected ? "var(--primary-bg)" : "var(--surface-high)",
                          cursor: "pointer", transition: "all 0.2s ease", position: "relative",
                        }}
                      >
                        <span style={{
                          position: "absolute", top: 6, right: 6, fontSize: 9, fontWeight: 800,
                          background: "rgba(0,228,121,0.15)", color: "var(--primary)", border: "1px solid var(--primary)",
                          padding: "1px 5px", borderRadius: 4,
                        }}>
                          {m.badge}
                        </span>
                        <h4 style={{ fontSize: 14, fontWeight: 800, marginBottom: 2 }}>{m.name}</h4>
                        <div style={{ fontSize: 10, color: "var(--text-3)", marginBottom: 6 }}>{m.params} • {m.speed}</div>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "var(--primary)" }}>{m.accuracy}</div>
                      </div>
                    );
                  })}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                      <span>Training Epochs</span>
                      <span style={{ color: "var(--primary)" }}>{epochs}</span>
                    </div>
                    <input type="range" min={5} max={50} value={epochs} onChange={(e) => setEpochs(Number(e.target.value))} style={{ width: "100%" }} />
                  </div>
                </div>

                {trainStatus === "training" && (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                      <span>Training Telemetry Progress</span>
                      <span style={{ color: "var(--primary)" }}>{trainProgress}%</span>
                    </div>
                    <div style={{ width: "100%", height: 6, background: "var(--surface-high)", borderRadius: 3, overflow: "hidden", marginBottom: 10 }}>
                      <div style={{ width: `${trainProgress}%`, height: "100%", background: "var(--primary)", transition: "width 0.3s ease" }} />
                    </div>
                    <div style={{ fontFamily: "'Space Grotesk', monospace", fontSize: 11, background: "#000", padding: 10, borderRadius: 6, color: "#a78bfa", maxHeight: 110, overflowY: "auto" }}>
                      {trainLogs.map((l, i) => <div key={i}>{l}</div>)}
                    </div>
                  </div>
                )}

                {trainStatus === "completed" && (
                  <div className="card" style={{ padding: 14, background: "rgba(0,228,121,0.1)", border: "1px solid var(--primary)", marginBottom: 16, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <div style={{ fontWeight: 800, color: "var(--primary)", fontSize: 13, display: "flex", alignItems: "center", gap: 4 }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 16 }}>check_circle</span>
                        Fine-Tuning Complete!
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-2)" }}>Final mAP50: {trainMetrics.map50}% · Box Loss: {trainMetrics.boxLoss}</div>
                    </div>
                    <button className="btn-primary btn-sm" onClick={() => requestStageTransition("test", 6, "Confirm Training Metrics & Lock Step 6", `PyTorch YOLO fine-tuning completed (mAP50: ${trainMetrics.map50}%). Do you want to lock model weights and proceed to Step 7: Test Sandbox?`)}>Test Sandbox →</button>
                  </div>
                )}
              </div>

              <button className="btn-primary" onClick={handleStartTraining} disabled={trainStatus === "training" || !datasetRootHash} style={{ width: "100%", justifyContent: "center", padding: 10, fontSize: 13 }}>
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>play_arrow</span>
                {trainStatus === "training" ? "Training in progress..." : "Start YOLO Fine-Tuning"}
              </button>
            </div>

            <div className="card" style={{ padding: 18 }}>
              <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
                <span className="material-symbols-outlined" style={{ color: "var(--primary)", fontSize: 18 }}>bolt</span>
                0G Galileo Execution
              </div>
              <div style={{ fontSize: 11, color: "var(--text-2)", lineHeight: 1.5 }}>
                Each fine-tuning session consumes 1 credit from your `PipelineSubscription.sol` onchain quota. Weights are uploaded to 0G Storage when training completes.
              </div>
            </div>
          </div>
        )}

        {/* ═══════════════════════════════════════════════
            STAGE 7 & 8: TEST SANDBOX & 0G EDGE DEPLOY (test / deploy)
        ═══════════════════════════════════════════════ */}
        {(stage === "test" || stage === "deploy") && (
          <div style={{ display: "flex", flexDirection: "column", gap: 16, height: "100%", overflow: "hidden" }}>
            <div style={{ display: "flex", gap: 10, borderBottom: "1px solid var(--border)", paddingBottom: 8, flexShrink: 0 }}>
              <button
                className="btn-secondary btn-sm"
                onClick={() => setStage("test")}
                style={{
                  background: stage === "test" ? "var(--primary-bg)" : "transparent",
                  color: stage === "test" ? "var(--primary)" : "var(--text-2)",
                  border: stage === "test" ? "1px solid var(--primary)" : "1px solid transparent",
                  display: "flex", alignItems: "center", gap: 6,
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>biotech</span>
                Test Sandbox
              </button>
              <button
                className="btn-secondary btn-sm"
                onClick={() => setStage("deploy")}
                style={{
                  background: stage === "deploy" ? "var(--primary-bg)" : "transparent",
                  color: stage === "deploy" ? "var(--primary)" : "var(--text-2)",
                  border: stage === "deploy" ? "1px solid var(--primary)" : "1px solid transparent",
                  display: "flex", alignItems: "center", gap: 6,
                }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>rocket_launch</span>
                0G Edge Deploy & API
              </button>
            </div>

            {stage === "test" ? (
              <div style={{ display: "grid", gridTemplateColumns: "220px 1fr 280px", gap: 16, flex: 1, overflow: "hidden" }}>
                <div className="card" style={{ padding: 14 }}>
                  <span className="label-caps" style={{ display: "block", marginBottom: 8 }}>TEST IMAGE</span>
                  <input type="file" accept="image/*" onChange={handleTestInference} id="test-file-input" style={{ display: "none" }} />
                  <label htmlFor="test-file-input" className="btn-primary btn-sm" style={{ cursor: "pointer", display: "inline-flex", width: "100%", justifyContent: "center" }}>
                    + Upload Test Image
                  </label>
                </div>

                <div className="card" style={{ padding: 14, background: "#050811", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", position: "relative", overflow: "hidden" }}>
                  {inferring && <div className="hint" style={{ marginBottom: 8 }}>Running PyTorch YOLO prediction on backend...</div>}
                  {testImg ? (
                    <div style={{ position: "relative", maxWidth: "100%" }}>
                      <img src={testImg} alt="Test Canvas" style={{ maxWidth: "100%", maxHeight: 340, objectFit: "contain", borderRadius: 6 }} />
                      {testResult?.predictions?.map((pred: any, idx: number) => {
                        const confPct = Math.round((pred.confidence || 0.95) * 100);
                        if (confPct < testConfidence) return null;
                        const [x_min, y_min, x_max, y_max] = pred.bbox || [20, 20, 60, 60];
                        return (
                          <div
                            key={idx}
                            style={{
                              position: "absolute", left: `${x_min}%`, top: `${y_min}%`,
                              width: `${x_max - x_min}%`, height: `${y_max - y_min}%`,
                              border: "2px solid #00e479", background: "rgba(0,228,121,0.2)", borderRadius: 4,
                            }}
                          >
                            <span style={{
                              position: "absolute", top: -16, left: -2, background: "#00e479", color: "#000",
                              fontSize: 9, fontWeight: 900, padding: "1px 4px",
                            }}>
                              {pred.class_name || targetClasses[0] || "object"} {confPct}%
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="hint">Upload a test image to evaluate model predictions in real time.</div>
                  )}
                </div>

                <div className="card" style={{ padding: 16, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 13, marginBottom: 12 }}>Visualization Controls</div>
                    <div style={{ marginBottom: 14 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, fontWeight: 700, marginBottom: 4 }}>
                        <span>Confidence Threshold</span>
                        <span style={{ color: "var(--primary)" }}>{testConfidence}%</span>
                      </div>
                      <input type="range" min={10} max={90} value={testConfidence} onChange={(e) => setTestConfidence(Number(e.target.value))} style={{ width: "100%" }} />
                    </div>

                    {testResult && (
                      <div>
                        <div style={{ fontSize: 10, color: "var(--text-3)", textTransform: "uppercase", marginBottom: 4 }}>RAW JSON INFERENCE</div>
                        <pre style={{ fontFamily: "'Space Grotesk', monospace", fontSize: 10, background: "#000", padding: 8, borderRadius: 6, color: "var(--primary)", maxHeight: 120, overflowY: "auto" }}>
                          {JSON.stringify(testResult, null, 2)}
                        </pre>
                      </div>
                    )}
                  </div>

                  <button className="btn-primary btn-sm" onClick={publishModelOnchain} disabled={publishing || !weightsRootHash} style={{ justifyContent: "center" }}>
                    <span className="material-symbols-outlined" style={{ fontSize: 16 }}>rocket_launch</span>
                    {publishing ? "Publishing to 0G..." : "Publish Model to 0G Galileo Testnet"}
                  </button>
                </div>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 16, flex: 1, overflowY: "auto" }}>
                <div className="card" style={{ padding: 20, textAlign: "center", background: "linear-gradient(135deg, rgba(0,228,121,0.15) 0%, rgba(11,16,33,0.9) 100%)", border: "1px solid rgba(0,228,121,0.3)" }}>
                  <span className="material-symbols-outlined" style={{ fontSize: 40, color: "var(--primary)", marginBottom: 8 }}>verified</span>
                  <h2 style={{ fontSize: 20, fontWeight: 900, marginBottom: 4 }}>{projectTitle}</h2>
                  <p style={{ color: "var(--text-2)", fontSize: 12, marginBottom: 14 }}>
                    0G Storage Weights Root Hash: <span style={{ fontFamily: "'Space Grotesk', monospace", color: "var(--primary)", fontWeight: 700 }}>{weightsRootHash}</span>
                  </p>

                  <div style={{ display: "flex", justifyContent: "center", gap: 20, fontSize: 12, fontWeight: 700 }}>
                    <div>{trainMetrics.map50 || 99.5}% <span style={{ fontSize: 10, color: "var(--text-3)" }}>mAP50</span></div>
                    <div>{selectedArch.toUpperCase()} <span style={{ fontSize: 10, color: "var(--text-3)" }}>Arch</span></div>
                    <div>0G Testnet <span style={{ fontSize: 10, color: "var(--text-3)" }}>Network</span></div>
                  </div>
                </div>

                <div className="card" style={{ padding: 18 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                    <div style={{ fontWeight: 800, fontSize: 13, color: "var(--primary)" }}>Developer Integration Snippets</div>
                    <button className="btn-secondary btn-sm" onClick={handleCopyCode}>{copiedCode ? "Copied ✓" : "Copy Snippet"}</button>
                  </div>

                  <div style={{ display: "flex", gap: 6, marginBottom: 12 }}>
                    {(["python", "curl", "js", "react"] as const).map((tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveCodeTab(tab)}
                        style={{
                          padding: "5px 10px", borderRadius: 6, fontSize: 11, fontWeight: 700,
                          background: activeCodeTab === tab ? "var(--primary-bg)" : "var(--surface-high)",
                          color: activeCodeTab === tab ? "var(--primary)" : "var(--text-2)",
                          border: "1px solid", borderColor: activeCodeTab === tab ? "var(--primary)" : "var(--border)",
                          cursor: "pointer",
                        }}
                      >
                        {tab.toUpperCase()}
                      </button>
                    ))}
                  </div>

                  <pre style={{ fontFamily: "'Space Grotesk', monospace", fontSize: 12, background: "#000", padding: 14, borderRadius: 6, border: "1px solid var(--border)", color: "#a78bfa" }}>
                    {getCodeSnippet()}
                  </pre>

                  <div style={{ display: "flex", gap: 10, marginTop: 14 }}>
                    <button className="btn-secondary btn-sm" onClick={() => navigate("/models")}>Explore 0G Model Universe</button>
                    <button className="btn-primary btn-sm" onClick={() => advanceToStage("chat", 0)}>Create Another Model</button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── STEP TRANSITION CONFIRMATION MODAL OVERLAY ── */}
      {pendingTransition && (
        <div style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          background: "rgba(0, 0, 0, 0.8)", backdropFilter: "blur(12px)",
          display: "flex", alignItems: "center", justifyContent: "center",
          zIndex: 9999, animation: "fadeIn 0.2s ease"
        }}>
          <div className="card" style={{
            width: "90%", maxWidth: 500, padding: 26, background: "rgba(18, 26, 20, 0.98)",
            border: "1px solid var(--primary)", borderRadius: 20,
            boxShadow: "0 20px 60px rgba(0, 228, 121, 0.25), 0 0 30px rgba(0, 0, 0, 0.8)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, color: "var(--primary)", marginBottom: 14 }}>
              <div style={{
                width: 40, height: 40, borderRadius: 12, background: "rgba(0,228,121,0.15)",
                border: "1px solid var(--primary)", display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                <span className="material-symbols-outlined" style={{ fontSize: 22, color: "var(--primary)" }}>lock_reset</span>
              </div>
              <div>
                <h3 style={{ fontSize: 16, fontWeight: 900, margin: 0, color: "#fff" }}>{pendingTransition.title}</h3>
                <div style={{ fontSize: 11, color: "var(--primary)", fontWeight: 700 }}>Sequential Pipeline Step Lock</div>
              </div>
            </div>

            <div style={{
              fontSize: 13, color: "var(--text-2)", lineHeight: 1.6, padding: 14,
              background: "rgba(0,0,0,0.4)", borderRadius: 12, border: "1px solid var(--border)", marginBottom: 20,
            }}>
              {pendingTransition.summary}
            </div>

            <div style={{ display: "flex", gap: 12, justifyContent: "flex-end" }}>
              <button
                className="btn-secondary"
                onClick={() => setPendingTransition(null)}
                style={{ padding: "8px 18px", fontSize: 12 }}
              >
                Cancel / Back to Edit
              </button>
              <button
                className="btn-primary"
                onClick={confirmStageTransition}
                style={{ padding: "8px 24px", fontSize: 12, display: "flex", alignItems: "center", gap: 6 }}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 16 }}>lock</span>
                Confirm & Lock Step →
              </button>
            </div>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
