# Graph Report - CECICS_webApp  (2026-11-26)

## Corpus Check
- cluster-only mode — file stats not available

## Summary
- 834 nodes · 2154 edges · 48 communities (36 shown, 12 thin omitted)
- Extraction: 99% EXTRACTED · 1% INFERRED · 0% AMBIGUOUS · INFERRED: 17 edges (avg confidence: 0.86)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `4044e560`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- lop-mo-phong/page.tsx
- llm_client.py
- simulation_digest_cron.ts
- Graphify RAG & AST Scripting
- Clinical Conflict Detection & State
- types.ts
- SMTP & IMAP Mailbox Integration
- DatabaseSnapshot
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
- Quy trình Vận hành Chuẩn (SOP) — CECICS Web App MVP
- Outbox Email Dispatcher
- Initial Sheets Table Setup
- Next.js Environment Declarations
- FullCalendar Core Plugin
- Google Auth Library
- main.js
- retrofit_calendar_events.ts
- Hướng dẫn Cài đặt & Đấu nối Google Sheets + Apps Script (100% Miễn phí)
- DomainError
- createSheetsStore_
- postcss.config.mjs
- css.d.ts
- { GET, POST }
- next-env.d.ts
- @fullcalendar/core
- @tailwindcss/postcss@^4.3.5
- @types/nodemailer@^8.0.2
- postcss.config.mjs
- css.d.ts
- { GET, POST }

## God Nodes (most connected - your core abstractions)
1. `executeAction()` - 44 edges
2. `SimClassesPage()` - 37 edges
3. `SchedulePage()` - 31 edges
4. `getCurrentUser()` - 30 edges
5. `formatVnDate()` - 28 edges
6. `getSnapshot()` - 28 edges
7. `todayVnYmd()` - 27 edges
8. `EquipmentPage()` - 26 edges
9. `next` - 26 edges
10. `DatabaseSnapshot` - 25 edges

## Surprising Connections (you probably didn't know these)
- `main()` --calls--> `sendNotificationEmail()`  [EXTRACTED]
  scripts/send_official_weekly_schedule.ts → src/lib/mailer.ts
- `run()` --calls--> `sendNotificationEmail()`  [EXTRACTED]
  scripts/simulation_digest_cron.ts → src/lib/mailer.ts
- `createMemoryStore()` --calls--> `idFieldOf()`  [EXTRACTED]
  tests/workflows.test.ts → src/core/schema.ts
- `createInMemoryStore()` --calls--> `buildMockSeed()`  [EXTRACTED]
  tests/recurring-meetings.test.ts → src/lib/mock-seed.ts
- `createInMemoryStore()` --calls--> `buildMockSeed()`  [EXTRACTED]
  tests/sim-class-workflow.test.ts → src/lib/mock-seed.ts

## Import Cycles
- 2-file cycle: `src/core/cme.ts -> src/core/mutations.ts -> src/core/cme.ts`

## Hyperedges (group relationships)
- **CECICS Token & Prompt Optimization Standards** — agent_skills_graphify_rag_skill_doc, agent_skills_microsoft_token_economizer_skill_doc, docs_prompt_optimization_rules_doc [EXTRACTED 1.00]

## Communities (48 total, 12 thin omitted)

### Community 0 - "lop-mo-phong/page.tsx"
Cohesion: 0.07
Nodes (63): react, CmeAdminPage(), SwapPage(), RoomAssignmentPage(), EscalationsPage(), FormState, SchedulePage(), formatDateYYYYMMDD() (+55 more)

### Community 1 - "llm_client.py"
Cohesion: 0.08
Nodes (55): SimClassesPage(), addItemRow(), handleCreateFull(), handleGenerateRecurring(), openTechReviewModal(), updateItemRow(), detectPendingEscalations(), findConflicts() (+47 more)

### Community 2 - "simulation_digest_cron.ts"
Cohesion: 0.07
Nodes (44): google-auth-library@^11.3.4, google-auth-library, vitest, db, seedToSheets(), POST(), dynamic, POST() (+36 more)

### Community 3 - "Graphify RAG & AST Scripting"
Cohesion: 0.06
Nodes (21): convert_html_to_pdf_playwright(), export_weekly_schedule(), generate_weekly_schedule_html(), get_academic_week_number(), get_next_week_range(), get_week_range(), load_data_from_db(), call_llm() (+13 more)

