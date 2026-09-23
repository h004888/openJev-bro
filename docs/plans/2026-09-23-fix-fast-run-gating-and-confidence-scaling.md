# Sửa lỗi Gating Escalation và Cân chỉnh Confidence Head khi có nhiều Candidates ($k \ge 15$) — Kế hoạch triển khai (TDD-first)

**Mục tiêu:** Khắc phục triệt để lỗi rơi rụng tham số `confidenceThreshold` trong `jev_fast_run`, đồng thời tối ưu hóa thuật toán tính Confidence Head và tách biệt Logits trong `JevEngine` khi có nhiều ứng viên ($k \ge 15$) để tự động click chính xác các bài viết mục tiêu mà không bị dừng oan.

**Cách tiếp cận:** Cập nhật công thức tính độ tin cậy của Confidence Head dựa trên tỷ lệ vượt trội so với phân phối ngẫu nhiên ($p_{\text{top}} / (1/k)$) và khoảng cách biên (Margin), nâng cao trọng số nhận diện từ khóa chuyên biệt (AI, GPT, LLM). Cho phép truyền xuyên suốt `confidenceThreshold` từ MCP tool parameters vào `FastLoopController.runPlan` và `executeStep`.

**Đã tra cứu codebase (codebase-memory-mcp):**
- `search_code`: Xác nhận `handleFastRun` trong `src/mcp_server.ts` nhận `params.confidenceThreshold` nhưng không chuyển tiếp vào `fastLoopController.runPlan`.
- `get_code_snippet`: Xác nhận `src/fast_loop_controller.ts` tại dòng 73 chỉ đọc `this.config.confidenceThreshold` mặc định là `0.85`.
- `get_code_snippet`: Xác nhận `src/jev_engine.ts` tại dòng 135 có công thức entropy $H / \log(k)$ làm giảm điểm confidence khi số lượng ứng viên $k=15$.

**Framework test & quy ước (đã xác nhận qua codebase-memory-mcp):**
- Framework: Node.js Test Runner kết hợp `tsx`
- Vị trí đặt file test: `tests/*.test.ts`
- Lệnh chạy test: `npm test`

## Ràng buộc chung (Global Constraints)

- Mọi task viết/sửa hành vi code phải theo chu trình Red → Green → Refactor.
- Không có task nào được đánh dấu hoàn tất nếu thiếu test tự động tương ứng và log xác nhận PASS.
- Đảm bảo khi một ứng viên có xác suất vượt trội gấp 3 lần mức ngẫu nhiên ($1/k$) thì Confidence Score đạt $\ge 0.85$.
- Tham số `confidenceThreshold` truyền vào tool MCP phải được tôn trọng tuyệt đối ở mọi tầng gọi hàm.

---

### Task 1: Cải tiến JevEngine Confidence Head và Logit Separation khi có nhiều Candidates ($k \ge 15$)

**Đối tượng liên quan (đã xác nhận qua codebase-memory-mcp):**
- Tạo mới: `tests/jev_engine_scaling.test.ts`
- Chỉnh sửa: `src/jev_engine.ts`
- Test tương ứng: `tests/jev_engine_scaling.test.ts`
- Kiểm chứng bằng: `npm test`

**Ảnh hưởng liên quan (từ trace_path / detect_changes):**
- Được gọi bởi: `src/fast_loop_controller.ts`, `src/mcp_server.ts`
- Gọi tới: `src/types.ts`
- Regression test cần chạy thêm do có inbound calls: `tests/jev_engine.test.ts`

**Giao diện/Kết nối với các task khác:**
- Nhận đầu vào từ: `JevDecisionRequest` chứa 15 candidates và mục tiêu tìm kiếm AI
- Cung cấp đầu ra cho: `JevDecisionResult` có `confidenceScore >= 0.85` và `topProbability >= 0.4` khi có ứng viên khớp rõ ràng

- [ ] **Bước 1 [RED]: Viết test cho trường hợp 15 candidates với 1 bài viết AI vượt trội để kiểm tra confidence >= 0.85**
  Vị trí file test: `tests/jev_engine_scaling.test.ts`
  Test case: Gửi request với 15 candidates (14 bài viết ngẫu nhiên và 1 bài 'GPT-6 Sol and Luna') với goal 'Click the first article link about AI, LLM, GPT'. Xác nhận chọn đúng candidate 'GPT-6' và `confidenceScore >= 0.85` (không bị tụt xuống 0.12).
  Kỳ vọng: chạy `npm test` → FAIL với lý do `AssertionError: Confidence score should be >= 0.85`, không fail vì lỗi cú pháp.
- [ ] **Bước 2 [GREEN]: Cải tiến công thức tính Logit và Confidence Head trong src/jev_engine.ts để test ở Bước 1 PASS**
  Kỳ vọng: chạy `npm test` → PASS.
- [ ] **Bước 3 [REFACTOR] (nếu cần): Tinh chỉnh hệ số tỷ lệ vượt trội ngẫu nhiên (Signal-to-Noise Ratio) trong Confidence Head**
  Kỳ vọng: chạy `npm test` → vẫn PASS, hành vi không đổi.
