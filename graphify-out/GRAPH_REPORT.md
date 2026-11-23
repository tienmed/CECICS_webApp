# Graph Report - CECICS_webApp  (2026-11-23)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 650 nodes · 1640 edges · 38 communities (24 shown, 14 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 9 edges (avg confidence: 0.87)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `f56bd97c`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

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
- Cron Triggers & Scheduled Tasks
- Outbox Email Dispatcher
- React DOM Runtime
- Node Type Definitions
- React DOM Type Definitions
- PostCSS Configuration
- CSS Module Declarations
- HTTP Method Route Handlers
- postcss.config.mjs
- css.d.ts
- { GET, POST }

## God Nodes (most connected - your core abstractions)
1. `SimClassesPage()` - 37 edges
2. `executeAction()` - 37 edges
3. `getCurrentUser()` - 26 edges
4. `todayVnYmd()` - 26 edges
5. `useApp()` - 23 edges
6. `getSnapshot()` - 22 edges
7. `formatVnDate()` - 22 edges
8. `SchedulePage()` - 21 edges
9. `Badge()` - 21 edges
10. `canPerform()` - 21 edges

## Surprising Connections (you probably didn't know these)
- `createInMemoryStore()` --calls--> `buildMockSeed()`  [EXTRACTED]
  tests/sim-class-workflow.test.ts → src/lib/mock-seed.ts
- `createMemoryStore()` --calls--> `idFieldOf()`  [EXTRACTED]
  tests/workflows.test.ts → src/core/schema.ts
- `Graphify RAG & Token Optimization Skill` --conceptually_related_to--> `BỘ QUY TẮC TỐI ƯU TOKEN & QUOTA KHI DÙNG QWEN, GEMMA VÀ GRAPHIFY`  [INFERRED]
  .agent/skills/graphify-rag/SKILL.md → docs/PROMPT_OPTIMIZATION_RULES.md
- `Microsoft TokenEconomizer Integration Guide` --conceptually_related_to--> `BỘ QUY TẮC TỐI ƯU TOKEN & QUOTA KHI DÙNG QWEN, GEMMA VÀ GRAPHIFY`  [INFERRED]
  .agent/skills/microsoft-token-economizer/SKILL.md → docs/PROMPT_OPTIMIZATION_RULES.md
- `CacheEntry` --references--> `DatabaseSnapshot`  [EXTRACTED]
  src/lib/sheets.ts → src/core/types.ts

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **CECICS Token & Prompt Optimization Standards** — agent_skills_graphify_rag_skill_doc, agent_skills_microsoft_token_economizer_skill_doc, docs_prompt_optimization_rules_doc [EXTRACTED 1.00]

## Communities (38 total, 14 thin omitted)

### Community 0 - "Schedule & Swap Management UI"
Cohesion: 0.07
Nodes (71): vitest, SimClassesPage(), addItemRow(), handleCreateFull(), handleGenerateRecurring(), openTechReviewModal(), updateItemRow(), detectPendingEscalations() (+63 more)

### Community 1 - "API Actions & Auth Handlers"
Cohesion: 0.07
Nodes (52): next, next-auth, ALLOWED_ACTIONS, BodySchema, POST(), POST(), dynamic, GET() (+44 more)

### Community 2 - "AppShell Navigation & RBAC"
Cohesion: 0.09
Nodes (28): react, SwapPage(), RoomAssignmentPage(), EscalationsPage(), FormState, SchedulePage(), openNew(), EquipmentPage() (+20 more)

### Community 3 - "Graphify RAG & AST Scripting"
Cohesion: 0.08
Nodes (14): call_llm(), estimate_tokens(), extract_subgraph(), load_graph(), main(), call_gemma(), call_qwen(), call_tier3() (+6 more)

### Community 4 - "Clinical Conflict Detection & State"
Cohesion: 0.06
Nodes (41): pending, run(), sendCommand(), socket, tls, waitTag(), cmd(), p (+33 more)

### Community 5 - "Testing Suite & Seed Store"
Cohesion: 0.09
Nodes (28): AdminPage(), ALL_MODULES, ALL_ROLES, AppShell(), NavItem, ACCESS_LEVEL_LABELS, ACCESS_LEVELS, AccessLevel (+20 more)

