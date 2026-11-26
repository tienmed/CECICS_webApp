'use client';

import React, { useEffect, useMemo, useState } from 'react';
import FullCalendar from '@fullcalendar/react';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin, { type EventResizeDoneArg } from '@fullcalendar/interaction';
import type { EventDropArg } from '@fullcalendar/core';
import viLocale from '@fullcalendar/core/locales/vi';
import { canPerform } from '@/core/permissions';
import { suggestAvailableRooms, type TimeSlotSuggestion } from '@/core/suggest';
import {
  formatVnDate,
  formatVnDateWithDay,
  dayOfWeekShortVn,
  getSessionPeriod,
  getMondayOfWeek,
  getWeekRange,
  parseTimeToMinutes,
  minutesToTime,
  todayVnYmd,
} from '@/core/time';
import { parseRoomIds } from '@/core/conflict';
import { parseSimSessions, resolveSessionRoom, simSessionLabel } from '@/core/sim-sessions';
import { ROLES, SESSION_PROGRAMS, SESSION_TYPES, type SessionRecord, type UserRecord } from '@/core/types';
import { useApp } from '@/components/AppProvider';
import { Badge, Card, Modal, PageHeader } from '@/components/ui';
import { AiAdvisorModal } from '@/components/AiAdvisorModal';

type FormState = {
  loai: string;
  he: string;
  hoc_phan: string;
  bai_giang: string;
  lop: string;
  ngay: string;
  gio_bd: string;
  gio_kt: string;
  campus_id: string;
  giang_vien_id: string;
  room_id: string;
  ghi_chu: string;
  repeatWeeks: number;
};

const inputCls = 'w-full text-sm border border-slate-300 rounded-lg px-3 py-2';
const labelCls = 'block text-xs font-semibold text-slate-700 mb-1';

