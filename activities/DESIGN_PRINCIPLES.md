### Các Nguyên lý Thiết kế UX/UI cho Compute Share (v2)

Tài liệu này định nghĩa các nguyên tắc cốt lõi để xây dựng giao diện người dùng cho dự án Compute Share, đảm bảo tính nhất quán, dễ sử dụng và phù hợp 100% với logic on-chain.

**1. Lấy Provider làm trung tâm (Provider-First)**
*   **Nguyên tắc:** Trải nghiệm của Provider phải được ưu tiên hàng đầu. Mục tiêu là tạo ra một công cụ "cài đặt và quên đi" (set it and forget it) để tối đa hóa việc thu hút người cho thuê tài nguyên.
*   **Thực thi:**
    *   Tính năng "Auto-Accept" trong UI chính là nút bật/tắt cho daemon `listen` của Provider. Giao diện phải đơn giản: một nút "Go Online" / "Go Offline".
    *   **Bảng điều khiển Provider:** Khi kết nối ví, Provider phải thấy một khu vực riêng hiển thị rõ các thông số on-chain của họ:
        *   Trạng thái hiện tại (`Available`, `Busy`, `Banned`).
        *   Thống kê uy tín: `Jobs Completed`, `Jobs Failed`.
        *   Thời gian bị phạt còn lại (nếu `banned_until` > thời gian hiện tại).
    *   **Dashboard Provider:** Cung cấp 2 danh sách job riêng biệt: (1) Job đang thực hiện, và (2) Các job đã hoàn thành và **có thể `claim_payment`**.

**2. Phân tách vai trò & Hành động theo ngữ cảnh (Clear Role & Contextual Actions)**
*   **Nguyên tắc:** Giao diện phải thích ứng hoàn toàn với vai trò và trạng thái của người dùng. Người dùng chỉ nên thấy những hành động họ được phép làm.
*   **Thực thi (Renter View):**
    *   **Dashboard Renter:** Hiển thị **chỉ những job do họ tạo ra**.
    *   **Hành động theo trạng thái:** Các nút hành động trên mỗi job phải xuất hiện/biến mất tùy theo logic on-chain:
        *   Nút `Cancel Job` chỉ hiển thị khi `job.status` là `Pending`.
        *   Nút `Verify Results` (cả Accept và Reject) chỉ hiển thị khi `job.status` là `PendingVerification`.
        *   Nút `Reclaim Job` chỉ hiển thị khi `job.status` là `InProgress` VÀ `submission_deadline` đã qua.
    *   Nút `Create Job` luôn là hành động chính.

**3. Phản ánh đúng thực tế On-chain (On-Chain as Source of Truth)**
*   **Nguyên tắc:** Giao diện là một lớp hiển thị cho smart contract. Mọi trạng thái và dữ liệu quan trọng phải được lấy từ blockchain.
*   **Thực thi:**
    *   **Không giả lập các tính năng cốt lõi.** Loại bỏ hoàn toàn khái niệm SBT giả lập. Uy tín của Provider được quyết định bởi các trường on-chain.
    *   **Chuẩn hóa Trạng thái:** Sử dụng màu sắc và icon nhất quán cho các trạng thái được định nghĩa trong `lib.rs`:
        *   **JobStatus:** `Pending` (Vàng), `InProgress` (Xanh dương), `PendingVerification` (Tím), `Completed` (Xám/Xanh lá nhạt).
        *   **ProviderStatus:** `Available` (Xanh lá), `Busy` (Xanh dương), `Banned` (Đỏ).

**4. Phản hồi Trực quan và Minh bạch (Visual & Transparent Feedback)**
*   **Nguyên tắc:** Người dùng phải luôn hiểu rõ hệ thống đang làm gì và kết quả hành động của họ.
*   **Thực thi:**
    *   **Modal xác nhận:** Mọi hành động thay đổi trạng thái on-chain (Create, Cancel, Verify, Reclaim) đều cần một modal xác nhận, nêu rõ hành động và hậu quả (nếu có).
    *   **Thông báo Giao dịch:** Sử dụng thông báo "toast" để hiển thị 3 giai đoạn của một giao dịch: "Đang gửi...", "Đang xử lý...", và "Thành công" (kèm link đến Solana Explorer).
    *   **Hiển thị tài chính rõ ràng:** Luôn hiển thị `reward` bằng đơn vị SOL (ví dụ: 2.5 SOL) thay vì lamports.

**5. Thẩm mỹ Hiện đại và Tối giản (Modern & Minimalist Aesthetics)**
*   **Nguyên tắc:** Giao diện phải sạch sẽ, chuyên nghiệp và mang lại cảm giác của một sản phẩm Web3 hiện đại.
*   **Thực thi:**
    *   Ưu tiên Dark Mode, sử dụng gradient và hiệu ứng trong suốt một cách tinh tế.
    *   Duy trì sự nhất quán về font chữ, icon (Lucide), và khoảng cách.    