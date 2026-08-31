import { useMemo } from "react";
import { ethers } from "ethers";
import { GALILEO, CONTRACTS, RELAYER_API_URL } from "../config";
import ABI from "../abis/DeviceRegistry.json";

export type DeviceInfo = {
  deviceId: string;
  owner: string;
  deviceName: string;
  latestStorageRoot: string;
  totalFramesIngested: number;
  lastSeenTimestamp: number;
  assignedModelId: number;
  active: boolean;
};

export type IngestedFrame = {
  id: number;
  device_id: string;
  root_hash: string;
  tx_seq: string | null;
  size_bytes: number;
  timestamp: number;
  bounty_job_id: number;
};

export function useDeviceRegistry(signer: ethers.Signer | null) {
  return useMemo(() => {
    const rawAddr = CONTRACTS.DEVICE_REGISTRY;
    if (!rawAddr || rawAddr === "0x0000000000000000000000000000000000000000") return null;

    const runner = signer || new ethers.JsonRpcProvider(GALILEO.rpc);
    const contract = new ethers.Contract(rawAddr, ABI, runner);

    return {
      /** Pair a new hardware camera to the connected wallet */
      async pairDevice(deviceId: string, deviceName: string) {
        const tx = await contract.pairDevice(deviceId, deviceName);
        return tx.wait();
      },

      /** Get single device details from on-chain mapping */
      async getDevice(deviceId: string): Promise<DeviceInfo> {
        const d = await contract.devices(deviceId);
        return {
          deviceId,
          owner: d[0],
          deviceName: d[1],
          latestStorageRoot: d[2],
          totalFramesIngested: Number(d[3]),
          lastSeenTimestamp: Number(d[4]),
          assignedModelId: Number(d[5]),
          active: d[6],
        };
      },

      /** Get all device IDs owned by a wallet address */
      async getOwnerDevices(ownerAddress: string): Promise<DeviceInfo[]> {
        try {
          const deviceIds: string[] = await contract.getOwnerDevices(ownerAddress);
          return Promise.all(deviceIds.map((id) => this.getDevice(id)));
        } catch {
          return [];
        }
      },

      /** Fetch ingested frames from the unified Relayer API */
      async fetchDeviceFrames(deviceId: string, limit = 50): Promise<IngestedFrame[]> {
        try {
          const res = await fetch(`${RELAYER_API_URL}/api/v1/devices/${deviceId}/frames?limit=${limit}`);
          if (res.ok) {
            const data = await res.json();
            return data.frames || [];
          }
        } catch {}
        return [];
      },

      /** Fetch recent frames across all devices */
      async fetchRecentFrames(limit = 30): Promise<IngestedFrame[]> {
        try {
          const res = await fetch(`${RELAYER_API_URL}/api/v1/frames?limit=${limit}`);
          if (res.ok) {
            const data = await res.json();
            return data.frames || [];
          }
        } catch {}
        return [];
      },

      /** Assign a fine-tuned YOLO model to an edge camera */
      async assignModel(deviceId: string, modelId: number, weightsRoot: string, modelName?: string) {
        // 1. Record on-chain
        const tx = await contract.assignModelToDevice(deviceId, modelId, weightsRoot);
        await tx.wait();

        // 2. Notify Relayer for fast OTA polling
        await fetch(`${RELAYER_API_URL}/api/v1/devices/${deviceId}/model`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ modelId, weightsRootHash: weightsRoot, modelName }),
        }).catch(() => {});

        return tx;
      },
    };
  }, [signer]);
}
