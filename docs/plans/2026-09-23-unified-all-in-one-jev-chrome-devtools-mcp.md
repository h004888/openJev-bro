# Gộp toàn bộ Chrome DevTools và openJev-verdict-2.0 vào Một MCP Server Duy Nhất (All-in-One) — Kế hoạch triển khai (TDD-first)

**Mục tiêu:** Xây dựng một MCP Server duy nhất (`jev-chrome-devtools-mcp`) tích hợp trọn gói toàn bộ khả năng điều khiển, quan sát trình duyệt của Chrome DevTools kết hợp cùng bộ não phản xạ nhanh và tự động hóa tốc độ cao của openJev-verdict-2.0.

**Cách tiếp cận:** Xây dựng module `BrowserManager` quản lý vòng đời trình duyệt Puppeteer dùng chung (Shared Browser Session) trong tiến trình Node.js. Đăng ký toàn bộ các công cụ Chrome DevTools chuẩn (`navigate_page`, `click`, `type_text`, `fill`, `hover`, `press_key`, `take_screenshot`, `take_snapshot`, `evaluate_script`, `list_pages`, `new_page`, `close_page`) song song với các công cụ Jev (`jev_rank_elements`, `jev_evaluate_action`, `jev_fast_run`) trên cùng một giao thức Model Context Protocol.

**Đã tra cứu codebase (codebase-memory-mcp):**
- `get_architecture`: Codebase hiện tại đã có `src/jev_engine.ts`, `src/dom_extractor.ts`, `src/fast_loop_controller.ts`, và `src/mcp_server.ts`.
- `search_code`: Các module hiện tại đang dùng Puppeteer độc lập trong từng context, cần chuyển sang cơ chế quản lý tập trung thông qua `BrowserManager`.

**Framework test & quy ước (đã xác nhận qua codebase-memory-mcp):**
- Framework: Node.js Test Runner kết hợp `tsx`
- Vị trí đặt file test: `tests/*.test.ts`
- Lệnh chạy test: `npm test`

## Ràng buộc chung (Global Constraints)

- Mọi task viết/sửa hành vi code phải theo chu trình Red → Green → Refactor.
- Không có task nào được đánh dấu hoàn tất nếu thiếu test tự động tương ứng và log xác nhận PASS.
- Đảm bảo 100% khả năng tương thích với đặc tả Model Context Protocol SDK v1.6+.
- Chia sẻ cùng một phiên trình duyệt Chromium/Chrome duy nhất giữa các tool DevTools và Jev Decision Engine để loại bỏ hoàn toàn độ trễ khởi động lại tab.
- Xử lý dọn dẹp tiến trình trình duyệt an toàn khi server đóng hoặc nhận tín hiệu ngắt (SIGINT/SIGTERM).

---

### Task 1: Xây dựng BrowserManager quản lý vòng đời Puppeteer Browser và các Tab

**Đối tượng liên quan (đã xác nhận qua codebase-memory-mcp):**
- Tạo mới: `src/browser_manager.ts`, `tests/browser_manager.test.ts`
- Chỉnh sửa: `src/types.ts`
- Test tương ứng: `tests/browser_manager.test.ts`
- Kiểm chứng bằng: `npm test`

**Ảnh hưởng liên quan (từ trace_path / detect_changes):**
- Được gọi bởi: `src/browser_tools.ts`, `src/mcp_server.ts`, `src/fast_loop_controller.ts`
- Gọi tới: `puppeteer`
- Regression test cần chạy thêm do có inbound calls: không cần

**Giao diện/Kết nối với các task khác:**
- Nhận đầu vào từ: Cấu hình khởi động trình duyệt (`headless`, `viewport`)
- Cung cấp đầu ra cho: Các đối tượng `Browser`, `Page` đang hoạt động (active page) cho các tool xử lý

- [ ] **Bước 1 [RED]: Viết test cho hành vi khởi tạo trình duyệt, quản lý tab và chuyển đổi active page của BrowserManager**
  Vị trí file test: `tests/browser_manager.test.ts`
  Test case: Khởi tạo BrowserManager, gọi `getOrLaunchBrowser()`, `newPage()`, `listPages()`, `getActivePage()`, và `closePage()`. Kiểm tra số lượng tab và khả năng chuyển đổi tab chính xác.
  Kỳ vọng: chạy `npm test` → FAIL với lý do `Cannot find module '../src/browser_manager.js'`, không fail vì lỗi cú pháp.
