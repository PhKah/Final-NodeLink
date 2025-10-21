# Ý tưởng cho các phiên bản tương lai (Future Ideas)

Tài liệu này ghi lại các ý tưởng và tính năng tiềm năng để phát triển sau khi phiên bản MVP của dự án NodeLink được hoàn thành.

---

## Lộ trình Ưu tiên (Priority Roadmap)

- **Ưu tiên #1 (Next Priority): Hệ thống Uy tín (Reputation System)**
  - **Lý do:** Giải quyết vấn đề tin tưởng cốt lõi của mạng lưới, tạo nền tảng cho một thị trường lành mạnh. Đây là bước đi hợp lý nhất sau khi hoàn thành MVP.
- **Ưu tiên #2: Mở rộng Metadata Chi tiết (Detailed Metadata)**
  - **Lý do:** Cải thiện hiệu quả của việc ghép nối (matching) một cách tự nhiên dựa trên các tính năng đã có.
- **Mục tiêu dài hạn (Long-term Goals):** Môi trường Thực thi An toàn (Sandbox), Staking & Slashing, Proof-of-Compute.

---

---

## Matching Layer Nâng cao

**Vấn đề cần giải quyết:** Mô hình MVP hiện tại dựa trên sự tin tưởng, dẫn đến một rủi ro: Renter xấu tính có thể từ chối kết quả đúng để không trả tiền, trong khi Provider không có cơ chế để tự bảo vệ một cách hiệu quả. Các ý tưởng dưới đây nhằm giải quyết vấn đề này bằng cách xây dựng một cơ chế kinh tế và uy tín để khuyến khích hành vi trung thực từ cả hai phía.

Cơ chế "matching layer" chịu trách nhiệm ghép nối Renter (người thuê) và Provider (người cung cấp) một cách hiệu quả và an toàn. Các ý tưởng dưới đây sẽ giúp xây dựng một thị trường tài nguyên tính toán mạnh mẽ và đáng tin cậy.

### 1. Hệ thống Uy tín (Reputation System)

- **Triết lý thiết kế:** Giữ cho quy trình phía Renter đơn giản nhất có thể. Không yêu cầu Renter phải hiểu về điểm số hay cấu hình phức tạp. Thay vào đó, áp dụng một cơ chế trừng phạt công bằng và tự động đối với Provider để khuyến khích hành vi tốt.

- **Cơ chế hoạt động:**
    - **Bước 1: Thêm trường dữ liệu vào `Provider` account:**
        - `jobs_completed: u64` (Số job hoàn thành thành công)
        - `jobs_failed: u64` (Số job thất bại)
        - `banned_until: i64` (Mốc thời gian Unix mà Provider bị cấm nhận job)
    - **Bước 2: Định nghĩa các trường hợp "Thất bại" (Failure Cases):**
        - `jobs_failed` sẽ tăng lên trong các trường hợp:
            1.  **Renter từ chối kết quả:** Khi Renter gọi `verify_results` với `is_accepted = false`.
            2.  **Provider không nộp kết quả đúng hạn:** (Cần triển khai) Khi `submission_deadline` của job đã qua mà Provider chưa nộp kết quả.
    - **Bước 3: Áp dụng hình phạt "Treo giò" động:**
        - Khi một Provider thất bại, chương trình sẽ tự động tính toán thời gian cấm và cập nhật trường `banned_until`.
        - **Công thức tính thời gian cấm:** `ban_duration = (THỜI_GIAN_CƠ_BẢN * jobs_failed) / (jobs_completed + jobs_failed)`
        - Công thức này đảm bảo hình phạt công bằng, dựa trên tỷ lệ thất bại chứ không phải số lần thất bại tuyệt đối. Phép tính sẽ được thực hiện an toàn on-chain.
    - **Bước 4: Kiểm tra hình phạt:**
        - Trong hàm `accept_job`, chương trình sẽ thêm một bước kiểm tra: `require!(Clock::get()?.unix_timestamp > provider.banned_until, "Provider is currently banned")`.

- **Lợi ích:**
    - **Đơn giản cho Renter:** Quy trình tạo job không thay đổi.
    - **Công bằng cho Provider:** Hình phạt dựa trên tỷ lệ, ưu ái các provider có lịch sử làm việc tốt.
    - **Tự động & Minh bạch:** Cơ chế phạt được thực thi hoàn toàn on-chain.

### 2. Cơ chế Stake và Phạt (Staking and Slashing)

- **Ý tưởng:** Yêu cầu các Provider phải "stake" (ký gửi) một lượng tài sản (ví dụ: USDC, SOL) như một khoản đặt cọc để đảm bảo cho hành vi tốt của họ.
- **Cách hoạt động:**
    - Provider phải gửi một lượng token vào một tài khoản escrow do chương trình quản lý trước khi có thể đăng ký hoặc nhận việc.
    - Nếu Provider có hành vi gian lận (ví dụ: gửi kết quả sai, offline đột ngột), một phần hoặc toàn bộ số tiền stake của họ sẽ bị "slashed" (phạt).
    - Số tiền phạt có thể được dùng để bồi thường cho Renter hoặc được chuyển vào kho bạc (treasury) của giao thức.
