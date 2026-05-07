/**
 * Demo seed script — creates a sample annotation job on Galileo testnet
 * so judges can annotate immediately without uploading their own data.
 *
 * Usage: node scripts/seed-demo.js
 */
import { ethers } from 'ethers';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import 'dotenv/config';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const GALILEO_RPC = 'https://evmrpc-testnet.0g.ai';
const UPLOAD_API = process.env.UPLOAD_API ?? 'http://localhost:3001';

// Contract addresses — update after deploy
const ANNOTATION_MARKET = process.env.ANNOTATION_MARKET;
const ANNOTATION_MARKET_ABI = [
  'function createJob(bytes32 dataRootHash, string metadataURI, uint256 rewardPerTask, uint256 taskCount, uint8 dataType) payable returns (uint256)'
];

// 5 sample images as colored SVGs (no external deps needed)
const SAMPLE_IMAGES = [
  { name: 'street_scene_1.svg', content: '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><rect width="640" height="480" fill="#87CEEB"/><rect y="300" width="640" height="180" fill="#808080"/><rect x="100" y="150" width="120" height="150" fill="#FF4444"/><rect x="300" y="180" width="80" height="120" fill="#4444FF"/><rect x="450" y="160" width="100" height="140" fill="#44FF44"/><text x="20" y="30" font-size="16" fill="#333">Street Scene 1 — Label: car, person, building</text></svg>' },
  { name: 'street_scene_2.svg', content: '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><rect width="640" height="480" fill="#FFF8DC"/><rect y="320" width="640" height="160" fill="#8B7355"/><ellipse cx="200" cy="200" rx="80" ry="60" fill="#228B22"/><ellipse cx="400" cy="180" rx="100" ry="70" fill="#228B22"/><rect x="180" y="260" width="40" height="60" fill="#8B4513"/><rect x="380" y="240" width="40" height="80" fill="#8B4513"/><text x="20" y="30" font-size="16" fill="#333">Street Scene 2 — Label: tree, road</text></svg>' },
  { name: 'objects_1.svg', content: '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><rect width="640" height="480" fill="#F0F0F0"/><rect x="50" y="100" width="150" height="100" fill="#FF6B6B" rx="8"/><circle cx="400" cy="200" r="80" fill="#4ECDC4"/><rect x="480" y="300" width="100" height="120" fill="#45B7D1" rx="4"/><text x="20" y="30" font-size="16" fill="#333">Objects — Label: box, circle, rectangle</text></svg>' },
  { name: 'vehicles_1.svg', content: '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><rect width="640" height="480" fill="#E8F4F8"/><rect x="80" y="200" width="200" height="100" fill="#CC3333" rx="10"/><circle cx="120" cy="310" r="30" fill="#333"/><circle cx="240" cy="310" r="30" fill="#333"/><rect x="350" y="220" width="180" height="80" fill="#3333CC" rx="8"/><circle cx="390" cy="310" r="25" fill="#333"/><circle cx="490" cy="310" r="25" fill="#333"/><text x="20" y="30" font-size="16" fill="#333">Vehicles — Label: car, truck</text></svg>' },
  { name: 'animals_1.svg', content: '<svg xmlns="http://www.w3.org/2000/svg" width="640" height="480"><rect width="640" height="480" fill="#90EE90"/><ellipse cx="200" cy="280" rx="80" ry="50" fill="#8B4513"/><circle cx="200" cy="220" r="40" fill="#8B4513"/><ellipse cx="450" cy="300" rx="60" ry="35" fill="#FF8C00"/><circle cx="450" cy="250" r="30" fill="#FF8C00"/><text x="20" y="30" font-size="16" fill="#333">Animals — Label: dog, cat</text></svg>' },
];

async function uploadToBackend(base64Data) {
  const res = await fetch(`${UPLOAD_API}/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ data: base64Data }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error);
  return json.rootHash;
}

async function main() {
  if (!process.env.PRIVATE_KEY) throw new Error('PRIVATE_KEY not set in .env');
  if (!ANNOTATION_MARKET) throw new Error('ANNOTATION_MARKET not set in .env');

  console.log('Creating demo annotation job on Galileo testnet...\n');

  // Package all sample images as JSON
  const fileContents = SAMPLE_IMAGES.map((img) => ({
    name: img.name,
    type: 'image/svg+xml',
    data: Buffer.from(img.content).toString('base64'),
  }));

  console.log('1. Uploading sample images to 0G Storage...');
  const dataBlob = Buffer.from(JSON.stringify(fileContents)).toString('base64');
  const dataRootHash = await uploadToBackend(dataBlob);
  console.log('   Data root hash:', dataRootHash);

  const metadata = {
    instructions: 'Draw bounding boxes around each object in the image. Use the provided labels.',
    labels: ['car', 'person', 'building', 'tree', 'truck', 'dog', 'cat', 'box'],
    dataType: 'image',
    fileCount: SAMPLE_IMAGES.length,
    dataRootHash,
    name: 'Heda Demo Dataset — Mixed Objects',
    description: 'Sample annotation job for demo purposes. Contains street scenes, vehicles, and animals.',
  };

  console.log('2. Uploading metadata to 0G Storage...');
  const metaBlob = Buffer.from(JSON.stringify(metadata)).toString('base64');
  const metadataRootHash = await uploadToBackend(metaBlob);
  console.log('   Metadata root hash:', metadataRootHash);

  console.log('3. Creating job onchain...');
  const provider = new ethers.JsonRpcProvider(GALILEO_RPC);
  const wallet = new ethers.Wallet(process.env.PRIVATE_KEY, provider);
  const contract = new ethers.Contract(ANNOTATION_MARKET, ANNOTATION_MARKET_ABI, wallet);

  const rewardPerTask = ethers.parseEther('0.01'); // 0.01 0G per task
  const taskCount = SAMPLE_IMAGES.length;
  const total = rewardPerTask * BigInt(taskCount);

  const feeData = await provider.getFeeData();
  const gasPrice = feeData.gasPrice ? (feeData.gasPrice * 120n) / 100n : BigInt(10_000_000_000);

  const tx = await contract.createJob(
    dataRootHash,
    metadataRootHash,
    rewardPerTask,
    taskCount,
    0, // DataType.Image
    { value: total, gasPrice }
  );
  const receipt = await tx.wait();

  console.log('\n✓ Demo job created!');
  console.log('  Tx:', `https://chainscan-galileo.0g.ai/tx/${receipt.hash}`);
  console.log('  Tasks:', taskCount);
  console.log('  Reward per task: 0.01 0G');
  console.log('  Total locked:', ethers.formatEther(total), '0G');
  console.log('\nJudges can now go to the Jobs page and annotate immediately.');
}

main().catch((e) => { console.error(e.message); process.exit(1); });
