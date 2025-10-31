Slide 1: Trang bìa
   * Nội dung:
       * Logo dự án (tôi sẽ đề xuất một concept placeholder).
       * Tên dự án: Compute Share
       * Tagline: The Global Computing Marketplace (Thị trường Tính toán Toàn cầu).
       * Tên của bạn & Chức danh (ví dụ: Founder & Lead Architect).

  Slide 2: Vấn đề: Tài sản bị lãng quên
   * Mục tiêu: Nhấn mạnh hai vấn đề song song: sự lãng phí tài nguyên và chi phí cao.
   * Nội dung:
       * Tiêu đề: "Hai mặt của một vấn đề: Sự lãng phí và Chi phí."
       * Luận điểm 1 (Provider): "Phần cứng của bạn là một tài sản đang mất giá. Hàng tỷ máy tính mạnh mẽ trên toàn cầu đang 'ngủ đông' và không tạo ra giá trị."
       * Luận điểm 2 (Renter): "Đám mây là một khu vườn có tường bao đắt đỏ. Bạn đang trả một khoản phí bảo hiểm cho các dịch vụ tập trung và kém hiệu quả."

  Slide 3: Giải pháp: Giới thiệu Compute Share
   * Mục tiêu: Trình bày Compute Share như một giải pháp cho cả hai vấn đề.
   * Nội dung:
       * Tiêu đề: "Compute Share: Biến tài sản nhàn rỗi thành thu nhập thụ động."
       * Tuyên bố cốt lõi: "Compute Share là một giao thức cho phép bất kỳ ai cũng có thể cho thuê chu kỳ CPU/GPU không sử dụng của mình một cách an toàn và dễ dàng, tạo ra một thị trường tính toán toàn cầu thực sự hiệu quả và dễ tiếp cận."
       * Hình ảnh: Một sơ đồ đơn giản thể hiện "Providers" (Người cho thuê) ở một bên, "Renters" (Người thuê) ở bên kia, với "Giao thức Compute Share" ở giữa, được vận hành bởi blockchain Solana.

  Slide 4: Cách hoạt động: Đơn giản, An toàn, Tự động
   * Mục tiêu: "Giải mã" công nghệ, giúp người nghe hiểu và tin tưởng. Dựa trên specs/plan.md.
   * Nội dung: Một quy trình 4 bước trực quan:
       1. Đóng gói & Gửi (Renter): Một lập trình viên đóng gói tác vụ (ví dụ: module Wasm) và
          định nghĩa yêu cầu (ví dụ: gpu_vram_16gb). Client của Compute Share tải nó lên IPFS.
       2. Ghép nối & Chấp nhận (Provider): Node của Provider, chạy nền, tự động phát hiện job phù
           hợp thông qua các "tags" on-chain và chấp nhận.
       3. Thực thi trong Sandbox (Provider): Job được chạy an toàn trong một sandbox Wasm.
          Provider được bảo vệ, và Renter được đảm bảo một môi trường chuẩn.
       4. Xác minh & Thanh toán (Renter): CID của kết quả được đăng lên on-chain. Renter xác minh
           kết quả và duyệt thanh toán, khoản tiền sẽ được giải phóng từ escrow on-chain.

  Slide 5: Cấu trúc của một Job: An toàn & Tự động hóa
   * Mục tiêu: Giải thích sâu hơn về cách một "job" được cấu trúc để đảm bảo an toàn và khả năng tự động hóa.
   * Nội dung:
       * Tiêu đề: "Mỗi Job là một 'Container' độc lập."
       * Hình ảnh: Một biểu đồ trực quan thể hiện một thư mục (Job Package) được tải lên IPFS. Bên trong thư mục đó có 3 thành phần:
           1.  **File thực thi (`main.wasm`):** "Bộ não" của tác vụ.
           2.  **Dữ liệu đầu vào (`input.json`):** "Nguyên liệu" cho tác vụ.
           3.  **Bản kê khai (`manifest.json`):** "Bảng hướng dẫn & Hợp đồng bảo mật".
       * Giải thích `manifest.json`:
           *   `"executable": "main.wasm"` -> Lệnh cho Provider biết file nào cần chạy.
           *   `"output_path": "results/"` -> Chỉ định nơi lưu kết quả, giới hạn quyền ghi của tác vụ.
           *   **Tại sao lại cần thiết?**
               *   **An toàn:** `manifest.json` định nghĩa một "hộp cát" (sandbox), ngăn chặn mã độc truy cập vào máy của Provider.
               *   **Tự động hóa:** Một định dạng chuẩn cho phép hàng nghìn node tự động hiểu và thực thi bất kỳ job nào mà không cần can thiệp thủ công.

  Slide 6: Cuộc cách mạng "Set It and Forget It" (Dành cho Provider)
   * Mục tiêu: Nhấn mạnh giá trị cốt lõi cho phía cung cấp tài nguyên. Dựa trên
     specs/constitution.md.
   * Nội dung:
       * Tiêu đề: "Biến Phần cứng Nhàn rỗi thành Thu nhập Thụ động."
       * Hình ảnh: So sánh song song:
           * "Cách cũ (Đào coin)": Cài đặt phức tạp, cần phần cứng chuyên dụng (ASIC), chi phí
             điện năng cao, lo ngại về môi trường.
           * "Cách của Compute Share": Chỉ một dòng lệnh đơn giản (./compute-share listen), sử dụng bất kỳ
              phần cứng nào có sẵn (CPU/GPU), chỉ chạy khi máy rảnh, xanh & hiệu quả.
       * Trích dẫn: "Nếu bạn có một chiếc PC gaming, bạn đã có một node Compute Share."
