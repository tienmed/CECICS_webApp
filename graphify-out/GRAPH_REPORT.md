# Graph Report - CECICS_webApp  (2026-11-20)

## Corpus Check
- 83 files · ~65,585 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 4 file(s) not represented in the graph (top: .example 1, (none) 1, .css 1)

## Summary
- 583 nodes · 1382 edges · 35 communities (23 shown, 12 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 9 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Schedule & Swap Management UI
- API Actions & Auth Handlers
- AppShell Navigation & RBAC
- Graphify RAG & AST Scripting
- Clinical Conflict Detection & State
- Testing Suite & Seed Store
- SMTP & IMAP Mailbox Integration
- Token Optimization & Agent Skills
- TypeScript Build Configuration
- FullCalendar & Next.js Core Deps
- Tailwind & Tooling Dependencies
- Gas Build Scripts
- Standard Operating Procedures (SOP)
- Core Package Manifest
- NPM Lifecycle Scripts
- Google Apps Script Manifest
- IMAP Email Query Utilities
- Apps Script Webhook & HMAC
- Deployment & Sheets Setup Guide
- React 19 & Next.js Guidance
- Google Calendar Sync Engine
- Google Sheets Data Store
- Auth & Cookie Debugging Skill
- FullCalendar Core Plugin
- Google Auth Library
- React DOM Runtime
- Node Type Definitions
- React DOM Type Definitions
- PostCSS Configuration
- CSS Module Declarations
- HTTP Method Route Handlers

## God Nodes (most connected - your core abstractions)
1. `executeAction()` - 28 edges
2. `todayVnYmd()` - 26 edges
3. `getCurrentUser()` - 24 edges
4. `useApp()` - 21 edges
5. `canPerform()` - 21 edges
6. `getSnapshot()` - 20 edges
7. `PageHeader()` - 19 edges
8. `Badge()` - 19 edges
9. `next` - 18 edges
10. `SchedulePage()` - 18 edges

## Surprising Connections (you probably didn't know these)
- `createMemoryStore()` --calls--> `idFieldOf()`  [EXTRACTED]
  tests/workflows.test.ts → src/core/schema.ts
- `Graphify RAG & Token Optimization Skill` --conceptually_related_to--> `BỘ QUY TẮC TỐI ƯU TOKEN & QUOTA KHI DÙNG QWEN, GEMMA VÀ GRAPHIFY`  [INFERRED]
  .agent/skills/graphify-rag/SKILL.md → docs/PROMPT_OPTIMIZATION_RULES.md
- `Microsoft TokenEconomizer Integration Guide` --conceptually_related_to--> `BỘ QUY TẮC TỐI ƯU TOKEN & QUOTA KHI DÙNG QWEN, GEMMA VÀ GRAPHIFY`  [INFERRED]
  .agent/skills/microsoft-token-economizer/SKILL.md → docs/PROMPT_OPTIMIZATION_RULES.md
- `CECICS WebApp - Hướng Dẫn & Quy Chuẩn Dự Án` --references--> `Quy trình Vận hành Chuẩn (SOP) — CECICS Web App MVP`  [EXTRACTED]
  GEMINI.md → docs/SOP_NHAP_LIEU.md
- `SwapPage()` --calls--> `findLecturerConflicts()`  [EXTRACTED]
  src/app/(app)/doi-lich/page.tsx → src/core/conflict.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **CECICS Token & Prompt Optimization Standards** — agent_skills_graphify_rag_skill_doc, agent_skills_microsoft_token_economizer_skill_doc, docs_prompt_optimization_rules_doc [EXTRACTED 1.00]

## Communities (35 total, 12 thin omitted)

### Community 0 - "Schedule & Swap Management UI"
Cohesion: 0.06
Nodes (48): react, SwapPage(), RoomAssignmentPage(), EscalationsPage(), FormState, SchedulePage(), openNew(), SimClassesPage() (+40 more)

### Community 1 - "API Actions & Auth Handlers"
Cohesion: 0.07
Nodes (51): next, next-auth, ALLOWED_ACTIONS, BodySchema, POST(), POST(), dynamic, GET() (+43 more)

### Community 2 - "AppShell Navigation & RBAC"
Cohesion: 0.05
Nodes (51): ALL_MODULES, ALL_ROLES, AppShell(), NavItem, ACCESS_LEVEL_LABELS, ACCESS_LEVELS, AccessLevel, APP_MODULES (+43 more)

### Community 3 - "Graphify RAG & AST Scripting"
Cohesion: 0.09
Nodes (11): call_llm(), estimate_tokens(), extract_subgraph(), load_graph(), main(), call_gemma(), call_qwen(), compress_prompt() (+3 more)

### Community 4 - "Clinical Conflict Detection & State"
Cohesion: 0.13
Nodes (30): openReviewModal(), AppContextValue, findConflicts(), findEquipmentConflicts(), findLecturerConflicts(), findRoomConflicts(), parseRoomIds(), Slot (+22 more)

### Community 5 - "Testing Suite & Seed Store"
Cohesion: 0.10
Nodes (28): vitest, db, POST(), DataStore, columnsOf(), FieldType, fromRow(), idFieldOf() (+20 more)

### Community 6 - "SMTP & IMAP Mailbox Integration"
Cohesion: 0.07
Nodes (33): pending, run(), sendCommand(), socket, tls, waitTag(), cmd(), p (+25 more)

### Community 7 - "Token Optimization & Agent Skills"
Cohesion: 0.10
Nodes (20): 1. Nguyên Tắc 4 Tầng Tối Ưu, 2. Lệnh CLI Thường Dùng, Graphify RAG & Token Optimization Skill, 1. Ba Trụ Cột Tối Ưu Cốt Lõi, 2. Các Lệnh CLI Quản Trị Thường Dùng, Microsoft TokenEconomizer Integration Guide, 1. MÔ HÌNH PHÂN TẦNG VAI TRÒ 4 LỚP (TIERED ARCHITECTURE), 2.1. Gemma qua Google AI Studio API (+12 more)

### Community 8 - "TypeScript Build Configuration"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, baseUrl, esModuleInterop, incremental, isolatedModules, jsx, lib (+11 more)

### Community 9 - "FullCalendar & Next.js Core Deps"
Cohesion: 0.11
Nodes (18): dependencies, @fullcalendar/daygrid@^6.1.22, @fullcalendar/interaction@^6.1.22, @fullcalendar/list@^6.1.22, @fullcalendar/timegrid@^6.1.22, next@^15.5.29, next-auth@^5.0.0-beta.32, nodemailer@^8.0.11 (+10 more)

### Community 10 - "Tailwind & Tooling Dependencies"
Cohesion: 0.11
Nodes (18): devDependencies, postcss@^8.5.33, tailwindcss@^4.3.5, @tailwindcss/postcss@^4.3.5, tsx@^4.23.15, @types/google-apps-script@^2.0.15, @types/nodemailer@^8.0.2, @types/react@^19.3.0 (+10 more)

### Community 11 - "Gas Build Scripts"
Cohesion: 0.14
Nodes (8): __dirname, distDir, rootDir, srcDir, __dirname, nextConfig, esbuild@^0.28.2, esbuild

### Community 12 - "Standard Operating Procedures (SOP)"
Cohesion: 0.18
Nodes (11): 1. Đơn vị Đào tạo (Lịch giảng), 2. Đơn vị Hành chính (Gán phòng & Coi thi), 3. Giảng viên (Kể cả giảng viên thỉnh giảng có email trong Whitelist), 4. Đầu mối Bộ môn & Đơn vị Kỹ thuật (Lớp Mô phỏng & Thiết bị), 5. Ban Lãnh đạo (Trưởng & Phó Trung tâm), Quy trình Vận hành Chuẩn (SOP) — CECICS Web App MVP, 1. Công Nghệ & Kiến Trúc, 2. Quy Tắc Phân Quyền & Nghiệp Vụ Y Khoa (+3 more)

### Community 13 - "Core Package Manifest"
Cohesion: 0.18
Nodes (10): exceljs@^4.4.0, @fullcalendar/react@^6.1.22, description, engines, node, name, private, version (+2 more)

### Community 14 - "NPM Lifecycle Scripts"
Cohesion: 0.20
Nodes (10): scripts, build, dev, gas:build, gas:push, lint, seed, start (+2 more)

### Community 15 - "Google Apps Script Manifest"
Cohesion: 0.22
Nodes (8): dependencies, exceptionLogging, oauthScopes, runtimeVersion, timeZone, webapp, access, executeAs

### Community 16 - "IMAP Email Query Utilities"
Cohesion: 0.39
Nodes (8): fetchHeaders(), pending, run(), searchUids(), sendCommand(), socket, tls, waitTag()

### Community 17 - "Apps Script Webhook & HMAC"
Cohesion: 0.52
Nodes (6): computeHmacHex_(), doGet(), doPost(), getTargetSpreadsheet_(), jsonOut_(), verifySignature_()

### Community 18 - "Deployment & Sheets Setup Guide"
Cohesion: 0.33
Nodes (6): Bước 1 — Chuẩn bị tài khoản Google của Trung tâm, Bước 2 — Triển khai Google Apps Script (Cửa ghi có khóa `LockService`), Bước 3 — Cấu hình Google Cloud (Đăng nhập OAuth & Đọc Sheets), Bước 4 — Nạp danh mục ban đầu vào Sheets, Bước 5 — Triển khai lên Vercel (hoặc Cloudflare Pages), Hướng dẫn Cài đặt & Đấu nối Google Sheets + Apps Script (100% Miễn phí)

### Community 19 - "React 19 & Next.js Guidance"
Cohesion: 0.40
Nodes (5): 1. Phòng Tránh Hydration Mismatch (Server vs Client), 2. Loại Bỏ Request Waterfalls & Tối Ưu Data Fetching, 3. Tối Ưu Re-renders Trên Giao Diện Lịch & Ma Trận Phòng, 4. Tailwind CSS v4 Best Practices, Next.js 15 & React 19 Best Practices for CECICS

### Community 20 - "Google Calendar Sync Engine"
Cohesion: 0.70
Nodes (4): applyCalendarEffects_(), getCenterCalendar_(), parseVnDateTime_(), syncCalendarRsvp_()

### Community 21 - "Google Sheets Data Store"
Cohesion: 0.67
Nodes (3): createSheetsStore_(), getSheet_(), readTable_()

### Community 22 - "Auth & Cookie Debugging Skill"
Cohesion: 0.67
Nodes (3): 1. Cấu Trúc Xác Thực 2 Chế Độ, 2. Các Lỗi Phổ Biến & Cách Khắc Phục, CECICS Authentication & Cookie Debugging Skill

## Knowledge Gaps
- **38 isolated node(s):** `{ GET, POST }`, `1. Cấu Trúc Xác Thực 2 Chế Độ`, `2. Các Lỗi Phổ Biến & Cách Khắc Phục`, `1. Nguyên Tắc 4 Tầng Tối Ưu`, `2. Lệnh CLI Thường Dùng` (+33 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 230 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `next` connect `API Actions & Auth Handlers` to `Schedule & Swap Management UI`, `AppShell Navigation & RBAC`, `Testing Suite & Seed Store`, `FullCalendar & Next.js Core Deps`, `Core Package Manifest`?**
  _High betweenness centrality (0.039) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `executeAction()` (e.g. with `.append()` and `.getAll()`) actually correct?**
  _`executeAction()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **What connects `{ GET, POST }`, `1. Cấu Trúc Xác Thực 2 Chế Độ`, `2. Các Lỗi Phổ Biến & Cách Khắc Phục` to the rest of the system?**
  _38 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Schedule & Swap Management UI` be split into smaller, more focused modules?**
  _Cohesion score 0.06427771556550951 - nodes in this community are weakly interconnected._
- **Why does `react` connect `Schedule & Swap Management UI` to `FullCalendar & Next.js Core Deps`, `AppShell Navigation & RBAC`, `Core Package Manifest`, `API Actions & Auth Handlers`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._
- **Should `API Actions & Auth Handlers` be split into smaller, more focused modules?**
  _Cohesion score 0.0700152207001522 - nodes in this community are weakly interconnected._
- **Why does `nodemailer` connect `FullCalendar & Next.js Core Deps` to `API Actions & Auth Handlers`, `Core Package Manifest`?**
  _High betweenness centrality (0.026) - this node is a cross-community bridge._