- [ ] **Bước 2 [GREEN]: Viết code tối thiểu tại src/browser_manager.ts để test ở Bước 1 PASS**
  Kỳ vọng: chạy `npm test` → PASS.
- [ ] **Bước 3 [REFACTOR] (nếu cần): Thêm cơ chế lazy-launch (chỉ bật browser khi có lệnh đầu tiên) và auto-cleanup khi process exit**
  Kỳ vọng: chạy `npm test` → vẫn PASS, hành vi không đổi.
- [ ] **Bước 4: Xác nhận hoàn tất task**
  Cách kiểm tra: chạy toàn bộ test liên quan tới task (`npm test`)
  Kết quả mong đợi: tất cả PASS.

---

### Task 2: Xây dựng bộ công cụ điều khiển và quan sát Chrome DevTools chuẩn (Browser Tools Handler)

**Đối tượng liên quan (đã xác nhận qua codebase-memory-mcp):**
- Tạo mới: `src/browser_tools.ts`, `tests/browser_tools.test.ts`
- Chỉnh sửa: `src/browser_manager.ts`
- Test tương ứng: `tests/browser_tools.test.ts`
- Kiểm chứng bằng: `npm test`

**Ảnh hưởng liên quan (từ trace_path / detect_changes):**
- Được gọi bởi: `src/mcp_server.ts`
- Gọi tới: `src/browser_manager.ts`
- Regression test cần chạy thêm do có inbound calls: `tests/browser_manager.test.ts`

**Giao diện/Kết nối với các task khác:**
- Nhận đầu vào từ: Lệnh thực thi (`navigate_page`, `click`, `type_text`, `fill`, `take_screenshot`, `take_snapshot`, `evaluate_script`)
- Cung cấp đầu ra cho: Kết quả thao tác trên trang web dạng structured output (text, base64 screenshot, DOM snapshot)

- [ ] **Bước 1 [RED]: Viết test cho các hành vi navigate, click, type_text, take_snapshot và evaluate_script**
  Vị trí file test: `tests/browser_tools.test.ts`
  Test case: Gọi `handleNavigatePage('data:text/html,...')`, gọi `handleTypeText('input#name', 'Test User')`, gọi `handleClick('button#btn')`, gọi `handleEvaluateScript('document.title')`, và gọi `handleTakeSnapshot()`. Xác nhận kết quả trả về đúng dữ liệu tương tác.
  Kỳ vọng: chạy `npm test` → FAIL với lý do `Cannot find module '../src/browser_tools.js'`, không fail vì lỗi cú pháp.
- [ ] **Bước 2 [GREEN]: Viết code tối thiểu tại src/browser_tools.ts để test ở Bước 1 PASS**
  Kỳ vọng: chạy `npm test` → PASS.
- [ ] **Bước 3 [REFACTOR] (nếu cần): Chuẩn hóa xử lý lỗi phần tử không tìm thấy và format snapshot dễ đọc cho LLM**
  Kỳ vọng: chạy `npm test` → vẫn PASS, hành vi không đổi.
- [ ] **Bước 4: Xác nhận hoàn tất task**
  Cách kiểm tra: chạy toàn bộ test liên quan tới task (`npm test`)
  Kết quả mong đợi: tất cả PASS.

---

### Task 3: Nâng cấp Unified MCP Server tích hợp toàn diện cả 2 nhóm công cụ (All-in-One Server)

**Đối tượng liên quan (đã xác nhận qua codebase-memory-mcp):**
- Tạo mới: `tests/unified_mcp_server.test.ts`
- Chỉnh sửa: `src/mcp_server.ts`
- Test tương ứng: `tests/unified_mcp_server.test.ts`
- Kiểm chứng bằng: `npm test`

**Ảnh hưởng liên quan (từ trace_path / detect_changes):**
- Được gọi bởi: MCP Clients (Antigravity IDE, Claude Desktop, Cursor)
- Gọi tới: `src/browser_tools.ts`, `src/browser_manager.ts`, `src/jev_engine.ts`, `src/dom_extractor.ts`
- Regression test cần chạy thêm do có inbound calls: `tests/mcp_server.test.ts`

**Giao diện/Kết nối với các task khác:**
- Nhận đầu vào từ: Danh sách đầy đủ các tool requests qua JSON-RPC stdio
- Cung cấp đầu ra cho: Đăng ký toàn bộ danh mục tools (12 tools DevTools + 3 tools Jev) và thực thi chính xác từng tool