vấn đề về chi phí của provider: tiền điện

  Slide 7: Thị trường: Cơ hội nghìn tỷ đô
   * Mục tiêu: Cho thấy tầm vóc và tham vọng của dự án.
   * Nội dung:
       * TAM (Thị trường có thể giải quyết): Thị trường Điện toán đám mây toàn cầu (~600 tỷ USD
         năm 2023, và đang tăng trưởng).
       * SAM (Thị trường có thể phục vụ): Thị trường cho xử lý theo lô (batch processing), huấn
         luyện AI/ML, và rendering (~150 tỷ USD). Đây là các tác vụ không yêu cầu độ trễ
         mili-giây, hoàn hảo cho mạng phi tập trung.
       * SOM (Thị trường có thể đạt được): "Mục tiêu ban đầu của chúng tôi là chiếm 1% thị
         trường ngách dành cho các nghệ sĩ 3D và lập trình viên AI độc lập, tương đương cơ hội
         hơn 100 triệu USD." (Sử dụng các tags từ specs/tags_dictionary.md làm ví dụ: blender,
         ai_inference).

  Slide 8: Thành tựu (Traction): Từ Ý tưởng đến Giao thức Hoạt động
   * Mục tiêu: Chứng minh năng lực thực thi của bạn. Dựa trên specs/tasks.md.
   * Nội dung: Một timeline thể hiện những gì đã đạt được:
       * Giai đoạn 1: Hoàn thành Lõi On-chain: Smart contract cho registry, job, escrow đã hoàn
         thiện và được kiểm thử.
       * Giai đoạn 2: Hoàn thành Provider CLI: Xây dựng daemon có thể tự động nhận và xử lý job.
       * Giai đoạn 3: Hoàn thành Hệ thống Uy tín: Cơ chế phạt và ghi nhận thành tích đã được
         implement on-chain.
       * Giai đoạn 4: Hoàn thành Engine Wasm: Đã demo thành công một luồng job Wasm end-to-end.
         (Đây là một cột mốc kỹ thuật cực kỳ quan trọng và đáng giá).
