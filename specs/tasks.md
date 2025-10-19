# Danh sách công việc chi tiết - Dự án NodeLink

Đây là danh sách các công việc cụ thể được chia theo từng giai đoạn của dự án.

---

### Giai đoạn 1: Xây dựng Smart Contract (On-chain Program)

- [x] **1.1: Khởi tạo và Cấu trúc chương trình Anchor**
  - [x] Kiểm tra lại cấu trúc dự án Anchor (`Anchor.toml`, `programs/node-link/src/lib.rs`).
  - Implemented by: [Khánh]
- [x] **1.2: Xây dựng Logic Đăng ký Node (On-chain Registry)**
  - [x] Định nghĩa `NodeAccount` (PDA) để lưu thông tin provider.
  - [x] Viết instruction `register_node`.
  - [x] Viết instruction `update_node_status`.
  - Implemented by: [Khánh]
- [x] **1.3: Xây dựng Logic Khởi tạo Job và Escrow**
  - [x] Định nghĩa `JobAccount` với các trường (`status`, `deadline`, `failed_providers`, ...).
  - [x] Định nghĩa `JobStatus` enum.
  - [x] Implement logic `EscrowAccount` (PDA) để giữ tiền.
  - [x] Viết instruction `create_job` (do Renter gọi).
  - Implemented by: [Khánh]
- [x] **1.4: Xây dựng Logic Thực thi và Xác minh Job**
  - [x] Viết instruction `accept_job` (do Provider gọi), kiểm tra danh sách `failed_providers`.
  - [x] Viết instruction `submit_result` (do Provider gọi).
  - [x] Viết instruction `verify_job` (do Renter gọi) để xử lý cả kết quả đúng (trả tiền) và sai (reset job).
  - Implemented by: [Khánh]
- [x] **1.5: Xây dựng Logic Thanh toán Timeout**
  - [x] Viết instruction `claim_payment` (do Provider gọi) để nhận tiền khi Renter không phản hồi sau deadline.
  - Implemented by: [Khánh]

---

### Giai đoạn 2: Phát triển Node Client (Off-chain)

- [x] **2.1: Thiết lập môi trường Client**
  - [x] Cài đặt `@solana/web3.js`, `@coral-xyz/anchor`, `commander`, `dotenv`.
  - Implemented by: [Gemini]
- [x] **2.2: Xây dựng Chức năng cho Provider (Node Client)**
  - [x] Tạo CLI command `node-link register` để đăng ký node.
  - [x] Xây dựng tiến trình nền (`daemon`) với các chức năng:
    - [x] Tự động quét blockchain để tìm job mới phù hợp tiêu chí (theo reward).
    - [x] Tự động gọi `accept_job` để nhận việc.
    - [x] Tự động thực thi tác vụ (chạy script Node.js chỉ định).
    - [x] Tự động gọi `submit_results` sau khi hoàn thành.
  - Implemented by: [Gemini]

---

### Giai đoạn 3: Phát triển Giao diện cho Người dùng (Consumer)

- [x] **3.1: Xây dựng Chức năng cho Consumer**
  - [x] Tạo CLI command `node-link create-job`.
  - [x] Tạo CLI command `node-link verify-job` để xác minh và giải phóng thanh toán.
  - Implemented by: [Gemini]

---

### Giai đoạn 4: Kiểm thử và Hoàn thiện Demo

- [ ] **4.1: Viết Unit Test cho Smart Contract**
  - [ ] Viết test cho toàn bộ luồng trong `tests/node-link.ts`.
  - Implemented by: 
- [ ] **4.2: Triển khai lên Devnet**
  - [ ] Dùng `anchor deploy` để đưa smart contract lên Devnet.
  - Implemented by: 
- [ ] **4.3: Xây dựng Kịch bản Demo End-to-End**
  - [ ] Chuẩn bị 2 terminal mô phỏng Provider và Consumer.
  - [ ] Viết script `demo.sh` để tự động hóa luồng demo.
  - [ ] Chuẩn bị slide trình bày.
  - Implemented by: