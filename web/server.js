// Simple Express server to provide a web UI for NodeLink CLI
// - Serves static UI from web/public
// - Exposes endpoints that wrap CLI commands

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn, execFile } = require('child_process');
const { Keypair, Connection } = require('@solana/web3.js');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true }));

const STATIC_DIR = path.join(__dirname, 'public');
app.use(express.static(STATIC_DIR));

const CLI_PATH = path.join(process.cwd(), 'dist', 'src', 'cli', 'index.js');
const IDL_CANDIDATES = [
  path.join(process.cwd(), 'target', 'idl', 'node_link.json'),
  path.join(process.cwd(), 'idl', 'node_link.json'),
];
function hasIdl() {
  return IDL_CANDIDATES.some((p) => fs.existsSync(p));
}

async function runCli(args, options = {}) {
  return new Promise((resolve) => {
    const fullArgs = [CLI_PATH, ...args];
    const child = spawn(process.execPath, fullArgs, {
      cwd: process.cwd(),
      env: process.env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let stdout = '';
    let stderr = '';
    child.stdout.on('data', (d) => (stdout += d.toString()));
    child.stderr.on('data', (d) => (stderr += d.toString()));
    child.on('close', (code) => {
      let json = null;
      try {
        json = JSON.parse(stdout.trim());
      } catch (_) {}
      resolve({ code, stdout, stderr, json });
    });
  });
}

// In-memory daemon state
let daemonProc = null;
let daemonLogs = [];
const MAX_LOGS = 500;

function pushLog(line) {
  if (!line) return;
  daemonLogs.push(line);
  if (daemonLogs.length > MAX_LOGS) {
    daemonLogs.splice(0, daemonLogs.length - MAX_LOGS);
  }
}

// API routes
app.get('/api/wallet-status', async (req, res) => {
  try {
    const defaultPath = path.join(os.homedir(), '.config', 'solana', 'id.json');
    const walletPath = process.env.ANCHOR_WALLET || defaultPath;
    const exists = fs.existsSync(walletPath);
    const rpcUrl = process.env.ANCHOR_PROVIDER_URL || process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
    let publicKey = null;
    let balanceLamports = null;
    let connected = false;
    let error = null;
    if (exists) {
      try {
        const raw = fs.readFileSync(walletPath, 'utf8');
        const secret = JSON.parse(raw);
        const keypair = Keypair.fromSecretKey(Uint8Array.from(secret));
        publicKey = keypair.publicKey.toBase58();
        const conn = new Connection(rpcUrl, 'confirmed');
        try {
          balanceLamports = await conn.getBalance(keypair.publicKey);
        } catch (e) {
          error = `RPC lỗi: ${e.message}`;
        }
        connected = true;
      } catch (e) {
        error = `Không đọc được ví: ${e.message}`;
      }
    } else {
      error = `Không tìm thấy ví tại ${walletPath}`;
    }
    return res.json({ connected, walletPath, rpcUrl, publicKey, balanceLamports, error });
  } catch (e) {
    return res.status(500).json({ connected: false, error: e.message });
  }
});

app.post('/api/wallet-reset', async (req, res) => {
  try {
    const defaultPath = path.join(os.homedir(), '.config', 'solana', 'id.json');
    const walletPath = process.env.ANCHOR_WALLET || defaultPath;
    const dir = path.dirname(walletPath);
    fs.mkdirSync(dir, { recursive: true });
    const keypair = Keypair.generate();
    const secretArr = Array.from(keypair.secretKey);
    fs.writeFileSync(walletPath, JSON.stringify(secretArr), 'utf8');
    process.env.ANCHOR_WALLET = walletPath;

    const rpcUrl = process.env.ANCHOR_PROVIDER_URL || process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com';
    const conn = new Connection(rpcUrl, 'confirmed');
    let airdropSig = null;
    let airdropError = null;
    try {
      airdropSig = await conn.requestAirdrop(keypair.publicKey, 1_000_000_000);
      // confirm airdrop
      await conn.confirmTransaction(airdropSig, 'confirmed');
    } catch (e) {
      airdropError = e.message;
    }
    const balanceLamports = await conn.getBalance(keypair.publicKey).catch(() => null);

    return res.json({
      ok: true,
      walletPath,
      rpcUrl,
      publicKey: keypair.publicKey.toBase58(),
      airdropSig,
      airdropError,
      balanceLamports,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: e.message });
  }
});

app.post('/api/register', async (req, res) => {
  if (!hasIdl()) {
    return res.status(500).json({
      error: 'idl_missing',
      message: "Không tìm thấy IDL. Chạy 'anchor build' để tạo 'target/idl/node_link.json' hoặc đặt file tại './idl/node_link.json'.",
      candidates: IDL_CANDIDATES,
    });
  }
  
  // Sử dụng public key từ ví đã kết nối để cập nhật IDL
  try {
    const defaultPath = path.join(os.homedir(), '.config', 'solana', 'id.json');
    const walletPath = process.env.ANCHOR_WALLET || defaultPath;
    const exists = fs.existsSync(walletPath);
    
    if (exists) {
      const raw = fs.readFileSync(walletPath, 'utf8');
      const secret = JSON.parse(raw);
      const keypair = Keypair.fromSecretKey(Uint8Array.from(secret));
      const publicKey = keypair.publicKey.toBase58();
      
      // Cập nhật IDL với public key của ví
      const idlPath = fs.existsSync(IDL_CANDIDATES[1]) ? IDL_CANDIDATES[1] : IDL_CANDIDATES[0];
      if (fs.existsSync(idlPath)) {
        const idlContent = JSON.parse(fs.readFileSync(idlPath, 'utf8'));
        if (!idlContent.metadata) idlContent.metadata = {};
        idlContent.metadata.address = publicKey;
        fs.writeFileSync(idlPath, JSON.stringify(idlContent, null, 2), 'utf8');
      }
    }
  } catch (e) {
    console.error("Lỗi khi cập nhật IDL:", e);
  }
  
  const result = await runCli(['offer-storage', '--json']);
  if (result.code === 0 && result.json) return res.json(result.json);
  res.status(500).json({ error: 'register_failed', stderr: result.stderr, stdout: result.stdout });
});

app.post('/api/create-contract', async (req, res) => {
  const { rewardLamports, specJson } = req.body;
  if (!rewardLamports || !specJson) {
    return res.status(400).json({ error: 'missing_params' });
  }
  const specPath = path.join(process.cwd(), 'specs', `ui_spec_${Date.now()}.json`);
  try {
    fs.writeFileSync(specPath, specJson, 'utf8');
  } catch (e) {
    return res.status(500).json({ error: 'write_spec_failed', message: e.message });
  }
  const result = await runCli(['create-contract', '-r', String(rewardLamports), '-f', specPath, '--json']);
  if (result.code === 0 && result.json) return res.json(result.json);
  res.status(500).json({ error: 'create_contract_failed', stderr: result.stderr, stdout: result.stdout });
});

app.post('/api/contract-status', async (req, res) => {
  const { specJson } = req.body;
  if (!specJson) return res.status(400).json({ error: 'missing_spec' });
  const specPath = path.join(process.cwd(), 'specs', `ui_spec_${Date.now()}.json`);
  try {
    fs.writeFileSync(specPath, specJson, 'utf8');
  } catch (e) {
    return res.status(500).json({ error: 'write_spec_failed', message: e.message });
  }
  const result = await runCli(['contract-status', '-f', specPath, '--json']);
  if (result.code === 0 && result.json) return res.json(result.json);
  res.status(500).json({ error: 'contract_status_failed', stderr: result.stderr, stdout: result.stdout });
});

app.post('/api/verify-storage', async (req, res) => {
  const { specJson, decision } = req.body;
  if (!specJson || !decision || !['accept', 'reject'].includes(decision)) {
    return res.status(400).json({ error: 'missing_params' });
  }
  const specPath = path.join(process.cwd(), 'specs', `ui_spec_${Date.now()}.json`);
  try {
    fs.writeFileSync(specPath, specJson, 'utf8');
  } catch (e) {
    return res.status(500).json({ error: 'write_spec_failed', message: e.message });
  }
  const flag = decision === 'accept' ? '--accept' : '--reject';
  const result = await runCli(['verify-storage', '-f', specPath, flag, '--json']);
  if (result.code === 0 && result.json) return res.json(result.json);
  res.status(500).json({ error: 'verify_storage_failed', stderr: result.stderr, stdout: result.stdout });
});

app.get('/api/list-contracts', async (req, res) => {
  const all = req.query.all === 'true';
  const args = ['list-contracts', '--json'];
  if (all) args.push('-a');
  const result = await runCli(args);
  if (result.code === 0 && result.json) return res.json(result.json);
  res.status(500).json({ error: 'list_contracts_failed', stderr: result.stderr, stdout: result.stdout });
});

app.post('/api/claim-payment', async (req, res) => {
  const { detailsHex, renter } = req.body;
  if (!detailsHex) return res.status(400).json({ error: 'missing_details' });
  const args = ['claim-payment', '-d', detailsHex, '--json'];
  if (renter) args.push('-r', renter);
  const result = await runCli(args);
  if (result.code === 0 && result.json) return res.json(result.json);
  res.status(500).json({ error: 'claim_payment_failed', stderr: result.stderr, stdout: result.stdout });
});

app.post('/api/storage-daemon/start', async (req, res) => {
  if (daemonProc) return res.status(400).json({ error: 'daemon_already_running' });
  const { scriptPath = path.join(process.cwd(), 'scripts', 'storage-handler.example.js'), minReward = 0, intervalMs = 15000 } = req.body || {};
  const args = [CLI_PATH, 'storage-daemon', '-s', scriptPath, '-m', String(minReward), '-i', String(intervalMs), '--log-json'];
  daemonLogs = [];
  daemonProc = spawn(process.execPath, args, {
    cwd: process.cwd(),
    env: process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  daemonProc.stdout.on('data', (d) => {
    const lines = d.toString().split(/\r?\n/).filter(Boolean);
    lines.forEach((ln) => pushLog(ln));
  });
  daemonProc.stderr.on('data', (d) => {
    const lines = d.toString().split(/\r?\n/).filter(Boolean);
    lines.forEach((ln) => pushLog(`stderr: ${ln}`));
  });
  daemonProc.on('close', (code) => {
    pushLog(`daemon_exit: code=${code}`);
    daemonProc = null;
  });
  res.json({ ok: true, scriptPath, minReward, intervalMs });
});

app.post('/api/storage-daemon/stop', async (req, res) => {
  if (!daemonProc) return res.status(400).json({ error: 'daemon_not_running' });
  try {
    daemonProc.kill();
    daemonProc = null;
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'daemon_stop_failed', message: e.message });
  }
});

app.get('/api/storage-daemon/logs', (req, res) => {
  res.json({ logs: daemonLogs });
});

app.listen(PORT, () => {
  const url = `http://localhost:${PORT}/`;
  console.log(`UI server listening on ${url}`);
});