- **Lợi ích:** Tạo ra một rào cản kinh tế mạnh mẽ chống lại các hành vi phá hoại, tăng cường an ninh và niềm tin cho toàn mạng lưới.

### 3. Hệ thống Tranh chấp (Dispute System)

- **Vấn đề:** Cơ chế `claim_payment` hiện tại tiềm ẩn rủi ro cho Renter nếu họ offline. Provider có thể claim tiền thưởng ngay cả khi kết quả sai. Hệ thống này sẽ giải quyết vấn đề đó.
- **Ý tưởng:** Thay vì cho phép Provider tự động claim tiền, một cơ chế tranh chấp sẽ được đưa vào để tăng cường sự công bằng.
- **Cách hoạt động:**
    1.  **Mở Tranh chấp:** Nếu Renter không hài lòng với kết quả (`verify_results(false)`), thay vì chỉ reset job, họ có thể đặt cọc một khoản tiền nhỏ để chuyển job sang trạng thái `InDispute`.
    2.  **Phân xử:** Một bên thứ ba được tin tưởng (trong giai đoạn đầu) hoặc một hội đồng phi tập trung (trong tương lai) sẽ được chỉ định để xem xét kết quả và quyết định ai là người đúng.
    3.  **Phân phối lại tiền:** Dựa trên kết quả phân xử, tiền trong escrow (và cả tiền đặt cọc) sẽ được chuyển cho bên thắng cuộc.
- **Lợi ích:** Bảo vệ Renter khỏi các hành vi gian lận, tạo ra một cơ chế giải quyết mâu thuẫn minh bạch và công bằng, tăng cường niềm tin vào toàn bộ mạng lưới.

### 4. Các cơ chế khác

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

---

## Mở rộng Các Loại Job (Extending Job Types)

Sau khi phiên bản hỗ trợ Docker được triển khai thành công, hệ thống có thể được mở rộng để hỗ trợ thêm nhiều loại công việc khác, giúp tăng tính đa dụng và thu hút các nhóm người dùng chuyên biệt.

### 1. Hỗ trợ Thực thi WebAssembly (WASM)

- **Ý tưởng:** Cho phép Renter gửi các tác vụ dưới dạng module WebAssembly (`.wasm`).
- **Cách hoạt động:**
    - Thêm một biến thể `Wasm` vào `enum ExecutionEngine`.
    - Provider sẽ sử dụng một WASM runtime (như Wasmer hoặc Wasmtime) để thực thi các job này trong một môi trường sandbox cực kỳ an toàn và nhẹ.
- **Lợi ích:**
    - **An toàn hơn:** WASM có mô hình bảo mật chặt chẽ, giới hạn quyền truy cập vào hệ thống của Provider.
    - **Hiệu năng cao:** Gần với tốc độ thực thi native, phù hợp cho các tác vụ tính toán nặng.
    - **Di động:** Một file `.wasm` có thể chạy trên mọi hệ điều hành mà không cần thay đổi.

### 2. Hỗ trợ Tác vụ cho Ứng dụng Cụ thể

- **Ý tưởng:** Hỗ trợ các job không phải là code thực thi mà là file dữ liệu cho các phần mềm phổ biến.
- **Cách hoạt động:**
    - Thêm các biến thể mới vào `ExecutionEngine`, ví dụ: `Blender { version: String }` hoặc `LLMInference { model: String }`.
    - Provider chuyên biệt sẽ cài đặt sẵn các phần mềm này (ví dụ: Blender 4.1) và chỉ lắng nghe các job tương ứng.
- **Lợi ích:**
    - **Dễ sử dụng cho Renter:** Người dùng trong các lĩnh vực (như 3D artists) không cần biết về Docker, họ chỉ cần tải lên file `.blend` của mình.
    - **Tạo thị trường ngách:** Thu hút các cộng đồng người dùng và provider chuyên biệt, ví dụ: các dàn máy render farm.

### 3. Mở rộng Metadata Chi tiết

- **Ý tưởng:** Bổ sung thêm các trường metadata chi tiết hơn vào `JobAccount` để thuật toán matching hoạt động thông minh hơn.
- **Các trường tiềm năng:**
    - `required_cpu_cores: u16`
    - `required_ram_gb: u16`
    - `required_storage_gb: u16`
    - `cpu_arch: String` (ví dụ: "x86_64", "arm64")
- **Lợi ích:** Giúp Renter chỉ định chính xác yêu cầu phần cứng, và Provider chỉ nhận những job mà mình chắc chắn đáp ứng được, giảm tỷ lệ thất bại.