- [ ] **Bước 1 [RED]: Viết test kiểm tra danh sách 15 tools được đăng ký trong ListToolsRequestSchema và gọi thử nghiệm cả 2 nhóm tool**
  Vị trí file test: `tests/unified_mcp_server.test.ts`
  Test case: Khởi tạo unified MCP server, kiểm tra danh sách tool trả về có đầy đủ: `navigate_page`, `click`, `type_text`, `fill`, `take_screenshot`, `take_snapshot`, `evaluate_script`, `list_pages`, `new_page`, `close_page`, `jev_rank_elements`, `jev_evaluate_action`, `jev_fast_run`. Thực hiện gọi lần lượt 1 tool DevTools và 1 tool Jev.
  Kỳ vọng: chạy `npm test` → FAIL với lý do thiếu danh sách tool DevTools trong router, không fail vì lỗi cú pháp.
- [ ] **Bước 2 [GREEN]: Cập nhật src/mcp_server.ts để đăng ký và định tuyến toàn bộ 15 công cụ của 2 nhóm**
  Kỳ vọng: chạy `npm test` → PASS.
- [ ] **Bước 3 [REFACTOR] (nếu cần): Tối ưu hóa Zod validation schemas và format mô tả chi tiết từng tool cho AI Agent**
  Kỳ vọng: chạy `npm test` → vẫn PASS, hành vi không đổi.
- [ ] **Bước 4: Xác nhận hoàn tất task**
  Cách kiểm tra: chạy toàn bộ test liên quan tới task (`npm test`)
  Kết quả mong đợi: tất cả PASS.

---

### Task 4: Xây dựng công cụ siêu tốc `jev_fast_run` tích hợp trực tiếp với Live Browser Session và kiểm thử E2E

**Đối tượng liên quan (đã xác nhận qua codebase-memory-mcp):**
- Tạo mới: `tests/e2e_unified_fast_run.test.ts`
- Chỉnh sửa: `src/mcp_server.ts`, `src/fast_loop_controller.ts`
- Test tương ứng: `tests/e2e_unified_fast_run.test.ts`
- Kiểm chứng bằng: `npm test`

**Ảnh hưởng liên quan (từ trace_path / detect_changes):**
- Được gọi bởi: AI Agent khi muốn thực hiện tác vụ tự động hóa nhiều bước ở tốc độ cao
- Gọi tới: `src/fast_loop_controller.ts`, `src/browser_manager.ts`
- Regression test cần chạy thêm do có inbound calls: toàn bộ test suite

**Giao diện/Kết nối với các task khác:**
- Nhận đầu vào từ: `jev_fast_run` tool call chứa URL và danh sách các bước (`steps`)
- Cung cấp đầu ra cho: Kết quả hoàn thành toàn bộ kịch bản tự động hóa trên live page chỉ trong một lượt gọi duy nhất

- [ ] **Bước 1 [RED]: Viết test E2E cho tool jev_fast_run thực thi trực tiếp trên live Puppeteer page**
  Vị trí file test: `tests/e2e_unified_fast_run.test.ts`
  Test case: Khởi tạo unified server, gọi tool `jev_fast_run` với một trang HTML mẫu 3 bước (nhập tên -> chọn sở thích -> bấm gửi). Kiểm tra toàn bộ 3 bước được tự động click/type thành công và trả về báo cáo tổng thời gian < 200ms.
  Kỳ vọng: chạy `npm test` → FAIL với lý do `jev_fast_run` chưa kết nối với active page của BrowserManager, không fail vì lỗi cú pháp.
- [ ] **Bước 2 [GREEN]: Hoàn thiện tích hợp jev_fast_run với BrowserManager trong src/mcp_server.ts để test ở Bước 1 PASS**
  Kỳ vọng: chạy `npm test` → PASS.
- [ ] **Bước 3 [REFACTOR] (nếu cần): Thêm tùy chọn chụp screenshot tự động sau khi hoàn thành fast-run plan**
  Kỳ vọng: chạy `npm test` → vẫn PASS, hành vi không đổi.
- [ ] **Bước 4: Xác nhận hoàn tất task**
  Cách kiểm tra: chạy toàn bộ test liên quan tới task (`npm test`)
  Kết quả mong đợi: tất cả PASS.
