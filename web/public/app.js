function $(id) { return document.getElementById(id); }
function pretty(obj) { return JSON.stringify(obj, null, 2); }

function notify(message) {
  const t = $('toast');
  if (!t) return;
  t.textContent = message;
  t.classList.add('show');
  setTimeout(() => { t.classList.remove('show'); }, 2500);
}

function switchTab(tab) {
  const items = document.querySelectorAll('.nav-item');
  const tabs = document.querySelectorAll('.tab');
  items.forEach((it) => it.classList.toggle('active', it.dataset.tab === tab));
  tabs.forEach((section) => section.classList.toggle('active', section.id === `tab-${tab}`));
}

// Nav events
Array.from(document.querySelectorAll('.nav-item')).forEach((btn) => {
  btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body || {}),
  });
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { raw: text, status: res.status }; }
}

async function getJson(url) {
  const res = await fetch(url);
  const text = await res.text();
  try { return JSON.parse(text); } catch { return { raw: text, status: res.status }; }
}

// Wallet status (support multiple buttons across tabs)
Array.from(document.querySelectorAll('#btnCheckWallet')).forEach((btn) => {
  const resultEl = btn.closest('.card')?.querySelector('pre.output');
  btn.onclick = async () => {
    const result = await getJson('/api/wallet-status');
    if (resultEl) resultEl.textContent = pretty(result);
    if (!result.connected) {
      notify('Ví chưa kết nối — tiến hành reset...');
      const reset = await postJson('/api/wallet-reset', {});
      if (resultEl) resultEl.textContent = pretty({ status: result, reset });
      if (reset && reset.ok) notify('Đã reset ví và airdrop'); else notify('Reset ví thất bại');
    } else {
      notify('Ví đã kết nối');
    }
  };
});

// Register Provider
if ($('btnRegister')) {
  $('btnRegister').onclick = async () => {
    // Lấy thông tin ví trước khi đăng ký
    const walletStatus = await getJson('/api/wallet-status');
    if (!walletStatus.connected || !walletStatus.publicKey) {
      notify('Vui lòng kết nối ví trước khi đăng ký');
      $('registerResult').textContent = pretty({error: 'wallet_not_connected'});
      return;
    }
    
    // Sử dụng public key của ví để đăng ký
    const result = await postJson('/api/register', {
      programId: walletStatus.publicKey
    });
    $('registerResult').textContent = pretty(result);
    notify('Đã chạy offer-storage');
  };
}

// Daemon controls
if ($('btnStartDaemon')) {
  $('btnStartDaemon').onclick = async () => {
    const scriptPath = $('daemonScript').value;
    const minReward = $('daemonMinReward').value || 0;
    const intervalMs = $('daemonInterval').value || 15000;
    const result = await postJson('/api/storage-daemon/start', { scriptPath, minReward, intervalMs });
    $('daemonLogs').textContent = 'Daemon started. Logs sẽ xuất hiện bên dưới...\n' + pretty(result) + '\n';
    notify('Daemon đã khởi động');
  };
}

if ($('btnStopDaemon')) {
  $('btnStopDaemon').onclick = async () => {
    const result = await postJson('/api/storage-daemon/stop');
    $('daemonLogs').textContent += '\nDaemon stopped: ' + pretty(result) + '\n';
    notify('Daemon đã dừng');
  };
}

// Poll daemon logs
setInterval(async () => {
  try {
    const data = await getJson('/api/storage-daemon/logs');
    if (data && data.logs) {
      $('daemonLogs').textContent = data.logs.join('\n');
    }
  } catch (_) {}
}, 2000);

// Create contract
if ($('btnCreateContract')) {
  $('btnCreateContract').onclick = async () => {
    const rewardLamports = $('rewardInput').value || '1000000';
    const specJson = $('specInput').value || '{}';
    const result = await postJson('/api/create-contract', { rewardLamports, specJson });
    $('createResult').textContent = pretty(result);
    notify('Đã tạo hợp đồng');
  };
}

// Contract status
if ($('btnContractStatus')) {
  $('btnContractStatus').onclick = async () => {
    const specJson = $('statusSpecInput').value || '{}';
    const result = await postJson('/api/contract-status', { specJson });
    $('statusResult').textContent = pretty(result);
    notify('Đã lấy trạng thái hợp đồng');
  };
}

// Verify storage
if ($('btnVerify')) {
  $('btnVerify').onclick = async () => {
    const specJson = $('verifySpecInput').value || '{}';
    const decision = document.querySelector('input[name="decision"]:checked').value;
    const result = await postJson('/api/verify-storage', { specJson, decision });
    $('verifyResult').textContent = pretty(result);
    notify(`Đã gửi verify: ${decision}`);
  };
}

// List contracts
if ($('btnListContracts')) {
  $('btnListContracts').onclick = async () => {
    const all = $('listAll').checked;
    const query = all ? '?all=true' : '';
    const result = await getJson('/api/list-contracts' + query);
    $('listResult').textContent = pretty(result);
    notify('Đã liệt kê hợp đồng');
  };
}

// Claim payment
if ($('btnClaim')) {
  $('btnClaim').onclick = async () => {
    const detailsHex = $('claimDetails').value || '';
    const renter = $('claimRenter').value || '';
    const result = await postJson('/api/claim-payment', { detailsHex, renter: renter || undefined });
    $('claimResult').textContent = pretty(result);
    notify('Đã gửi claim-payment');
  };
}