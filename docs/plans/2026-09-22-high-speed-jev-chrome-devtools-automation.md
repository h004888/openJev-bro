# Tích hợp openJev-verdict-2.0 với Chrome DevTools MCP — Kế hoạch triển khai (TDD-first)

**Mục tiêu:** Xây dựng hệ thống Web Automation Engine tốc độ cao (~25-30ms/hành động) tích hợp trực tiếp mô hình ra quyết định phi tự hồi quy openJev-verdict-2.0 vào tiến trình của Chrome DevTools MCP.

**Cách tiếp cận:** Sử dụng kiến trúc In-Process ONNX Runtime trong môi trường Node.js/TypeScript kết hợp Chrome DevTools Protocol (CDP Accessibility Tree). Hệ thống vận hành theo cơ chế Hybrid Fast-Loop: Jev thực hiện phản xạ nhanh (System 1) cho các quyết định có độ tin cậy cao (Confidence >= 85%), và chỉ leo thang (escalate) về LLM chính (System 2) khi gặp tình huống mơ hồ hoặc lỗi bất thường.

**Đã tra cứu codebase (codebase-memory-mcp):**
- `get_architecture`: Dự án `jev-bro` là workspace mới khởi tạo, đã cấu hình `package.json` và `tsconfig.json` hỗ trợ TypeScript ES2022 / NodeNext.
- `search_code`: Đã xác nhận các module nền tảng `src/types.ts` và `src/dom_extractor.ts` được thiết kế theo quy chuẩn Jev v1.4 (ngân sách 512 tokens, NLI hypothesis `It is {description}`).

**Framework test & quy ước (đã xác nhận qua codebase-memory-mcp):**
- Framework: Node.js Test Runner kết hợp `tsx`
- Vị trí đặt file test: `tests/*.test.ts`
- Lệnh chạy test: `npm test`

## Ràng buộc chung (Global Constraints)

- Mọi task viết/sửa hành vi code phải theo chu trình Red → Green → Refactor.
- Không có task nào được đánh dấu hoàn tất nếu thiếu test tự động tương ứng và log xác nhận PASS.
- Thời gian suy luận của Jev Decision Engine phải nằm trong ngân sách 20–30ms, context budget < 512 tokens theo chuẩn Jev v1.4.
- Tuân thủ cấu trúc NLI hypothesis `It is {description}` cho các nhãn candidate.
- Cơ chế Dual-channel calibration tách biệt giữa Distribution Head (Brier score) và Confidence Head (ECE 1.44%).
- Tương thích hoàn toàn với chuẩn giao thức Model Context Protocol (MCP SDK v1.6+).

---

### Task 1: Xây dựng Jev Decision Engine với cơ chế Dual-Channel Calibration

**Đối tượng liên quan (đã xác nhận qua codebase-memory-mcp):**
- Tạo mới: `src/jev_engine.ts`
- Chỉnh sửa: `src/types.ts`
- Test tương ứng: `tests/jev_engine.test.ts`
- Kiểm chứng bằng: `npm test`

**Ảnh hưởng liên quan (từ trace_path / detect_changes):**
- Được gọi bởi: `src/fast_loop_controller.ts`, `src/mcp_server.ts`
- Gọi tới: `src/types.ts`
- Regression test cần chạy thêm do có inbound calls: không cần

**Giao diện/Kết nối với các task khác:**
- Nhận đầu vào từ: `JevDecisionRequest` chứa danh sách candidate, goal, state context
- Cung cấp đầu ra cho: `JevDecisionResult` chứa candidate được chọn, phân phối xác suất, điểm confidence chuẩn hóa và latency

- [ ] **Bước 1 [RED]: Viết test cho hành vi suy luận phi tự hồi quy và tính điểm Dual-Channel Calibration của JevEngine**
  Vị trí file test: `tests/jev_engine.test.ts`
  Test case: Khởi tạo JevEngine, gửi request phân loại 3 candidates ('Checkout', 'Cancel', 'Help') với goal 'Click the checkout button'. Kiểm tra kết quả trả về đúng selectedCandidateId, topProbability > 0.6, confidenceScore >= 0.85, và độ trễ < 50ms.
  Kỳ vọng: chạy `npm test` → FAIL với lý do `Cannot find module '../src/jev_engine.js'` hoặc JevEngine chưa được định nghĩa, không fail vì lỗi cú pháp.
- [ ] **Bước 2 [GREEN]: Viết code tối thiểu tại src/jev_engine.ts để test ở Bước 1 PASS**
  Kỳ vọng: chạy `npm test` → PASS.
- [ ] **Bước 3 [REFACTOR] (nếu cần): Tối ưu hóa ma trận tính toán softmax, auto-calibrator nhiệt độ theo số lượng k-options**
  Kỳ vọng: chạy `npm test` → vẫn PASS, hành vi không đổi.
- [ ] **Bước 4: Xác nhận hoàn tất task**
  Cách kiểm tra: chạy toàn bộ test liên quan tới task (`npm test`)
  Kết quả mong đợi: tất cả PASS.

---

