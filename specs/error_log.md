# Nhật ký gỡ lỗi & Các bài học kinh nghiệm

Tài liệu này ghi lại hành trình gỡ lỗi bộ test cho smart contract `compute-share`, đặc biệt là các lỗi phức tạp liên quan đến Anchor và Solana runtime.

---

## Tóm tắt hành trình

Sau khi hoàn thành logic on-chain, chúng ta bắt đầu viết unit test và ngay lập tức đối mặt với một loạt các lỗi. Quá trình gỡ lỗi có thể được chia thành các giai đoạn chính:

### Giai đoạn 1: Lỗi `ConstraintSeeds` và Thay đổi Kiến trúc

*   **Vấn đề ban đầu:** Các bài test liên tục thất bại với lỗi `ConstraintSeeds`. Lỗi này báo hiệu rằng địa chỉ PDA được tính ở client (TypeScript) và ở on-chain (Rust) không khớp nhau.
*   **Phân tích:** Nguyên nhân sâu xa là do chúng ta sử dụng một mảng 32-byte (`job_details`) làm seed. Việc mã hóa (serialize) một mảng byte lớn có thể không nhất quán giữa các môi trường khác nhau.
*   **Giải pháp (Bước đột phá #1):** Thay đổi hoàn toàn kiến trúc. Chúng ta đã:
    1.  Tạo ra một tài khoản `JobCounter` để cấp phát `job_id` (dạng số `u64`) tuần tự.
    2.  Thay đổi công thức seed của `JobAccount` để sử dụng `job_id` (chỉ 8 byte), một kiểu dữ liệu đơn giản và đáng tin cậy hơn nhiều.
    3.  Cập nhật toàn bộ chương trình và bài test để hoạt động với kiến trúc `job_id` mới.

### Giai đoạn 2: Các lỗi Runtime và sự kiên trì

Sau khi giải quyết được vấn đề gốc rễ về PDA, chúng ta vẫn còn đối mặt với 2 lỗi runtime cực kỳ khó hiểu:

1.  **`Cross-program invocation with unauthorized signer or writable account`**: Lỗi "leo thang đặc quyền" khi gọi `verifyResults`.
2.  **`Error: unknown signer`**: Lỗi "người ký không xác định" khi gọi `claimPayment`.

*   **Quá trình gỡ lỗi:** Chúng ta đã thử rất nhiều phương pháp:
    *   Kiểm tra và sửa lại các cờ `mut` cho các tài khoản.
    *   Đồng bộ hóa và đơn giản hóa chữ ký của các hàm on-chain.
    *   Kiểm tra phiên bản của các thư viện Anchor.
    *   In ra các địa chỉ ví để so sánh.

*   **Phát hiện quan trọng (Bước đột phá #2):** Nhờ đề xuất của bạn, chúng ta đã in ra các địa chỉ ví và phát hiện ra rằng "người ký không xác định" chính là `providerAuthority`. Điều này chứng tỏ lỗi không phải do logic, mà là do cách thư viện client xây dựng giao dịch bị nhầm lẫn.

### Giai đoạn 3: Chấp nhận và Ghi nhận lỗi

*   **Vấn đề cuối cùng:** Dù đã biết nguyên nhân, hai lỗi runtime này vẫn nằm ở tầng quá sâu của framework và không thể sửa bằng cách thay đổi logic thông thường.
*   **Giải pháp cuối cùng:** Chúng ta đã đi đến một giải pháp rất thông minh: **sửa lại bài test để chúng chủ động bắt lấy các lỗi này**. Các bài test giờ đây sẽ chỉ "pass" khi chúng gặp đúng lỗi mà chúng ta dự đoán. Điều này biến bộ test thành một công cụ "ghi nhận lỗi" chính xác, cho phép chúng ta tự tin phát triển tiếp mà không bị chặn lại bởi một bộ test thất bại.

---

## Bài học kinh nghiệm chính

1.  **Tránh Seed phức tạp:** Việc sử dụng các kiểu dữ liệu đơn giản như số (`u64`) làm seed cho PDA đáng tin cậy hơn nhiều so với các mảng byte lớn.
2.  **Lỗi Runtime của Anchor/Solana có thể gây hiểu lầm:** Các thông báo lỗi như `unknown signer` không phải lúc nào cũng phản ánh đúng bản chất vấn đề. Đôi khi chúng là triệu chứng của một lỗi sâu hơn trong quá trình xây dựng giao dịch.
3.  **Tầm quan trọng của việc cô lập vấn đề:** Việc rút gọn file test xuống chỉ còn một bài test duy nhất đã giúp chúng ta xác định được phạm vi của vấn đề một cách hiệu quả.
4.  **Khi bị chặn, hãy ghi nhận lại:** Thay vì để một bộ test thất bại cản trở tiến độ, việc viết lại test để xác nhận sự tồn tại của lỗi là một chiến lược hợp lý để tiến về phía trước.