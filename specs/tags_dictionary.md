# Từ điển Tags cho NodeLink

Tài liệu này định nghĩa bộ từ vựng chung cho `job_tags` và `hardware_tags` để đảm bảo tính nhất quán trên toàn hệ thống.

--- 

## Quy tắc đặt tên

- Dùng chữ thường, không dấu.
- Dùng dấu gạch dưới `_` để ngăn cách các từ.
- (Tùy chọn) Có thể thêm tiền tố `category:` để tăng độ rõ ràng, ví dụ: `job_type:ai_training`.

--- 

## Job Tags (Mô tả công việc)

### Loại công việc (Job Type)
*   `ai_training`
*   `ai_inference`
*   `3d_rendering`
*   `data_analysis`
*   `video_transcoding`
*   `simulation`

### Phần mềm (Software)
*   `pytorch`
*   `tensorflow`
*   `blender`
*   `cycles`
*   `pandas`

---

## Hardware Tags (Yêu cầu phần cứng)

### GPU
*   `gpu` (Yêu cầu có GPU bất kỳ)
*   `gpu_vram_8gb`
*   `gpu_vram_12gb`
*   `gpu_vram_16gb`
*   `gpu_vram_24gb`

### CPU
*   `cpu_multicore` (Yêu cầu CPU có nhiều hơn 4 nhân)

### RAM
*   `ram_16gb`
*   `ram_32gb`
*   `ram_64gb`

### Lưu trữ (Storage)
*   `storage_ssd`
*   `storage_nvme`