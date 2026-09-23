# Kế Hoạch Triển Khai Mở Cửa Sổ Chrome Thật Với Persisted Profile & Visual HUD Highlight

**Mục tiêu:** Cung cấp trải nghiệm tự động hóa trực quan 100% giống và vượt trội hơn Chrome DevTools MCP: mặc định mở cửa sổ Google Chrome thật trên màn hình desktop, lưu trữ profile độc lập (`.jev-chrome-profile`) để vượt qua cơ chế chặn bot của Cloudflare và hiển thị hiệu ứng Visual HUD Highlight (viền sáng + badge tỷ lệ phần trăm độ tin cậy) trực tiếp trên trang web khi AI đưa ra quyết định.

**Cách tiếp cận:** Nâng cấp `BrowserManager` để mặc định chạy `headless: false` với `userDataDir` cố định tại thư mục người dùng, tích hợp cơ chế inject Visual HUD vào `FastLoopController` trước khi click phần tử, bổ sung kịch bản `npm run live` và đồng bộ cấu hình MCP server để Antigravity điều khiển trực tiếp cửa sổ Chrome hiển thị trên desktop.

**Đã tra cứu codebase (codebase-memory-mcp):**
- Đã chạy `index_repository` cho repo `c:\Users\ADMIN\Downloads\jev-bro`.
- `get_architecture`: Xác nhận các module chính gồm `src/browser_manager.ts`, `src/fast_loop_controller.ts`, `src/browser_tools.ts`, `src/mcp_server.ts`, `src/jev_engine.ts`.
- `trace_path`: `BrowserManager` được gọi bởi `createJevMcpServer` và `BrowserTools`. `FastLoopController` thực thi các bước `executeStep` và gọi `page.click` trên đối tượng `Page` của Puppeteer.
- `get_code_snippet`: Xác nhận `FastLoopController` hiện đang gọi trực tiếp `page.click(decision.selectedSelector)` mà chưa có bước scroll và inject visual badge.

**Framework test & quy ước (đã xác nhận qua codebase-memory-mcp):**
- Framework: Node.js Built-in Test Runner (`node:test`, `node:assert/strict`, `tsx`)
- Vị trí đặt file test: Thư mục `tests/*.test.ts`
- Lệnh chạy test: `npm test` hoặc `npm run test`

## Ràng buộc chung (Global Constraints)

- Mọi task viết/sửa hành vi code phải theo chu trình Red → Green → Refactor.
- Không có task nào được đánh dấu hoàn tất nếu thiếu test tự động tương ứng và log xác nhận PASS.
- Mặc định là `headless: false` (mở cửa sổ Chrome thật cho người dùng quan sát). Nếu cần chạy CI/CD hoặc benchmark ngầm, hỗ trợ cờ `--headless=true` hoặc biến môi trường `HEADLESS=true`.
- Giữ nguyên 100% tính tương thích của 16 MCP tools hiện có.

---

### Task 1: Nâng cấp BrowserManager mặc định mở Headful Chrome thật và Persisted Profile

**Đối tượng liên quan (đã xác nhận qua codebase-memory-mcp):**
- Tạo mới: `tests/browser_manager_profile.test.ts`
- Chỉnh sửa: `src/browser_manager.ts` (`BrowserManager`, `BrowserManagerConfig`, `getOrLaunchBrowser`)
- Test tương ứng: `tests/browser_manager_profile.test.ts`
- Kiểm chứng bằng: `npm test`

**Ảnh hưởng liên quan (từ trace_path / detect_changes):**
- Được gọi bởi: `src/browser_tools.ts`, `src/mcp_server.ts`
- Gọi tới: `puppeteer.launch`, `os.homedir`, `path.join`
- Regression test cần chạy thêm do có inbound calls: `tests/browser_manager.test.ts`, `tests/browser_manager_headful_stealth.test.ts`

**Giao diện/Kết nối với các task khác:**
- Nhận đầu vào từ: Cấu hình `BrowserManagerConfig` hoặc thiết lập mặc định của hệ thống.
- Cung cấp đầu ra cho: `FastLoopController` (Task 2) và `createJevMcpServer` (Task 3) với một instance trình duyệt Chrome thật có giao diện người dùng.

