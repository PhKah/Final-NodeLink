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

- [x] **4.1: Viết Unit Test cho Smart Contract**
  - [x] Viết test cho toàn bộ luồng trong `tests/node-link.ts`.
  - Implemented by: [Gemini & Khánh]
- [ ] **4.2: Triển khai lên Devnet**
  - [ ] Dùng `anchor deploy` để đưa smart contract lên Devnet.
  - Implemented by: 
- [ ] **4.3: Xây dựng Kịch bản Demo End-to-End**
  - [ ] Chuẩn bị 2 terminal mô phỏng Provider và Consumer.
  - [ ] Viết script `demo.sh` để tự động hóa luồng demo.
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

### Giai đoạn 6: Xây dựng Hệ thống Uy tín & Hoàn thiện Luồng Job (Reputation System & Job Flow Finalization)

- [x] **6.0: Tái cấu trúc `JobAccount` PDA (Refactor `JobAccount` PDA)**
  - [x] Thay đổi `seeds` của `JobAccount` từ `[b"job", renter, job_id]` thành `[b"job", job_id]` để đơn giản hóa việc truy xuất.
  - [x] Cập nhật lại tất cả các Contexts (`CreateJob`, `AcceptJob`, `SubmitResults`, v.v.) để sử dụng `seeds` mới.
  - Implemented by: [Gemini & Khánh]

- [x] **6.1: Cập nhật các Structs (Update Structs)**
  - [x] `Provider`: Thêm các trường `jobs_completed: u64`, `jobs_failed: u64`, `banned_until: i64`.
  - [x] `JobAccount`: Thêm các trường `max_duration: i64` (thời gian tối đa Renter phải xác minh) và `submission_deadline: i64` (thời gian tối đa Provider phải nộp kết quả).
  - Implemented by: [Gemini & Khánh]

- [x] **6.2: Bổ sung Instruction cho Renter (Add Instructions for Renter)**
  - [x] Tạo instruction `cancel_job` cho phép Renter hủy job và lấy lại tiền khi job đang ở trạng thái `Pending`.
  - [x] Tạo instruction `reclaim_job` cho phép Renter phạt Provider (gọi `apply_penalty`) khi quá `submission_deadline`.
  - Implemented by: [Gemini & Khánh]

- [x] **6.3: Tái cấu trúc Logic Phạt (Refactor Penalty Logic)**
  - [x] Tạo một hàm nội bộ `apply_penalty(provider: &mut Account<Provider>)` để xử lý logic: tăng `jobs_failed`, tính `ban_duration` theo tỷ lệ, cập nhật `banned_until`, và reset `provider.status` về `Available`.
  - Implemented by: [Gemini & Khánh]

- [x] **6.4: Cập nhật các Instruction hiện có (Update Existing Instructions)**
  - [x] `provider_register`: Khởi tạo các trường `jobs_completed`, `jobs_failed`, `banned_until` bằng 0.
  - [x] `create_job`: Thêm tham số `max_duration` và lưu vào `JobAccount`.
  - [x] `accept_job`: Kiểm tra `provider.banned_until` và tính `submission_deadline`.
  - [x] `verify_results`:
    - [x] Khi `is_accepted = true`, tăng `jobs_completed`.
    - [x] Khi `is_accepted = false`, gọi hàm nội bộ `apply_penalty`.
  - Implemented by: [Gemini & Khánh]

- [x] **6.5: Cập nhật Unit Tests**
  - [x] Viết test cho `cancel_job` và `reclaim_job`.
  - [x] Viết test cho việc provider bị cấm sau khi thất bại và không thể `accept_job`.
  - [x] Viết test để xác minh `jobs_completed` và `jobs_failed` được cập nhật chính xác.
  - [x] Cập nhật các test cũ để phù hợp với `JobAccount` PDA seeds mới.
  - Implemented by: [Gemini & Khánh]