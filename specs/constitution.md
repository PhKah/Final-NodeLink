# Hiến pháp dự án NodeLink (Project Constitution)

Tài liệu này định nghĩa các nguyên tắc và thành phần cốt lõi, không thể thiếu (bare minimum) để xây dựng thành công phiên bản MVP (Minimum Viable Product) cho dự án NodeLink trong khuôn khổ hackathon. Mọi quyết định kỹ thuật phải tuân thủ và ưu tiên hoàn thành các mục tiêu dưới đây.

---

## Nguyên tắc chỉ đạo

1.  **Tập trung vào Luồng End-to-End:** Ưu tiên hàng đầu là hoàn thành một luồng trình diễn hoàn chỉnh: **Gửi Job -> Xử lý -> Xác minh -> Thanh toán**.
2.  **Đơn giản là Tối thượng:** Mọi thành phần phải được xây dựng ở mức độ đơn giản nhất có thể để chứng minh khái niệm. Các tính năng phức tạp (ví dụ: sandbox bảo mật, matching layer nâng cao) sẽ được để lại cho các giai đoạn sau.
3.  **Tự động hóa cho Provider:** Client của Provider phải được thiết kế như một tiến trình nền tự động (`set it and forget it`), cho phép khai thác tài nguyên rảnh rỗi một cách hiệu quả mà không cần sự can thiệp thủ công.
4.  **Minh bạch On-chain:** Các trạng thái quan trọng nhất (node nào đang online, job nào đang chạy, tiền đã được trả chưa) phải được ghi nhận và có thể xác minh trên blockchain.
5.  **Giao diện là CLI:** Tương tác của cả Provider và Consumer sẽ được thực hiện qua giao diện dòng lệnh (CLI) để tối ưu thời gian phát triển.
6.  **Nền tảng là Solana:** Toàn bộ logic on-chain sẽ được xây dựng trên blockchain **Solana**, sử dụng **Anchor framework**. Môi trường mục tiêu cho hackathon là **Devnet**.
7.  **Tận dụng Lưu trữ Off-chain:** Đối với các dữ liệu lớn (chi tiết job, kết quả), hệ thống sẽ sử dụng các giải pháp lưu trữ phi tập trung như IPFS. Logic on-chain chỉ lưu trữ các "con trỏ" (ví dụ: CID) tới dữ liệu này để tối ưu chi phí và hiệu năng.

---

## Các thành phần tối thiểu (Bare Minimum Components)

### 1. Chương trình On-chain (Smart Contract)

Chương trình phải cung cấp các chức năng cơ bản sau:

-   **[Cần có] Đăng ký Node:** Cho phép các máy tính (nodes) đăng ký, hủy đăng ký và cập nhật trạng thái (`Available`, `Busy`) trên mạng lưới.
-   **[Cần có] Đăng tải Job:** Cho phép người dùng gửi một tác vụ (job) kèm theo một khoản thanh toán được khóa trong một tài khoản tạm giữ (escrow).
-   **[Cần có] Xác minh & Thanh toán (Proof-of-Compute):**
    -   Cho phép node đã hoàn thành gửi lại "bằng chứng công việc" (ví dụ: hash của kết quả).
    -   Cho phép người gửi job xác minh bằng chứng đó. Nếu hợp lệ, thanh toán sẽ được tự động chuyển từ escrow cho node.

### 2. Ứng dụng Off-chain (Client-side)

Phải có hai kịch bản sử dụng CLI riêng biệt:

-   **[Cần có] CLI cho Provider (Người cho thuê):**
    -   Lệnh để `register` node của họ.
    -   Một tiến trình nền tự động để `listen` (lắng nghe) và nhận các job phù hợp.
    -   Logic để `execute` (thực thi) job và `submit` (gửi) kết quả hash lên on-chain.

-   **[Cần có] CLI cho Consumer (Người thuê):**
    -   Lệnh để `create` một job mới và gửi tiền vào escrow.
    -   Lệnh để `verify` kết quả sau khi job hoàn thành để giải phóng thanh toán.

---

> Mọi tính năng không phục vụ trực tiếp cho việc hoàn thành các thành phần tối thiểu trên sẽ được xem là "ngoài phạm vi" (out of scope) của MVP cho hackathon.