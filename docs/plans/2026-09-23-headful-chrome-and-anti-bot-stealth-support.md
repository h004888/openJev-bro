# Kế Hoạch Triển Khai Mở Tab Chrome Thật (Headful Mode) và Cơ Chế Chống Bot (Anti-Detection Stealth)

**Mục tiêu:** Cung cấp khả năng hiển thị trực tiếp cửa sổ Chrome thật (Headful Mode `headless: false`) khi thực thi tự động hóa với `jev-chrome-devtools-mcp`, đồng thời tích hợp cơ chế chống bot stealth để khắc phục triệt để tình trạng Cloudflare chặn hoặc treo phiên trình duyệt.

**Cách tiếp cận:** Nâng cấp `BrowserManager` để hỗ trợ linh hoạt cấu hình `headless` (qua tham số, biến môi trường `HEADLESS=false`, CLI flags `--headless=false`), tự động nhận diện binary Google Chrome có sẵn trên Windows (`chrome.exe`), cấu hình cờ anti-detection (`--disable-blink-features=AutomationControlled`, xóa `navigator.webdriver`, giả lập User-Agent chuẩn) và kết nối đồng bộ vào `mcp_server.ts` cùng `mcp_config.json`.

**Đã tra cứu codebase (codebase-memory-mcp):**
- Đã chạy `index_repository` cho repo `c:\Users\ADMIN\Downloads\jev-bro`.
- `get_architecture`: Xác nhận kiến trúc dự án gồm các module `src/browser_manager.ts`, `src/browser_tools.ts`, `src/fast_loop_controller.ts`, `src/mcp_server.ts`, `src/jev_engine.ts`, `src/dom_extractor.ts`.
- `trace_path`: Xác nhận `BrowserManager` được gọi trực tiếp bởi `BrowserTools.constructor` và `createJevMcpServer` trong `src/mcp_server.ts`.
- `get_code_snippet`: Xác nhận `BrowserManager` hiện đang hardcode mặc định `headless: true` và `args` cơ bản chưa có cờ chống `AutomationControlled`.

**Framework test & quy ước (đã xác nhận qua codebase-memory-mcp):**
- Framework: Node.js Built-in Test Runner (`node:test`, `node:assert/strict`, `tsx`)
- Vị trí đặt file test: Thư mục `tests/*.test.ts`
- Lệnh chạy test: `npm test` hoặc `npm run test`

## Ràng buộc chung (Global Constraints)

- Mọi task viết/sửa hành vi code phải theo chu trình Red → Green → Refactor.
- Không có task nào được đánh dấu hoàn tất nếu thiếu test tự động tương ứng và log xác nhận PASS.
- Giữ nguyên 100% khả năng tương thích của 16 MCP tools đã đăng ký trong `jev-chrome-devtools-mcp`.
- Hỗ trợ cả hai chế độ: Headless (cho CI/CD, benchmark ngầm) và Headful (mở cửa sổ Chrome thật cho người dùng quan sát).

---

### Task 1: Nâng cấp BrowserManager hỗ trợ Headful Mode, Auto-Detect Chrome Windows và Anti-Bot Stealth

**Đối tượng liên quan (đã xác nhận qua codebase-memory-mcp):**
- Tạo mới: `tests/browser_manager_headful_stealth.test.ts`
- Chỉnh sửa: `src/browser_manager.ts` (`BrowserManager`, `BrowserManagerConfig`, `getOrLaunchBrowser`, `getActivePage`, `newPage`)
- Test tương ứng: `tests/browser_manager_headful_stealth.test.ts`
- Kiểm chứng bằng: `npm test`

**Ảnh hưởng liên quan (từ trace_path / detect_changes):**
- Được gọi bởi: `src/browser_tools.ts`, `src/mcp_server.ts`
- Gọi tới: `puppeteer.launch`, `browser.newPage`, `page.evaluateOnNewDocument`
- Regression test cần chạy thêm do có inbound calls: `tests/browser_manager.test.ts`, `tests/browser_tools.test.ts`

**Giao diện/Kết nối với các task khác:**
- Nhận đầu vào từ: Cấu hình `BrowserManagerConfig` hoặc biến môi trường `HEADLESS` / `CHROME_PATH` / `CHROME_HEADLESS`.
- Cung cấp đầu ra cho: `createJevMcpServer` tại `src/mcp_server.ts` (Task 2) để khởi tạo trình duyệt ở chế độ hiển thị thật hoặc headless có stealth.