- [ ] **Bước 1 [RED]: Viết test cho BrowserManager cấu hình mặc định Headful và Persisted Profile**
  Vị trí file test: `tests/browser_manager_profile.test.ts`
  Test case:
  - Khởi tạo `new BrowserManager()` không truyền tham số: kiểm tra `config.headless` mặc định là `false`.
  - Kiểm tra `config.userDataDir` mặc định trỏ tới thư mục `.jev-chrome-profile` trong thư mục Home của người dùng.
  - Kiểm tra khi truyền `{ headless: true }` hoặc `process.env.HEADLESS = 'true'` thì `config.headless` chuyển thành `true`.
  Kỳ vọng: chạy `npm test` → FAIL do `src/browser_manager.ts` trước đó vẫn mặc định `headless = true` khi không có cấu hình.
- [ ] **Bước 2 [GREEN]: Viết code tối thiểu tại src/browser_manager.ts để test ở Bước 1 PASS**
  Bổ sung vào `src/browser_manager.ts`:
  - Thiết lập giá trị mặc định cho `headless`: nếu không truyền trong `config` và không có `HEADLESS=true` thì mặc định là `false`.
  - Tự động gán `userDataDir: path.join(os.homedir(), '.jev-chrome-profile')` nếu chưa được chỉ định.
  - Tự động truyền `userDataDir` và `executablePath` vào `puppeteer.launch`.
  Kỳ vọng: chạy `npm test` → PASS.
- [ ] **Bước 3 [REFACTOR] (nếu cần): Tinh chỉnh hàm xác định userDataDir an toàn đa nền tảng**
  Tạo thư mục `userDataDir` tự động nếu chưa tồn tại qua `fs.mkdirSync(..., { recursive: true })`.
  Kỳ vọng: chạy `npm test` → vẫn PASS, hành vi không đổi.
- [ ] **Bước 4: Xác nhận hoàn tất task**
  Cách kiểm tra: chạy toàn bộ test liên quan tới task (`npm test`)
  Kết quả mong đợi: tất cả PASS.

---

### Task 2: Tích hợp Visual HUD & Element Highlight vào FastLoopController

**Đối tượng liên quan (đã xác nhận qua codebase-memory-mcp):**
- Tạo mới: `tests/fast_loop_visual_hud.test.ts`
- Chỉnh sửa: `src/fast_loop_controller.ts` (`FastLoopController`, `executeStep`, `runPlan`, `GatingConfig`), `src/types.ts`
- Test tương ứng: `tests/fast_loop_visual_hud.test.ts`
- Kiểm chứng bằng: `npm test`

**Ảnh hưởng liên quan (từ trace_path / detect_changes):**
- Được gọi bởi: `src/mcp_server.ts` (`handleFastRun`), `src/demo_benchmark.ts`
- Gọi tới: `page.evaluate`, `page.click`, `page.waitForNavigation`
- Regression test cần chạy thêm do có inbound calls: `tests/fast_loop_controller.test.ts`, `tests/e2e_unified_fast_run.test.ts`

**Giao diện/Kết nối với các task khác:**
- Nhận đầu vào từ: Quyết định `decision` của `JevEngine` trên Page của `BrowserManager` (Task 1).
- Cung cấp đầu ra cho: Giao diện trực quan trên màn hình Chrome và kết quả phản hồi cho MCP Server (Task 3).

- [ ] **Bước 1 [RED]: Viết test kiểm tra cơ chế inject Visual HUD và Highlight của FastLoopController**
  Vị trí file test: `tests/fast_loop_visual_hud.test.ts`
  Test case:
  - Khởi tạo `FastLoopController` với cấu hình `{ visualFeedback: true, highlightDurationMs: 50 }`.
  - Chạy `executeStep` trên một trang mock có phần tử mục tiêu.
  - Xác nhận phần tử được gắn style `outline` hoặc có thẻ `#jev-hud-badge` được inject vào DOM trước khi click.
  Kỳ vọng: chạy `npm test` → FAIL do `GatingConfig` và `executeStep` chưa hỗ trợ thuộc tính `visualFeedback`.
- [ ] **Bước 2 [GREEN]: Viết code tối thiểu tại src/fast_loop_controller.ts và src/types.ts để test ở Bước 1 PASS**
  Bổ sung vào `src/types.ts` và `src/fast_loop_controller.ts`:
  - Thêm `visualFeedback?: boolean` và `highlightDurationMs?: number` vào `GatingConfig`.
  - Trong `executeStep`: nếu `decision.isConfident` và `visualFeedback !== false`, gọi `page.evaluate` để thực hiện cuộn tới phần tử (`scrollIntoView`), vẽ viền `outline: 3px solid #00ff66`, bóng đổ `boxShadow` và tạo thẻ HUD nổi hiển thị thông tin quyết định của openJev.
  - Thêm delay ngắn (`highlightDurationMs`, mặc định 300ms khi headful, 0ms khi test) để mắt người quan sát được.
  - Xử lý click an toàn kèm `page.waitForNavigation` với race/timeout fallback.
  Kỳ vọng: chạy `npm test` → PASS.