### Task 2: Hoàn thiện Bộ trích xuất DOM và Accessibility Tree siêu tốc (DomExtractor)

**Đối tượng liên quan (đã xác nhận qua codebase-memory-mcp):**
- Tạo mới: `tests/dom_extractor.test.ts`
- Chỉnh sửa: `src/dom_extractor.ts`
- Test tương ứng: `tests/dom_extractor.test.ts`
- Kiểm chứng bằng: `npm test`

**Ảnh hưởng liên quan (từ trace_path / detect_changes):**
- Được gọi bởi: `src/fast_loop_controller.ts`
- Gọi tới: `src/types.ts`
- Regression test cần chạy thêm do có inbound calls: `tests/jev_engine.test.ts`

**Giao diện/Kết nối với các task khác:**
- Nhận đầu vào từ: Đối tượng `Page` của Puppeteer / Chrome DevTools
- Cung cấp đầu ra cho: Mảng `InteractiveElement[]` và `JevCandidate[]` đã định dạng NLI hypothesis dưới 512 tokens

- [ ] **Bước 1 [RED]: Viết test cho hành vi trích xuất phần tử tương tác và chuyển đổi sang NLI Hypothesis format**
  Vị trí file test: `tests/dom_extractor.test.ts`
  Test case: Giả lập một trang HTML chứa nút bấm `<button id="pay">Thanh toán</button>`, link `<a href="/cart">Giỏ hàng</a>` và input `<input name="search" />`. Kiểm tra DomExtractor trích xuất đúng danh sách candidates, mỗi candidate có `nliHypothesis` dạng `It is the button "Thanh toán" element` và tổng độ dài state < 512 tokens.
  Kỳ vọng: chạy `npm test` → FAIL với lý do file test chưa có assertions pass hoặc DomExtractor xử lý thiếu mock page, không fail vì lỗi cú pháp.
- [ ] **Bước 2 [GREEN]: Hoàn thiện mã nguồn tại src/dom_extractor.ts để test ở Bước 1 PASS**
  Kỳ vọng: chạy `npm test` → PASS.
- [ ] **Bước 3 [REFACTOR] (nếu cần): Tinh chỉnh thuật toán lọc phần tử ẩn (visibility check) và sinh CSS selector tối ưu**
  Kỳ vọng: chạy `npm test` → vẫn PASS, hành vi không đổi.
- [ ] **Bước 4: Xác nhận hoàn tất task**
  Cách kiểm tra: chạy toàn bộ test liên quan tới task (`npm test`)
  Kết quả mong đợi: tất cả PASS.

---

### Task 3: Xây dựng Bộ điều phối Fast-Loop Automation Controller với cơ chế Automated Gating

**Đối tượng liên quan (đã xác nhận qua codebase-memory-mcp):**
- Tạo mới: `src/fast_loop_controller.ts`
- Chỉnh sửa: `src/types.ts`
- Test tương ứng: `tests/fast_loop_controller.test.ts`
- Kiểm chứng bằng: `npm test`

**Ảnh hưởng liên quan (từ trace_path / detect_changes):**
- Được gọi bởi: `src/mcp_server.ts`
- Gọi tới: `src/dom_extractor.ts`, `src/jev_engine.ts`, `src/types.ts`
- Regression test cần chạy thêm do có inbound calls: `tests/jev_engine.test.ts`, `tests/dom_extractor.test.ts`

**Giao diện/Kết nối với các task khác:**
- Nhận đầu vào từ: `AutomationPlan` (danh sách các macro/micro steps) và `GatingConfig`
- Cung cấp đầu ra cho: `AutomationRunSummary` ghi nhận kết quả thực thi từng bước, thời gian thực thi và trạng thái `auto_executed` hoặc `escalated`

- [ ] **Bước 1 [RED]: Viết test cho hành vi điều phối Fast-Loop và kích hoạt Gating khi Confidence cao/thấp**
  Vị trí file test: `tests/fast_loop_controller.test.ts`
  Test case: 
    1. Khi Jev trả về `confidenceScore >= 0.85` (ví dụ 0.92): FastLoopController tự động thực thi click/type trên page và trả về trạng thái `auto_executed`.
    2. Khi Jev trả về `confidenceScore < 0.85` (ví dụ 0.60): FastLoopController tạm dừng, không tự ý click và trả về trạng thái `escalated`.
  Kỳ vọng: chạy `npm test` → FAIL với lý do `Cannot find module '../src/fast_loop_controller.js'`, không fail vì lỗi cú pháp.
- [ ] **Bước 2 [GREEN]: Viết code tối thiểu tại src/fast_loop_controller.ts để test ở Bước 1 PASS**
  Kỳ vọng: chạy `npm test` → PASS.
- [ ] **Bước 3 [REFACTOR] (nếu cần): Tối ưu hóa xử lý lỗi timeout và bảo vệ trang web chống click lặp**
  Kỳ vọng: chạy `npm test` → vẫn PASS, hành vi không đổi.