### Community 4 - "Clinical Conflict Detection & State"
Cohesion: 0.07
Nodes (43): concatenated, __dirname, distDir, order, rootDir, srcDir, __dirname, nextConfig (+35 more)

### Community 5 - "types.ts"
Cohesion: 0.06
Nodes (41): pending, run(), sendCommand(), socket, tls, waitTag(), cmd(), p (+33 more)

### Community 6 - "SMTP & IMAP Mailbox Integration"
Cohesion: 0.09
Nodes (24): AdminPage(), AppShell(), NavItem, ACCESS_LEVEL_LABELS, ACCESS_LEVELS, AccessLevel, APP_MODULES, AppModuleKey (+16 more)

### Community 7 - "DatabaseSnapshot"
Cohesion: 0.08
Nodes (24): AuditLogRecord, CampusRecord, DEFAULT_SETTINGS, DefaultSettings, EQUIPMENT_STATUSES, EquipmentMaintenanceRecord, ESCALATION_ACTIONS, INCIDENT_ASSESSMENTS (+16 more)

### Community 8 - "TypeScript Build Configuration"
Cohesion: 0.10
Nodes (20): 1. Nguyên Tắc 4 Tầng Tối Ưu, 2. Lệnh CLI Thường Dùng, Graphify RAG & Token Optimization Skill, 1. Ba Trụ Cột Tối Ưu Cốt Lõi, 2. Các Lệnh CLI Quản Trị Thường Dùng, Microsoft TokenEconomizer Integration Guide, 1. MÔ HÌNH PHÂN TẦNG VAI TRÒ 4 LỚP (TIERED ARCHITECTURE), 2.1. Gemma qua Google AI Studio API (+12 more)

### Community 9 - "FullCalendar & Next.js Core Deps"
Cohesion: 0.17
Nodes (15): ALLOWED_ACTIONS, BodySchema, POST(), dynamic, POST(), AppContextValue, ActionName, DomainError (+7 more)

### Community 10 - "Tailwind & Tooling Dependencies"
Cohesion: 0.10
Nodes (19): compilerOptions, allowJs, baseUrl, esModuleInterop, incremental, isolatedModules, jsx, lib (+11 more)

### Community 11 - "Gas Build Scripts"
Cohesion: 0.27
Nodes (15): dynamic, GET(), dynamic, GET(), dynamic, GET(), POST(), GET() (+7 more)

### Community 12 - "Standard Operating Procedures (SOP)"
Cohesion: 0.11
Nodes (18): dependencies, exceljs@^4.4.0, @fullcalendar/daygrid@^6.1.22, @fullcalendar/interaction@^6.1.22, @fullcalendar/react@^6.1.22, @fullcalendar/timegrid@^6.1.22, next@^15.5.29, next-auth@^5.0.0-beta.32 (+10 more)

### Community 13 - "Core Package Manifest"
Cohesion: 0.18
Nodes (12): nodemailer@^8.0.11, nodemailer, main(), createSmtpTransporter(), formatIcsDateTime(), generateSessionIcs(), sendCalendarEventInvite(), createSmtpTransporter() (+4 more)

### Community 14 - "NPM Lifecycle Scripts"
Cohesion: 0.11
Nodes (18): devDependencies, postcss@^8.5.33, tailwindcss@^4.3.5, tsx@^4.23.15, @types/google-apps-script@^2.0.15, @types/node@^26.6.6, @types/react@^19.3.0, @types/react-dom@^19.3.0 (+10 more)

### Community 15 - "Google Apps Script Manifest"
Cohesion: 0.12
Nodes (16): 10. ⏱️ Phân Hệ Thống Kê & Đối Soát Giờ Giảng (Faculty Hours & Audit), 11. ⚙️ Phân Hệ Quản Trị Danh Mục Dùng Chung (System Administration), 1. 📊 Phân Hệ Tổng Quan Điều Hành (Executive Dashboard), 2. 📅 Phân Hệ Lịch Giảng & Lịch Coi Thi (Master Clinical Schedule), 3. 🚪 Phân Hệ Gán Phòng & Phân Bổ Giảng Đường (Intelligent Room Assignment), 4. 🔄 Phân Hệ Hoán Đổi Lịch Giảng (Peer Shift Swapping), 5. 🩺 Phân Hệ Lớp Mô Phỏng & Dự Trù Vật Tư (Sim Classes & Multi-Session Series), 6. 🧭 Phân Hệ Sơ Đồ Trực Quan Trạm Thi OSCE (OSCE Circuit & Live Floor Plan) (+8 more)

