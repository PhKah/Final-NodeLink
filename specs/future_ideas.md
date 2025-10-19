# Ý tưởng cho các phiên bản tương lai (Future Ideas)

Tài liệu này ghi lại các ý tưởng và tính năng tiềm năng để phát triển sau khi phiên bản MVP của dự án NodeLink được hoàn thành.

---

## Matching Layer Nâng cao

**Vấn đề cần giải quyết:** Mô hình MVP hiện tại dựa trên sự tin tưởng, dẫn đến một rủi ro: Renter xấu tính có thể từ chối kết quả đúng để không trả tiền, trong khi Provider không có cơ chế để tự bảo vệ một cách hiệu quả. Các ý tưởng dưới đây nhằm giải quyết vấn đề này bằng cách xây dựng một cơ chế kinh tế và uy tín để khuyến khích hành vi trung thực từ cả hai phía.

Cơ chế "matching layer" chịu trách nhiệm ghép nối Renter (người thuê) và Provider (người cung cấp) một cách hiệu quả và an toàn. Các ý tưởng dưới đây sẽ giúp xây dựng một thị trường tài nguyên tính toán mạnh mẽ và đáng tin cậy.

### 1. Hệ thống Uy tín (Reputation System)

- **Ý tưởng:** Mỗi `NodeAccount` sẽ theo dõi lịch sử hoạt động của mình để xây dựng một điểm uy tín.
- **Cách hoạt động:**
    - Thêm các trường vào `NodeAccount`: `jobs_completed: u64`, `jobs_failed: u64`, `total_uptime: i64`, v.v.
    - Điểm uy tín có thể được tính toán on-chain hoặc off-chain dựa trên các chỉ số này (ví dụ: tỷ lệ hoàn thành job).
    - Khi tạo job, Renter có thể đặt ra các yêu cầu tối thiểu về uy tín (ví dụ: `min_reputation_score: u8`). Chương trình on-chain sẽ chỉ cho phép các node đủ điều kiện nhận job.
- **Lợi ích:** Khuyến khích các Provider hoạt động tốt và giúp Renter lựa chọn được các đối tác đáng tin cậy.

### 2. Cơ chế Stake và Phạt (Staking and Slashing)

- **Ý tưởng:** Yêu cầu các Provider phải "stake" (ký gửi) một lượng tài sản (ví dụ: USDC, SOL) như một khoản đặt cọc để đảm bảo cho hành vi tốt của họ.
- **Cách hoạt động:**
    - Provider phải gửi một lượng token vào một tài khoản escrow do chương trình quản lý trước khi có thể đăng ký hoặc nhận việc.
    - Nếu Provider có hành vi gian lận (ví dụ: gửi kết quả sai, offline đột ngột), một phần hoặc toàn bộ số tiền stake của họ sẽ bị "slashed" (phạt).
    - Số tiền phạt có thể được dùng để bồi thường cho Renter hoặc được chuyển vào kho bạc (treasury) của giao thức.
- **Lợi ích:** Tạo ra một rào cản kinh tế mạnh mẽ chống lại các hành vi phá hoại, tăng cường an ninh và niềm tin cho toàn mạng lưới.

### 3. Các cơ chế khác

- **Đấu giá (Auctioning):** Renter có thể tạo một phiên đấu giá cho job của mình, và các Provider sẽ "bid" (đặt giá) để được thực hiện. Provider có giá tốt nhất (hoặc kết hợp giá và uy tín tốt nhất) sẽ thắng.
- **Lựa chọn dựa trên hiệu năng (Performance-based selection):** Renter có thể ưu tiên các node có cấu hình phần cứng cụ thể hoặc có thời gian phản hồi nhanh nhất, được ghi nhận on-chain.

---

## Môi trường Thực thi An toàn (Sandbox)

Hiện tại, mô hình đang dựa trên sự tin tưởng: Renter tin Provider sẽ chạy đúng logic, và Provider tin code từ Renter không độc hại. Một môi trường sandbox sẽ loại bỏ sự tin tưởng này.

### 1. Ý tưởng

- **Ý tưởng:** Mỗi job sẽ được thực thi bên trong một môi trường bị cô lập (sandbox) trên máy của Provider để đảm bảo an toàn cho cả hai bên.

### 2. Cách hoạt động

-   Provider sẽ sử dụng các công nghệ như **WebAssembly (WASM)**, **gVisor**, hoặc **Docker containers** để tạo ra một sandbox.
-   Code hoặc tác vụ do Renter gửi sẽ được thực thi hoàn toàn bên trong môi trường này. Sandbox sẽ giới hạn nghiêm ngặt quyền truy cập của tác vụ vào hệ thống file, mạng, và các tài nguyên khác trên máy của Provider.
-   Kết quả từ sandbox sẽ được trích xuất và gửi lại on-chain.

### 3. Lợi ích

-   **Bảo vệ Provider:** Ngăn chặn code độc hại từ Renter gây hại cho máy của Provider.
-   **Đảm bảo cho Renter:** Đảm bảo code của họ được chạy trong một môi trường chuẩn, không bị can thiệp.
-   **Mở rộng khả năng:** Cho phép mạng lưới thực thi các loại tác vụ phức tạp và tùy ý một cách an toàn, không chỉ giới hạn ở các tác vụ được định nghĩa trước.

---

## Lộ trình Nâng cấp Proof-of-Compute

Để tăng cường tính bảo mật và tin cậy cho mạng lưới, cơ chế Proof-of-Compute sẽ được nâng cấp theo từng giai đoạn sau MVP.

### 1. Giai đoạn Beta: Phát hiện Gian lận

- **Cơ chế:** Challenge-Response (Thách thức-Phản hồi) kết hợp với Hệ thống Uy tín (Reputation System).
- **Mô tả:** Cho phép người dùng "thách thức" các kết quả đáng ngờ và xây dựng điểm uy tín cho các provider, khuyến khích hành vi trung thực.

### 2. Giai đoạn Mainnet: Tăng cường Tin cậy

- **Cơ chế:** Redundant Computation (Tính toán song song).
- **Mô tả:** Một tác vụ sẽ được giao cho nhiều provider thực hiện song song. Hệ thống sẽ coi kết quả là hợp lệ nếu đa số các provider trả về cùng một kết quả, loại bỏ sự phụ thuộc vào một provider duy nhất.

### 3. Giai đoạn v2.0: Xác minh Trustless

- **Cơ chế:** zk-SNARKs / TEEs.
- **Mô tả:** Tích hợp các bằng chứng không kiến thức (zero-knowledge proofs) hoặc môi trường thực thi tin cậy (trusted execution environments) để đạt được cơ chế xác minh không cần tin cậy (trustless), cho phép xử lý các tác vụ yêu cầu bảo mật và tính toán phức tạp như AI.
