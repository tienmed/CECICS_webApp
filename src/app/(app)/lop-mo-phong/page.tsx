'use client';

import React, { useMemo, useState } from 'react';
import { findEquipmentConflicts, findRoomConflicts, parseRoomIds } from '@/core/conflict';
import { canPerform, canViewAllSimClasses, canViewSimClass } from '@/core/permissions';
import { addDaysYmd, diffDaysYmd, formatVnDate, formatVnDateWithDay, todayVnYmd } from '@/core/time';
import { parseSettings, ROLES, UNITS, type SimClassRecord } from '@/core/types';
import { useApp } from '@/components/AppProvider';
import { Badge, Card, KpiCard, Modal, PageHeader } from '@/components/ui';
import { parseModelItems, parseChecklistItems, type SimPdfModelItem } from '@/lib/sim-pdf';
import {
  type SimSessionItem,
  WEEKDAY_OPTIONS,
  computeItemTotal,
  defaultTimesForBuoi,
  generateRecurringSessions,
  normalizeSimSessions,
  parseSimSessions,
  resolveSessionRoom,
  resolveSessionKtv,
  simSessionLabel,
  summarizeSimSchedule,
  validateSimSessions,
} from '@/core/sim-sessions';

const inputCls = 'w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white text-slate-900 focus:outline-none focus:ring-2 focus:ring-teal-500';
const labelCls = 'block text-xs font-semibold text-slate-700 mb-1';

