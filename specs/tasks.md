# Danh sách công việc chi tiết - Dự án NodeLink

Đây là danh sách các công việc cụ thể được chia theo từng giai đoạn của dự án.

---

### Giai đoạn 0: Tự động hóa Triển khai (Deployment Automation)

- [x] **0.1: Cập nhật Script Deploy**
  - [x] Thêm logic vào `migrations/deploy.ts` để tự động gọi instruction `initializeCounter`.
  - [x] Đảm bảo `JobCounter` PDA được tạo ra một cách an toàn, chỉ một lần duy nhất sau khi deploy.
  - Implemented by: [Gemini & Khánh]

---

### Giai đoạn 1: Xây dựng Smart Contract (On-chain Program)

- [x] **1.1: Khởi tạo và Cấu trúc chương trình Anchor**
  - [x] Kiểm tra lại cấu trúc dự án Anchor (`Anchor.toml`, `programs/compute-share/src/lib.rs`).
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

### Giai đoạn 2: Phát triển Client cho Provider (Web + CLI)

- [x] **2.1: Xây dựng Nền tảng Client**
  - [x] Tạo thư mục `client/` và các file helper.
  - [x] Viết các hàm tái sử dụng để kết nối mạng Solana, tải ví và khởi tạo đối tượng `program`.
  - Implemented by: [Gemini & Khánh]
- [ ] **2.2: Xây dựng Giao diện Đăng ký (Web)**
  - [ ] Thiết lập dự án React trong thư mục `app/`.
  - [ ] Cài đặt và cấu hình `@solana/wallet-adapter`.
  - [ ] Xây dựng giao diện cho phép Provider kết nối ví và đăng ký.
  - Implemented by: 
- [x] **2.3: Xây dựng Daemon `listen` (CLI) - (Task 7.0)**
  - [x] Implement vòng lặp `listen` để quét và chấp nhận job.
  - [x] Tải thư mục job từ IPFS dựa trên `job_details_cid`.
  - [x] Đọc và phân tích `manifest.json` để lấy thông tin thực thi.
  - [x] Tích hợp Wasm runtime (`@wasmer/sdk`) với WASI để thực thi job an toàn.
  - [x] Tạo "Gói Kết quả" chuẩn (gồm `stdout.txt`, `stderr.txt`, và output chính).
  - [x] Tải "Gói Kết quả" lên IPFS và gửi lại CID kết quả lên blockchain.
  - [x] Tham khảo chi tiết tại: `activities/7.0_Wasm_Execution_Engine.md`.
  - Implemented by: [Gemini & Khánh]

---

### Giai đoạn 3: Phát triển Client cho Consumer (Web)

- [ ] **3.1: Xây dựng Giao diện Tạo Job**
  - [ ] Mở rộng ứng dụng React với trang "Create Job".
  - [ ] Xây dựng form cho phép người dùng tải lên file Wasm, file input và nhập các tham số.
  - [ ] **Client tự động tạo file `manifest.json` từ input của người dùng.**
  - [ ] **Client tự động tải thư mục job (gồm manifest, wasm, input) lên IPFS để lấy CID.**
  - [ ] Gọi instruction `createJob` với CID nhận được.
  - Implemented by: 
- [ ] **3.2: Xây dựng Dashboard Quản lý Job**
  - [ ] Xây dựng trang "My Jobs" để liệt kê các job đã tạo của người dùng.
  - [ ] Hiển thị trạng thái (`status`) của từng job.
  - [ ] Cho phép tải về và xem "Gói Kết quả" (bao gồm cả `stdout.txt`, `stderr.txt`).
  - [ ] Thêm các nút bấm để gọi `verifyResults`, `cancel_job`, `reclaim_job`.
  - Implemented by: 

---

### Giai đoạn 4: Kiểm thử và Hoàn thiện Demo