export default function SchedulePage() {
  const { user, db, execute } = useApp();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const [campusFilter, setCampusFilter] = useState<string>('ALL');
  const [classFilter, setClassFilter] = useState<string>('ALL');
  const [sessionTab, setSessionTab] = useState<'UPCOMING' | 'PAST'>('UPCOMING');
  const [onlyMine, setOnlyMine] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [syncLecturerId, setSyncLecturerId] = useState('');
  const [syncPersonalEmail, setSyncPersonalEmail] = useState('');
  const [syncing, setSyncing] = useState(false);
  const [syncSuccessMsg, setSyncSuccessMsg] = useState('');
  const [syncErrorMsg, setSyncErrorMsg] = useState('');
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailStatusMsg, setEmailStatusMsg] = useState('');
  const [emailErrorMsg, setEmailErrorMsg] = useState('');
  const [recipientEmail, setRecipientEmail] = useState(user?.email || 'cecics@pnt.edu.vn');
  const [editing, setEditing] = useState<SessionRecord | null>(null);
  const [slotSuggestions, setSlotSuggestions] = useState<TimeSlotSuggestion[]>([]);
  const [selectedTemplateCourse, setSelectedTemplateCourse] = useState('');
  const [selectedTemplateLesson, setSelectedTemplateLesson] = useState('');

  const [form, setForm] = useState<FormState>({
    loai: 'Giảng dạy',
    he: 'ĐH',
    hoc_phan: '',
    bai_giang: '',
    lop: '',
    ngay: todayVnYmd(),
    gio_bd: '08:00',
    gio_kt: '10:30',
    campus_id: 'HH',
    giang_vien_id: '',
    room_id: '',
    ghi_chu: '',
    repeatWeeks: 1,
  });

  const canCreate = canPerform(user, 'create_session') || canPerform(user, 'create_exam_session');
  const canEdit = canPerform(user, 'edit_session');

  const userMap = useMemo(() => new Map(db.Users.map((u) => [u.user_id, u])), [db.Users]);
  const roomMap = useMemo(() => new Map(db.Rooms.map((r) => [r.room_id, r])), [db.Rooms]);

  const lecturers = useMemo(() => {
    const list = db.Users.filter((u) => u.kich_hoat && (u.vai_tro.includes(ROLES.GIANG_VIEN) || u.user_id === 'U-CECICS-ALL'));
    if (!list.some((u) => u.user_id === 'U-CECICS-ALL')) {
      list.unshift({
        user_id: 'U-CECICS-ALL',
        email: 'cecics@pnt.edu.vn',
        ho_ten: 'Toàn thể nhân sự Trung tâm CECICS',
        vai_tro: [ROLES.GIANG_VIEN, ROLES.HANH_CHINH],
        don_vi: 'HANH_CHINH',
        co_so: 'HH',
        bo_mon_id: '',
        la_nguoi_ngoai: false,
        kich_hoat: true,
      });
    }
    return list;
  }, [db.Users]);

  const uniqueClasses = useMemo(() => {
    const set = new Set<string>();
    for (const s of db.Sessions) {
      if (s.lop && s.lop.trim()) set.add(s.lop.trim());
    }
    return Array.from(set).sort();
  }, [db.Sessions]);

  const syllabusTemplates = useMemo(() => {
    const map = new Map<
      string,
      {
        hoc_phan: string;
        he: string;
        campus_id: string;
        lop: string;
        bai_giang_list: {
          bai_giang: string;
          giang_vien_id: string;
          gio_bd: string;
          gio_kt: string;
          ghi_chu: string;
          lop: string;
          loai: string;
          repeatWeeks: number;
        }[];
      }
    >();

    // 1. Template mẫu: Họp định kỳ CECICS
    map.set('CECICS', {
      hoc_phan: 'CECICS',
      he: 'Hành chính',
      campus_id: 'HH',
      lop: 'Toàn thể nhân sự Trung tâm CECICS',
      bai_giang_list: [
        {
          bai_giang: 'Họp định kỳ',
          giang_vien_id: 'U-CECICS-ALL',
          gio_bd: '08:00',
          gio_kt: '10:30',
          ghi_chu: 'Họp giao ban định kỳ Trung tâm CECICS. Thành phần: Toàn bộ nhân viên CECICS.',
          lop: 'Toàn thể nhân sự Trung tâm CECICS',
          loai: 'Họp',
          repeatWeeks: 2,
        },
      ],
    });

    for (const s of db.Sessions) {
      if (s.trang_thai === 'Đã hủy' || !s.hoc_phan || !s.bai_giang) continue;
      const key = s.hoc_phan.trim();
      let entry = map.get(key);
      if (!entry) {
        entry = {
          hoc_phan: key,
          he: s.he || 'ĐH',
          campus_id: s.campus_id || 'HH',
          lop: s.lop || '',
          bai_giang_list: [],
        };
        map.set(key, entry);
      }
      const existingLesson = entry.bai_giang_list.find(
        (b) => b.bai_giang.trim().toLowerCase() === s.bai_giang.trim().toLowerCase()
      );
      if (!existingLesson) {
        entry.bai_giang_list.push({
          bai_giang: s.bai_giang.trim(),
          giang_vien_id: s.giang_vien_id,
          gio_bd: s.gio_bd,
          gio_kt: s.gio_kt,
          ghi_chu: s.ghi_chu || '',
          lop: s.lop || entry.lop || '',
          loai: s.loai || 'Giảng dạy',
          repeatWeeks: 1,
        });
      }
    }
    return Array.from(map.values());
  }, [db.Sessions]);

  const activeTemplate = useMemo(
    () => syllabusTemplates.find((t) => t.hoc_phan === selectedTemplateCourse),
    [syllabusTemplates, selectedTemplateCourse]
  );

  const visibleSessions = useMemo(
    () =>
      db.Sessions.filter((s) => {
        if (s.trang_thai === 'Đã hủy') return false;
        if (campusFilter !== 'ALL' && s.campus_id !== campusFilter) return false;
        if (classFilter !== 'ALL' && s.lop !== classFilter) return false;
        if (onlyMine && s.giang_vien_id !== user.user_id) return false;
        return true;
      }),
    [db.Sessions, campusFilter, classFilter, onlyMine, user.user_id]
  );

  const simEvents = useMemo(() => {
    return db.SimClasses.filter((sc) => {
      if (sc.trang_thai === 'Từ chối' || sc.trang_thai === 'Đã hủy') return false;
      if (campusFilter !== 'ALL' && sc.campus_id !== campusFilter) return false;
      if (onlyMine && sc.nguoi_dang_ky !== user.user_id && sc.giang_vien_phu_trach !== user.ho_ten) return false;
      return true;
    }).flatMap((sc) => {
      const items = parseSimSessions(sc);
      const total = items.length;
      return items.map((buoi) => {
        const rids = parseRoomIds(resolveSessionRoom(sc, buoi));
        let roomLabel = ' · Chờ xếp phòng';
        if (rids.length === 1) {
          roomLabel = ` · ${roomMap.get(rids[0])?.ten || rids[0]}`;
        } else if (rids.length > 1) {
          roomLabel = ` · [Đa phòng: ${rids.map((id) => roomMap.get(id)?.ten || id).join(', ')}]`;
        }
        const label = simSessionLabel(sc.noi_dung, buoi.buoi_so, total);
        const gvName = sc.giang_vien_phu_trach || userMap.get(sc.nguoi_dang_ky)?.ho_ten || 'GV Bộ môn';
        const title = `${label} · GV: ${gvName}${roomLabel}`;
        return {
          id: `sim_${sc.sim_id}_${buoi.buoi_so}`,
          title,
          start: `${buoi.ngay}T${buoi.gio_bd}:00`,
          end: `${buoi.ngay}T${buoi.gio_kt}:00`,
          backgroundColor: '#0d9488',
          borderColor: '#0f766e',
          extendedProps: {
            isSim: true,
            simClass: sc,
            sessionItem: buoi,
            gvName,
          },
        };
      });
    });
  }, [db.SimClasses, campusFilter, onlyMine, user.user_id, user.ho_ten, roomMap, userMap]);

  const calendarEvents = useMemo(
    () => [
      ...visibleSessions.map((s) => {
        const rids = parseRoomIds(s.room_id);
        const isExam = s.loai === 'Coi thi';
        const isMeeting = s.loai === 'Họp';
        const missingRoom = rids.length === 0;
        let roomLabel = ' · Chưa có phòng';
        if (rids.length === 1) {
          roomLabel = ` · ${roomMap.get(rids[0])?.ten || rids[0]}`;
        } else if (rids.length > 1) {
          roomLabel = ` · [Đa phòng: ${rids.map((id) => roomMap.get(id)?.ten || id).join(', ')}]`;
        }
        const gv = userMap.get(s.giang_vien_id);
        const gvName = s.giang_vien_id === 'U-CECICS-ALL' ? 'Toàn bộ NV CECICS' : gv?.ho_ten || s.giang_vien_id || 'Chưa gán GV';

        const badgePrefix = isExam ? '[Coi thi] ' : isMeeting ? '[Họp] ' : '';
        const classPrefix = s.lop ? `[${s.lop}] ` : '';
        const mainTitle = s.bai_giang ? `${s.bai_giang} (${s.hoc_phan})` : s.hoc_phan;
        const title = `${badgePrefix}${classPrefix}${mainTitle} · GV: ${gvName}${roomLabel}`;

        return {
          id: s.session_id,
          title,
          start: `${s.ngay}T${s.gio_bd}:00`,
          end: `${s.ngay}T${s.gio_kt}:00`,
          backgroundColor: isExam ? '#7c3aed' : isMeeting ? '#2563eb' : missingRoom ? '#d97706' : '#0f766e',
          borderColor: isExam ? '#6d28d9' : isMeeting ? '#1d4ed8' : missingRoom ? '#b45309' : '#115e59',
          editable: canEdit,
          extendedProps: { session: s, gvName },
        };
      }),
      ...simEvents.map((se) => ({
        ...se,
        editable: false,
      })),
    ],
    [visibleSessions, simEvents, roomMap, userMap, canEdit]
  );

  const todayStr = todayVnYmd();
  const upcomingSessions = useMemo(() => {
    return visibleSessions
      .filter((s) => s.ngay >= todayStr)
      .sort((a, b) => `${a.ngay}${a.gio_bd}`.localeCompare(`${b.ngay}${b.gio_bd}`));
  }, [visibleSessions, todayStr]);

  const pastSessions = useMemo(() => {
    return visibleSessions
      .filter((s) => s.ngay < todayStr)
      .sort((a, b) => `${b.ngay}${b.gio_bd}`.localeCompare(`${a.ngay}${a.gio_bd}`));
  }, [visibleSessions, todayStr]);

  const displayedSessions = sessionTab === 'UPCOMING' ? upcomingSessions : pastSessions;

  // Gom nhóm danh sách buổi học theo từng tuần phục vụ góc nhìn Thư ký / Hành chính
  const weeklySessionGroups = useMemo(() => {
    const groupsMap = new Map<string, { weekInfo: { startYmd: string; endYmd: string; label: string }; sessions: SessionRecord[] }>();
    for (const s of displayedSessions) {
      const mon = getMondayOfWeek(s.ngay);
      if (!groupsMap.has(mon)) {
        groupsMap.set(mon, {
          weekInfo: getWeekRange(s.ngay),
          sessions: [],
        });
      }
      groupsMap.get(mon)!.sessions.push(s);
    }
    return Array.from(groupsMap.values());
  }, [displayedSessions]);

  const availableRooms = useMemo(() => {
    if (!form.ngay || !form.gio_bd || !form.gio_kt) return [];
    return suggestAvailableRooms({
      excludeId: editing?.session_id || '__NEW__',
      campus_id: form.campus_id,
      ngay: form.ngay,
      gio_bd: form.gio_bd,
      gio_kt: form.gio_kt,
      rooms: db.Rooms,
      sessions: db.Sessions,
      simClasses: db.SimClasses,
    });
  }, [form.campus_id, form.ngay, form.gio_bd, form.gio_kt, editing, db.Rooms, db.Sessions, db.SimClasses]);

  function openNew(defaultDate?: string) {
    setEditing(null);
    setSlotSuggestions([]);
    setSelectedTemplateCourse('');
    setSelectedTemplateLesson('');
    setForm({
      loai: canPerform(user, 'create_session') ? 'Giảng dạy' : 'Coi thi',
      he: 'ĐH',
      hoc_phan: '',
      bai_giang: '',
      lop: '',
      ngay: defaultDate || todayVnYmd(),
      gio_bd: '08:00',
      gio_kt: '10:30',
      campus_id: 'HH',
      giang_vien_id: lecturers[0]?.user_id || '',
      room_id: '',
      ghi_chu: '',
      repeatWeeks: 1,
    });
    setModalOpen(true);
  }

  function openExisting(s: SessionRecord, duplicate: boolean) {
    setEditing(duplicate ? null : s);
    setSlotSuggestions([]);
    setSelectedTemplateCourse(s.hoc_phan);
    setSelectedTemplateLesson(s.bai_giang);
    setForm({
      loai: s.loai,
      he: s.he,
      hoc_phan: s.hoc_phan,
      bai_giang: s.bai_giang,
      lop: s.lop || '',
      ngay: s.ngay,
      gio_bd: s.gio_bd,
      gio_kt: s.gio_kt,
      campus_id: s.campus_id,
      giang_vien_id: s.giang_vien_id,
      room_id: duplicate ? '' : s.room_id,
      ghi_chu: s.ghi_chu,
      repeatWeeks: 1,
    });
    setModalOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSlotSuggestions([]);
    const res = editing
      ? await execute('updateSession', { session_id: editing.session_id, ...form }, 'Đã cập nhật buổi học.')
      : await execute(
          'createSession',
          form,
          form.repeatWeeks > 1 ? `Đã tạo ${form.repeatWeeks} buổi lặp hằng tuần.` : 'Đã tạo buổi học.'
        );
    if (res.ok) {
      setModalOpen(false);
    } else if (res.err.code === 'LECTURER_CONFLICT') {
      const d = res.err.details as { suggestions?: TimeSlotSuggestion[] } | undefined;
      setSlotSuggestions(d?.suggestions || []);
    }
  }

  async function handleCancel(session_id: string) {
    if (!confirm('Xác nhận hủy buổi học này? Sự kiện trên Google Calendar cũng sẽ bị xóa.')) return;
    const res = await execute('cancelSession', { session_id }, 'Đã hủy buổi học.');
    if (res.ok) setModalOpen(false);
  }

  function formatTimeHHmm(date: Date): string {
    const h = String(date.getHours()).padStart(2, '0');
    const m = String(date.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }

  function formatDateYYYYMMDD(date: Date): string {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }

  async function handleEventDrop(info: EventDropArg) {
    if (!canEdit) {
      info.revert();
      return;
    }
    const session = info.event.extendedProps.session as SessionRecord | undefined;
    if (!session || info.event.extendedProps.isSim) {
      info.revert();
      return;
    }

    const newStart = info.event.start;
    if (!newStart) {
      info.revert();
      return;
    }

    const newNgay = formatDateYYYYMMDD(newStart);
    let newGioBd = formatTimeHHmm(newStart);
    let newGioKt = info.event.end ? formatTimeHHmm(info.event.end) : '';

    // Nếu drop trong month view hoặc sự kiện không có end time, tính end time dựa vào thời lượng ban đầu
    if (!newGioKt || newGioKt === newGioBd) {
      const origStartMins = parseTimeToMinutes(session.gio_bd);
      const origEndMins = parseTimeToMinutes(session.gio_kt);
      const duration = !Number.isNaN(origStartMins) && !Number.isNaN(origEndMins) && origEndMins > origStartMins
        ? origEndMins - origStartMins
        : 150; // mặc định 2h30 nếu không xác định
      const startMins = parseTimeToMinutes(newGioBd);
      if (!Number.isNaN(startMins)) {
        newGioKt = minutesToTime(Math.min(23 * 60 + 59, startMins + duration));
      } else {
        newGioBd = session.gio_bd;
        newGioKt = session.gio_kt;
      }
    }

    const res = await execute(
      'updateSession',
      {
        session_id: session.session_id,
        ngay: newNgay,
        gio_bd: newGioBd,
        gio_kt: newGioKt,
      },
      `Đã dời thời điểm buổi học ${session.bai_giang || session.hoc_phan} sang ${formatVnDate(newNgay)} (${newGioBd}–${newGioKt}).`
    );

    if (!res.ok) {
      info.revert();
    }
  }

  async function handleEventResize(info: EventResizeDoneArg) {
    if (!canEdit) {
      info.revert();
      return;
    }
    const session = info.event.extendedProps.session as SessionRecord | undefined;
    if (!session || info.event.extendedProps.isSim) {
      info.revert();
      return;
    }

    const newStart = info.event.start;
    const newEnd = info.event.end;
    if (!newStart || !newEnd) {
      info.revert();
      return;
    }

    const newNgay = formatDateYYYYMMDD(newStart);
    const newGioBd = formatTimeHHmm(newStart);
    const newGioKt = formatTimeHHmm(newEnd);

    const res = await execute(
      'updateSession',
      {
        session_id: session.session_id,
        ngay: newNgay,
        gio_bd: newGioBd,
        gio_kt: newGioKt,
      },
      `Đã cập nhật thời lượng buổi học: ${newGioBd}–${newGioKt} (${formatVnDate(newNgay)}).`
    );

    if (!res.ok) {
      info.revert();
    }
  }

  function openSyncModal() {
    setSyncSuccessMsg('');
    setSyncErrorMsg('');
    const currentGvId = lecturers.some((l) => l.user_id === user.user_id)
      ? user.user_id
      : syncLecturerId || lecturers[0]?.user_id || '';
    setSyncLecturerId(currentGvId);

    const currentUserObj = db.Users.find((u) => u.user_id === currentGvId);
    setSyncPersonalEmail(currentUserObj?.email || user.email || '');
    setSyncModalOpen(true);
  }

  const lecturerSessions = useMemo(() => {
    if (!syncLecturerId) return [];
    return db.Sessions.filter(
      (s) => s.giang_vien_id === syncLecturerId && s.trang_thai !== 'Đã hủy'
    ).sort((a, b) => `${a.ngay}${a.gio_bd}`.localeCompare(`${b.ngay}${b.gio_bd}`));
  }, [db.Sessions, syncLecturerId]);

  async function handleSyncCalendar() {
    if (!syncLecturerId) return;
    if (!syncPersonalEmail || !syncPersonalEmail.includes('@')) {
      setSyncErrorMsg('Vui lòng nhập địa chỉ email cá nhân / Gmail hợp lệ.');
      return;
    }
    setSyncing(true);
    setSyncErrorMsg('');
    setSyncSuccessMsg('');
    try {
      const res = await fetch('/api/calendar-sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lecturer_id: syncLecturerId,
          personal_email: syncPersonalEmail.trim(),
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setSyncSuccessMsg(
          `Đã đồng bộ trực tiếp ${data.syncedCount}/${data.total} sự kiện trên Google Calendar (cecics@pnt.edu.vn) và thêm ${syncPersonalEmail} vào danh sách tham dự (Attendee) thành công!`
        );
      } else {
        setSyncErrorMsg(data.error || 'Có lỗi xảy ra khi đồng bộ.');
      }
    } catch (err: unknown) {
      setSyncErrorMsg(err instanceof Error ? err.message : 'Lỗi kết nối máy chủ.');
    } finally {
      setSyncing(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lịch giảng dạy & Coi thi"
        subtitle="Nhập tay (hỗ trợ nhân bản & lặp tuần) · Tự chặn trùng giảng viên trên cả 2 cơ sở · Đồng bộ Google Calendar"
        actions={
          <>
            <select
              aria-label="Lọc cơ sở"
              value={campusFilter}
              onChange={(e) => setCampusFilter(e.target.value)}
              className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 bg-white font-medium text-slate-700"
            >
              <option value="ALL">Tất cả cơ sở</option>
              {db.Campuses.map((c) => (
                <option key={c.campus_id} value={c.campus_id}>
                  {c.ten}
                </option>
              ))}
            </select>

            <select
              aria-label="Lọc theo lớp"
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 bg-white font-medium text-slate-700 max-w-xs truncate"
            >
              <option value="ALL">Tất cả các lớp ({uniqueClasses.length} lớp)</option>
              {uniqueClasses.map((cls) => (
                <option key={cls} value={cls}>
                  🎓 {cls}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setAiModalOpen(true)}
              className="px-3.5 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-300 text-sm font-semibold flex items-center gap-1.5 shadow-2xs transition-colors"
            >
              <span>✨</span>
              <span>Hỏi Trợ lý AI</span>
            </button>

            <button
              type="button"
              onClick={openSyncModal}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
            >
              <span>📅</span>
              <span>Đồng bộ Google Calendar</span>
            </button>

            {/* Nút In Ký Lưu và Gửi Email Lịch Tuần dành cho Thư ký / Hành chính */}
            <div className="flex items-center gap-1.5">
              <a
                href="/api/export-weekly-schedule-pdf?week=12&print=true"
                target="_blank"
                rel="noreferrer"
                className="px-3.5 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 text-sm font-bold flex items-center gap-1.5 shadow-2xs transition-colors"
                title="Mở bản in PDF A4 khổ ngang chuẩn chữ ký Người lập bảng & Trưởng Trung tâm"
              >
                <span>🖨️</span>
                <span>In Bản Ký Lưu (PDF)</span>
              </a>

              <button
                type="button"
                onClick={() => {
                  setEmailErrorMsg('');
                  setEmailStatusMsg('');
                  setEmailModalOpen(true);
                }}
                className="px-3.5 py-1.5 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border border-indigo-300 text-sm font-bold flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer"
                title="Gửi lịch tuần tích hợp trực tiếp vào Body Email Responsive (kèm nút in ký lưu)"
              >
                <span>✉️</span>
                <span>Gửi Email Lịch Tuần</span>
              </button>
            </div>
            <label className="inline-flex items-center gap-1.5 text-sm text-slate-700 bg-white border border-slate-300 rounded-lg px-3 py-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={onlyMine}
                onChange={(e) => setOnlyMine(e.target.checked)}
                className="accent-teal-700"
              />
              Chỉ lịch của tôi
            </label>
            {canCreate && (
              <button
                onClick={() => openNew()}
                className="px-4 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold shadow-xs"
              >
                + Thêm buổi
              </button>
            )}
          </>
        }
      />

      <div className="flex flex-wrap items-center justify-between gap-4 text-xs text-slate-600">
        <div className="flex flex-wrap items-center gap-4">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-teal-700" /> Giảng dạy (đã có phòng)
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-amber-600" /> Chưa gán phòng
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-violet-600" /> Coi thi
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-blue-600" /> Họp đơn vị / CECICS
          </span>
        </div>
        {canEdit && (
          <div className="inline-flex items-center gap-1.5 text-xs text-teal-800 bg-teal-50 px-2.5 py-1 rounded-md border border-teal-200">
            <span>✨</span>
            <span>Kéo thả (drag & drop) hoặc co giãn mép để dời ngày/giờ trực quan trên lịch tuần</span>
          </div>
        )}
      </div>

      <Card>
        {mounted ? (
          <FullCalendar
            plugins={[dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin]}
            initialView="timeGridWeek"
            locale={viLocale}
            firstDay={1}
            slotMinTime="07:00:00"
            slotMaxTime="18:30:00"
            slotDuration="00:30:00"
            snapDuration="00:15:00"
            nowIndicator={true}
            allDaySlot={false}
            height="auto"
            editable={canEdit}
            eventStartEditable={canEdit}
            eventDurationEditable={canEdit}
            eventResizableFromStart={true}
            dragRevertDuration={300}
            slotLabelFormat={{
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            }}
            eventTimeFormat={{
              hour: '2-digit',
              minute: '2-digit',
              hour12: false,
            }}
            headerToolbar={{ left: 'prev,next today', center: 'title', right: 'dayGridMonth,timeGridWeek,listWeek' }}
            events={calendarEvents}
            dateClick={(info) => {
              if (canCreate) openNew(info.dateStr.slice(0, 10));
            }}
            eventClick={(info) => {
              if (info.event.extendedProps.isSim) {
                window.location.href = '/lop-mo-phong';
                return;
              }
              if (canEdit) openExisting(info.event.extendedProps.session as SessionRecord, false);
            }}
            eventDrop={handleEventDrop}
            eventResize={handleEventResize}
          />
        ) : (
          <div className="h-96 w-full bg-slate-50 animate-pulse rounded-lg flex items-center justify-center text-sm text-slate-400">
            Đang tải lịch giảng dạy...
          </div>
        )}
      </Card>

      <Card>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4 pb-3 border-b border-slate-200">
          <div>
            <h3 className="text-base font-bold text-slate-900">
              Danh sách buổi học ({visibleSessions.length})
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Phân loại danh sách theo tiến trình thời gian thực tế ({upcomingSessions.length} sắp tới · {pastSessions.length} đã qua)
            </p>
          </div>

          <div className="flex items-center gap-1.5 p-1 bg-slate-100 rounded-xl border border-slate-200/80">
            <button
              type="button"
              onClick={() => setSessionTab('UPCOMING')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
                sessionTab === 'UPCOMING'
                  ? 'bg-teal-700 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <span>📅 Sắp tới &amp; Hôm nay</span>
              <span
                className={`px-1.5 py-0.5 rounded-md text-[11px] font-bold ${
                  sessionTab === 'UPCOMING' ? 'bg-teal-800 text-white' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {upcomingSessions.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setSessionTab('PAST')}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-2 transition-all ${
                sessionTab === 'PAST'
                  ? 'bg-slate-800 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
              }`}
            >
              <span>🕰️ Đã qua</span>
              <span
                className={`px-1.5 py-0.5 rounded-md text-[11px] font-bold ${
                  sessionTab === 'PAST' ? 'bg-slate-900 text-white' : 'bg-slate-200 text-slate-700'
                }`}
              >
                {pastSessions.length}
              </span>
            </button>

            <button
              type="button"
              onClick={openSyncModal}
              className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold transition-colors cursor-pointer ml-auto"
            >
              <span>📅</span>
              <span>Đồng bộ Google Calendar ({syncLecturerId ? userMap.get(syncLecturerId)?.ho_ten || 'Giảng viên' : 'Giảng viên'})</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                <th className="pb-2 pr-3">Mã / Loại / Hệ</th>
                <th className="pb-2 pr-3">Ngày &amp; Giờ</th>
                <th className="pb-2 pr-3">Đối tượng / Lớp</th>
                <th className="pb-2 pr-3">Bài giảng / Trạm thi</th>
                <th className="pb-2 pr-3">Học phần</th>
                <th className="pb-2 pr-3">Giảng viên / Chủ trì</th>
                <th className="pb-2 pr-3">Cơ sở / Phòng</th>
                <th className="pb-2 pr-3">Xác nhận lịch</th>
                {canCreate && <th className="pb-2 text-right">Thao tác</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {displayedSessions.length === 0 ? (
                <tr>
                  <td colSpan={canCreate ? 9 : 8} className="py-8 text-center text-sm text-slate-500">
                    Không có buổi học nào trong danh mục {sessionTab === 'UPCOMING' ? 'sắp tới' : 'đã qua'}.
                  </td>
                </tr>
              ) : (
                weeklySessionGroups.map((group) => {
                  return (
                    <React.Fragment key={group.weekInfo.startYmd}>
                      {/* Tiêu đề phân cách tuần lễ dưới góc nhìn Thư ký / Hành chính */}
                      <tr className="bg-slate-100/80 border-y border-slate-200">
                        <td colSpan={canCreate ? 9 : 8} className="py-2 px-3">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-bold text-teal-900">
                                🗓️ {group.weekInfo.label}
                              </span>
                              <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-teal-100 text-teal-800">
                                {group.sessions.length} buổi
                              </span>
                            </div>
                            <span className="text-xs text-slate-500 italic hidden sm:inline">
                              Từ {formatVnDate(group.weekInfo.startYmd)} đến {formatVnDate(group.weekInfo.endYmd)}
                            </span>
                          </div>
                        </td>
                      </tr>

                      {group.sessions.map((s) => {
                        const gv = userMap.get(s.giang_vien_id);
                        const gvName = s.giang_vien_id === 'U-CECICS-ALL' ? 'Toàn bộ NV CECICS' : gv?.ho_ten || s.giang_vien_id;
                        const isMeeting = s.loai === 'Họp';
                        const isExam = s.loai === 'Coi thi';
                        const dayShort = dayOfWeekShortVn(s.ngay);
                        const periodInfo = getSessionPeriod(s.gio_bd);

                        return (
                          <tr key={s.session_id} className="hover:bg-slate-50/70 transition-colors">
                            <td className="py-2.5 pr-3 whitespace-nowrap">
                              <div className="font-mono text-xs text-slate-500">{s.session_id}</div>
                              <Badge tone={isExam ? 'purple' : isMeeting ? 'blue' : 'teal'}>
                                {s.loai} · {s.he}
                              </Badge>
                            </td>

                            {/* Cột Ngày & Giờ & Buổi rõ ràng cho Thư ký */}
                            <td className="py-2.5 pr-3 whitespace-nowrap">
                              <div className="flex items-center gap-1.5 font-medium text-slate-900">
                                <span className="inline-flex items-center justify-center px-1.5 py-0.5 rounded bg-slate-200 text-slate-800 text-[11px] font-bold">
                                  {dayShort}
                                </span>
                                <span>{formatVnDate(s.ngay)}</span>
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5 text-xs text-slate-600">
                                <span
                                  className={`inline-flex items-center gap-1 px-1.5 py-0.2 rounded text-[10.5px] font-semibold border ${
                                    periodInfo.period === 'Sáng'
                                      ? 'bg-amber-50 text-amber-800 border-amber-200'
                                      : periodInfo.period === 'Chiều'
                                      ? 'bg-sky-50 text-sky-800 border-sky-200'
                                      : 'bg-indigo-50 text-indigo-800 border-indigo-200'
                                  }`}
                                  title={periodInfo.label}
                                >
                                  <span>{periodInfo.icon}</span>
                                  <span>{periodInfo.period}</span>
                                </span>
                                <span className="font-mono font-medium text-slate-700">
                                  {s.gio_bd} – {s.gio_kt}
                                </span>
                              </div>
                            </td>

                            <td className="py-2.5 pr-3">
                              <span className="inline-block px-2 py-0.5 rounded bg-blue-50 text-blue-800 border border-blue-200 text-xs font-semibold">
                                🎓 {s.lop || 'Chưa phân lớp'}
                              </span>
                            </td>
                            <td className="py-2.5 pr-3">
                              <div className="font-semibold text-slate-900">{s.bai_giang}</div>
                              {s.ghi_chu && <div className="text-[11px] text-slate-400 italic line-clamp-1">{s.ghi_chu}</div>}
                            </td>
                            <td className="py-2.5 pr-3">
                              <div className="text-xs font-medium text-slate-700">{s.hoc_phan}</div>
                            </td>
                            <td className="py-2.5 pr-3 text-slate-700 whitespace-nowrap">
                              <div className="font-medium">{gvName}</div>
                              {gv?.email && <div className="text-[11px] text-slate-400">{gv.email}</div>}
                            </td>
                            <td className="py-2.5 pr-3 whitespace-nowrap">
                              <div className="text-xs font-medium text-slate-500">{s.campus_id}</div>
                              {s.room_id ? (
                                <span className="text-xs font-semibold text-teal-800">{roomMap.get(s.room_id)?.ten || s.room_id}</span>
                              ) : (
                                <Badge tone="amber">Chưa gán phòng</Badge>
                              )}
                            </td>
                            <td className="py-2.5 pr-3">
                              <Badge tone={s.rsvp === 'Đã đồng ý' ? 'emerald' : s.rsvp === 'Từ chối' ? 'red' : 'slate'}>
                                {s.rsvp || 'Chờ phản hồi'}
                              </Badge>
                            </td>
                            {canCreate && (
                              <td className="py-2.5 text-right whitespace-nowrap space-x-3">
                                {canEdit && (
                                  <button onClick={() => openExisting(s, false)} className="text-xs font-medium text-teal-700 hover:underline">
                                    Sửa
                                  </button>
                                )}
                                <button onClick={() => openExisting(s, true)} className="text-xs font-medium text-slate-600 hover:underline">
                                  Nhân bản
                                </button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </React.Fragment>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editing ? `Cập nhật buổi ${editing.session_id}` : 'Nhập buổi giảng / coi thi mới'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          {!editing && syllabusTemplates.length > 0 && (
            <div className="p-3 rounded-xl bg-teal-50/80 border border-teal-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-teal-900 flex items-center gap-1.5">
                  <span>⚡</span> Thừa hưởng dữ liệu học phần &amp; bài giảng đã nạp:
                </span>
                <span className="text-[11px] text-teal-700 font-medium">Tự động điền GV &amp; Thời gian</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <select
                    value={selectedTemplateCourse}
                    onChange={(e) => {
                      const courseName = e.target.value;
                      setSelectedTemplateCourse(courseName);
                      setSelectedTemplateLesson('');
                      const tmpl = syllabusTemplates.find((t) => t.hoc_phan === courseName);
                      if (tmpl) {
                        setForm((prev) => ({
                          ...prev,
                          hoc_phan: tmpl.hoc_phan,
                          he: tmpl.he || prev.he,
                          campus_id: tmpl.campus_id || prev.campus_id,
                          lop: tmpl.lop || prev.lop,
                          loai: tmpl.hoc_phan === 'CECICS' ? 'Họp' : prev.loai,
                        }));
                      }
                    }}
                    className="w-full text-xs border border-teal-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-800"
                  >
                    <option value="">-- Chọn học phần mẫu đã có --</option>
                    {syllabusTemplates.map((t) => (
                      <option key={t.hoc_phan} value={t.hoc_phan}>
                        {t.hoc_phan} ({t.bai_giang_list.length} bài đã mapping)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <select
                    disabled={!selectedTemplateCourse}
                    value={selectedTemplateLesson}
                    onChange={(e) => {
                      const lessonTitle = e.target.value;
                      setSelectedTemplateLesson(lessonTitle);
                      const tmpl = syllabusTemplates.find((t) => t.hoc_phan === selectedTemplateCourse);
                      const lesson = tmpl?.bai_giang_list.find((b) => b.bai_giang === lessonTitle);
                      if (lesson) {
                        setForm((prev) => ({
                          ...prev,
                          bai_giang: lesson.bai_giang,
                          giang_vien_id: lesson.giang_vien_id || prev.giang_vien_id,
                          gio_bd: lesson.gio_bd || prev.gio_bd,
                          gio_kt: lesson.gio_kt || prev.gio_kt,
                          ghi_chu: lesson.ghi_chu || prev.ghi_chu,
                          lop: lesson.lop || prev.lop,
                          loai: lesson.loai || prev.loai,
                          repeatWeeks: lesson.repeatWeeks || prev.repeatWeeks,
                        }));
                      }
                    }}
                    className="w-full text-xs border border-teal-300 rounded-lg px-2.5 py-1.5 bg-white text-slate-800 disabled:bg-slate-100 disabled:text-slate-400"
                  >
                    <option value="">-- Chọn bài học &amp; GV mapping --</option>
                    {activeTemplate?.bai_giang_list.map((b, idx) => (
                      <option key={b.bai_giang} value={b.bai_giang}>
                        {idx + 1}. {b.bai_giang} ({userMap.get(b.giang_vien_id)?.ho_ten || (b.giang_vien_id === 'U-CECICS-ALL' ? 'Toàn bộ NV CECICS' : b.giang_vien_id)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Loại buổi</label>
              <select value={form.loai} onChange={(e) => setForm({ ...form, loai: e.target.value })} className={inputCls}>
                {SESSION_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Hệ đào tạo</label>
              <select value={form.he} onChange={(e) => setForm({ ...form, he: e.target.value })} className={inputCls}>
                {SESSION_PROGRAMS.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>Đối tượng (ngành, lớp, khóa) *</label>
            <input
              required
              value={form.lop}
              onChange={(e) => setForm({ ...form, lop: e.target.value })}
              placeholder="VD: Cử nhân Kỹ Thuật Hình Ảnh Y Học 2025"
              list="classes-datalist"
              className={inputCls}
            />
            <datalist id="classes-datalist">
              {uniqueClasses.map((c) => (
                <option key={c} value={c} />
              ))}
            </datalist>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Học phần *</label>
              <input
                required
                value={form.hoc_phan}
                onChange={(e) => setForm({ ...form, hoc_phan: e.target.value })}
                placeholder="VD: Kỹ năng lâm sàng Y3 hoặc CECICS"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Bài giảng / Trạm thi *</label>
              <input
                required
                value={form.bai_giang}
                onChange={(e) => setForm({ ...form, bai_giang: e.target.value })}
                placeholder="VD: Họp định kỳ hoặc Đặt nội khí quản"
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Ngày *</label>
              <input type="date" required value={form.ngay} onChange={(e) => setForm({ ...form, ngay: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Bắt đầu *</label>
              <input type="time" required value={form.gio_bd} onChange={(e) => setForm({ ...form, gio_bd: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Kết thúc *</label>
              <input type="time" required value={form.gio_kt} onChange={(e) => setForm({ ...form, gio_kt: e.target.value })} className={inputCls} />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Cơ sở *</label>
              <select
                value={form.campus_id}
                onChange={(e) => setForm({ ...form, campus_id: e.target.value, room_id: '' })}
                className={inputCls}
              >
                {db.Campuses.map((c) => (
                  <option key={c.campus_id} value={c.campus_id}>
                    {c.ten}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Giảng viên / Người chủ trì *</label>
              <select
                required
                value={form.giang_vien_id}
                onChange={(e) => setForm({ ...form, giang_vien_id: e.target.value })}
                className={inputCls}
              >
                <option value="">-- Chọn giảng viên / người chủ trì --</option>
                {lecturers.map((l) => (
                  <option key={l.user_id} value={l.user_id}>
                    {l.ho_ten} {l.email ? `(${l.email})` : ''}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Phòng (tùy chọn — Hành chính gán sau)</label>
              <select value={form.room_id} onChange={(e) => setForm({ ...form, room_id: e.target.value })} className={inputCls}>
                <option value="">-- Chưa gán phòng (chờ Hành chính xếp phòng) --</option>
                {availableRooms.map((s) => (
                  <option key={s.room.room_id} value={s.room.room_id}>
                    {s.room.ten} ({s.room.suc_chua} chỗ · trống)
                  </option>
                ))}
              </select>
            </div>
            {!editing && (
              <div>
                <label className={labelCls}>Lặp lại hằng tuần (số tuần, tối đa 16)</label>
                <input
                  type="number"
                  min={1}
                  max={16}
                  value={form.repeatWeeks}
                  onChange={(e) => setForm({ ...form, repeatWeeks: Number(e.target.value) || 1 })}
                  className={inputCls}
                />
              </div>
            )}
          </div>

          <div>
            <label className={labelCls}>Ghi chú</label>
            <input value={form.ghi_chu} onChange={(e) => setForm({ ...form, ghi_chu: e.target.value })} className={inputCls} />
          </div>

          {slotSuggestions.length > 0 && (
            <div className="p-3.5 rounded-lg bg-amber-50 border border-amber-300 space-y-2">
              <div className="text-xs font-bold text-amber-900">💡 Khung giờ trống gần nhất của giảng viên (bấm để chọn):</div>
              <div className="flex flex-wrap gap-2">
                {slotSuggestions.map((sg, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setForm({ ...form, ngay: sg.ngay, gio_bd: sg.gio_bd, gio_kt: sg.gio_kt })}
                    className="px-2.5 py-1 rounded-md bg-white border border-amber-400 text-xs font-medium text-amber-900 hover:bg-amber-100"
                  >
                    {sg.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center justify-between pt-3 border-t border-slate-100">
            <div>
              {editing && canEdit && (
                <button
                  type="button"
                  onClick={() => handleCancel(editing.session_id)}
                  className="px-3 py-2 rounded-lg text-xs font-semibold text-red-700 hover:bg-red-50"
                >
                  Hủy buổi học
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                Đóng
              </button>
              <button
                type="submit"
                className="px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold shadow-xs"
              >
                {editing ? 'Lưu thay đổi' : 'Tạo buổi học'}
              </button>
            </div>
          </div>
        </form>
      </Modal>

      <Modal
        open={syncModalOpen}
        onClose={() => setSyncModalOpen(false)}
        title="📅 Đồng bộ Lịch giảng vào Google Calendar cá nhân"
      >
        <div className="space-y-4">
          <div className="p-3.5 rounded-xl bg-blue-50/80 border border-blue-200 text-xs text-blue-900 leading-relaxed">
            💡 <strong>Cơ chế đồng bộ trực tiếp (Không gửi email mời):</strong> Toàn bộ sự kiện lịch giảng được tạo và quản lý tập trung trên Google Calendar chính thức của Trung tâm (<strong>cecics@pnt.edu.vn</strong>). Hệ thống tự động thêm Thầy/Cô làm người tham dự (<strong>Attendee</strong>) vào từng sự kiện tương ứng. Lịch sẽ tự động hiển thị ngay trên ứng dụng Google Calendar điện thoại/máy tính mà không gửi email mời làm phiền hộp thư.
          </div>

          <div>
            <label className={labelCls}>Chọn Giảng viên cần đồng bộ lịch *</label>
            <select
              value={syncLecturerId}
              onChange={(e) => {
                const id = e.target.value;
                setSyncLecturerId(id);
                const u = db.Users.find((x) => x.user_id === id);
                if (u) {
                  setSyncPersonalEmail(u.email || '');
                }
              }}
              className={inputCls}
            >
              <option value="">-- Chọn giảng viên --</option>
              {lecturers.map((l) => (
                <option key={l.user_id} value={l.user_id}>
                  {l.ho_ten} ({l.email})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className={labelCls}>
              Email tài khoản Google Calendar nhận lịch (Attendee) *
            </label>
            <input
              type="email"
              required
              value={syncPersonalEmail}
              onChange={(e) => setSyncPersonalEmail(e.target.value)}
              placeholder="VD: bstien@pnt.edu.vn"
              className={inputCls}
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Mặc định lấy email công vụ (@pnt.edu.vn). Thầy/Cô có thể giữ nguyên email trường hoặc đổi sang Gmail cá nhân để được add trực tiếp vào sự kiện.
            </p>
          </div>

          {syncLecturerId && (
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs">
              <div className="font-semibold text-slate-800 flex items-center justify-between">
                <span>Danh sách buổi giảng sẽ đồng bộ:</span>
                <span className="px-2 py-0.5 rounded-full bg-teal-100 text-teal-800 font-bold">
                  {lecturerSessions.length} buổi
                </span>
              </div>
              <ul className="mt-2.5 space-y-1.5 text-slate-600 max-h-48 overflow-y-auto divide-y divide-slate-100">
                {lecturerSessions.length === 0 ? (
                  <li className="text-slate-400 py-2">Không có buổi giảng nào cho giảng viên này.</li>
                ) : (
                  lecturerSessions.map((s) => (
                    <li key={s.session_id} className="pt-1.5 flex items-start justify-between gap-2">
                      <div>
                        <div className="font-medium text-slate-900">{s.bai_giang || s.hoc_phan}</div>
                        <div className="text-[11px] text-slate-500">
                          {formatVnDate(s.ngay)} ({s.gio_bd}–{s.gio_kt}) · {s.lop || 'Chưa phân lớp'}
                        </div>
                      </div>
                      <span className="font-mono text-[10px] text-slate-400 whitespace-nowrap">{s.session_id}</span>
                    </li>
                  ))
                )}
              </ul>
            </div>
          )}

          {syncSuccessMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-xs text-emerald-800 font-medium">
              ✅ {syncSuccessMsg}
            </div>
          )}

          {syncErrorMsg && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-300 text-xs text-red-800 font-medium">
              ❌ {syncErrorMsg}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setSyncModalOpen(false)}
              className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Đóng
            </button>
            <button
              type="button"
              disabled={syncing || !syncLecturerId || !syncPersonalEmail || lecturerSessions.length === 0}
              onClick={handleSyncCalendar}
              className="px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5"
            >
              {syncing ? '⏳ Đang đồng bộ...' : '🚀 Đồng bộ Attendee vào Google Calendar ngay'}
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal Phát Email Lịch Tuần Tích Hợp Body Email & Nút In Ký Lưu */}
      <Modal
        open={emailModalOpen}
        onClose={() => setEmailModalOpen(false)}
        title="✉️ Gửi Email Lịch Tuần CECICS (Responsive & Nút In Ký Lưu)"
      >
        <div className="space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            Hệ thống sẽ tạo <strong>Body Email chuẩn HTML Responsive</strong> (tối ưu hiển thị bảng trên máy tính và thẻ card trên điện thoại), phân công rõ ràng trách nhiệm thiết bị/mô hình, tích hợp sẵn nút <strong>In Bản Ký Lưu (PDF)</strong> và tự động đính kèm file PDF Tuần 12.
          </p>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Email người nhận thông báo:
            </label>
            <input
              type="email"
              value={recipientEmail}
              onChange={(e) => setRecipientEmail(e.target.value)}
              placeholder="nhansu@pnt.edu.vn"
              className={inputCls}
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Có thể gửi cho chính bạn, Trưởng Trung tâm hoặc toàn thể ban thư ký / kỹ thuật viên.
            </p>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1.5">
            <div className="font-semibold text-slate-800">Thông tin gói phát hành:</div>
            <div className="text-slate-600">• Tuần: <strong>Tuần 12</strong> (23/11/2026 – 29/11/2026)</div>
            <div className="text-slate-600">• Đính kèm: <strong>Lich_Tuan_12_20261123_20261129.pdf</strong> (Khổ A4 ngang chuẩn lưu trữ)</div>
            <div className="text-slate-600">• Trách nhiệm thiết bị: Thống kê mô hình soi đáy mắt, phế quản ống mềm, siêu âm Doppler.</div>
          </div>

          {emailStatusMsg && (
            <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-300 text-xs text-emerald-800 font-medium">
              ✅ {emailStatusMsg}
            </div>
          )}

          {emailErrorMsg && (
            <div className="p-3.5 rounded-xl bg-red-50 border border-red-300 text-xs text-red-800 font-medium">
              ❌ {emailErrorMsg}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setEmailModalOpen(false)}
              className="px-4 py-2 rounded-lg border border-slate-300 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Đóng
            </button>
            <button
              type="button"
              disabled={sendingEmail || !recipientEmail}
              onClick={async () => {
                setSendingEmail(true);
                setEmailErrorMsg('');
                setEmailStatusMsg('');
                try {
                  const res = await fetch('/api/send-weekly-schedule-email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      to: recipientEmail,
                      weekNumber: 12,
                      startDate: '23/11/2026',
                      endDate: '29/11/2026',
                    }),
                  });
                  const data = await res.json();
                  if (data.ok) {
                    setEmailStatusMsg(`Đã phát hành email lịch tuần thành công tới ${recipientEmail}. Đã kèm bản PDF ký lưu.`);
                  } else {
                    setEmailErrorMsg(data.error || 'Gửi email thất bại.');
                  }
                } catch (err: any) {
                  setEmailErrorMsg(err?.message || 'Lỗi kết nối máy chủ.');
                } finally {
                  setSendingEmail(false);
                }
              }}
              className="px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white text-xs font-semibold shadow-xs flex items-center gap-1.5"
            >
              {sendingEmail ? '⏳ Đang phát hành email...' : '🚀 Phát hành Email Lịch Tuần ngay'}
            </button>
          </div>
        </div>
      </Modal>

      <AiAdvisorModal isOpen={aiModalOpen} onClose={() => setAiModalOpen(false)} />
    </div>
  );
}