- [ ] **Bước 1 [RED]: Viết test cho BrowserManager cấu hình Headless, Auto-Detect Chrome và Anti-Detection Stealth**
  Vị trí file test: `tests/browser_manager_headful_stealth.test.ts`
  Test case:
  - Khởi tạo `BrowserManager` với `headless: false`, kiểm tra cờ launch `headless: false` và các tham số `--disable-blink-features=AutomationControlled`.
  - Kiểm tra hàm loại bỏ `navigator.webdriver` và giả lập User Agent trên Page mới tạo.
  - Kiểm tra hàm `findChromeExecutable()` tìm binary Chrome trên Windows nếu có.
  Kỳ vọng: chạy `npm test` → FAIL với lý do các thuộc tính và logic stealth / headful chưa được cài đặt trong `BrowserManager`.
- [ ] **Bước 2 [GREEN]: Viết code tối thiểu tại src/browser_manager.ts để test ở Bước 1 PASS**
  Bổ sung vào `src/browser_manager.ts`:
  - Mở rộng `BrowserManagerConfig` với `executablePath?: string`, `stealth?: boolean`, `userDataDir?: string`.
  - Thêm logic đọc `process.env.HEADLESS`, `process.env.CHROME_HEADLESS`, `process.env.CHROME_PATH`.
  - Thêm danh sách cờ launch stealth: `--disable-blink-features=AutomationControlled`, `--no-first-run`, `--no-default-browser-check`, `--window-size=1280,800`.
  - Thêm logic `page.evaluateOnNewDocument` để xóa thuộc tính `navigator.webdriver` và giả lập `window.chrome`.
  Kỳ vọng: chạy `npm test` → PASS.
- [ ] **Bước 3 [REFACTOR] (nếu cần): Tinh chỉnh hàm tiện ích auto-detect Chrome path trên Windows**
  Tách hàm tìm đường dẫn Chrome trên Windows (`C:\Program Files\Google\Chrome\Application\chrome.exe`, `C:\Program Files (x86)\Google\Chrome\Application\chrome.exe`) thành hàm helper có kiểm tra `fs.existsSync`.
  Kỳ vọng: chạy `npm test` → vẫn PASS, hành vi không đổi.
- [ ] **Bước 4: Xác nhận hoàn tất task**
  Cách kiểm tra: chạy toàn bộ test liên quan tới task (`npm test`)
  Kết quả mong đợi: tất cả PASS, bao gồm cả regression test của BrowserManager.

---

### Task 2: Nâng cấp mcp_server.ts để nhận diện CLI Args và cấu hình Headful Mode linh hoạt

**Đối tượng liên quan (đã xác nhận qua codebase-memory-mcp):**
- Tạo mới: `tests/mcp_server_cli_config.test.ts`
- Chỉnh sửa: `src/mcp_server.ts` (`createJevMcpServer`, `parseCliArgs`, `main block`)
- Test tương ứng: `tests/mcp_server_cli_config.test.ts`
- Kiểm chứng bằng: `npm test`

**Ảnh hưởng liên quan (từ trace_path / detect_changes):**
- Được gọi bởi: Stdio JSON-RPC runtime của Antigravity MCP client
- Gọi tới: `createJevMcpServer(config)`
- Regression test cần chạy thêm do có inbound calls: `tests/mcp_server.test.ts`, `tests/unified_mcp_server.test.ts`

**Giao diện/Kết nối với các task khác:**
- Nhận đầu vào từ: `BrowserManager` đã được nâng cấp từ Task 1.
- Cung cấp đầu ra cho: Cấu hình MCP Client trong Antigravity (`mcp_config.json`) ở Task 3.

- [ ] **Bước 1 [RED]: Viết test cho logic parseCliArgs và cấu hình BrowserManagerConfig trong mcp_server.ts**
  Vị trí file test: `tests/mcp_server_cli_config.test.ts`
  Test case:
  - Parse CLI args `["--headless=false"]` → cấu hình trả về `{ headless: false }`.
  - Parse CLI args `["--no-headless"]` → cấu hình trả về `{ headless: false }`.
  - Parse CLI args `["--chrome-path=C:\\Custom\\chrome.exe"]` → cấu hình trả về `{ executablePath: "C:\\Custom\\chrome.exe" }`.
  - Truyền config vào `createJevMcpServer` và đảm bảo server khởi tạo đúng options.
  Kỳ vọng: chạy `npm test` → FAIL với lý do hàm `parseCliArgs` chưa được export và cài đặt.