### Community 6 - "SMTP & IMAP Mailbox Integration"
Cohesion: 0.06
Nodes (35): DashboardMetrics, EquipmentGroupUsageRow, LecturerSessionDetail, LecturerWorkloadRow, RoomSessionDetail, RoomUtilizationRow, TechBalanceRow, AuditLogRecord (+27 more)

### Community 7 - "Token Optimization & Agent Skills"
Cohesion: 0.09
Nodes (22): __dirname, distDir, rootDir, srcDir, __dirname, nextConfig, db, POST() (+14 more)

### Community 8 - "TypeScript Build Configuration"
Cohesion: 0.10
Nodes (20): 1. Nguyên Tắc 4 Tầng Tối Ưu, 2. Lệnh CLI Thường Dùng, Graphify RAG & Token Optimization Skill, 1. Ba Trụ Cột Tối Ưu Cốt Lõi, 2. Các Lệnh CLI Quản Trị Thường Dùng, Microsoft TokenEconomizer Integration Guide, 1. MÔ HÌNH PHÂN TẦNG VAI TRÒ 4 LỚP (TIERED ARCHITECTURE), 2.1. Gemma qua Google AI Studio API (+12 more)

### Community 9 - "FullCalendar & Next.js Core Deps"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, baseUrl, esModuleInterop, incremental, isolatedModules, jsx, lib (+11 more)

### Community 10 - "Tailwind & Tooling Dependencies"
Cohesion: 0.11
Nodes (18): dependencies, exceljs@^4.4.0, @fullcalendar/daygrid@^6.1.22, @fullcalendar/list@^6.1.22, @fullcalendar/react@^6.1.22, next@^15.5.29, next-auth@^5.0.0-beta.32, nodemailer@^8.0.11 (+10 more)

### Community 11 - "Gas Build Scripts"
Cohesion: 0.11
Nodes (18): devDependencies, postcss@^8.5.33, tailwindcss@^4.3.5, @tailwindcss/postcss@^4.3.5, tsx@^4.23.15, @types/google-apps-script@^2.0.15, @types/node@^26.6.6, @types/react-dom@^19.3.0 (+10 more)

### Community 12 - "Standard Operating Procedures (SOP)"
Cohesion: 0.27
Nodes (13): OsceFloorPlanPage(), playStationChime(), INITIAL_COMPLETED_CANDIDATES, INITIAL_HH_STATIONS, INITIAL_HOLDING_QUEUE, INITIAL_OSCE_EXAMS, INITIAL_TN_STATIONS, OsceChecklistItem (+5 more)

### Community 13 - "Core Package Manifest"
Cohesion: 0.23
Nodes (12): columnsOf(), FieldType, fromRow(), parseCell(), serializeCell(), TABLE_NAMES, TABLES, toRow() (+4 more)

### Community 14 - "NPM Lifecycle Scripts"
Cohesion: 0.18
Nodes (11): 1. Đơn vị Đào tạo (Lịch giảng), 2. Đơn vị Hành chính (Gán phòng & Coi thi), 3. Giảng viên (Kể cả giảng viên thỉnh giảng có email trong Whitelist), 4. Đầu mối Bộ môn & Đơn vị Kỹ thuật (Lớp Mô phỏng & Thiết bị), 5. Ban Lãnh đạo (Trưởng & Phó Trung tâm), Quy trình Vận hành Chuẩn (SOP) — CECICS Web App MVP, 1. Công Nghệ & Kiến Trúc, 2. Quy Tắc Phân Quyền & Nghiệp Vụ Y Khoa (+3 more)

### Community 15 - "Google Apps Script Manifest"
Cohesion: 0.18
Nodes (10): @fullcalendar/core@^6.1.22, @fullcalendar/timegrid@^6.1.22, description, engines, node, name, private, version (+2 more)

### Community 16 - "IMAP Email Query Utilities"
Cohesion: 0.20
Nodes (10): scripts, build, dev, gas:build, gas:push, lint, seed, start (+2 more)

### Community 17 - "Apps Script Webhook & HMAC"
Cohesion: 0.22
Nodes (8): dependencies, exceptionLogging, oauthScopes, runtimeVersion, timeZone, webapp, access, executeAs