export default function SimClassesPage() {
  const { user, db, execute } = useApp();
  const settings = useMemo(() => parseSettings(db.Settings), [db.Settings]);
  const today = todayVnYmd();

  // Tab lọc
  const [activeTab, setActiveTab] = useState<'all' | 'pending' | 't7' | 'approved' | 'adjust'>('all');

  // Wizard state
  const [createOpen, setCreateOpen] = useState(false);
  const [wizardStep, setWizardStep] = useState<1 | 2 | 3>(1);

  // Multi-session & Recurring states
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringDays, setRecurringDays] = useState<number[]>([1, 3]); // Mặc định T2, T4
  const [recurringRange, setRecurringRange] = useState({
    tu_ngay: addDaysYmd(today, 18),
    den_ngay: addDaysYmd(today, 32),
    buoi_hoc: 'Sáng',
    gio_bd: '08:00',
    gio_kt: '11:30',
  });
  const [sessions, setSessions] = useState<SimSessionItem[]>([
    {
      buoi_so: 1,
      ngay: addDaysYmd(today, 18),
      buoi_hoc: 'Sáng',
      gio_bd: '08:00',
      gio_kt: '11:30',
      trang_thai_buoi: 'Kế hoạch',
    },
  ]);
  const [expandedSims, setExpandedSims] = useState<Record<string, boolean>>({});
  const [techOverrides, setTechOverrides] = useState<Record<number, { room_id: string; ktv_phu_trach: string }>>({});
  const [showTechOverrides, setShowTechOverrides] = useState(false);
  const [adjustSessions, setAdjustSessions] = useState<Record<number, { ngay: string; gio_bd: string; gio_kt: string; huy: boolean }>>({});

  // Review states
  const [techReviewing, setTechReviewing] = useState<SimClassRecord | null>(null);
  const [adminReviewing, setAdminReviewing] = useState<SimClassRecord | null>(null);
  const [adminDecision, setAdminDecision] = useState<'Đã duyệt' | 'Từ chối'>('Đã duyệt');
  const [adminNote, setAdminNote] = useState('');

  // T-7 Reminder state
  const [reminderTarget, setReminderTarget] = useState<SimClassRecord | null>(null);

  // Confirmation / Adjustment state
  const [confirmTarget, setConfirmTarget] = useState<SimClassRecord | null>(null);
  const [confirmResponseType, setConfirmResponseType] = useState<'Giữ nguyên' | 'Điều chỉnh'>('Giữ nguyên');
  const [confirmNote, setConfirmNote] = useState('');

  // Late approval state
  const [lateTarget, setLateTarget] = useState<SimClassRecord | null>(null);
  const [lateNote, setLateNote] = useState('');

  // Initial Form Data
  const defaultDeptId = user.bo_mon_id || db.Departments[0]?.bo_mon_id || 'BM-CDHA';
  const [form, setForm] = useState({
    bo_mon_id: defaultDeptId,
    giang_vien_phu_trach: user.ho_ten || 'ThS. BSCKII. Phạm Nguyên Vũ',
    sdt_lien_he: '0983738421',
    email_lien_he: user.email || 'vuphammd@pnt.edu.vn',
    nguoi_ho_tro: '',
    doi_tuong_hoc_vien: 'Sinh viên Y5 Đa khoa - Lớp K52',
    ngay: addDaysYmd(today, settings.HAN_DANG_KY_MO_PHONG_NGAY + 3),
    buoi_hoc: 'Sáng',
    gio_bd: '08:00',
    gio_kt: '11:30',
    campus_id: 'HH',
    noi_dung: 'Khóa học Siêu âm tổng quát thực hành K52',
    so_hoc_vien: 24,
    so_nhom: 2,
    so_hv_moi_nhom: 12,
    benh_nhan_chuan: ['Người lớn', 'Huấn luyện kỹ năng từng phần'],
    boi_canh_lam_sang: ['Chăm sóc cấp'],
    muc_tieu_dao_tao: '1. Nhận diện các mốc giải phẫu gan mật tụy lách trên siêu âm 2D.\n2. Thực hiện đo đạc kích thước tạng và nhận diện dịch tự do ổ bụng.\n3. Rèn luyện kỹ năng giao tiếp và thao tác chuẩn mực trên người bệnh.',
    ky_nang_mong_doi: 'Cầm đầu dò đúng tư thế, quét lát cắt chuẩn hạ sườn phải và mặt cắt dưới mũi ức, thao tác điều chỉnh gain/depth chính xác.',
    thiet_bi_yeu_cau: '2 Máy siêu âm Doppler 4D + 2 Mô hình thực hành siêu âm bụng',
    items: [
      { loai: 'mo_hinh' as const, ten: 'Mô hình thực hành siêu âm bụng tổng quát', dvt: 'Mô hình', sl_nhom: 1, sl_tong: 2, ghi_chu: 'Cần đầu dò convex' },
      { loai: 'dung_cu' as const, ten: 'Máy siêu âm màu Doppler 4D Voluson E8', dvt: 'Máy', sl_nhom: 1, sl_tong: 2, ghi_chu: 'Cài sẵn preset bụng tổng quát' },
      { loai: 'vat_tu' as const, ten: 'Gel siêu âm y tế 5 lít & Khăn giấy lau', dvt: 'Bình/Gói', sl_nhom: 2, sl_tong: 4, ghi_chu: 'Vật tư tiêu hao' },
    ] as SimPdfModelItem[],
  });

  // Review Form Data
  const [techForm, setTechForm] = useState({
    room_ids: [] as string[],
    ktv_phu_trach: '',
    equipment_ids: [] as string[],
    trang_thai: 'Đã duyệt',
    ghi_chu_ky_thuat: '',
  });

  const canCreate = canPerform(user, 'create_sim_class');
  const canReviewTech = canPerform(user, 'review_sim_class_tech') || canPerform(user, 'review_sim_class');
  const canReviewAdmin = canPerform(user, 'review_sim_class_admin');
  const canSendReminder = canPerform(user, 'send_sim_reminder');
  const canApproveLate = canPerform(user, 'approve_late_sim_class');

  const userMap = useMemo(() => new Map(db.Users.map((u) => [u.user_id, u])), [db.Users]);
  const deptMap = useMemo(() => new Map(db.Departments.map((d) => [d.bo_mon_id, d])), [db.Departments]);
  const roomMap = useMemo(() => new Map(db.Rooms.map((r) => [r.room_id, r])), [db.Rooms]);
  const eqMap = useMemo(() => new Map(db.Equipment.map((e) => [e.equipment_id, e])), [db.Equipment]);

  const technicians = useMemo(
    () => db.Users.filter((u) => u.kich_hoat && (u.vai_tro.includes(ROLES.KY_THUAT) || u.don_vi === UNITS.KY_THUAT)),
    [db.Users]
  );

  const daysAheadForm = diffDaysYmd(today, form.ngay);
  const isLateForm = daysAheadForm < settings.HAN_DANG_KY_MO_PHONG_NGAY;

  const reviewRooms = useMemo(() => {
    if (!techReviewing) return [];
    return db.Rooms.filter((r) => r.campus_id === techReviewing.campus_id && r.kich_hoat).map((r) => {
      const conflicts = findRoomConflicts(
        {
          id: techReviewing.sim_id,
          ngay: techReviewing.ngay,
          gio_bd: techReviewing.gio_bd,
          gio_kt: techReviewing.gio_kt,
          room_ids: [r.room_id],
        },
        db.Sessions,
        db.SimClasses
      );
      return {
        room: r,
        conflict: conflicts.length > 0 ? conflicts[0] : null,
      };
    });
  }, [techReviewing, db.Rooms, db.Sessions, db.SimClasses]);

  const reviewEquipment = useMemo(() => {
    if (!techReviewing) return [];
    return db.Equipment.filter((e) => e.campus_id === techReviewing.campus_id && e.trang_thai !== 'Thanh lý').map((e) => {
      const conflicts = findEquipmentConflicts(
        {
          sim_id: techReviewing.sim_id,
          ngay: techReviewing.ngay,
          gio_bd: techReviewing.gio_bd,
          gio_kt: techReviewing.gio_kt,
          equipment_id: e.equipment_id,
        },
        db.SimClasses,
        db.SimClassEquipment
      );
      return { eq: e, unavailable: e.trang_thai !== 'Hoạt động', conflicts };
    });
  }, [techReviewing, db.Equipment, db.SimClasses, db.SimClassEquipment]);

  function openTechReviewModal(sc: SimClassRecord) {
    const linked = db.SimClassEquipment.filter((l) => l.sim_id === sc.sim_id).map((l) => l.equipment_id);
    const initialRooms = parseRoomIds(sc.room_id);
    const simSessions = parseSimSessions(sc);
    const initialOverrides: Record<number, { room_id: string; ktv_phu_trach: string }> = {};
    let hasAnyOv = false;
    for (const s of simSessions) {
      if (s.room_id || s.ktv_phu_trach) {
        initialOverrides[s.buoi_so] = {
          room_id: s.room_id || '',
          ktv_phu_trach: s.ktv_phu_trach || '',
        };
        hasAnyOv = true;
      }
    }
    setTechOverrides(initialOverrides);
    setShowTechOverrides(hasAnyOv);
    setTechReviewing(sc);
    setTechForm({
      room_ids: initialRooms,
      ktv_phu_trach: sc.ktv_phu_trach || technicians[0]?.user_id || user.user_id,
      equipment_ids: linked,
      trang_thai: sc.duyet_ky_thuat === 'Từ chối' ? 'Từ chối' : 'Đã duyệt',
      ghi_chu_ky_thuat: sc.ghi_chu_ky_thuat || '',
    });
  }

  function openAdminReviewModal(sc: SimClassRecord) {
    setAdminReviewing(sc);
    setAdminDecision(sc.duyet_hanh_chinh === 'Từ chối' ? 'Từ chối' : 'Đã duyệt');
    setAdminNote(sc.ghi_chu_hanh_chinh || '');
  }

  // Xử lý tạo lớp Wizard 3 bước
  async function handleCreateFull(e: React.FormEvent) {
    e.preventDefault();
    if (isRecurring) {
      const err = validateSimSessions(sessions);
      if (err) {
        alert(err);
        return;
      }
    }
    const anchor = isRecurring && sessions.length > 0 ? sessions[0] : null;
    const payload = {
      bo_mon_id: form.bo_mon_id,
      giang_vien_phu_trach: form.giang_vien_phu_trach,
      sdt_lien_he: form.sdt_lien_he,
      email_lien_he: form.email_lien_he,
      nguoi_ho_tro: form.nguoi_ho_tro,
      doi_tuong_hoc_vien: form.doi_tuong_hoc_vien,
      ngay: anchor ? anchor.ngay : form.ngay,
      buoi_hoc: anchor ? anchor.buoi_hoc : form.buoi_hoc,
      gio_bd: anchor ? anchor.gio_bd : form.gio_bd,
      gio_kt: anchor ? anchor.gio_kt : form.gio_kt,
      campus_id: form.campus_id,
      noi_dung: form.noi_dung,
      so_hoc_vien: Number(form.so_hoc_vien || 0),
      so_nhom: Number(form.so_nhom || 1),
      so_hv_moi_nhom: Number(form.so_hv_moi_nhom || 10),
      nhu_cau_sp: JSON.stringify(form.benh_nhan_chuan),
      boi_canh_lam_sang: JSON.stringify(form.boi_canh_lam_sang),
      muc_tieu_dao_tao: form.muc_tieu_dao_tao,
      ky_nang_mong_doi: form.ky_nang_mong_doi,
      thiet_bi_yeu_cau: form.thiet_bi_yeu_cau,
      danh_muc_mo_hinh_json: JSON.stringify(form.items),
      danh_sach_buoi: isRecurring && sessions.length > 0 ? sessions : undefined,
    };

    const res = await execute(
      'createSimClass',
      payload,
      isLateForm
        ? 'Đã gửi hồ sơ yêu cầu (TRỄ HẠN) — thông báo Hành chính & Kỹ thuật rà soát khẩn.'
        : `Đã gửi hồ sơ đăng ký lớp mô phỏng (${isRecurring ? `${sessions.length} buổi` : '1 buổi'}) thành công.`
    );
    if (res.ok) {
      setCreateOpen(false);
      setWizardStep(1);
    }
  }

  // Xử lý duyệt kỹ thuật
  async function handleTechReviewSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!techReviewing) return;
    const overridesList = Object.entries(techOverrides)
      .filter(([_, val]) => val.room_id || val.ktv_phu_trach)
      .map(([b, val]) => ({ buoi_so: Number(b), room_id: val.room_id, ktv_phu_trach: val.ktv_phu_trach }));

    const res = await execute(
      'reviewSimClassTech',
      {
        sim_id: techReviewing.sim_id,
        decision: techForm.trang_thai === 'Từ chối' ? 'Từ chối' : 'Đã duyệt',
        room_ids: techForm.room_ids,
        equipment_ids: techForm.equipment_ids,
        ktv_phu_trach: techForm.ktv_phu_trach,
        ghi_chu_ky_thuat: techForm.ghi_chu_ky_thuat,
        session_overrides: showTechOverrides && overridesList.length > 0 ? overridesList : undefined,
      },
      `Đã cập nhật thẩm định kỹ thuật cho lớp ${techReviewing.sim_id}.`
    );
    if (res.ok) {
      setTechReviewing(null);
      setTechOverrides({});
      setShowTechOverrides(false);
    }
  }

  // Xử lý duyệt hành chính
  async function handleAdminReviewSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!adminReviewing) return;
    const res = await execute(
      'reviewSimClassAdmin',
      {
        sim_id: adminReviewing.sim_id,
        decision: adminDecision,
        ghi_chu_hanh_chinh: adminNote,
      },
      `Đã cập nhật duyệt hành chính cho lớp ${adminReviewing.sim_id}: ${adminDecision}.`
    );
    if (res.ok) setAdminReviewing(null);
  }

  // Xử lý phát email nhắc nhở T-7
  async function handleSendReminder() {
    if (!reminderTarget) return;
    const res = await execute(
      'sendSimClassReminder',
      { sim_id: reminderTarget.sim_id },
      `Đã phát thư điện tử nhắc nhở mốc T-7 ngày cho Bộ môn (${reminderTarget.email_lien_he || 'Bộ môn'}).`
    );
    if (res.ok) setReminderTarget(null);
  }

  // Xử lý phản hồi từ Bộ môn (Xác nhận / Điều chỉnh)
  async function handleConfirmSubmit() {
    if (!confirmTarget) return;
    const res = await execute(
      'respondSimClassConfirmation',
      {
        sim_id: confirmTarget.sim_id,
        response_type: confirmResponseType,
        phan_hoi_bo_mon: confirmNote,
      },
      confirmResponseType === 'Giữ nguyên'
        ? `Bộ môn đã xác nhận giữ nguyên kế hoạch lớp ${confirmTarget.sim_id}.`
        : `Bộ môn đã gửi yêu cầu điều chỉnh lớp ${confirmTarget.sim_id}. Hệ thống đã gửi báo động Kỹ thuật.`
    );
    if (res.ok) {
      setConfirmTarget(null);
      setConfirmNote('');
    }
  }

  // Xử lý duyệt trễ hạn
  async function handleLateDecision(decision: 'approve' | 'reject') {
    if (!lateTarget) return;
    const res = await execute(
      'approveLateSimClass',
      { sim_id: lateTarget.sim_id, decision, ghi_chu: lateNote },
      decision === 'approve' ? 'Đã chấp thuận chuyển KTV rà soát.' : 'Đã từ chối lớp đăng ký trễ.'
    );
    if (res.ok) {
      setLateTarget(null);
      setLateNote('');
    }
  }

  const currentNumSessions = isRecurring ? Math.max(1, sessions.length) : 1;

  function handleGenerateRecurring() {
    const list = generateRecurringSessions({
      tu_ngay: recurringRange.tu_ngay,
      den_ngay: recurringRange.den_ngay,
      weekdays: recurringDays,
      buoi_hoc: recurringRange.buoi_hoc,
      gio_bd: recurringRange.gio_bd,
      gio_kt: recurringRange.gio_kt,
    });
    if (list.length === 0) {
      alert('Không tìm thấy ngày nào khớp với thứ và khoảng thời gian đã chọn.');
      return;
    }
    setSessions(list);
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((it) => ({
        ...it,
        sl_tong: computeItemTotal(it, prev.so_nhom || 1, list.length),
      })),
    }));
  }

  // Quản lý các dòng trong bảng dự trù (Mẫu 1)
  function addItemRow(loai: 'mo_hinh' | 'dung_cu' | 'vat_tu') {
    setForm((prev) => {
      const sl_tong = computeItemTotal({ loai, sl_nhom: 1 }, prev.so_nhom || 1, currentNumSessions);
      return {
        ...prev,
        items: [
          ...prev.items,
          {
            loai,
            ten: '',
            dvt: loai === 'vat_tu' ? 'Gói' : 'Bộ',
            sl_nhom: 1,
            sl_tong,
            ghi_chu: '',
          },
        ],
      };
    });
  }

  function updateItemRow(index: number, patch: Partial<SimPdfModelItem>) {
    setForm((prev) => {
      const next = [...prev.items];
      const merged = { ...next[index], ...patch };
      if ('sl_nhom' in patch || 'loai' in patch) {
        merged.sl_tong = computeItemTotal(merged, prev.so_nhom || 1, currentNumSessions);
      }
      next[index] = merged;
      return { ...prev, items: next };
    });
  }

  function removeItemRow(index: number) {
    setForm((prev) => ({
      ...prev,
      items: prev.items.filter((_, i) => i !== index),
    }));
  }

  // Phân quyền theo quy chuẩn: "BM nào chỉ thấy được phiếu của bm đó thôi"
  const isStaff = canViewAllSimClasses(user);
  const userDept = user.bo_mon_id ? deptMap.get(user.bo_mon_id) : null;

  // Danh sách các lớp trong phạm vi quyền truy cập của người dùng
  const scopedSimClasses = useMemo(() => {
    return db.SimClasses.filter((sc) => canViewSimClass(user, sc)).sort((a, b) =>
      `${b.ngay}${b.sim_id}`.localeCompare(`${a.ngay}${a.sim_id}`)
    );
  }, [db.SimClasses, user]);

  const filteredSimClasses = useMemo(() => {
    return scopedSimClasses.filter((sc) => {
      if (activeTab === 'all') return true;
      if (activeTab === 'pending') {
        return sc.trang_thai === 'Chờ rà soát' || sc.trang_thai === 'Cần xét đặc biệt';
      }
      if (activeTab === 't7') {
        const days = diffDaysYmd(today, sc.ngay);
        return days >= 0 && days <= 7;
      }
      if (activeTab === 'approved') {
        return sc.trang_thai === 'Đã phê duyệt' || sc.trang_thai === 'Đã chốt giữ nguyên' || sc.trang_thai === 'Đã duyệt';
      }
      if (activeTab === 'adjust') {
        return sc.trang_thai === 'Cần rà soát điều chỉnh';
      }
      return true;
    });
  }, [scopedSimClasses, activeTab, today]);

  // KPIs được tính toán theo đúng phạm vi Bộ môn (hoặc toàn CECICS nếu là Admin/Lãnh đạo/Staff)
  const kpiTotal = scopedSimClasses.length;
  const kpiPending = scopedSimClasses.filter((sc) => sc.trang_thai === 'Chờ rà soát' || sc.trang_thai === 'Cần xét đặc biệt').length;
  const kpiT7 = scopedSimClasses.filter((sc) => {
    const days = diffDaysYmd(today, sc.ngay);
    return days >= 0 && days <= 7 && sc.trang_thai !== 'Đã hủy' && sc.trang_thai !== 'Từ chối';
  }).length;
  const kpiAdjust = scopedSimClasses.filter((sc) => sc.trang_thai === 'Cần rà soát điều chỉnh').length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lớp Mô Phỏng & Phê Duyệt Song Song (3 Biểu Mẫu)"
        subtitle="Chuẩn hóa theo 3 biểu mẫu Y khoa: Kế hoạch sử dụng mô hình, Yêu cầu khóa học lâm sàng và Dự trù vật tư tiêu hao · Liên thông ký số E-Office"
        actions={
          canCreate && (
            <button
              onClick={() => {
                setWizardStep(1);
                if (user.bo_mon_id) {
                  setForm((prev) => ({
                    ...prev,
                    bo_mon_id: user.bo_mon_id || prev.bo_mon_id,
                    giang_vien_phu_trach: user.ho_ten || prev.giang_vien_phu_trach,
                    email_lien_he: user.email || prev.email_lien_he,
                  }));
                }
                setCreateOpen(true);
              }}
              className="px-4 py-2.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold shadow-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <span>+</span> Đăng ký Lớp Mô Phỏng Mới
            </button>
          )
        }
      />

      {/* Thông báo phạm vi dữ liệu phân quyền theo quy chuẩn Bộ môn */}
      {!isStaff && user.bo_mon_id ? (
        <div className="flex items-center gap-2.5 bg-blue-50 border border-blue-200 px-4 py-2.5 rounded-xl text-xs text-blue-900 shadow-2xs">
          <span className="text-base">🔒</span>
          <div>
            <strong>Phạm vi dữ liệu:</strong> Đang hiển thị danh sách phiếu yêu cầu của riêng{' '}
            <strong>{userDept?.ten || user.bo_mon_id}</strong>. (Theo quy chuẩn bảo mật nghiệp vụ, mỗi Bộ môn chỉ thấy và quản lý các phiếu của chính đơn vị mình).
          </div>
        </div>
      ) : (
        <div className="flex items-center gap-2.5 bg-slate-100 border border-slate-200 px-4 py-2 rounded-xl text-xs text-slate-700 shadow-2xs">
          <span className="text-base">🌐</span>
          <div>
            <strong>Phạm vi quản trị:</strong> Bạn có quyền quản trị/điều phối toàn hệ thống CECICS — Đang hiển thị phiếu yêu cầu của tất cả các Bộ môn.
          </div>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Tổng Lớp Mô Phỏng" value={kpiTotal} hint="Toàn hệ thống năm 2026-2027" tone="default" />
        <KpiCard label="Chờ Rà Soát Song Song" value={kpiPending} hint="Cần Hành chính & Kỹ thuật xem xét" tone="amber" />
        <KpiCard label="Lớp Sắp Tới (Mốc T-7)" value={kpiT7} hint="Cần Hành chính phát thư nhắc Bộ môn" tone="teal" />
        <KpiCard label="Cần Điều Chỉnh Phòng/TB" value={kpiAdjust} hint="Bộ môn yêu cầu đổi giờ/bổ sung" tone={kpiAdjust > 0 ? 'red' : 'emerald'} />
      </div>

      {/* Tabs filter */}
      <div className="flex border-b border-slate-200 gap-2 overflow-x-auto pb-px">
        {[
          { key: 'all', label: `Tất cả (${kpiTotal})` },
          { key: 'pending', label: `Chờ rà soát (${kpiPending})` },
          { key: 't7', label: `Lớp sắp tới T-7 (${kpiT7})` },
          { key: 'approved', label: 'Đã phê duyệt / Đã chốt' },
          { key: 'adjust', label: `Cần điều chỉnh (${kpiAdjust})` },
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className={`px-4 py-2.5 text-xs sm:text-sm font-semibold whitespace-nowrap border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-teal-700 text-teal-800 bg-teal-50/50'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:border-slate-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Danh sách lớp mô phỏng */}
      <div className="space-y-4">
        {filteredSimClasses.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500 text-sm">
            Không có lớp mô phỏng nào trong phân loại này.
          </div>
        ) : (
          filteredSimClasses.map((sc) => {
            const linkedEqs = db.SimClassEquipment.filter((l) => l.sim_id === sc.sim_id).map(
              (l) => eqMap.get(l.equipment_id)?.ten || l.equipment_id
            );
            const daysLeft = diffDaysYmd(today, sc.ngay);

            let statusTone: 'emerald' | 'red' | 'amber' | 'slate' | 'blue' = 'slate';
            if (sc.trang_thai === 'Đã chốt giữ nguyên') statusTone = 'emerald';
            else if (sc.trang_thai === 'Đã phê duyệt' || sc.trang_thai === 'Đã duyệt') statusTone = 'blue';
            else if (sc.trang_thai === 'Nhắc xác nhận T-7') statusTone = 'teal' as any;
            else if (sc.trang_thai === 'Cần rà soát điều chỉnh') statusTone = 'red';
            else if (sc.trang_thai === 'Cần xét đặc biệt') statusTone = 'red';
            else if (sc.trang_thai === 'Chờ rà soát') statusTone = 'amber';

            const roomList = parseRoomIds(sc.room_id);
            const isNear = daysLeft >= 0 && daysLeft <= 7;
            const scSessions = parseSimSessions(sc);
            const isMulti = scSessions.length > 1;

            return (
              <div
                key={sc.sim_id}
                className={`bg-white rounded-xl border p-5 shadow-xs transition-shadow hover:shadow-md ${
                  sc.trang_thai === 'Cần rà soát điều chỉnh'
                    ? 'border-red-300 bg-red-50/20'
                    : sc.trang_thai === 'Cần xét đặc biệt'
                      ? 'border-amber-300 bg-amber-50/20'
                      : isNear
                        ? 'border-sky-300 bg-sky-50/10'
                        : 'border-slate-200'
                }`}
              >
                <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                        {sc.sim_id}
                      </span>
                      <Badge tone={statusTone}>{sc.trang_thai}</Badge>
                      {isMulti && (
                        <span className="text-xs font-bold text-teal-900 bg-teal-100/80 px-2 py-0.5 rounded-full border border-teal-300">
                          📅 Khóa học {scSessions.length} buổi
                        </span>
                      )}
                      {sc.dang_ky_tre && <Badge tone="red">Trễ hạn (&lt; 14 ngày)</Badge>}
                      <Badge tone="teal">{sc.campus_id === 'HH' ? 'Cơ sở Hòa Hưng' : 'Cơ sở Tân Nhật'}</Badge>
                      <span className="text-xs font-semibold text-slate-700 bg-slate-50 px-2 py-0.5 rounded border border-slate-200">
                        {deptMap.get(sc.bo_mon_id)?.ten || sc.bo_mon_id}
                      </span>
                      {isNear && (
                        <span className="text-xs font-bold text-sky-800 bg-sky-100 px-2.5 py-0.5 rounded-full border border-sky-300 animate-pulse">
                          ⏱️ Còn {daysLeft} ngày nữa diễn ra (Mốc T-7)
                        </span>
                      )}
                    </div>

                    <div className="font-bold text-slate-900 text-lg">{sc.noi_dung}</div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs text-slate-600 bg-slate-50/70 p-3 rounded-lg border border-slate-200/60">
                      <div>
                        {isMulti ? (
                          <div>
                            <strong>📅 Thời gian:</strong> {scSessions.length} buổi ({summarizeSimSchedule(scSessions)})
                            <button
                              type="button"
                              onClick={() => setExpandedSims((prev) => ({ ...prev, [sc.sim_id]: !prev[sc.sim_id] }))}
                              className="ml-2 text-2xs text-teal-800 underline font-semibold hover:text-teal-900 cursor-pointer inline-block"
                            >
                              {expandedSims[sc.sim_id] ? '▲ Thu gọn' : '▼ Xem chi tiết các buổi'}
                            </button>
                          </div>
                        ) : (
                          <div>
                            <strong>📅 Thời gian:</strong> {formatVnDateWithDay(sc.ngay)} ({sc.gio_bd}–{sc.gio_kt}) · Buổi: {sc.buoi_hoc || 'Sáng'}
                          </div>
                        )}
                      </div>
                      <div>
                        <strong>👥 Quy mô:</strong> {sc.so_hoc_vien} HV ({sc.so_nhom || 1} nhóm · {sc.so_hv_moi_nhom || sc.so_hoc_vien} HV/nhóm)
                      </div>
                      <div>
                        <strong>👨‍🏫 Giảng viên phụ trách:</strong> {sc.giang_vien_phu_trach || userMap.get(sc.nguoi_dang_ky)?.ho_ten || '...'}
                        {sc.sdt_lien_he ? ` (SĐT: ${sc.sdt_lien_he})` : ''}
                      </div>
                      <div>
                        <strong>📧 Email liên hệ:</strong> {sc.email_lien_he || userMap.get(sc.nguoi_dang_ky)?.email || '...'}
                      </div>
                      <div className="md:col-span-2">
                        <strong>🛠️ Thiết bị & Mô hình:</strong> {sc.thiet_bi_yeu_cau || 'Theo danh mục dự trù Mẫu 1'}
                        {sc.nhu_cau_sp ? ` · Bệnh nhân chuẩn: ${sc.nhu_cau_sp}` : ''}
                      </div>
                    </div>

                    {/* Chi tiết từng buổi học khi mở rộng */}
                    {isMulti && expandedSims[sc.sim_id] && (
                      <div className="p-3 bg-teal-50/40 rounded-lg border border-teal-200 space-y-1.5 text-xs">
                        <div className="font-bold text-teal-900 flex items-center justify-between">
                          <span>Chi tiết {scSessions.length} buổi học trong khóa:</span>
                          <span className="text-2xs font-normal text-slate-500">Giờ 24h (hh:mm) · dd/mm/yyyy</span>
                        </div>
                        <div className="overflow-x-auto border border-teal-200/80 rounded bg-white">
                          <table className="w-full text-xs">
                            <thead className="bg-teal-50/80 text-teal-900 font-bold border-b border-teal-200">
                              <tr>
                                <th className="p-1.5 text-center w-12">Buổi</th>
                                <th className="p-1.5 text-left">Ngày &amp; Thứ</th>
                                <th className="p-1.5 text-center w-24">Buổi &amp; Giờ</th>
                                <th className="p-1.5 text-left">Phòng xếp</th>
                                <th className="p-1.5 text-left">KTV phụ trách</th>
                                <th className="p-1.5 text-center w-24">Trạng thái</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {scSessions.map((buoi) => {
                                const specificRoom = buoi.room_id ? roomMap.get(buoi.room_id)?.ten || buoi.room_id : null;
                                const fallbackRoom = roomList.map((rid) => roomMap.get(rid)?.ten || rid).join(' + ') || 'Chờ gán';
                                const specificKtv = buoi.ktv_phu_trach ? userMap.get(buoi.ktv_phu_trach)?.ho_ten || buoi.ktv_phu_trach : null;
                                const fallbackKtv = sc.ktv_phu_trach ? userMap.get(sc.ktv_phu_trach)?.ho_ten || sc.ktv_phu_trach : 'Chờ gán';
                                return (
                                  <tr key={buoi.buoi_so} className="hover:bg-teal-50/20">
                                    <td className="p-1.5 text-center font-bold text-teal-800">#{buoi.buoi_so}</td>
                                    <td className="p-1.5 font-semibold text-slate-800">{formatVnDateWithDay(buoi.ngay)}</td>
                                    <td className="p-1.5 text-center">{buoi.buoi_hoc} ({buoi.gio_bd}–{buoi.gio_kt})</td>
                                    <td className="p-1.5 font-medium text-teal-800">{specificRoom ? `${specificRoom} (riêng)` : fallbackRoom}</td>
                                    <td className="p-1.5 text-slate-700">{specificKtv ? `${specificKtv} (riêng)` : fallbackKtv}</td>
                                    <td className="p-1.5 text-center">
                                      <span className={`px-2 py-0.5 rounded text-2xs font-semibold ${
                                        buoi.trang_thai_buoi === 'Hủy' ? 'bg-red-100 text-red-700' : 'bg-slate-100 text-slate-700'
                                      }`}>
                                        {buoi.trang_thai_buoi || 'Kế hoạch'}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Khu vực Dual-Approval (Hành chính + Kỹ thuật) */}
                    <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
                      <div className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                        <span className="font-semibold text-slate-700">🏛️ Duyệt Hành chính:</span>
                        <Badge tone={sc.duyet_hanh_chinh === 'Đã duyệt' ? 'emerald' : sc.duyet_hanh_chinh === 'Từ chối' ? 'red' : 'amber'}>
                          {sc.duyet_hanh_chinh || 'Chờ'}
                        </Badge>
                        {sc.ghi_chu_hanh_chinh && <span className="text-slate-500 italic">({sc.ghi_chu_hanh_chinh})</span>}
                      </div>

                      <div className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                        <span className="font-semibold text-slate-700">🛠️ Duyệt Kỹ thuật:</span>
                        <Badge tone={sc.duyet_ky_thuat === 'Đã duyệt' ? 'emerald' : sc.duyet_ky_thuat === 'Từ chối' ? 'red' : 'amber'}>
                          {sc.duyet_ky_thuat || 'Chờ'}
                        </Badge>
                        {sc.room_id ? (
                          <span className="font-medium text-teal-800">
                            · Phòng: {roomList.map((rid) => roomMap.get(rid)?.ten || rid).join(' + ')}
                          </span>
                        ) : null}
                        {linkedEqs.length > 0 && <span className="text-slate-600">· Đã gán {linkedEqs.length} thiết bị</span>}
                      </div>
                    </div>

                    {/* Hiển thị phản hồi Bộ môn hoặc thư nhắc T-7 nếu có */}
                    {sc.ngay_nhac_t7 && (
                      <div className="text-xs text-sky-700 bg-sky-50 px-2.5 py-1 rounded border border-sky-200 inline-block">
                        ✉️ Hành chính đã phát email nhắc nhở T-7 ngày cho Bộ môn.
                      </div>
                    )}
                    {sc.phan_hoi_bo_mon && (
                      <div className={`text-xs p-2.5 rounded border ${
                        sc.trang_thai === 'Cần rà soát điều chỉnh'
                          ? 'bg-red-50 border-red-300 text-red-800 font-medium'
                          : 'bg-emerald-50 border-emerald-300 text-emerald-800'
                      }`}>
                        <strong>Phản hồi của Bộ môn:</strong> {sc.phan_hoi_bo_mon}
                      </div>
                    )}
                  </div>

                  {/* Cột Action Buttons */}
                  <div className="flex flex-col sm:flex-row lg:flex-col gap-2 shrink-0 pt-2 lg:pt-0">
                    {/* Nút Xuất PDF E-Office */}
                    <a
                      href={`/api/export-sim-pdf?sim_id=${sc.sim_id}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-bold text-center flex items-center justify-center gap-1.5 transition-colors shadow-2xs"
                    >
                      <span>📄</span> Xuất PDF Ký Số E-Office
                    </a>

                    {/* Nút Duyệt Hành chính */}
                    {canReviewAdmin && sc.duyet_hanh_chinh !== 'Đã duyệt' && (
                      <button
                        onClick={() => openAdminReviewModal(sc)}
                        className="px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold text-center transition-colors cursor-pointer"
                      >
                        🏛️ Duyệt Hành chính
                      </button>
                    )}

                    {/* Nút Rà soát Kỹ thuật */}
                    {canReviewTech && (
                      <button
                        onClick={() => openTechReviewModal(sc)}
                        className="px-3 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold text-center transition-colors cursor-pointer"
                      >
                        🛠️ Kỹ thuật: Gán Phòng &amp; TB
                      </button>
                    )}

                    {/* Nút Phát thư nhắc T-7 cho Hành chính */}
                    {canSendReminder && isNear && sc.trang_thai !== 'Đã chốt giữ nguyên' && (
                      <button
                        onClick={() => setReminderTarget(sc)}
                        className="px-3 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold text-center transition-colors cursor-pointer"
                      >
                        ✉️ Phát thư nhắc T-7
                      </button>
                    )}

                    {/* Nút Xác nhận hoặc Điều chỉnh cho Bộ môn */}
                    {(user.user_id === sc.nguoi_dang_ky || user.bo_mon_id === sc.bo_mon_id || user.vai_tro.includes(ROLES.DAU_MOI_BO_MON) || user.vai_tro.includes(ROLES.ADMIN)) && (
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => {
                            setConfirmTarget(sc);
                            setConfirmResponseType('Giữ nguyên');
                            setConfirmNote('Bộ môn xác nhận giữ nguyên đúng kế hoạch và danh mục thiết bị.');
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold flex-1 text-center transition-colors cursor-pointer"
                          title="Xác nhận giữ nguyên kế hoạch"
                        >
                          ✅ Giữ nguyên
                        </button>
                        <button
                          onClick={() => {
                            setConfirmTarget(sc);
                            setConfirmResponseType('Điều chỉnh');
                            setConfirmNote('');
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 text-white text-xs font-semibold flex-1 text-center transition-colors cursor-pointer"
                          title="Đề xuất điều chỉnh ngày giờ/thiết bị"
                        >
                          ✏️ Điều chỉnh
                        </button>
                      </div>
                    )}

                    {/* Nút xét duyệt trễ hạn cho Lãnh đạo */}
                    {sc.trang_thai === 'Cần xét đặc biệt' && canApproveLate && (
                      <button
                        onClick={() => {
                          setLateTarget(sc);
                          setLateNote('');
                        }}
                        className="px-3 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-xs font-semibold text-center transition-colors cursor-pointer"
                      >
                        Xét duyệt trễ hạn
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* ======================================================== */}
      {/* MODAL 1: FORM WIZARD 3 BƯỚC ĐĂNG KÝ LỚP MÔ PHỎNG        */}
      {/* ======================================================== */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Đăng Ký Khóa Học Mô Phỏng & Dự Trù Dụng Cụ (Mẫu 1 + 2 + 3)"
        maxWidth="max-w-4xl"
      >
        <div className="space-y-4">
          {/* Thanh Tiến trình Wizard */}
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            {[
              { step: 1, label: '1. Thông tin lớp & Hành chính (Mẫu 2 & 3)' },
              { step: 2, label: '2. Bệnh nhân chuẩn & Mục tiêu (Mẫu 3)' },
              { step: 3, label: '3. Dự trù Mô hình, Dụng cụ & Vật tư (Mẫu 1)' },
            ].map((s) => (
              <button
                key={s.step}
                type="button"
                onClick={() => setWizardStep(s.step as any)}
                className={`text-xs font-bold px-3 py-1.5 rounded-md transition-colors ${
                  wizardStep === s.step
                    ? 'bg-teal-700 text-white shadow-xs'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          <form onSubmit={handleCreateFull} className="space-y-4">
            {/* BƯỚC 1: THÔNG TIN LỚP & HÀNH CHÍNH */}
            {wizardStep === 1 && (
              <div className="space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className={labelCls}>
                      Khoa / Bộ môn đề xuất * {!isStaff && Boolean(user.bo_mon_id) ? '(Cố định theo Bộ môn của Thầy/Cô)' : ''}
                    </label>
                    <select
                      value={form.bo_mon_id}
                      disabled={!isStaff && Boolean(user.bo_mon_id)}
                      onChange={(e) => setForm({ ...form, bo_mon_id: e.target.value })}
                      className={`${inputCls} ${!isStaff && Boolean(user.bo_mon_id) ? 'bg-slate-100 cursor-not-allowed text-slate-700 font-semibold' : ''}`}
                    >
                      {db.Departments.map((d) => (
                        <option key={d.bo_mon_id} value={d.bo_mon_id}>
                          {d.ten} ({d.bo_mon_id})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className={labelCls}>Khóa đào tạo / Đối tượng học viên *</label>
                    <input
                      required
                      value={form.doi_tuong_hoc_vien}
                      onChange={(e) => setForm({ ...form, doi_tuong_hoc_vien: e.target.value })}
                      placeholder="VD: Sinh viên Y5 Đa khoa - Lớp K52"
                      className={inputCls}
                    />
                  </div>
                </div>

                <div>
                  <label className={labelCls}>Tên khóa học / Bài giảng mô phỏng *</label>
                  <input
                    required
                    value={form.noi_dung}
                    onChange={(e) => setForm({ ...form, noi_dung: e.target.value })}
                    placeholder="VD: Khóa học Siêu âm tổng quát thực hành K52"
                    className={inputCls}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className={labelCls}>Giảng viên phụ trách chuyên môn *</label>
                    <input
                      required
                      value={form.giang_vien_phu_trach}
                      onChange={(e) => setForm({ ...form, giang_vien_phu_trach: e.target.value })}
                      placeholder="VD: ThS. BSCKII. Phạm Nguyên Vũ"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Số điện thoại liên hệ *</label>
                    <input
                      required
                      value={form.sdt_lien_he}
                      onChange={(e) => setForm({ ...form, sdt_lien_he: e.target.value })}
                      placeholder="VD: 0983738421"
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Email nhận thông báo *</label>
                    <input
                      type="email"
                      required
                      value={form.email_lien_he}
                      onChange={(e) => setForm({ ...form, email_lien_he: e.target.value })}
                      placeholder="VD: vuphammd@pnt.edu.vn"
                      className={inputCls}
                    />
                  </div>
                </div>

                {/* Chọn hình thức: 1 buổi đơn lẻ HOẶC Chuỗi nhiều buổi */}
                <div className="flex items-center gap-4 p-3 bg-slate-50 rounded-xl border border-slate-200">
                  <span className="text-xs font-bold text-slate-700">Hình thức đào tạo:</span>
                  <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer">
                    <input
                      type="radio"
                      name="kieu_dang_ky"
                      checked={!isRecurring}
                      onChange={() => {
                        setIsRecurring(false);
                        setForm((prev) => ({
                          ...prev,
                          items: prev.items.map((it) => ({
                            ...it,
                            sl_tong: computeItemTotal(it, prev.so_nhom || 1, 1),
                          })),
                        }));
                      }}
                      className="accent-teal-700"
                    />
                    <span>1 Buổi đơn lẻ</span>
                  </label>
                  <label className="flex items-center gap-1.5 text-xs font-semibold cursor-pointer text-teal-800">
                    <input
                      type="radio"
                      name="kieu_dang_ky"
                      checked={isRecurring}
                      onChange={() => {
                        setIsRecurring(true);
                        setForm((prev) => ({
                          ...prev,
                          items: prev.items.map((it) => ({
                            ...it,
                            sl_tong: computeItemTotal(it, prev.so_nhom || 1, sessions.length || 1),
                          })),
                        }));
                      }}
                      className="accent-teal-700"
                    />
                    <span>📅 Chuỗi nhiều buổi (Lịch định kỳ)</span>
                  </label>
                </div>

                {!isRecurring ? (
                  /* 1 BUỔI ĐƠN LẺ */
                  <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                    <div>
                      <label className={labelCls}>Cơ sở thực hành *</label>
                      <select
                        value={form.campus_id}
                        onChange={(e) => setForm({ ...form, campus_id: e.target.value })}
                        className={inputCls}
                      >
                        {db.Campuses.map((c) => (
                          <option key={c.campus_id} value={c.campus_id}>
                            {c.ten} ({c.campus_id})
                          </option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className={labelCls}>
                        Ngày học * {form.ngay ? <span className="text-teal-700 font-bold">({formatVnDateWithDay(form.ngay)})</span> : ''}
                      </label>
                      <input
                        type="date"
                        required
                        value={form.ngay}
                        onChange={(e) => setForm({ ...form, ngay: e.target.value })}
                        className={inputCls}
                      />
                    </div>
                    <div>
                      <label className={labelCls}>Buổi học</label>
                      <select
                        value={form.buoi_hoc}
                        onChange={(e) => setForm({ ...form, buoi_hoc: e.target.value })}
                        className={inputCls}
                      >
                        <option value="Sáng">Sáng (08:00–11:30)</option>
                        <option value="Chiều">Chiều (13:30–16:30)</option>
                        <option value="Cả ngày">Cả ngày (08:00–16:30)</option>
                      </select>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      <div>
                        <label className={labelCls}>Bắt đầu</label>
                        <input
                          type="time"
                          value={form.gio_bd}
                          onChange={(e) => setForm({ ...form, gio_bd: e.target.value })}
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Kết thúc</label>
                        <input
                          type="time"
                          value={form.gio_kt}
                          onChange={(e) => setForm({ ...form, gio_kt: e.target.value })}
                          className={inputCls}
                        />
                      </div>
                    </div>
                  </div>
                ) : (
                  /* CHUỖI NHIỀU BUỔI / LỊCH ĐỊNH KỲ */
                  <div className="space-y-3 bg-teal-50/50 p-3.5 rounded-xl border border-teal-200">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-teal-900">
                        ⚡ Thiết lập lịch định kỳ & Sinh danh sách buổi
                      </span>
                      <div className="w-48">
                        <select
                          value={form.campus_id}
                          onChange={(e) => setForm({ ...form, campus_id: e.target.value })}
                          className="w-full text-xs border border-teal-300 rounded px-2 py-1 bg-white font-semibold"
                        >
                          {db.Campuses.map((c) => (
                            <option key={c.campus_id} value={c.campus_id}>
                              Cơ sở: {c.ten} ({c.campus_id})
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Bộ lọc lặp theo các thứ trong tuần */}
                    <div className="space-y-1.5">
                      <label className="text-2xs font-bold text-slate-700 uppercase">
                        Chọn các thứ học trong tuần (T2 là đầu tuần, T7 CN là cuối tuần):
                      </label>
                      <div className="flex flex-wrap gap-1.5">
                        {WEEKDAY_OPTIONS.map((opt) => {
                          const active = recurringDays.includes(opt.value);
                          return (
                            <button
                              key={opt.value}
                              type="button"
                              onClick={() => {
                                const next = active
                                  ? recurringDays.filter((x) => x !== opt.value)
                                  : [...recurringDays, opt.value];
                                setRecurringDays(next);
                              }}
                              className={`px-3 py-1 rounded-md text-xs font-bold transition-all cursor-pointer ${
                                active
                                  ? 'bg-teal-700 text-white shadow-2xs'
                                  : opt.weekend
                                  ? 'bg-amber-100 text-amber-900 border border-amber-300 hover:bg-amber-200'
                                  : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-100'
                              }`}
                            >
                              {opt.label} {opt.weekend ? '(Cuối tuần)' : ''}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5 items-end">
                      <div>
                        <label className={labelCls}>Từ ngày (dd/mm/yyyy)</label>
                        <input
                          type="date"
                          value={recurringRange.tu_ngay}
                          onChange={(e) => setRecurringRange({ ...recurringRange, tu_ngay: e.target.value })}
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Đến ngày (dd/mm/yyyy)</label>
                        <input
                          type="date"
                          value={recurringRange.den_ngay}
                          onChange={(e) => setRecurringRange({ ...recurringRange, den_ngay: e.target.value })}
                          className={inputCls}
                        />
                      </div>
                      <div>
                        <label className={labelCls}>Buổi & Khung giờ</label>
                        <select
                          value={recurringRange.buoi_hoc}
                          onChange={(e) => {
                            const b = e.target.value;
                            const times = defaultTimesForBuoi(b);
                            setRecurringRange({ ...recurringRange, buoi_hoc: b, ...times });
                          }}
                          className={inputCls}
                        >
                          <option value="Sáng">Sáng (08:00–11:30)</option>
                          <option value="Chiều">Chiều (13:30–16:30)</option>
                          <option value="Cả ngày">Cả ngày (08:00–16:30)</option>
                        </select>
                      </div>
                      <div>
                        <button
                          type="button"
                          onClick={handleGenerateRecurring}
                          className="w-full px-3 py-2 rounded-lg bg-teal-800 hover:bg-teal-900 text-white text-xs font-bold shadow-xs cursor-pointer"
                        >
                          ⚡ Tự động tạo buổi
                        </button>
                      </div>
                    </div>

                    {/* Danh sách các buổi xem trước & chỉnh sửa */}
                    <div className="pt-2 border-t border-teal-200/80 space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-bold text-teal-900">
                          📋 Danh sách {sessions.length} buổi học ({summarizeSimSchedule(sessions)}):
                        </span>
                        <button
                          type="button"
                          onClick={() => {
                            const lastNgay = sessions[sessions.length - 1]?.ngay || recurringRange.den_ngay || today;
                            const nextNgay = addDaysYmd(lastNgay, 7);
                            const newSession: SimSessionItem = {
                              buoi_so: sessions.length + 1,
                              ngay: nextNgay,
                              buoi_hoc: recurringRange.buoi_hoc,
                              gio_bd: recurringRange.gio_bd,
                              gio_kt: recurringRange.gio_kt,
                              trang_thai_buoi: 'Kế hoạch',
                            };
                            const updated = normalizeSimSessions([...sessions, newSession]);
                            setSessions(updated);
                            setForm((prev) => ({
                              ...prev,
                              items: prev.items.map((it) => ({
                                ...it,
                                sl_tong: computeItemTotal(it, prev.so_nhom || 1, updated.length),
                              })),
                            }));
                          }}
                          className="text-2xs font-bold px-2 py-1 bg-white border border-teal-300 text-teal-800 rounded hover:bg-teal-50 cursor-pointer"
                        >
                          + Thêm 1 buổi thủ công
                        </button>
                      </div>

                      <div className="max-h-48 overflow-y-auto border border-teal-200 rounded-lg bg-white divide-y divide-slate-100">
                        {sessions.map((s, idx) => (
                          <div key={idx} className="flex items-center justify-between gap-2 p-2 text-xs">
                            <span className="font-bold text-teal-900 w-16">Buổi {s.buoi_so}</span>
                            <div className="flex items-center gap-1 flex-1">
                              <span className="font-semibold text-slate-700 w-32">
                                {formatVnDateWithDay(s.ngay)}
                              </span>
                              <input
                                type="date"
                                value={s.ngay}
                                onChange={(e) => {
                                  const next = [...sessions];
                                  next[idx] = { ...next[idx], ngay: e.target.value };
                                  setSessions(normalizeSimSessions(next));
                                }}
                                className="text-2xs border border-slate-200 rounded px-1.5 py-0.5"
                              />
                              <input
                                type="time"
                                value={s.gio_bd}
                                onChange={(e) => {
                                  const next = [...sessions];
                                  next[idx] = { ...next[idx], gio_bd: e.target.value };
                                  setSessions(next);
                                }}
                                className="text-2xs border border-slate-200 rounded px-1 py-0.5 w-18"
                              />
                              <span>–</span>
                              <input
                                type="time"
                                value={s.gio_kt}
                                onChange={(e) => {
                                  const next = [...sessions];
                                  next[idx] = { ...next[idx], gio_kt: e.target.value };
                                  setSessions(next);
                                }}
                                className="text-2xs border border-slate-200 rounded px-1 py-0.5 w-18"
                              />
                            </div>
                            {sessions.length > 1 && (
                              <button
                                type="button"
                                onClick={() => {
                                  const filtered = sessions.filter((_, i) => i !== idx);
                                  const normalized = normalizeSimSessions(filtered);
                                  setSessions(normalized);
                                  setForm((prev) => ({
                                    ...prev,
                                    items: prev.items.map((it) => ({
                                      ...it,
                                      sl_tong: computeItemTotal(it, prev.so_nhom || 1, normalized.length),
                                    })),
                                  }));
                                }}
                                className="text-red-500 hover:text-red-700 font-bold px-1.5 cursor-pointer"
                                title="Xóa buổi này"
                              >
                                ✕
                              </button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className={labelCls}>Tổng số học viên dự kiến *</label>
                    <input
                      type="number"
                      min={1}
                      required
                      value={form.so_hoc_vien}
                      onChange={(e) => {
                        const total = Number(e.target.value) || 0;
                        const perGroup = Math.ceil(total / (form.so_nhom || 1));
                        setForm({ ...form, so_hoc_vien: total, so_hv_moi_nhom: perGroup });
                      }}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Số nhóm thực hành *</label>
                    <input
                      type="number"
                      min={1}
                      required
                      value={form.so_nhom}
                      onChange={(e) => {
                        const groups = Number(e.target.value) || 1;
                        const perGroup = Math.ceil((form.so_hoc_vien || 10) / groups);
                        // Cập nhật lại tổng dự trù ở bảng vật tư
                        const updatedItems = form.items.map((it) => ({
                          ...it,
                          sl_tong: (it.sl_nhom || 1) * groups,
                        }));
                        setForm({ ...form, so_nhom: groups, so_hv_moi_nhom: perGroup, items: updatedItems });
                      }}
                      className={inputCls}
                    />
                  </div>
                  <div>
                    <label className={labelCls}>Số học viên / nhóm</label>
                    <input
                      type="number"
                      min={1}
                      value={form.so_hv_moi_nhom}
                      onChange={(e) => setForm({ ...form, so_hv_moi_nhom: Number(e.target.value) || 1 })}
                      className={inputCls}
                    />
                  </div>
                </div>

                {isLateForm && (
                  <div className="p-3 rounded-lg bg-amber-50 border border-amber-300 text-xs text-amber-900">
                    ⚠️ Ngày chọn chỉ còn <strong>{daysAheadForm} ngày</strong> (quy định tối thiểu {settings.HAN_DANG_KY_MO_PHONG_NGAY} ngày).
                    Hồ sơ sẽ được chuyển vào chế độ <strong>“Cần xét đặc biệt”</strong> để Lãnh đạo thẩm định.
                  </div>
                )}

                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    onClick={() => setWizardStep(2)}
                    className="px-5 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold cursor-pointer"
                  >
                    Tiếp tục: Bước 2 (Nghiệp vụ Y khoa) →
                  </button>
                </div>
              </div>
            )}

            {/* BƯỚC 2: BỆNH NHÂN CHUẨN & MỤC TIÊU LÂM SÀNG (MẪU 3) */}
            {wizardStep === 2 && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5 uppercase">
                    1. Bệnh nhân chuẩn (Standardized Patient / Simulator)
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
                    {['Sơ sinh', 'Sản phụ', 'Người lớn', 'Trẻ em', 'Nhũ nhi', 'Huấn luyện kỹ năng từng phần'].map((opt) => {
                      const checked = form.benh_nhan_chuan.includes(opt);
                      return (
                        <label key={opt} className="flex items-center gap-2 text-xs text-slate-800 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? [...form.benh_nhan_chuan, opt]
                                : form.benh_nhan_chuan.filter((x) => x !== opt);
                              setForm({ ...form, benh_nhan_chuan: next });
                            }}
                            className="accent-teal-700"
                          />
                          <span>{opt}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1.5 uppercase">
                    2. Bối cảnh lâm sàng (Clinical Environment)
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-slate-50 p-3 rounded-lg border border-slate-200">
                    {['Chuyển bệnh cấp cứu', 'Chăm sóc cấp', 'Chấn thương', 'Chăm sóc tích cực', 'Khác'].map((opt) => {
                      const checked = form.boi_canh_lam_sang.includes(opt);
                      return (
                        <label key={opt} className="flex items-center gap-2 text-xs text-slate-800 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? [...form.boi_canh_lam_sang, opt]
                                : form.boi_canh_lam_sang.filter((x) => x !== opt);
                              setForm({ ...form, boi_canh_lam_sang: next });
                            }}
                            className="accent-teal-700"
                          />
                          <span>{opt}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className={labelCls}>3. Mục tiêu đào tạo lâm sàng (Learning Objectives) *</label>
                  <textarea
                    rows={3}
                    required
                    value={form.muc_tieu_dao_tao}
                    onChange={(e) => setForm({ ...form, muc_tieu_dao_tao: e.target.value })}
                    placeholder="Nhập 3 mục tiêu lâm sàng mong đợi..."
                    className={inputCls}
                  />
                </div>

                <div>
                  <label className={labelCls}>4. Kỹ năng mong đợi thực hiện (Psychomotor &amp; Behavioral Skills) *</label>
                  <textarea
                    rows={2}
                    required
                    value={form.ky_nang_mong_doi}
                    onChange={(e) => setForm({ ...form, ky_nang_mong_doi: e.target.value })}
                    placeholder="Mô tả kỹ năng thao tác trên mô hình..."
                    className={inputCls}
                  />
                </div>

                <div className="flex justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setWizardStep(1)}
                    className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold cursor-pointer"
                  >
                    ← Quay lại Bước 1
                  </button>
                  <button
                    type="button"
                    onClick={() => setWizardStep(3)}
                    className="px-5 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold cursor-pointer"
                  >
                    Tiếp tục: Bước 3 (Bảng Dự Trù Vật Tư Mẫu 1) →
                  </button>
                </div>
              </div>
            )}

            {/* BƯỚC 3: BẢNG DỰ TRÙ MÔ HÌNH, DỤNG CỤ, VẬT TƯ TIÊU HAO (MẪU 1) */}
            {wizardStep === 3 && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="text-xs text-slate-600">
                    💡 Công thức: <strong>Mô hình/Máy = SL/nhóm × {form.so_nhom} nhóm</strong> &nbsp;|&nbsp;{' '}
                    <strong>
                      Vật tư tiêu hao = SL/nhóm × {form.so_nhom} nhóm × {currentNumSessions} buổi
                    </strong>
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => addItemRow('mo_hinh')}
                      className="px-2.5 py-1 rounded bg-teal-50 border border-teal-200 text-teal-800 text-xs font-bold hover:bg-teal-100 cursor-pointer"
                    >
                      + Mô hình
                    </button>
                    <button
                      type="button"
                      onClick={() => addItemRow('dung_cu')}
                      className="px-2.5 py-1 rounded bg-blue-50 border border-blue-200 text-blue-800 text-xs font-bold hover:bg-blue-100 cursor-pointer"
                    >
                      + Dụng cụ/Máy
                    </button>
                    <button
                      type="button"
                      onClick={() => addItemRow('vat_tu')}
                      className="px-2.5 py-1 rounded bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold hover:bg-amber-100 cursor-pointer"
                    >
                      + Vật tư tiêu hao
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200">
                      <tr>
                        <th className="p-2 w-28">Phân loại</th>
                        <th className="p-2">Tên mô hình / dụng cụ / vật tư</th>
                        <th className="p-2 w-16 text-center">ĐVT</th>
                        <th className="p-2 w-20 text-center">SL/Nhóm</th>
                        <th className="p-2 w-20 text-center">Tổng dự trù</th>
                        <th className="p-2">Ghi chú</th>
                        <th className="p-2 w-10 text-center">Xóa</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {form.items.map((it, idx) => (
                        <tr key={idx} className="hover:bg-slate-50">
                          <td className="p-2">
                            <select
                              value={it.loai}
                              onChange={(e) => updateItemRow(idx, { loai: e.target.value as any })}
                              className="w-full text-xs border border-slate-200 rounded px-1.5 py-1 bg-white"
                            >
                              <option value="mo_hinh">Mô hình</option>
                              <option value="dung_cu">Dụng cụ/Máy</option>
                              <option value="vat_tu">Vật tư tiêu hao</option>
                            </select>
                          </td>
                          <td className="p-2">
                            <input
                              required
                              value={it.ten}
                              onChange={(e) => updateItemRow(idx, { ten: e.target.value })}
                              placeholder="VD: Mô hình siêu âm tổng quát..."
                              className="w-full text-xs border border-slate-200 rounded px-2 py-1"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              value={it.dvt || ''}
                              onChange={(e) => updateItemRow(idx, { dvt: e.target.value })}
                              className="w-full text-xs border border-slate-200 rounded px-1 py-1 text-center"
                            />
                          </td>
                          <td className="p-2">
                            <input
                              type="number"
                              min={1}
                              value={it.sl_nhom}
                              onChange={(e) => updateItemRow(idx, { sl_nhom: Number(e.target.value) || 1 })}
                              className="w-full text-xs border border-slate-200 rounded px-1 py-1 text-center"
                            />
                          </td>
                          <td className="p-2 text-center font-bold text-teal-800">
                            {it.sl_tong}
                          </td>
                          <td className="p-2">
                            <input
                              value={it.ghi_chu || ''}
                              onChange={(e) => updateItemRow(idx, { ghi_chu: e.target.value })}
                              placeholder="Ghi chú kỹ thuật..."
                              className="w-full text-xs border border-slate-200 rounded px-2 py-1"
                            />
                          </td>
                          <td className="p-2 text-center">
                            <button
                              type="button"
                              onClick={() => removeItemRow(idx)}
                              className="text-red-500 hover:text-red-700 font-bold px-1"
                              title="Xóa dòng"
                            >
                              ✕
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-between pt-3 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setWizardStep(2)}
                    className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold cursor-pointer"
                  >
                    ← Quay lại Bước 2
                  </button>
                  <button
                    type="submit"
                    className="px-6 py-2.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-sm font-bold shadow-md cursor-pointer transition-colors"
                  >
                    🚀 Hoàn Tất &amp; Gửi Phiếu Yêu Cầu (Mẫu 1 + 2 + 3)
                  </button>
                </div>
              </div>
            )}
          </form>
        </div>
      </Modal>

      {/* ======================================================== */}
      {/* MODAL 2: DUYỆT HÀNH CHÍNH CECICS                         */}
      {/* ======================================================== */}
      <Modal
        open={Boolean(adminReviewing)}
        onClose={() => setAdminReviewing(null)}
        title={`Thẩm Định & Duyệt Hành Chính — ${adminReviewing?.sim_id || ''}`}
      >
        {adminReviewing && (
          <form onSubmit={handleAdminReviewSubmit} className="space-y-4">
            <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 text-xs text-blue-900">
              <strong>{adminReviewing.noi_dung}</strong> · {formatVnDate(adminReviewing.ngay)} ({adminReviewing.gio_bd}–{adminReviewing.gio_kt})
              <div className="mt-1">
                Bộ môn: <strong>{deptMap.get(adminReviewing.bo_mon_id)?.ten || adminReviewing.bo_mon_id}</strong> · Quy mô: {adminReviewing.so_hoc_vien} HV
              </div>
            </div>

            <div>
              <label className={labelCls}>Quyết định phê duyệt Hành chính *</label>
              <select
                value={adminDecision}
                onChange={(e) => setAdminDecision(e.target.value as any)}
                className={inputCls}
              >
                <option value="Đã duyệt">✅ Đã duyệt (Hợp lệ khung kế hoạch &amp; chỉ tiêu)</option>
                <option value="Từ chối">❌ Từ chối hồ sơ</option>
              </select>
            </div>

            <div>
              <label className={labelCls}>Ghi chú hành chính / Số văn bản tiếp nhận</label>
              <textarea
                rows={2}
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder="VD: Tiếp nhận theo Công văn số 12/CĐHA ngày 20/11..."
                className={inputCls}
              />
            </div>

            <div className="p-3 rounded bg-slate-50 border border-slate-200 text-xs text-slate-600">
              ℹ️ <strong>Cơ chế duyệt song song:</strong> Sau khi Hành chính bấm duyệt, nếu Đơn vị Kỹ thuật cũng đã thẩm định xong, lớp sẽ tự động chuyển sang trạng thái <strong>“ĐÃ PHÊ DUYỆT”</strong>.
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setAdminReviewing(null)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold cursor-pointer"
              >
                Đóng
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold cursor-pointer"
              >
                Lưu Phê Duyệt Hành Chính
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* ======================================================== */}
      {/* MODAL 3: KỸ THUẬT RÀ SOÁT & GÁN PHÒNG / THIẾT BỊ          */}
      {/* ======================================================== */}
      <Modal
        open={Boolean(techReviewing)}
        onClose={() => setTechReviewing(null)}
        title={`Thẩm Định Kỹ Thuật & Gán Phòng/Thiết Bị — ${techReviewing?.sim_id || ''}`}
        maxWidth="max-w-2xl"
      >
        {techReviewing && (
          <form onSubmit={handleTechReviewSubmit} className="space-y-4">
            <div className="p-3 rounded-lg bg-teal-50 border border-teal-200 text-xs text-teal-900">
              <strong>{techReviewing.noi_dung}</strong> · {formatVnDate(techReviewing.ngay)} ({techReviewing.gio_bd}–{techReviewing.gio_kt}) · Cơ sở {techReviewing.campus_id}
              <div className="mt-1">
                Yêu cầu Bộ môn: <em>{techReviewing.thiet_bi_yeu_cau || 'Theo danh mục Mẫu 1'}</em>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Quyết định Kỹ thuật</label>
                <select
                  value={techForm.trang_thai}
                  onChange={(e) => setTechForm({ ...techForm, trang_thai: e.target.value })}
                  className={inputCls}
                >
                  <option value="Đã duyệt">Đã duyệt (Đủ điều kiện phòng &amp; máy)</option>
                  <option value="Chờ rà soát">Giữ Chờ rà soát</option>
                  <option value="Từ chối">Từ chối (Không đáp ứng được)</option>
                </select>
              </div>
              <div>
                <label className={labelCls}>KTV phụ trách buổi mô phỏng</label>
                <select
                  value={techForm.ktv_phu_trach}
                  onChange={(e) => setTechForm({ ...techForm, ktv_phu_trach: e.target.value })}
                  className={inputCls}
                >
                  {technicians.map((t) => (
                    <option key={t.user_id} value={t.user_id}>
                      {t.ho_ten}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className={labelCls}>
                  Chọn phòng mô phỏng (Hỗ trợ ghép Combo Đa trạm) *
                </label>
                {techForm.room_ids.length > 0 && (
                  <span className="text-xs font-semibold text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                    Đã chọn {techForm.room_ids.length} phòng: {techForm.room_ids.map((id) => roomMap.get(id)?.ten || id).join(' + ')}
                  </span>
                )}
              </div>
              <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                {reviewRooms.map(({ room, conflict }) => {
                  const checked = techForm.room_ids.includes(room.room_id);
                  const disabled = Boolean(conflict && !checked);
                  return (
                    <label
                      key={room.room_id}
                      className={`flex items-center justify-between px-3 py-2 text-xs ${
                        disabled
                          ? 'bg-slate-50 text-slate-400 cursor-not-allowed'
                          : 'hover:bg-teal-50/40 cursor-pointer'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          disabled={disabled}
                          checked={checked}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...techForm.room_ids, room.room_id]
                              : techForm.room_ids.filter((x) => x !== room.room_id);
                            setTechForm({ ...techForm, room_ids: next });
                          }}
                          className="accent-teal-700"
                        />
                        <span className="font-semibold text-slate-800">{room.ten}</span>
                        <span className="text-slate-500 font-normal">
                          · {room.loai} (Sức chứa {room.suc_chua})
                        </span>
                      </span>
                      <span>
                        {conflict ? (
                          <span className="text-red-500 font-medium">Trùng: {conflict.label || conflict.id}</span>
                        ) : (
                          <span className="text-emerald-600 font-medium">Trống lịch</span>
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            <div>
              <label className={labelCls}>Gán thiết bị mô hình (Tự động chặn thiết bị hỏng / trùng giờ)</label>
              <div className="max-h-40 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100">
                {reviewEquipment.map(({ eq, unavailable, conflicts }) => {
                  const disabled = unavailable || conflicts.length > 0;
                  const checked = techForm.equipment_ids.includes(eq.equipment_id);
                  return (
                    <label
                      key={eq.equipment_id}
                      className={`flex items-center justify-between px-3 py-2 text-xs ${
                        disabled ? 'bg-slate-50 text-slate-400 cursor-not-allowed' : 'hover:bg-teal-50/40 cursor-pointer'
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          disabled={disabled}
                          checked={checked}
                          onChange={(e) => {
                            const next = e.target.checked
                              ? [...techForm.equipment_ids, eq.equipment_id]
                              : techForm.equipment_ids.filter((x) => x !== eq.equipment_id);
                            setTechForm({ ...techForm, equipment_ids: next });
                          }}
                          className="accent-teal-700"
                        />
                        <span className="font-medium text-slate-800">{eq.ten}</span>
                        <span className="text-slate-500 font-mono">({eq.equipment_id})</span>
                      </span>
                      <span>
                        {unavailable ? (
                          <span className="text-red-600 font-bold">({eq.trang_thai})</span>
                        ) : conflicts.length > 0 ? (
                          <span className="text-amber-600 font-medium">(Trùng lớp {conflicts[0].sim_id})</span>
                        ) : (
                          <span className="text-emerald-600 font-medium">Sẵn sàng</span>
                        )}
                      </span>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Tùy chỉnh phòng & KTV riêng từng buổi cho khóa nhiều buổi */}
            {techReviewing && parseSimSessions(techReviewing).length > 1 && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-800">
                    Phân công chi tiết từng buổi ({parseSimSessions(techReviewing).length} buổi):
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowTechOverrides(!showTechOverrides)}
                    className="text-2xs font-bold text-teal-800 hover:text-teal-900 underline cursor-pointer"
                  >
                    {showTechOverrides ? 'Ẩn tùy chỉnh từng buổi' : 'Hiện tùy chỉnh riêng từng buổi'}
                  </button>
                </div>
                {showTechOverrides && (
                  <div className="space-y-2 max-h-48 overflow-y-auto">
                    {parseSimSessions(techReviewing).map((s) => (
                      <div key={s.buoi_so} className="p-2 bg-white rounded-lg border border-slate-200 text-xs space-y-1">
                        <div className="flex items-center justify-between font-bold text-slate-800">
                          <span>Buổi {s.buoi_so}: {formatVnDateWithDay(s.ngay)} ({s.gio_bd}–{s.gio_kt})</span>
                          <span className="text-2xs text-slate-500 font-normal">Buổi: {s.buoi_hoc}</span>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                          <div>
                            <label className="text-2xs text-slate-600 block">Phòng riêng:</label>
                            <select
                              value={techOverrides[s.buoi_so]?.room_id || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setTechOverrides((prev) => ({
                                  ...prev,
                                  [s.buoi_so]: {
                                    ktv_phu_trach: prev[s.buoi_so]?.ktv_phu_trach || '',
                                    room_id: val,
                                  },
                                }));
                              }}
                              className="w-full text-xs border border-slate-200 rounded px-1.5 py-1"
                            >
                              <option value="">-- Dùng phòng chung của khóa --</option>
                              {db.Rooms.filter((r) => r.campus_id === techReviewing.campus_id && r.kich_hoat).map((r) => (
                                <option key={r.room_id} value={r.room_id}>
                                  {r.ten}
                                </option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="text-2xs text-slate-600 block">KTV riêng:</label>
                            <select
                              value={techOverrides[s.buoi_so]?.ktv_phu_trach || ''}
                              onChange={(e) => {
                                const val = e.target.value;
                                setTechOverrides((prev) => ({
                                  ...prev,
                                  [s.buoi_so]: {
                                    room_id: prev[s.buoi_so]?.room_id || '',
                                    ktv_phu_trach: val,
                                  },
                                }));
                              }}
                              className="w-full text-xs border border-slate-200 rounded px-1.5 py-1"
                            >
                              <option value="">-- Dùng KTV chung của khóa --</option>
                              {technicians.map((t) => (
                                <option key={t.user_id} value={t.user_id}>
                                  {t.ho_ten}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div>
              <label className={labelCls}>Ghi chú chuẩn bị kỹ thuật</label>
              <input
                value={techForm.ghi_chu_ky_thuat}
                onChange={(e) => setTechForm({ ...techForm, ghi_chu_ky_thuat: e.target.value })}
                placeholder="VD: Cài đặt preset Doppler 4D, cấp 2 can gel..."
                className={inputCls}
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setTechReviewing(null)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold cursor-pointer"
              >
                Đóng
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-bold cursor-pointer"
              >
                Lưu Thẩm Định Kỹ Thuật
              </button>
            </div>
          </form>
        )}
      </Modal>

      {/* ======================================================== */}
      {/* MODAL 4: PHẢN HỒI BỘ MÔN (XÁC NHẬN GIỮ NGUYÊN / ĐIỀU CHỈNH) */}
      {/* ======================================================== */}
      <Modal
        open={Boolean(confirmTarget)}
        onClose={() => setConfirmTarget(null)}
        title={`Xác Nhận Kế Hoạch Đào Tạo — ${confirmTarget?.sim_id || ''}`}
      >
        {confirmTarget && (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs text-slate-700">
              <strong>{confirmTarget.noi_dung}</strong> · {formatVnDate(confirmTarget.ngay)} ({confirmTarget.gio_bd}–{confirmTarget.gio_kt})
              <div className="mt-1">
                Phòng xếp: <strong>{confirmTarget.room_id || 'Chưa gán'}</strong> · KTV: {userMap.get(confirmTarget.ktv_phu_trach)?.ho_ten || 'Kỹ thuật CECICS'}
              </div>
            </div>

            <div>
              <label className={labelCls}>Lựa chọn của Bộ môn *</label>
              <div className="space-y-2">
                <label className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                  <input
                    type="radio"
                    name="confirmType"
                    checked={confirmResponseType === 'Giữ nguyên'}
                    onChange={() => {
                      setConfirmResponseType('Giữ nguyên');
                      setConfirmNote('Bộ môn xác nhận giữ nguyên đúng kế hoạch và danh mục thiết bị.');
                    }}
                    className="accent-emerald-600"
                  />
                  <div>
                    <div className="text-xs font-bold text-slate-900">✅ Xác nhận GIỮ NGUYÊN kế hoạch</div>
                    <div className="text-xs text-slate-500">Kế hoạch lớp học, số lượng học viên và thiết bị đã sẵn sàng đúng dự kiến.</div>
                  </div>
                </label>

                <label className="flex items-center gap-2 p-2.5 rounded-lg border border-slate-200 hover:bg-slate-50 cursor-pointer">
                  <input
                    type="radio"
                    name="confirmType"
                    checked={confirmResponseType === 'Điều chỉnh'}
                    onChange={() => {
                      setConfirmResponseType('Điều chỉnh');
                      setConfirmNote('');
                    }}
                    className="accent-amber-600"
                  />
                  <div>
                    <div className="text-xs font-bold text-amber-900">✏️ Yêu cầu ĐIỀU CHỈNH / BỔ SUNG</div>
                    <div className="text-xs text-slate-500">Cần dời ngày giờ, thay đổi số lượng học viên hoặc bổ sung mô hình, dụng cụ.</div>
                  </div>
                </label>
              </div>
            </div>

            <div>
              <label className={labelCls}>
                {confirmResponseType === 'Điều chỉnh' ? 'Chi tiết nội dung cần điều chỉnh *' : 'Ghi chú xác nhận'}
              </label>
              <textarea
                rows={3}
                required={confirmResponseType === 'Điều chỉnh'}
                value={confirmNote}
                onChange={(e) => setConfirmNote(e.target.value)}
                placeholder={confirmResponseType === 'Điều chỉnh' ? 'VD: Xin bổ sung thêm 1 máy siêu âm Doppler 4D và tăng 4 sinh viên...' : 'Ghi chú thêm nếu có...'}
                className={inputCls}
              />
            </div>

            {confirmResponseType === 'Điều chỉnh' && (
              <div className="p-3 rounded-lg bg-amber-50 border border-amber-300 text-xs text-amber-900">
                ⚠️ Hệ thống sẽ tự động gửi cảnh báo khẩn đến Đơn vị Kỹ thuật và Hành chính để kiểm tra tính khả dụng của phòng trạm và máy móc bổ sung.
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConfirmTarget(null)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleConfirmSubmit}
                className={`px-4 py-2 rounded-lg text-white text-xs font-bold cursor-pointer ${
                  confirmResponseType === 'Giữ nguyên'
                    ? 'bg-emerald-600 hover:bg-emerald-700'
                    : 'bg-amber-600 hover:bg-amber-700'
                }`}
              >
                {confirmResponseType === 'Giữ nguyên' ? 'Chốt Kế Hoạch Giữ Nguyên' : 'Gửi Yêu Cầu Điều Chỉnh'}
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ======================================================== */}
      {/* MODAL 5: PHÁT EMAIL NHẮC NHỞ T-7 NGÀY (HÀNH CHÍNH)      */}
      {/* ======================================================== */}
      <Modal
        open={Boolean(reminderTarget)}
        onClose={() => setReminderTarget(null)}
        title={`Phát Thư Nhắc Nhở T-7 Ngày — ${reminderTarget?.sim_id || ''}`}
      >
        {reminderTarget && (
          <div className="space-y-4">
            <div className="p-3 rounded-lg bg-sky-50 border border-sky-200 text-xs text-sky-900">
              <div><strong>Lớp:</strong> {reminderTarget.noi_dung}</div>
              <div><strong>Ngày diễn ra:</strong> {formatVnDate(reminderTarget.ngay)} ({reminderTarget.gio_bd}–{reminderTarget.gio_kt})</div>
              <div><strong>Người nhận:</strong> {reminderTarget.giang_vien_phu_trach || 'Giảng viên phụ trách'} &lt;{reminderTarget.email_lien_he || 'email bộ môn'}&gt;</div>
            </div>

            <div className="text-xs text-slate-600">
              Email sẽ phát tự động kèm 2 nút tương tác trực tiếp <strong>[✅ Xác Nhận Giữ Nguyên]</strong> và <strong>[✏️ Đề Xuất Điều Chỉnh]</strong> để Bộ môn phản hồi nhanh.
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setReminderTarget(null)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleSendReminder}
                className="px-4 py-2 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold cursor-pointer"
              >
                ✉️ Xác Nhận Phát Email Nhắc Bộ Môn
              </button>
            </div>
          </div>
        )}
      </Modal>

      {/* ======================================================== */}
      {/* MODAL 6: XÉT DUYỆT TRỄ HẠN (LÃNH ĐẠO)                   */}
      {/* ======================================================== */}
      <Modal
        open={Boolean(lateTarget)}
        onClose={() => setLateTarget(null)}
        title={`Xét duyệt lớp đăng ký trễ — ${lateTarget?.sim_id || ''}`}
      >
        {lateTarget && (
          <div className="space-y-4">
            <div className="text-sm text-slate-700">
              <div>
                <strong>{lateTarget.noi_dung}</strong>
              </div>
              <div className="text-xs text-slate-500 mt-1">
                {formatVnDate(lateTarget.ngay)} ({lateTarget.gio_bd}–{lateTarget.gio_kt}) · Cơ sở {lateTarget.campus_id}
              </div>
            </div>
            <div>
              <label className={labelCls}>Ghi chú / Lý do quyết định</label>
              <textarea
                rows={2}
                value={lateNote}
                onChange={(e) => setLateNote(e.target.value)}
                placeholder="VD: Chấp thuận hỗ trợ ghép phòng cho Bộ môn..."
                className={inputCls}
              />
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => handleLateDecision('reject')}
                className="px-4 py-2 rounded-lg border border-red-300 text-red-700 hover:bg-red-50 text-xs font-semibold cursor-pointer"
              >
                Từ chối
              </button>
              <button
                onClick={() => handleLateDecision('approve')}
                className="px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold cursor-pointer"
              >
                Chấp thuận &amp; Chuyển rà soát
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