- [ ] **Bước 2 [GREEN]: Viết code tối thiểu tại src/mcp_server.ts để test ở Bước 1 PASS**
  Bổ sung vào `src/mcp_server.ts`:
  - Export hàm `parseCliArgs(argv: string[]): BrowserManagerConfig`.
  - Trong block `if (process.argv[1]...)`: gọi `parseCliArgs(process.argv.slice(2))` và truyền vào `createJevMcpServer(cliConfig)`.
  Kỳ vọng: chạy `npm test` → PASS.
- [ ] **Bước 3 [REFACTOR] (nếu cần): Tối ưu hóa xử lý giá trị mặc định cho cấu hình CLI**
  Đảm bảo nếu không có cờ dòng lệnh thì fallback chuẩn sang biến môi trường `HEADLESS` và cấu hình mặc định.
  Kỳ vọng: chạy `npm test` → vẫn PASS.
- [ ] **Bước 4: Xác nhận hoàn tất task**
  Cách kiểm tra: chạy toàn bộ test server (`npm test`)
  Kết quả mong đợi: tất cả PASS.

---

### Task 3: Build dự án, cập nhật mcp_config.json và viết E2E test cho Fast Run trên trang Hacker News

**Đối tượng liên quan (đã xác nhận qua codebase-memory-mcp):**
- Tạo mới: `tests/e2e_headful_fast_run.test.ts`
- Chỉnh sửa: `C:\Users\ADMIN\.gemini\config\mcp_config.json`, `.agents/mcp_config.json`
- Test tương ứng: `tests/e2e_headful_fast_run.test.ts`
- Kiểm chứng bằng: `npm test` và `npm run build`

**Ảnh hưởng liên quan (từ trace_path / detect_changes):**
- Được gọi bởi: Toàn bộ hệ thống kiểm thử tự động và Antigravity IDE MCP loader
- Gọi tới: `dist/mcp_server.js`
- Regression test cần chạy thêm do có inbound calls: `npm test`

**Giao diện/Kết nối với các task khác:**
- Nhận đầu vào từ: Task 1 và Task 2 đã hoàn tất và build thành công `dist/mcp_server.js`.
- Cung cấp đầu ra cho: Người dùng chạy `jev_fast_run` trực tiếp trên Antigravity với tab Chrome thật mở trực quan.

- [ ] **Bước 1 [RED]: Viết test E2E kiểm tra toàn bộ luồng Fast Run với Headful/Stealth options**
  Vị trí file test: `tests/e2e_headful_fast_run.test.ts`
  Test case:
  - Khởi tạo unified server với cấu hình stealth / headful.
  - Chạy `jev_fast_run` trên trang HTML mô phỏng danh sách tin tức AI.
  - Đảm bảo hành động click và chụp ảnh `take_screenshot` hoạt động trơn tru không bị treo.
  Kỳ vọng: chạy `npm test` → FAIL nếu chưa đồng bộ đầy đủ cấu hình.
- [ ] **Bước 2 [GREEN]: Cập nhật mcp_config.json, biên dịch TypeScript sang dist/ và chạy test PASS**
  Thực hiện:
  - Viết code hoàn thiện cho luồng E2E.
  - Chạy `npm run build` để cập nhật `dist/mcp_server.js`.
  - Cập nhật file cấu hình MCP `C:\Users\ADMIN\.gemini\config\mcp_config.json` và `.agents/mcp_config.json` hỗ trợ tham số `["dist/mcp_server.js", "--headless=false"]` (hoặc cấu hình tùy chọn).
  Kỳ vọng: chạy `npm test` → PASS.
- [ ] **Bước 3 [REFACTOR] (nếu cần): Đồng bộ tài liệu hướng dẫn và cấu hình trong file README**
  Cập nhật ghi chú hướng dẫn cách bật/tắt cửa sổ Chrome thật (`--headless=false` hoặc `--headless=true`) trong tài liệu.
  Kỳ vọng: chạy `npm test` → vẫn PASS toàn bộ test suite.
- [ ] **Bước 4: Xác nhận hoàn tất task**
  Cách kiểm tra: chạy toàn bộ bộ test `npm test` và kiểm tra lệnh build `npm run build`
  Kết quả mong đợi: 100% test PASS, bản build TypeScript thành công.
