# Danh sách công việc chi tiết - Dự án NodeLink

Đây là danh sách các công việc cụ thể được chia theo từng giai đoạn của dự án.

---

### Giai đoạn 1: Xây dựng Smart Contract (On-chain Program)

- [ ] **1.1: Khởi tạo và Cấu trúc chương trình Anchor**
  - [ ] Kiểm tra lại cấu trúc dự án Anchor (`Anchor.toml`, `programs/node-link/src/lib.rs`).
  - Implemented by: 
- [ ] **1.2: Xây dựng Logic Đăng ký Node (On-chain Registry)**
  - [ ] Định nghĩa `NodeAccount` (PDA) để lưu thông tin provider.
  - [ ] Viết instruction `register_node`.
  - [ ] Viết instruction `update_node_status`.
  - Implemented by: 
- [ ] **1.3: Xây dựng Logic Khởi tạo Job và Escrow**
  - [ ] Định nghĩa `JobAccount` với các trường (`status`, `deadline`, `failed_providers`, ...).
  - [ ] Định nghĩa `JobStatus` enum.
  - [ ] Implement logic `EscrowAccount` (PDA) để giữ tiền.
  - [ ] Viết instruction `create_job` (do Renter gọi).
  - Implemented by: 
- [ ] **1.4: Xây dựng Logic Thực thi và Xác minh Job**
  - [ ] Viết instruction `accept_job` (do Provider gọi), kiểm tra danh sách `failed_providers`.
  - [ ] Viết instruction `submit_result` (do Provider gọi).
  - [ ] Viết instruction `verify_job` (do Renter gọi) để xử lý cả kết quả đúng (trả tiền) và sai (reset job).
  - Implemented by: 
- [ ] **1.5: Xây dựng Logic Thanh toán Timeout**
  - [ ] Viết instruction `claim_payment` (do Provider gọi) để nhận tiền khi Renter không phản hồi sau deadline.
  - Implemented by: 

---

### Giai đoạn 2: Phát triển Node Client (Off-chain)

- [ ] **2.1: Thiết lập môi trường Client**
  - [ ] Cài đặt `@solana/web3.js`, `@project-serum/anchor`.
  - Implemented by: 
- [ ] **2.2: Xây dựng Chức năng cho Provider (Node Client)**
  - [ ] Tạo CLI command `node-link register` để đăng ký node.
  - [ ] Xây dựng tiến trình nền (`daemon`) với các chức năng:
    - [ ] Tự động quét blockchain để tìm job mới phù hợp tiêu chí (ví dụ: reward).
    - [ ] Tự động gọi `accept_job` để nhận việc.
    - [ ] Tự động thực thi tác vụ (ví dụ: chạy một script được chỉ định).
    - [ ] Tự động gọi `submit_result` sau khi hoàn thành.
  - Implemented by: 

---

### Giai đoạn 3: Phát triển Giao diện cho Người dùng (Consumer)

- [ ] **3.1: Xây dựng Chức năng cho Consumer**
  - [ ] Tạo CLI command `node-link create-job`.
  - [ ] Tạo CLI command `node-link verify-job` để xác minh và giải phóng thanh toán.
  - Implemented by: 

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