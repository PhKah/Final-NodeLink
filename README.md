# NodeLink CLI — Chế Độ Thuê Ổ Cứng

Tài liệu hướng dẫn “đưa về dạng” cho mô hình thuê ổ cứng: Consumer tạo hợp đồng thuê lưu trữ; Provider đăng ký, chạy daemon phục vụ/challenge; hai bên xác minh và thanh toán/claim theo hạn.

## Yêu cầu môi trường
- RPC: đặt `ANCHOR_PROVIDER_URL` hoặc `SOLANA_RPC_URL` (mặc định Devnet: `https://api.devnet.solana.com`).
- Ví: đặt `ANCHOR_WALLET` đến file keypair, mặc định `~/.config/solana/id.json`.
- IDL: `target/idl/node_link.json` (sau `anchor build`) hoặc `./idl/node_link.json`. Nếu IDL không có `metadata.address`, đặt `PROGRAM_ID` (Program ID của `node_link`).
- Build CLI: `npm run build`.

## Nhóm lệnh theo mô hình lưu trữ
- Provider
  - `offer-storage` (alias `register`): đăng ký node sẵn sàng cho thuê.
  - `storage-daemon` (alias `daemon`): tiến trình nền phục vụ/challenge, submit kết quả.
  - `claim-payment`: yêu cầu thanh toán sau hạn verify nếu Consumer không xác minh.
- Consumer
  - `create-contract` (alias `create-job`): tạo hợp đồng lưu trữ, nạp escrow, lưu spec.
  - `verify-storage` (alias `verify-job`): xác minh việc lưu trữ, chấp nhận/từ chối kết quả.
  - `contract-status` (alias `job-status`): xem trạng thái hợp đồng (hỗ trợ JSON).
  - `list-contracts` (alias `list-jobs`): liệt kê hợp đồng (hỗ trợ JSON).

## Pipeline End-to-End
1) Provider đăng ký node
```bash
node dist/src/cli/index.js offer-storage
```

2) Provider chạy daemon lưu trữ (script tuỳ chỉnh)
```bash
node dist/src/cli/index.js storage-daemon -s ./scripts/storage-handler.js -m 0 -i 15000
```
- `-s` trỏ đến script Node.js xử lý job (ví dụ lưu/đọc chunk, ghi log, submit kết quả).
- `-m` ngưỡng phần thưởng tối thiểu (lamports), `-i` chu kỳ quét.

3) Consumer tạo hợp đồng lưu trữ từ file spec
```bash
node dist/src/cli/index.js create-contract -r 1000000 -f specs/storage_contract.example.json
```
- CLI sẽ SHA-256 băm file spec và dùng hex làm `details` on-chain.
- Có thể dùng `-d` nếu muốn nhập trực tiếp text/hex.

4) Theo dõi hợp đồng (JSON hoặc text)
```bash
# JSON
node dist/src/cli/index.js contract-status -f specs/storage_contract.example.json --json
# Text
node dist/src/cli/index.js contract-status -f specs/storage_contract.example.json
```

5) Xác minh hoặc claim
```bash
# Consumer chấp nhận
node dist/src/cli/index.js verify-storage -f specs/storage_contract.example.json --accept
# Consumer từ chối
node dist/src/cli/index.js verify-storage -f specs/storage_contract.example.json --reject
# Provider claim sau hạn verify
node dist/src/cli/index.js claim-payment -d <detailsHex> [-r <renterPubkey>]
```

6) Liệt kê hợp đồng
```bash
# Của ví hiện tại
node dist/src/cli/index.js list-contracts --json
# Tất cả chương trình
node dist/src/cli/index.js list-contracts -a --json
```

## Định dạng JSON
- `contract-status --json` / `job-status --json`:
```json
{
  "jobAccount": "<base58>",
  "status": "Pending|InProgress|Completed|PendingVerification",
  "rewardLamports": "<string>",
  "renter": "<base58>",
  "provider": "<base58>",
  "detailsHex": "<hex>",
  "resultsHex": "<hex>",
  "verificationDeadlineSec": 0,
  "verificationDeadlineIso": "2025-01-01T00:00:00.000Z",
  "failedProviders": ["<base58>"]
}
```
- `list-contracts --json` / `list-jobs --json`:
```json
[
  {
    "key": "<jobAccountBase58>",
    "status": "Pending",
    "reward": "1000000",
    "renter": "<base58>",
    "provider": "<base58>"
  }
]
```
- `create-contract --json` / `create-job --json`:
```json
{
  "tx": "<signature>",
  "jobAccount": "<base58>",
  "escrow": "<base58>",
  "renter": "<base58>",
  "rewardLamports": "<string>",
  "detailsHex": "<hex>"
}
```
- `verify-storage --json` / `verify-job --json`:
```json
{
  "tx": "<signature>",
  "jobAccount": "<base58>",
  "renter": "<base58>",
  "provider": "<base58>",
  "decision": "accept|reject",
  "detailsHex": "<hex>"
}
```
- `claim-payment --json`:
```json
{
  "tx": "<signature>",
  "jobAccount": "<base58>",
  "renter": "<base58>",
  "provider": "<base58>",
  "providerPda": "<base58>",
  "escrow": "<base58>",
  "detailsHex": "<hex>"
}
```
- `register --json` / `offer-storage --json`:
```json
{
  "tx": "<signature>",
  "providerPda": "<base58>"
}
```

## Log JSON (daemon)
- Dùng `--log-json` cho `daemon` và `storage-daemon` để nhận log sự kiện dạng JSON máy-đọc.
- Ví dụ:
```json
{ "event": "daemon_start", "provider": "...", "minReward": "0", "script": "./scripts/storage-handler.js", "intervalMs": 15000 }
{ "event": "scan_start" }
{ "event": "scan_done", "count": 1 }
{ "event": "job_candidate", "jobAccount": "...", "renter": "...", "detailsHex": "..." }
{ "event": "job_accept_success", "jobAccount": "...", "tx": "..." }
{ "event": "run_script_start", "jobAccount": "...", "script": "./scripts/storage-handler.js" }
{ "event": "run_script_output", "jobAccount": "...", "outputLen": 128 }
{ "event": "submit_results_success", "jobAccount": "...", "tx": "...", "resultsHex": "..." }
```
- Các sự kiện khác: `job_skip_invalid_details`, `job_skip_low_reward`, `job_accept_error`, `run_script_error`, `submit_results_error`, `scan_error`.

## Mẫu Spec Hợp Đồng
- Xem `specs/storage_contract.example.json`. Các trường gợi ý:
  - `capacityGB`, `durationDays`, `redundancy`, `pricePerDayLamports`, `region`, `encryption`, `retrievalEndpoint`
  - `providerRequirements`: băng thông tối thiểu, SLA, proofs mỗi ngày
  - `audit`: kiểu challenge, kích thước chunk, ngưỡng thất bại
  - `dataProfile`: kích thước file, đọc đồng thời, cho phép hot storage

## Ghi chú kỹ thuật
- `details` là 32 byte (SHA-256) làm định danh on-chain; CLI tự băm nếu dùng `--spec-file`.
- PDA Job: seed `("job", renter, details32)`; Escrow: seed `("escrow", jobAccount)`.
- `verify-storage` tương ứng `verifyResults` trong chương trình; `claim-payment` dành cho Provider sau hạn.
- Mặc định RPC Devnet; đặt `ANCHOR_PROVIDER_URL`/`SOLANA_RPC_URL` để đổi endpoint.
- Ví mặc định `~/.config/solana/id.json`; có thể đặt `ANCHOR_WALLET`.
- Nếu lỗi IDL/Program ID: chạy `anchor build` để tạo IDL, hoặc đặt `PROGRAM_ID`.

## Khởi tạo nhanh
```bash
npm install
npm run build
node dist/src/cli/index.js --help
```

## Provider Script Mẫu
Tạo sẵn `scripts/storage-handler.example.js` làm script mẫu cho daemon:
- In payload lên stdout; daemon sẽ SHA-256 băm stdout và submit kết quả.
- Hỗ trợ biến môi trường (được daemon truyền khi chạy script):
  - `NL_JOB_ACCOUNT`: JobAccount (base58)
  - `NL_RENTER`: Renter (base58)
  - `NL_DETAILS_HEX`: Chi tiết job (hex 64 ký tự)
  - `NL_JOB_REWARD_LAMPORTS`: Phần thưởng job (string)
  - `NL_ESCROW_BALANCE`: Số lamports trong escrow (string)
  - `NL_ESCROW_PDA`: Escrow PDA (base58)
  - `NL_MIN_REWARD`: Ngưỡng phần thưởng tối thiểu (string)
  - `NL_PROVIDER`: Provider authority (base58)
  - `NL_PROVIDER_PDA`: Provider PDA (base58)
  - `NL_PROGRAM_ID`: Program ID (base58)
- Chạy thử:
```
node scripts/storage-handler.example.js
node dist/src/cli/index.js storage-daemon -s ./scripts/storage-handler.example.js
```

## Troubleshooting
- Không tìm thấy IDL:
  - Chạy `anchor build` để tạo `target/idl/node_link.json`, hoặc đặt `./idl/node_link.json`.
- Không xác định `PROGRAM_ID`:
  - Đặt `PROGRAM_ID` khi IDL không có `metadata.address`.
- Không tìm thấy ví (`ANCHOR_WALLET`):
  - Đặt `ANCHOR_WALLET=~/.config/solana/id.json` hoặc cung cấp đường dẫn ví hợp lệ.
- Lỗi RPC/endpoint:
  - Đặt `ANCHOR_PROVIDER_URL` hoặc `SOLANA_RPC_URL` tới endpoint hợp lệ (ví dụ Devnet).
- Script không tồn tại:
  - Kiểm tra đường dẫn `-s` trong `storage-daemon`.
- Không tìm thấy JobAccount khi `contract-status`/`job-status`:
  - Đảm bảo chi tiết (`-d` hoặc `-f --spec-file`) và ví `renter` đúng.
- Nhận/submit job thất bại trong daemon:
  - Xem log tx, kiểm tra escrow đủ lamports và quyền Provider PDA.