### Community 18 - "Deployment & Sheets Setup Guide"
Cohesion: 0.52
Nodes (6): computeHmacHex_(), doGet(), doPost(), getTargetSpreadsheet_(), jsonOut_(), verifySignature_()

### Community 19 - "React 19 & Next.js Guidance"
Cohesion: 0.33
Nodes (6): Bước 1 — Chuẩn bị tài khoản Google của Trung tâm, Bước 2 — Triển khai Google Apps Script (Cửa ghi có khóa `LockService`), Bước 3 — Cấu hình Google Cloud (Đăng nhập OAuth & Đọc Sheets), Bước 4 — Nạp danh mục ban đầu vào Sheets, Bước 5 — Triển khai lên Vercel (hoặc Cloudflare Pages), Hướng dẫn Cài đặt & Đấu nối Google Sheets + Apps Script (100% Miễn phí)

### Community 20 - "Google Calendar Sync Engine"
Cohesion: 0.40
Nodes (5): 1. Phòng Tránh Hydration Mismatch (Server vs Client), 2. Loại Bỏ Request Waterfalls & Tối Ưu Data Fetching, 3. Tối Ưu Re-renders Trên Giao Diện Lịch & Ma Trận Phòng, 4. Tailwind CSS v4 Best Practices, Next.js 15 & React 19 Best Practices for CECICS

### Community 21 - "Google Sheets Data Store"
Cohesion: 0.70
Nodes (4): applyCalendarEffects_(), getCenterCalendar_(), parseVnDateTime_(), syncCalendarRsvp_()

### Community 22 - "Auth & Cookie Debugging Skill"
Cohesion: 0.67
Nodes (3): createSheetsStore_(), getSheet_(), readTable_()

### Community 24 - "Outbox Email Dispatcher"
Cohesion: 0.67
Nodes (3): 1. Cấu Trúc Xác Thực 2 Chế Độ, 2. Các Lỗi Phổ Biến & Cách Khắc Phục, CECICS Authentication & Cookie Debugging Skill

## Knowledge Gaps
- **38 isolated node(s):** `{ GET, POST }`, `1. Đơn vị Đào tạo (Lịch giảng)`, `2. Đơn vị Hành chính (Gán phòng & Coi thi)`, `3. Giảng viên (Kể cả giảng viên thỉnh giảng có email trong Whitelist)`, `4. Đầu mối Bộ môn & Đơn vị Kỹ thuật (Lớp Mô phỏng & Thiết bị)` (+33 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 243 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **14 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `next` connect `API Actions & Auth Handlers` to `AppShell Navigation & RBAC`, `Testing Suite & Seed Store`, `Token Optimization & Agent Skills`, `Tailwind & Tooling Dependencies`, `Standard Operating Procedures (SOP)`, `Google Apps Script Manifest`, `Cron Triggers & Scheduled Tasks`?**
  _High betweenness centrality (0.049) - this node is a cross-community bridge._
- **Are the 4 inferred relationships involving `executeAction()` (e.g. with `.append()` and `.getAll()`) actually correct?**
  _`executeAction()` has 4 INFERRED edges - model-reasoned connections that need verification._
- **What connects `{ GET, POST }`, `1. Đơn vị Đào tạo (Lịch giảng)`, `2. Đơn vị Hành chính (Gán phòng & Coi thi)` to the rest of the system?**
  _38 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Schedule & Swap Management UI` be split into smaller, more focused modules?**
  _Cohesion score 0.06837786661056175 - nodes in this community are weakly interconnected._
- **Why does `react` connect `AppShell Navigation & RBAC` to `Schedule & Swap Management UI`, `API Actions & Auth Handlers`, `Testing Suite & Seed Store`, `Tailwind & Tooling Dependencies`, `Standard Operating Procedures (SOP)`, `Google Apps Script Manifest`?**
  _High betweenness centrality (0.034) - this node is a cross-community bridge._
- **Should `API Actions & Auth Handlers` be split into smaller, more focused modules?**
  _Cohesion score 0.0699099099099099 - nodes in this community are weakly interconnected._
- **Why does `SimClassesPage()` connect `Schedule & Swap Management UI` to `AppShell Navigation & RBAC`, `Testing Suite & Seed Store`, `Token Optimization & Agent Skills`?**
  _High betweenness centrality (0.027) - this node is a cross-community bridge._