### Community 16 - "IMAP Email Query Utilities"
Cohesion: 0.17
Nodes (11): next, POST(), POST(), dynamic, HomePage(), evaluateLoginAccess(), DEMO_COOKIE_NAME, handlers (+3 more)

### Community 17 - "Apps Script Webhook & HMAC"
Cohesion: 0.27
Nodes (13): OsceFloorPlanPage(), playStationChime(), INITIAL_COMPLETED_CANDIDATES, INITIAL_HH_STATIONS, INITIAL_HOLDING_QUEUE, INITIAL_OSCE_EXAMS, INITIAL_TN_STATIONS, OsceChecklistItem (+5 more)

### Community 18 - "Deployment & Sheets Setup Guide"
Cohesion: 0.13
Nodes (4): EquipmentPage(), handleRunLessonSuggestion(), runSimulationDispatch(), suggestEquipmentAndConsumablesForLesson()

### Community 19 - "React 19 & Next.js Guidance"
Cohesion: 0.33
Nodes (10): calculateEquipmentUsageMap(), DispatchEquipmentQuery, dispatchLeastUsedEquipment(), DispatchResult, EquipmentCandidate, LessonEquipmentConsumableSuggestion, ConsumableRecord, EquipmentCatalogRecord (+2 more)

### Community 20 - "Google Calendar Sync Engine"
Cohesion: 0.18
Nodes (11): 1. Đơn vị Đào tạo (Lịch giảng), 2. Đơn vị Hành chính (Gán phòng & Coi thi), 3. Giảng viên (Kể cả giảng viên thỉnh giảng có email trong Whitelist), 4. Đầu mối Bộ môn & Đơn vị Kỹ thuật (Lớp Mô phỏng & Thiết bị), 5. Ban Lãnh đạo (Trưởng & Phó Trung tâm), Quy trình Vận hành Chuẩn (SOP) — CECICS Web App MVP, 1. Công Nghệ & Kiến Trúc, 2. Quy Tắc Phân Quyền & Nghiệp Vụ Y Khoa (+3 more)

### Community 21 - "Google Sheets Data Store"
Cohesion: 0.18
Nodes (10): @fullcalendar/list@^6.1.22, description, esbuild@^0.28.2, engines, node, name, private, version (+2 more)

### Community 22 - "Auth & Cookie Debugging Skill"
Cohesion: 0.20
Nodes (10): scripts, build, dev, gas:build, gas:push, lint, seed, start (+2 more)

### Community 23 - "Quy trình Vận hành Chuẩn (SOP) — CECICS Web App MVP"
Cohesion: 0.31
Nodes (6): html, sampleItems, dynamic, BuildWeeklyEmailParams, buildWeeklyScheduleEmailHtml(), WeeklyScheduleItem

### Community 24 - "Outbox Email Dispatcher"
Cohesion: 0.22
Nodes (8): dependencies, exceptionLogging, oauthScopes, runtimeVersion, timeZone, webapp, access, executeAs

### Community 25 - "Initial Sheets Table Setup"
Cohesion: 0.46
Nodes (6): applyCalendarEffects_(), getCenterCalendar_(), getSessionAttendeesEmails_(), parseVnDateTime_(), retrofitCalendarEventsFromDate_(), syncCalendarRsvp_()

### Community 26 - "Next.js Environment Declarations"
Cohesion: 0.36
Nodes (6): dynamic, GET(), dynamic, POST(), generateExcelReportBuffer(), sendDepartmentReportEmail()

### Community 27 - "FullCalendar Core Plugin"
Cohesion: 0.25
Nodes (7): CmeAssessmentRecord, CmeAttendanceRecord, CmeCourseRecord, CmeRegistrationRecord, CmeSettlementRecord, CmeStudentRecord, CmeSurveyRecord

### Community 28 - "Google Auth Library"
Cohesion: 0.52
Nodes (6): computeHmacHex_(), doGet(), doPost(), getTargetSpreadsheet_(), jsonOut_(), verifySignature_()

### Community 29 - "main.js"
Cohesion: 0.33
Nodes (6): Bước 1 — Chuẩn bị tài khoản Google của Trung tâm, Bước 2 — Triển khai Google Apps Script (Cửa ghi có khóa `LockService`), Bước 3 — Cấu hình Google Cloud (Đăng nhập OAuth & Đọc Sheets), Bước 4 — Nạp danh mục ban đầu vào Sheets, Bước 5 — Triển khai lên Vercel (hoặc Cloudflare Pages), Hướng dẫn Cài đặt & Đấu nối Google Sheets + Apps Script (100% Miễn phí)

