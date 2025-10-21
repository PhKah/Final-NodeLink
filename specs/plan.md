# Kế hoạch tổng thể dự án NodeLink (MVP cho Hackathon)

Dự án sẽ được chia thành các giai đoạn chính để hoàn thành sản phẩm MVP. Chi tiết các công việc (tasks) cụ thể được theo dõi tại file `tasks.md`.

---

### **Giai đoạn 0: Tự động hóa Triển khai (Deployment Automation)**
*   **Mục tiêu:** Đảm bảo chương trình on-chain luôn ở trạng thái sẵn sàng hoạt động ngay sau khi deploy bằng cách tự động hóa các tác vụ thiết lập ban đầu.

---

### **Giai đoạn 1: Xây dựng Smart Contract & Logic On-chain**
*   **Mục tiêu:** Tạo ra bộ logic cốt lõi trên Solana Devnet để quản lý node, tác vụ (job), thanh toán và hệ thống uy tín.

---

### **Giai đoạn 2: Phát triển Client cho Provider (Web + CLI)**
*   **Mục tiêu:** Cung cấp giao diện web để đăng ký và một ứng dụng CLI (daemon) để Provider tự động xử lý công việc.

---

### **Giai đoạn 3: Phát triển Client cho Consumer (Web)**
*   **Mục tiêu:** Xây dựng một giao diện web hoàn chỉnh cho người dùng (Consumer/Renter) thuê tài nguyên tính toán.

---

### **Giai đoạn 4: Kiểm thử và Hoàn thiện Demo**
*   **Mục tiêu:** Đảm bảo toàn bộ hệ thống hoạt động trơn tru, triển khai lên Devnet và chuẩn bị một kịch bản demo hoàn chỉnh.

---

### **Mô hình Thực thi Job (Job Execution Model)**

Phần này làm rõ kiến trúc thực thi công việc đã được nâng cấp, cho phép hỗ trợ các tác vụ phức tạp thông qua một hệ thống metadata và tags linh hoạt.

**1. Kiến trúc cốt lõi: Tags On-chain**

*   Để giải quyết bài toán Provider cần biết một job có phù hợp với mình không trước khi nhận, hệ thống sẽ sử dụng một kiến trúc "tags" on-chain.
*   Mỗi `JobAccount` sẽ chứa hai danh sách các tags (dạng `Vec<String>`):
    *   `job_tags`: Mô tả bản chất của công việc (ví dụ: `"ai_training"`, `"3d_rendering"`).
    *   `hardware_tags`: Mô tả các yêu cầu về phần cứng (ví dụ: `"gpu"`, `"vram_16gb"`).
*   Provider có thể quét các job trên blockchain và lọc cực kỳ hiệu quả dựa trên các tags này mà không cần truy cập IPFS.

**2. Quy ước và Từ điển Tags**

*   Để đảm bảo tính nhất quán, một file "từ điển" (`specs/tags_dictionary.md`) sẽ được tạo ra để định nghĩa một bộ từ vựng chung cho tất cả các tags.
*   Client của cả Renter và Provider sẽ tuân theo từ điển này để đảm bảo việc đăng và tìm job diễn ra chính xác.

**3. Lộ trình Triển khai Engine**

*   **Giai đoạn đầu (Tập trung vào Docker):** Hệ thống sẽ ưu tiên hỗ trợ `ExecutionEngine::Docker` là engine thực thi đầu tiên. Trường `job_details` sẽ chứa tên của Docker image.
*   **Giai đoạn tương lai (Mở rộng):** Kiến trúc này cho phép dễ dàng mở rộng để hỗ trợ các engine khác như `Wasm` trong tương lai bằng cách thêm biến thể mới vào `enum ExecutionEngine`.

---

### **Nguyên tắc Phát triển Client (Client Development Principles)**

Phần này ghi lại các nguyên tắc cốt lõi khi xây dựng ứng dụng client (CLI, frontend) để tương tác với chương trình Anchor.

1.  **IDL là trung tâm:** Luôn sử dụng file IDL (JSON) do `anchor build` tạo ra làm "nguồn chân lý" (source of truth) cho API của chương trình.
2.  **Tái sử dụng Provider:** Tạo một `AnchorProvider` có thể tái sử dụng để đóng gói `connection` (kết nối mạng Solana) và `wallet` (ví người dùng).
3.  **Khởi tạo `Program` một lần:** Khởi tạo một đối tượng `Program` duy nhất bằng IDL và Provider để tương tác với smart contract.
4.  **Sử dụng `program.methods`:** Dùng `program.methods.instructionName()` để xây dựng và gọi các instruction một cách an toàn và rõ ràng.
5.  **Sử dụng `program.account`:** Dùng `program.account.accountName.fetch()` hoặc `.all()` để truy vấn và giải mã (deserialize) dữ liệu của các account on-chain.