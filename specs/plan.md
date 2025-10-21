# Kế hoạch tổng thể dự án NodeLink (MVP cho Hackathon)

Dự án sẽ được chia thành 4 giai đoạn chính để hoàn thành sản phẩm MVP. Chi tiết các công việc (tasks) cụ thể được theo dõi tại file `tasks.md`.

---

### **Giai đoạn 1: Xây dựng Smart Contract (On-chain Program)**
*   **Mục tiêu:** Tạo ra bộ logic cốt lõi trên Solana Devnet để quản lý node, tác vụ (job) và thanh toán an toàn.

---

### **Giai đoạn 2: Phát triển Node Client (Off-chain)**
*   **Mục tiêu:** Tạo ra một ứng dụng CLI cho phép người dùng (provider) kết nối máy tính của họ vào mạng lưới để cung cấp tài nguyên tính toán.

---

### **Giai đoạn 3: Phát triển Giao diện cho Người dùng (Consumer)**
*   **Mục tiêu:** Tạo ra một ứng dụng CLI cho phép người dùng (consumer) gửi tác vụ tính toán và xác minh kết quả.

---

### **Giai đoạn 4: Kiểm thử và Hoàn thiện Demo**
*   **Mục tiêu:** Đảm bảo toàn bộ hệ thống hoạt động trơn tru, triển khai lên Devnet và chuẩn bị một kịch bản demo hoàn chỉnh.

---

### **Giai đoạn 5: Xây dựng Hệ thống Uy tín (Reputation System)**
*   **Mục tiêu:** Xây dựng một cơ chế phạt tự động để tăng cường tính tin cậy của mạng lưới. Provider sẽ bị cấm nhận việc trong một khoảng thời gian nếu có hành vi không tốt, dựa trên tỷ lệ thất bại của họ. Cơ chế này được thiết kế để giữ sự đơn giản tối đa cho Renter.

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