### Community 30 - "retrofit_calendar_events.ts"
Cohesion: 0.47
Nodes (4): next-auth, LoginClient(), dynamic, LoginPage()

### Community 31 - "Hướng dẫn Cài đặt & Đấu nối Google Sheets + Apps Script (100% Miễn phí)"
Cohesion: 0.40
Nodes (5): 1. Phòng Tránh Hydration Mismatch (Server vs Client), 2. Loại Bỏ Request Waterfalls & Tối Ưu Data Fetching, 3. Tối Ưu Re-renders Trên Giao Diện Lịch & Ma Trận Phòng, 4. Tailwind CSS v4 Best Practices, Next.js 15 & React 19 Best Practices for CECICS

### Community 32 - "DomainError"
Cohesion: 0.67
Nodes (3): createSheetsStore_(), getSheet_(), readTable_()

### Community 34 - "createSheetsStore_"
Cohesion: 0.67
Nodes (3): dynamic, GET(), lookupStudentByCccdAndDob()

### Community 35 - "postcss.config.mjs"
Cohesion: 0.67
Nodes (3): CmeRegistrationContent(), CmeRegistrationPage(), Course

### Community 37 - "{ GET, POST }"
Cohesion: 0.67
Nodes (3): 1. Cấu Trúc Xác Thực 2 Chế Độ, 2. Các Lỗi Phổ Biến & Cách Khắc Phục, CECICS Authentication & Cookie Debugging Skill

## Knowledge Gaps
- **38 isolated node(s):** `{ GET, POST }`, `1. Đơn vị Đào tạo (Lịch giảng)`, `2. Đơn vị Hành chính (Gán phòng & Coi thi)`, `3. Giảng viên (Kể cả giảng viên thỉnh giảng có email trong Whitelist)`, `4. Đầu mối Bộ môn & Đơn vị Kỹ thuật (Lớp Mô phỏng & Thiết bị)` (+33 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 303 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **12 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `next` connect `IMAP Email Query Utilities` to `lop-mo-phong/page.tsx`, `simulation_digest_cron.ts`, `createSheetsStore_`, `postcss.config.mjs`, `css.d.ts`, `SMTP & IMAP Mailbox Integration`, `FullCalendar & Next.js Core Deps`, `Gas Build Scripts`, `Standard Operating Procedures (SOP)`, `Apps Script Webhook & HMAC`, `Google Sheets Data Store`, `Quy trình Vận hành Chuẩn (SOP) — CECICS Web App MVP`, `Next.js Environment Declarations`, `retrofit_calendar_events.ts`?**
  _High betweenness centrality (0.046) - this node is a cross-community bridge._
- **Are the 5 inferred relationships involving `executeAction()` (e.g. with `dispatchLeastUsedEquipment()` and `.append()`) actually correct?**
  _`executeAction()` has 5 INFERRED edges - model-reasoned connections that need verification._
- **What connects `{ GET, POST }`, `1. Đơn vị Đào tạo (Lịch giảng)`, `2. Đơn vị Hành chính (Gán phòng & Coi thi)` to the rest of the system?**
  _38 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `lop-mo-phong/page.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06572164948453608 - nodes in this community are weakly interconnected._
- **Why does `vitest` connect `simulation_digest_cron.ts` to `llm_client.py`, `Clinical Conflict Detection & State`, `SMTP & IMAP Mailbox Integration`, `DatabaseSnapshot`, `NPM Lifecycle Scripts`, `Apps Script Webhook & HMAC`, `React 19 & Next.js Guidance`, `Google Sheets Data Store`, `Quy trình Vận hành Chuẩn (SOP) — CECICS Web App MVP`?**
  _High betweenness centrality (0.045) - this node is a cross-community bridge._
- **Should `llm_client.py` be split into smaller, more focused modules?**
  _Cohesion score 0.0770735524256651 - nodes in this community are weakly interconnected._
- **Why does `formatVnDate()` connect `lop-mo-phong/page.tsx` to `llm_client.py`, `Deployment & Sheets Setup Guide`, `Core Package Manifest`, `FullCalendar & Next.js Core Deps`?**
  _High betweenness centrality (0.033) - this node is a cross-community bridge._