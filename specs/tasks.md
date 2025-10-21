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

### Giai đoạn 2: Phát triển Client cho Provider (Web + CLI)

- [ ] **2.1: Xây dựng Nền tảng Client**
  - [ ] Tạo thư mục `client/` và file `client/common.ts`.
  - [ ] Viết các hàm tái sử dụng để kết nối mạng Solana, tải ví và khởi tạo đối tượng `program`.
  - Implemented by: 
- [ ] **2.2: Xây dựng Giao diện Đăng ký (Web)**
  - [ ] Thiết lập dự án React trong thư mục `app/`.
  - [ ] Cài đặt và cấu hình `@solana/wallet-adapter`.
  - [ ] Xây dựng giao diện cho phép Provider kết nối ví, nhập `tags` và gọi instruction `providerRegister`.
  - Implemented by: 
- [ ] **2.3: Xây dựng Daemon `listen` (CLI)**
  - [ ] Tạo file `client/provider-cli.ts`.
  - [ ] Implement vòng lặp `listen` để tự động quét và nhận job từ on-chain dựa trên `status` và `tags`.
  - [ ] Giả lập quá trình thực thi và tự động gọi `submit_results`.
  - Implemented by: 

---

### Giai đoạn 3: Phát triển Client cho Consumer (Web)

- [ ] **3.1: Xây dựng Giao diện Tạo Job**
  - [ ] Mở rộng ứng dụng React với trang "Create Job".
  - [ ] Xây dựng form cho phép người dùng nhập thông tin job và gọi instruction `createJob`.
  - Implemented by: 
- [ ] **3.2: Xây dựng Dashboard Quản lý Job**
  - [ ] Xây dựng trang "My Jobs" để liệt kê các job đã tạo của người dùng.
  - [ ] Hiển thị trạng thái (`status`) của từng job.
  - [ ] Thêm các nút bấm để gọi `verifyResults`, `cancel_job`, `reclaim_job`.
  - Implemented by: 

---

### Giai đoạn 4: Kiểm thử và Hoàn thiện Demo

- [x] **4.1: Viết Unit Test cho Smart Contract**
  - [x] Viết test cho toàn bộ luồng trong `tests/node-link.ts`.
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
  - [x] Định nghĩa `enum ExecutionEngine` chỉ với biến thể `Docker`.
  - [x] Cập nhật `JobAccount` để sử dụng các trường metadata mới: `engine`, `job_details: String`, `results: String`, `job_tags: Vec<String>`, `hardware_tags: Vec<String>`.
  - [x] Xóa các trường cũ không còn phù hợp.
  - [x] Cập nhật instruction `create_job` để nhận các tham số metadata và tags mới.
  - [x] Cập nhật instruction `submit_results` để nhận `results`.
  - Implemented by: [Gemini & Khánh]
- [ ] **5.2: Cập nhật Client của Provider**
  - [ ] Cập nhật logic quét job để lọc dựa trên `job_tags` và `hardware_tags`.
  - [ ] Implement logic thực thi job Docker từ `job_details` (tên Docker image).
  - [ ] Implement logic tải kết quả lên IPFS để lấy `results` (CID của kết quả).
  - Implemented by: 
- [ ] **5.3: Cập nhật Client của Consumer**
  - [ ] Cập nhật lệnh `create-job` để cho phép người dùng cung cấp `job_tags` và `hardware_tags`.
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