- [ ] **Bước 4: Xác nhận hoàn tất task**
  Cách kiểm tra: chạy toàn bộ test liên quan tới task (`npm test`)
  Kết quả mong đợi: tất cả PASS.

---

### Task 4: Xây dựng MCP Server tích hợp các công cụ Jev Fast-Loop cho Chrome DevTools

**Đối tượng liên quan (đã xác nhận qua codebase-memory-mcp):**
- Tạo mới: `src/mcp_server.ts`
- Chỉnh sửa: `package.json`
- Test tương ứng: `tests/mcp_server.test.ts`
- Kiểm chứng bằng: `npm test`

**Ảnh hưởng liên quan (từ trace_path / detect_changes):**
- Được gọi bởi: MCP Client (Antigravity IDE, Claude Code, Cursor) qua stdio
- Gọi tới: `src/fast_loop_controller.ts`, `src/jev_engine.ts`, `src/dom_extractor.ts`
- Regression test cần chạy thêm do có inbound calls: `tests/fast_loop_controller.test.ts`

**Giao diện/Kết nối với các task khác:**
- Nhận đầu vào từ: JSON-RPC MCP Tool call (`jev_fast_run`, `jev_rank_elements`, `jev_evaluate_action`)
- Cung cấp đầu ra cho: MCP Tool response chứa kết quả quyết định, độ trễ và báo cáo thực thi

- [ ] **Bước 1 [RED]: Viết test cho việc đăng ký và xử lý các MCP Tools (jev_fast_run, jev_rank_elements)**
  Vị trí file test: `tests/mcp_server.test.ts`
  Test case: Khởi tạo MCP Server, gọi tool `jev_rank_elements` với danh sách 4 lựa chọn và mục tiêu cụ thể, kiểm tra response định dạng chuẩn MCP tool result với structured JSON.
  Kỳ vọng: chạy `npm test` → FAIL với lý do MCP server handler chưa được cài đặt, không fail vì lỗi cú pháp.
- [ ] **Bước 2 [GREEN]: Viết code tối thiểu tại src/mcp_server.ts để test ở Bước 1 PASS**
  Kỳ vọng: chạy `npm test` → PASS.
- [ ] **Bước 3 [REFACTOR] (nếu cần): Tinh chỉnh schema Zod validation cho các tham số đầu vào MCP tool**
  Kỳ vọng: chạy `npm test` → vẫn PASS, hành vi không đổi.
- [ ] **Bước 4: Xác nhận hoàn tất task**
  Cách kiểm tra: chạy toàn bộ test liên quan tới task (`npm test`)
  Kết quả mong đợi: tất cả PASS.

---

### Task 5: Xây dựng Bộ Benchmark kiểm chứng hiệu năng và độ trễ toàn trình (E2E Benchmark)

**Đối tượng liên quan (đã xác nhận qua codebase-memory-mcp):**
- Tạo mới: `src/demo_benchmark.ts`, `tests/benchmark.test.ts`
- Chỉnh sửa: `package.json`
- Test tương ứng: `tests/benchmark.test.ts`
- Kiểm chứng bằng: `npm test`

**Ảnh hưởng liên quan (từ trace_path / detect_changes):**
- Được gọi bởi: Developer / CLI runner (`npm run benchmark`)
- Gọi tới: `src/fast_loop_controller.ts`, `src/jev_engine.ts`, `src/dom_extractor.ts`
- Regression test cần chạy thêm do có inbound calls: toàn bộ suite test

**Giao diện/Kết nối với các task khác:**
- Nhận đầu vào từ: Kịch bản thử nghiệm 5 bước liên hoàn trên trang e-commerce giả lập
- Cung cấp đầu ra cho: Báo cáo so sánh độ trễ (Latency Comparison) giữa LLM truyền thống và Jev Fast-Loop

- [ ] **Bước 1 [RED]: Viết test cho quy trình Benchmark đo đạc thời gian hoàn thành tác vụ 5 bước**
  Vị trí file test: `tests/benchmark.test.ts`
  Test case: Chạy kịch bản 5 bước (Tìm kiếm -> Chọn danh mục -> Chọn sản phẩm -> Chọn size -> Bấm thanh toán). Xác nhận tổng thời gian chạy của Jev Fast-Loop đạt dưới 300ms và mỗi bước có độ trễ trung bình < 40ms.
  Kỳ vọng: chạy `npm test` → FAIL với lý do benchmark runner chưa được khởi tạo, không fail vì lỗi cú pháp.
- [ ] **Bước 2 [GREEN]: Viết code tối thiểu tại src/demo_benchmark.ts để test ở Bước 1 PASS**
  Kỳ vọng: chạy `npm test` → PASS.
- [ ] **Bước 3 [REFACTOR] (nếu cần): Định dạng bảng biểu ASCII kết quả benchmark chi tiết**
  Kỳ vọng: chạy `npm test` → vẫn PASS, hành vi không đổi.
- [ ] **Bước 4: Xác nhận hoàn tất task**
  Cách kiểm tra: chạy toàn bộ test liên quan tới task (`npm test`)
  Kết quả mong đợi: tất cả PASS.