- [ ] **Bước 3 [REFACTOR] (nếu cần): Tách hàm injectVisualHud thành method helper riêng biệt**
  Tách logic inject DOM HUD và highlight ra method `private async injectVisualHud(page: Page, decision: JevDecisionResult)` để code gọn gàng, dễ bảo trì.
  Kỳ vọng: chạy `npm test` → vẫn PASS, hành vi không đổi.
- [ ] **Bước 4: Xác nhận hoàn tất task**
  Cách kiểm tra: chạy toàn bộ test liên quan tới task (`npm test`)
  Kết quả mong đợi: tất cả PASS.

---

### Task 3: Cập nhật visual_live_run.ts, cấu hình package.json và build phiên bản MCP Server mới nhất

**Đối tượng liên quan (đã xác nhận qua codebase-memory-mcp):**
- Tạo mới: `tests/e2e_hackernews_live_simulation.test.ts`
- Chỉnh sửa: `src/visual_live_run.ts`, `package.json`, `c:\Users\ADMIN\Downloads\jev-bro\.agents\mcp_config.json`, `C:\Users\ADMIN\.gemini\config\mcp_config.json`
- Test tương ứng: `tests/e2e_hackernews_live_simulation.test.ts`
- Kiểm chứng bằng: `npm test` và `npm run build`

**Ảnh hưởng liên quan (từ trace_path / detect_changes):**
- Được gọi bởi: Toàn bộ hệ thống kiểm thử tự động, lệnh `npm run live` và Antigravity MCP runtime
- Gọi tới: `dist/mcp_server.js`
- Regression test cần chạy thêm do có inbound calls: `npm test`

**Giao diện/Kết nối với các task khác:**
- Nhận đầu vào từ: Task 1 (Headful BrowserManager) và Task 2 (Visual FastLoopController).
- Cung cấp đầu ra cho: Người dùng sử dụng `jev_fast_run` trực tiếp trên Antigravity hoặc chạy `npm run live` để kiểm tra trực quan trên desktop.

- [ ] **Bước 1 [RED]: Viết test E2E kiểm tra toàn bộ luồng mô phỏng Hacker News với Visual HUD**
  Vị trí file test: `tests/e2e_hackernews_live_simulation.test.ts`
  Test case:
  - Khởi tạo unified server với cấu hình headful & visualFeedback.
  - Chạy `jev_fast_run` tìm bài viết AI trên trang Hacker News.
  - Đảm bảo thực thi thành công, click đúng bài viết AI và chụp screenshot hoàn chỉnh.
  Kỳ vọng: chạy `npm test` → FAIL nếu chưa đồng bộ hoàn chỉnh cấu hình.
- [ ] **Bước 2 [GREEN]: Cập nhật visual_live_run.ts, package.json, biên dịch dist/ và chạy test PASS**
  Thực hiện:
  - Bổ sung lệnh `"live": "tsx src/visual_live_run.ts"` vào `package.json`.
  - Hoàn thiện `src/visual_live_run.ts` thực hiện trọn vẹn luồng tìm bài viết AI trên Hacker News thật.
  - Chạy `npm run build` để cập nhật `dist/mcp_server.js`.
  - Cập nhật cả 2 file `mcp_config.json` để sử dụng cấu hình mới nhất.
  Kỳ vọng: chạy `npm test` → PASS.
- [ ] **Bước 3 [REFACTOR] (nếu cần): Tối ưu tài liệu hướng dẫn và thông báo log trực quan**
  Bổ sung hướng dẫn chạy lệnh `npm run live` vào README để người dùng có thể kích hoạt tab Chrome thật chỉ với 1 dòng lệnh.
  Kỳ vọng: chạy `npm test` → vẫn PASS toàn bộ test suite.
- [ ] **Bước 4: Xác nhận hoàn tất task**
  Cách kiểm tra: chạy toàn bộ bộ test `npm test` và kiểm tra lệnh build `npm run build`
  Kết quả mong đợi: 100% test PASS, bản build TypeScript thành công.
