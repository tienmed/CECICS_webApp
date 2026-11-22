---
name: nextjs-react-guidance
description: Tiêu chuẩn và quy tắc phát triển Next.js 15 (App Router), React 19, Tailwind CSS v4, FullCalendar v6 và Recharts v3 trong dự án CECICS WebApp. Ngăn ngừa Hydration Mismatch, Request Waterfall, tối ưu hóa Re-render và hiệu năng hiển thị biểu đồ/lịch biểu.
metadata:
  priority: 2
---

# Next.js 15 & React 19 Best Practices for CECICS

## 1. Phòng Tránh Hydration Mismatch (Server vs Client)
* **Thời gian và Ngày tháng**: Không gọi `new Date()` hoặc hàm tính thời gian thực trực tiếp trong thân JSX của Server Component nếu Client render lại khác múi giờ. Luôn truyền `todayVnYmd()` từ Props hoặc bọc trong `useEffect()` / dynamic import `ssr: false`.
* **Thư viện Calendar / Charts**:
  - `FullCalendar` và `Recharts (ResponsiveContainer)` phải luôn chạy trên Client Component (`'use client'`).
  - Nếu cần SSR, cung cấp Skeleton loader hiển thị trước khi mounted:
    ```tsx
    const [mounted, setMounted] = useState(false);
    useEffect(() => setMounted(true), []);
    if (!mounted) return <SkeletonLoader />;
    ```

## 2. Loại Bỏ Request Waterfalls & Tối Ưu Data Fetching
* Không `await` tuần tự nhiều API độc lập. Luôn dùng `Promise.all()`:
  ```typescript
  const [rooms, instructors, courses] = await Promise.all([
    getRooms(),
    getInstructors(),
    getCourses()
  ]);
  ```
* Tách biệt rõ Server Component (chỉ đọc dữ liệu, không có hooks/event listeners) và Client Component (nút bấm, modal, form tương tác).

## 3. Tối Ưu Re-renders Trên Giao Diện Lịch & Ma Trận Phòng
* Không truyền inline object hoặc inline arrow function mới ở mỗi lần render vào các components lớn như FullCalendar hoặc Table hàng trăm dòng.
* Sử dụng `useCallback` cho event handlers và `useMemo` cho danh sách sự kiện đã lọc.
* Áp dụng virtualized list hoặc phân trang khi danh sách lượt đặt phòng vượt quá 100 bản ghi.

## 4. Tailwind CSS v4 Best Practices
* Dự án sử dụng `@tailwindcss/postcss` và cấu hình CSS hiện đại `@theme`.
* Không sử dụng cú pháp cũ `@apply` tùy tiện nếu có thể dùng utility classes trực tiếp.
* Đảm bảo color tokens đồng nhất với bộ nhận diện PNT: màu chủ đạo Teal (`#006B70`), Navy (`#1E293B`), và Amber (`#D97706`).