- [ ] **Bước 4: Xác nhận hoàn tất task**
  Cách kiểm tra: chạy toàn bộ test liên quan tới task (`npm test`)
  Kết quả mong đợi: tất cả PASS.

---

### Task 2: Sửa lỗi Parameter Dropping truyền `confidenceThreshold` xuyên suốt `runPlan` và `executeStep`

**Đối tượng liên quan (đã xác nhận qua codebase-memory-mcp):**
- Tạo mới: `tests/fast_loop_threshold_passthrough.test.ts`
- Chỉnh sửa: `src/fast_loop_controller.ts`, `src/mcp_server.ts`
- Test tương ứng: `tests/fast_loop_threshold_passthrough.test.ts`
- Kiểm chứng bằng: `npm test`

**Ảnh hưởng liên quan (từ trace_path / detect_changes):**
- Được gọi bởi: `handleFastRun` trong `src/mcp_server.ts`
- Gọi tới: `src/jev_engine.ts`
- Regression test cần chạy thêm do có inbound calls: `tests/fast_loop_controller.test.ts`

**Giao diện/Kết nối với các task khác:**
- Nhận đầu vào từ: `params.confidenceThreshold` (ví dụ 0.5 hoặc 0.6)
- Cung cấp đầu ra cho: `FastLoopController` áp dụng đúng ngưỡng threshold được truyền thay vì ép về 0.85

- [ ] **Bước 1 [RED]: Viết test kiểm tra FastLoopController tôn trọng override threshold truyền vào runPlan**
  Vị trí file test: `tests/fast_loop_threshold_passthrough.test.ts`
  Test case: Chạy `runPlan` với plan có bước đạt confidence 0.7. Nếu gọi với `confidenceThreshold: 0.5` thì phải trả về `status: auto_executed` (không được escalate về 0.85).
  Kỳ vọng: chạy `npm test` → FAIL với lý do `status` trả về `escalated` do threshold bị ghi đè, không fail vì lỗi cú pháp.
- [ ] **Bước 2 [GREEN]: Cập nhật src/fast_loop_controller.ts và src/mcp_server.ts để truyền xuyên suốt confidenceThreshold để test ở Bước 1 PASS**
  Kỳ vọng: chạy `npm test` → PASS.
- [ ] **Bước 3 [REFACTOR] (nếu cần): Chuẩn hóa giá trị mặc định confidenceThreshold tại một điểm duy nhất trong GatingConfig**
  Kỳ vọng: chạy `npm test` → vẫn PASS, hành vi không đổi.
- [ ] **Bước 4: Xác nhận hoàn tất task**
  Cách kiểm tra: chạy toàn bộ test liên quan tới task (`npm test`)
  Kết quả mong đợi: tất cả PASS.

---

### Task 3: Kiểm thử hồi quy toàn trình E2E trên trang mô phỏng Hacker News (15 Links)

**Đối tượng liên quan (đã xác nhận qua codebase-memory-mcp):**
- Tạo mới: `tests/e2e_hackernews_simulation.test.ts`
- Chỉnh sửa: `package.json`
- Test tương ứng: `tests/e2e_hackernews_simulation.test.ts`
- Kiểm chứng bằng: `npm test`

**Ảnh hưởng liên quan (từ trace_path / detect_changes):**
- Được gọi bởi: Toàn bộ suite test
- Gọi tới: `src/mcp_server.ts`, `src/browser_manager.ts`, `src/fast_loop_controller.ts`
- Regression test cần chạy thêm do có inbound calls: toàn bộ suite test

**Giao diện/Kết nối với các task khác:**
- Nhận đầu vào từ: Lệnh gọi `jev_fast_run` trên trang HTML mô phỏng chính xác cấu trúc Hacker News gồm 15 bài viết
- Cung cấp đầu ra cho: Tự động click thành công vào bài viết AI 'GPT-6 Sol and Luna' và chuyển trạng thái trang sang đọc bài viết

- [ ] **Bước 1 [RED]: Viết test E2E mô phỏng bài toán Hacker News của người dùng với 15 links**
  Vị trí file test: `tests/e2e_hackernews_simulation.test.ts`
  Test case: Tạo trang mock 15 links giống Hacker News, gọi `handleToolCall('jev_fast_run', { macroGoal: '...', steps: [{ goal: 'Click the first article link about AI, LLM, GPT', actionType: 'click' }] })`. Xác nhận `successfulSteps === 1`, `escalatedSteps === 0`, và link bài viết GPT được click.
  Kỳ vọng: chạy `npm test` → FAIL nếu hệ thống chưa hoàn thiện Task 1 và Task 2, không fail vì lỗi cú pháp.
- [ ] **Bước 2 [GREEN]: Hoàn thiện toàn bộ mã nguồn để test ở Bước 1 PASS**
  Kỳ vọng: chạy `npm test` → PASS.
- [ ] **Bước 3 [REFACTOR] (nếu cần): Tối ưu hóa log chẩn đoán lỗi trong StepExecutionResult**
  Kỳ vọng: chạy `npm test` → vẫn PASS, hành vi không đổi.
- [ ] **Bước 4: Xác nhận hoàn tất task**
  Cách kiểm tra: chạy toàn bộ test liên quan tới task (`npm test`)
  Kết quả mong đợi: tất cả PASS.