- [x] **4.1: Viết Unit Test cho Smart Contract**
  - [x] Viết test cho toàn bộ luồng trong `tests/compute-share.ts`.
  - Implemented by: [Gemini & Khánh]
- [ ] **4.2: Triển khai lên Devnet**
  - [ ] Dùng `anchor deploy` để đưa smart contract và chạy script `migrations/deploy.ts` lên Devnet.
  - Implemented by: 
- [ ] **4.3: Xây dựng Kịch bản Demo End-to-End**
  - [ ] Chuẩn bị kịch bản demo bao gồm cả giao diện web và CLI daemon.
  - [ ] Viết script `demo.sh` (tùy chọn) để tự động hóa luồng demo.
  - [ ] Chuẩn bị slide trình bày.
  - Implemented by: 

---

### Giai đoạn 5: Nâng cấp Hỗ trợ Job Phức tạp (Metadata & Tags)

- [x] **5.1: Cập nhật Smart Contract với kiến trúc Tags**
  - [x] Định nghĩa `enum ExecutionEngine` chỉ với biến thể `Docker`. (Lưu ý: Chiến lược đã được cập nhật, Wasm hiện là ưu tiên số 1).
  - [x] Cập nhật `JobAccount` để sử dụng các trường metadata mới: `engine`, `job_details: String`, `results: String`, `job_tags: Vec<String>`, `hardware_tags: Vec<String>`.
  - [x] Xóa các trường cũ không còn phù hợp.
  - [x] Cập nhật instruction `create_job` để nhận các tham số metadata và tags mới.
  - [x] Cập nhật instruction `submit_results` để nhận `results`.
  - Implemented by: [Gemini & Khánh]
- [ ] **5.2: Cập nhật Client của Provider**
  - [ ] Cập nhật logic quét job trong `provider-cli` để lọc dựa trên `job_tags` và `hardware_tags`.
  - [x] Implement logic thực thi job Wasm theo `manifest.json` (đã hoàn thành trong Task 7.0).
  - Implemented by: [Gemini & Khánh]
- [ ] **5.3: Cập nhật Client của Consumer**
  - [ ] Cập nhật giao diện/lệnh `create-job` để cho phép người dùng cung cấp các CID cho module Wasm, model (nếu có), và dữ liệu đầu vào.
  - [ ] Cập nhật logic `verify-job` để tải và xác minh kết quả từ `results` (CID của kết quả).
  - Implemented by: 
- [ ] **5.4: Xây dựng Từ điển Tags**
  - [ ] Tạo và định nghĩa phiên bản đầu tiên của file `specs/tags_dictionary.md`.
  - [ ] Tích hợp logic đọc từ điển này vào client (tùy chọn, có thể để sau).
  - Implemented by:

---

### Giai đoạn 6: Xây dựng Hệ thống Uy tín (Reputation System)

- [x] **6.1: Cập nhật `Provider` Account**
  - [x] Thêm các trường `jobs_completed: u64`, `jobs_failed: u64`, `banned_until: i64` vào struct `Provider`.
  - Implemented by: [Gemini & Khánh]
- [x] **6.2: Cập nhật Logic Xử lý Job để áp dụng hình phạt**
  - [x] Sửa đổi instruction `verify_results`:
    - [x] Khi `is_accepted = true`, tăng `provider.jobs_completed`.
    - [x] Khi `is_accepted = false`, tăng `provider.jobs_failed` và tính toán `ban_duration` dựa trên tỷ lệ thất bại, sau đó cập nhật `provider.banned_until`.
  - [x] Sửa đổi instruction `accept_job` để kiểm tra `banned_until` và từ chối nếu provider đang bị cấm.
  - Implemented by: [Gemini & Khánh]
- [x] **6.3: Cập nhật Unit Tests**
  - [x] Viết test case cho việc provider bị cấm sau khi thất bại.
  - [x] Viết test case để xác minh `jobs_completed` và `jobs_failed` được cập nhật chính xác.
  - Implemented by: [Gemini & Khánh]