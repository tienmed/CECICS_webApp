'use client';

import React, { useMemo, useState } from 'react';
import { computeDashboardMetrics, type LecturerWorkloadRow, type RoomUtilizationRow } from '@/core/analytics';
import { type PeriodKind, todayVnYmd } from '@/core/time';
import { useApp } from '@/components/AppProvider';
import { Badge, Card, PageHeader } from '@/components/ui';
import { ROLES } from '@/core/types';

export default function HoursReportPage() {
  const { db, user, execute, refresh, notify } = useApp();
  const todayYmd = useMemo(() => todayVnYmd(), []);
  const currentYear = Number(todayYmd.slice(0, 4));
  const currentMonth = Number(todayYmd.slice(5, 7));

  // Bộ lọc
  const [kind, setKind] = useState<PeriodKind>('month');
  const [year, setYear] = useState(currentYear);
  const [index, setIndex] = useState(currentMonth);
  const [campus, setCampus] = useState('ALL');
  const [departmentId, setDepartmentId] = useState('ALL');

  // Chế độ xem & UI State
  const [activeTab, setActiveTab] = useState<'lecturers' | 'rooms'>('lecturers');
  const [expandedLecturerId, setExpandedLecturerId] = useState<string | null>(null);
  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [isBulkModalOpen, setIsBulkModalOpen] = useState(false);
  const [selectedDeptIds, setSelectedDeptIds] = useState<string[]>([]);
  const [isSendingEmails, setIsSendingEmails] = useState(false);
  const [lockLoading, setLockLoading] = useState(false);

  // Tính toán số liệu
  const metrics = useMemo(
    () => computeDashboardMetrics(db, { periodKind: kind, year, periodIndex: index, campusId: campus }),
    [db, kind, year, index, campus]
  );

  const periodKey = `${year}-${String(index).padStart(2, '0')}`;

  // Phân quyền người dùng
  const isAdmin = user.vai_tro.includes(ROLES.ADMIN);
  const isLeader = isAdmin || user.vai_tro.includes(ROLES.LANH_DAO) || user.vai_tro.includes(ROLES.TRUONG_DON_VI);
  const isCoordinator = isLeader || user.vai_tro.includes(ROLES.HANH_CHINH) || user.vai_tro.includes(ROLES.DAO_TAO);
  const isDeptLiaison =
    isAdmin ||
    (user.vai_tro.includes(ROLES.DAU_MOI_BO_MON) &&
      (departmentId === 'ALL' || user.bo_mon_id === departmentId));

  // Khóa đối soát cho bộ môn đang chọn (nếu có)
  const currentLock = useMemo(() => {
    if (departmentId === 'ALL') return null;
    return (db.VerificationLocks || []).find(
      (l) => l.period_key === periodKey && l.entity_id === departmentId
    );
  }, [db.VerificationLocks, periodKey, departmentId]);

  // Tiến độ đối soát của toàn bộ các bộ môn
  const deptProgress = useMemo(() => {
    const depts = db.Departments;
    const locks = db.VerificationLocks || [];
    let completedCount = 0;
    let pendingReviewCount = 0;

    const list = depts.map((d) => {
      const lock = locks.find((l) => l.period_key === periodKey && l.entity_id === d.bo_mon_id);
      const isL2 = Boolean(lock?.layer2_locked);
      const isL1 = Boolean(lock?.layer1_locked);
      if (isL2) completedCount++;
      else if (isL1) pendingReviewCount++;

      return {
        bo_mon_id: d.bo_mon_id,
        ten: d.ten,
        layer1_locked: isL1,
        layer2_locked: isL2,
        email_sent_at: lock?.email_sent_at,
      };
    });

    return {
      total: depts.length,
      completedCount,
      pendingReviewCount,
      list,
    };
  }, [db.Departments, db.VerificationLocks, periodKey]);

  // Lọc danh sách Giảng viên theo Bộ môn / Trung tâm
  const filteredLecturers = useMemo(() => {
    let list = metrics.lecturerWorkload;
    if (departmentId === 'CECICS') {
      list = list.filter((l) => l.isCoreStaff);
    } else if (departmentId !== 'ALL') {
      list = list.filter(
        (l) => l.bo_mon_id === departmentId || l.sessions.some((s) => s.isCrossDept)
      );
    }
    return list;
  }, [metrics.lecturerWorkload, departmentId]);

  // Phân trang
  const paginatedLecturers = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredLecturers.slice(start, start + pageSize);
  }, [filteredLecturers, currentPage, pageSize]);

  const totalPages = Math.ceil(filteredLecturers.length / pageSize) || 1;

  // URL xuất file Excel (.xlsx)
  const exportUrl = `/api/export-hours?kind=${kind}&year=${year}&index=${index}&campus=${campus}&departmentId=${departmentId}`;

  // Thao tác Khóa / Mở khóa
  const handleLockAction = async (action: 'lock_layer1' | 'lock_layer2' | 'request_unlock' | 'unlock_layer2') => {
    if (departmentId === 'ALL') {
      notify('error', 'Vui lòng chọn một Bộ môn cụ thể để thao tác Khóa đối soát.');
      return;
    }

    setLockLoading(true);
    try {
      const res = await fetch('/api/verification-locks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          period_key: periodKey,
          entity_type: departmentId === 'CECICS' ? 'USER_CECICS' : 'BO_MON',
          entity_id: departmentId,
          reason: action === 'request_unlock' ? 'Bộ môn đề xuất cập nhật lại số giờ giảng/thi' : '',
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Thao tác thất bại.');
      }

      await refresh();
      notify('success', 'Đã cập nhật trạng thái Khóa đối soát thành công!');
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      notify('error', msg);
    } finally {
      setLockLoading(false);
    }
  };

  // Mở hộp thoại Gửi hàng loạt
  const openBulkSendModal = () => {
    setSelectedDeptIds(db.Departments.map((d) => d.bo_mon_id));
    setIsBulkModalOpen(true);
  };

  // Thực hiện Gửi email hàng loạt qua SMTP
  const handleSendBulkEmails = async () => {
    if (!selectedDeptIds.length) {
      notify('error', 'Vui lòng chọn ít nhất một Bộ môn để gửi báo cáo.');
      return;
    }

    setIsSendingEmails(true);
    try {
      const res = await fetch('/api/send-department-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          department_ids: selectedDeptIds,
          periodKind: kind,
          year,
          periodIndex: index,
          campus,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.ok) {
        throw new Error(data.error || 'Gửi email hàng loạt thất bại.');
      }

      await refresh();
      setIsBulkModalOpen(false);
      notify(
        'success',
        `Đã gửi thành công ${data.sentCount}/${data.totalRequested} email báo cáo kèm file Excel tới các Bộ môn!`
      );
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      notify('error', msg);
    } finally {
      setIsSendingEmails(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Thống kê Giờ giảng & Công suất Phòng"
        subtitle={`Kỳ ${metrics.period.label} · Trung bình giảng viên hoạt động: ${metrics.avgLecturerHours}h · Định mức chuẩn: 8h/ngày`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={campus}
              onChange={(e) => setCampus(e.target.value)}
              className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 bg-white"
            >
              <option value="ALL">Cả 2 cơ sở</option>
              {db.Campuses.map((c) => (
                <option key={c.campus_id} value={c.campus_id}>
                  {c.ten}
                </option>
              ))}
            </select>

            <select
              value={kind}
              onChange={(e) => {
                const k = e.target.value as PeriodKind;
                setKind(k);
                if (k === 'month') setIndex(currentMonth);
                if (k === 'quarter') setIndex(Math.floor((currentMonth - 1) / 3) + 1);
              }}
              className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 bg-white"
            >
              <option value="month">Theo Tháng</option>
              <option value="quarter">Theo Quý</option>
              <option value="year">Theo Năm</option>
            </select>

            {kind === 'month' && (
              <select
                value={index}
                onChange={(e) => setIndex(Number(e.target.value))}
                className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 bg-white"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    Tháng {m}
                  </option>
                ))}
              </select>
            )}

            {kind === 'quarter' && (
              <select
                value={index}
                onChange={(e) => setIndex(Number(e.target.value))}
                className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 bg-white"
              >
                {[1, 2, 3, 4].map((q) => (
                  <option key={q} value={q}>
                    Quý {q}
                  </option>
                ))}
              </select>
            )}

            <select
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 bg-white"
            >
              {[currentYear - 1, currentYear, currentYear + 1].map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>

            <select
              value={departmentId}
              onChange={(e) => {
                setDepartmentId(e.target.value);
                setCurrentPage(1);
              }}
              className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 bg-white font-medium text-teal-900"
            >
              <option value="ALL">🏢 Toàn trường (Tất cả)</option>
              <option value="CECICS">⭐ Giảng viên Trung tâm CECICS</option>
              <optgroup label="Danh mục Bộ môn">
                {db.Departments.map((d) => (
                  <option key={d.bo_mon_id} value={d.bo_mon_id}>
                    {d.ten}
                  </option>
                ))}
              </optgroup>
            </select>

            <a
              href={exportUrl}
              className="px-3.5 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold flex items-center gap-1.5 shadow-sm"
              title="Xuất file Excel (.xlsx) 2 Sheet chuẩn NĐ 30/2020/NĐ-CP"
            >
              <span>⬇</span> Xuất Excel (.xlsx)
            </a>

            {isCoordinator && (
              <button
                onClick={openBulkSendModal}
                className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold flex items-center gap-1.5 shadow-sm"
                title="Gửi báo cáo hàng loạt qua SMTP cecics@pnt.edu.vn"
              >
                <span>✉</span> Gửi Email Hàng Loạt
              </button>
            )}
          </div>
        }
      />

      {/* Widget Khóa 2 Lớp hoặc Tiến Độ Đối Soát */}
      {departmentId === 'ALL' ? (
        <Card>
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-slate-800">📊 Tiến độ Đối soát các Bộ môn:</span>
                <span className="text-xs px-2.5 py-0.5 rounded-full bg-teal-100 text-teal-800 font-semibold">
                  {deptProgress.completedCount}/{deptProgress.total} Bộ môn đã Khóa 2 lớp
                </span>
                {deptProgress.pendingReviewCount > 0 && (
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 font-semibold">
                    {deptProgress.pendingReviewCount} chờ CECICS duyệt
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-500">Kỳ {metrics.period.label}</div>
            </div>

            <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
              <div
                className="bg-teal-600 h-full transition-all duration-300"
                style={{
                  width: `${deptProgress.total ? (deptProgress.completedCount / deptProgress.total) * 100 : 0}%`,
                }}
              />
            </div>

            <div className="flex flex-wrap gap-1.5 pt-1">
              {deptProgress.list.map((d) => (
                <button
                  key={d.bo_mon_id}
                  onClick={() => {
                    setDepartmentId(d.bo_mon_id);
                    setCurrentPage(1);
                  }}
                  className={`text-xs px-2.5 py-1 rounded-md border flex items-center gap-1.5 transition-colors ${
                    d.layer2_locked
                      ? 'bg-teal-50 border-teal-300 text-teal-800 hover:bg-teal-100'
                      : d.layer1_locked
                        ? 'bg-amber-50 border-amber-300 text-amber-800 hover:bg-amber-100'
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <span className="font-medium">{d.ten}</span>
                  {d.layer2_locked ? (
                    <span className="text-[10px] bg-teal-700 text-white px-1 rounded">2 Lớp</span>
                  ) : d.layer1_locked ? (
                    <span className="text-[10px] bg-amber-600 text-white px-1 rounded">Chờ duyệt</span>
                  ) : (
                    <span className="text-[10px] bg-slate-300 text-slate-700 px-1 rounded">Chưa khóa</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </Card>
      ) : (
        <Card>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Lớp 1: Khóa Bộ môn */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                  Lớp 1: Xác nhận Bộ môn
                </span>
                {currentLock?.layer1_locked ? (
                  <Badge tone="emerald">ĐÃ XÁC NHẬN & KHÓA</Badge>
                ) : (
                  <Badge tone="slate">CHƯA KHÓA</Badge>
                )}
              </div>
              <p className="text-sm font-semibold text-slate-900">
                {currentLock?.layer1_locked
                  ? `Ký bởi: ${currentLock.layer1_by || 'Đầu mối Bộ môn'} (${currentLock.layer1_at?.slice(0, 16)})`
                  : 'Bộ môn chưa bấm xác nhận số liệu kỳ này.'}
              </p>
              {currentLock?.unlock_requested && (
                <p className="text-xs text-amber-700 bg-amber-50 p-2 rounded border border-amber-200">
                  ⚠️ Đang yêu cầu mở khóa: {currentLock.unlock_reason}
                </p>
              )}
              <div className="pt-2 flex gap-2">
                {!currentLock?.layer1_locked ? (
                  <button
                    disabled={lockLoading || !isDeptLiaison}
                    onClick={() => handleLockAction('lock_layer1')}
                    className="px-3 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white text-xs font-semibold"
                  >
                    🔒 Xác nhận & Khóa Bộ môn
                  </button>
                ) : (
                  <button
                    disabled={lockLoading || !isDeptLiaison}
                    onClick={() => handleLockAction('request_unlock')}
                    className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-semibold"
                  >
                    🔓 Yêu cầu Mở khóa Bộ môn
                  </button>
                )}
              </div>
            </div>

            {/* Lớp 2: Khóa Trung tâm CECICS */}
            <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500 uppercase tracking-wide">
                  Lớp 2: Duyệt & Đối sánh CECICS
                </span>
                {currentLock?.layer2_locked ? (
                  <Badge tone="teal">ĐÃ KHÓA 2 LỚP CHÍNH THỨC</Badge>
                ) : currentLock?.layer1_locked ? (
                  <Badge tone="amber">CHỜ CECICS DUYỆT</Badge>
                ) : (
                  <Badge tone="slate">CHƯA ĐỦ ĐIỀU KIỆN</Badge>
                )}
              </div>
              <p className="text-sm font-semibold text-slate-900">
                {currentLock?.layer2_locked
                  ? `Duyệt bởi: ${currentLock.layer2_by || 'Lãnh đạo CECICS'} (${currentLock.layer2_at?.slice(0, 16)})`
                  : currentLock?.layer1_locked
                    ? 'Đã đối soát xong phía Bộ môn. Chờ Lãnh đạo CECICS duyệt khóa 2 lớp.'
                    : 'Cần Bộ môn khóa Lớp 1 trước khi CECICS duyệt.'}
              </p>
              <div className="pt-2 flex gap-2">
                {currentLock?.layer1_locked && !currentLock?.layer2_locked && (
                  <button
                    disabled={lockLoading || !isLeader}
                    onClick={() => handleLockAction('lock_layer2')}
                    className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 disabled:opacity-50 text-white text-xs font-semibold"
                  >
                    ✅ Duyệt & Khóa 2 Lớp (CECICS)
                  </button>
                )}
                {currentLock?.unlock_requested && currentLock?.layer2_locked && (
                  <button
                    disabled={lockLoading || !isLeader}
                    onClick={() => handleLockAction('unlock_layer2')}
                    className="px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 disabled:opacity-50 text-white text-xs font-semibold"
                  >
                    🔓 Phê duyệt Mở khóa Lớp 2
                  </button>
                )}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* Tabs Chuyển Đổi Chế Độ Xem */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('lecturers')}
          className={`py-3 px-6 text-sm font-bold border-b-2 flex items-center gap-2 transition-all ${
            activeTab === 'lecturers'
              ? 'border-teal-700 text-teal-800 bg-teal-50/40'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>👨‍⚕️ Thống kê Giảng viên</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-semibold">
            {filteredLecturers.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('rooms')}
          className={`py-3 px-6 text-sm font-bold border-b-2 flex items-center gap-2 transition-all ${
            activeTab === 'rooms'
              ? 'border-teal-700 text-teal-800 bg-teal-50/40'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>🏥 Công suất Phòng mô phỏng</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 font-semibold">
            {metrics.roomUtilization.length}
          </span>
        </button>
      </div>

      {/* NỘI DUNG TAB 1: BẢNG GIẢNG VIÊN */}
      {activeTab === 'lecturers' && (
        <Card>
          {/* Desktop & Tablet View */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-200 bg-slate-50">
                  <th className="py-2.5 px-3 w-8"></th>
                  <th className="py-2.5 pr-3">Mã GV</th>
                  <th className="py-2.5 pr-3">Họ và tên</th>
                  <th className="py-2.5 pr-3">Bộ môn / Đơn vị</th>
                  <th className="py-2.5 pr-3 text-center">Số buổi</th>
                  <th className="py-2.5 pr-3 text-right">Giờ giảng dạy</th>
                  <th className="py-2.5 pr-3 text-right">Giờ coi thi</th>
                  <th className="py-2.5 pr-3 text-right">Tổng giờ</th>
                  <th className="py-2.5 pr-3 text-center">Hệ ĐH / SĐH / CME</th>
                  <th className="py-2.5 text-right">Cảnh báo tải</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {paginatedLecturers.map((w) => {
                  const isExpanded = expandedLecturerId === w.user_id;
                  return (
                    <React.Fragment key={w.user_id}>
                      <tr
                        onClick={() => setExpandedLecturerId(isExpanded ? null : w.user_id)}
                        className={`cursor-pointer hover:bg-slate-50 transition-colors ${
                          isExpanded ? 'bg-teal-50/30 font-medium' : ''
                        }`}
                      >
                        <td className="py-2.5 px-3 text-slate-400 text-center">
                          {isExpanded ? '▼' : '▶'}
                        </td>
                        <td className="py-2.5 pr-3 font-mono text-xs text-slate-500">{w.user_id}</td>
                        <td className="py-2.5 pr-3 font-semibold text-slate-900">
                          {w.ho_ten}
                          {w.isCoreStaff && (
                            <span className="ml-1.5 text-[10px] px-1.5 py-0.5 rounded bg-teal-100 text-teal-800 font-bold">
                              CECICS
                            </span>
                          )}
                          {w.isCrossDept && (
                            <span className="ml-1 text-[10px] px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 font-bold">
                              Liên BM
                            </span>
                          )}
                        </td>
                        <td className="py-2.5 pr-3 text-slate-600">{w.bo_mon_ten || '—'}</td>
                        <td className="py-2.5 pr-3 text-center font-medium">{w.sessionCount}</td>
                        <td className="py-2.5 pr-3 text-right text-slate-700">{w.teachingHours}h</td>
                        <td className="py-2.5 pr-3 text-right text-slate-700">{w.examHours}h</td>
                        <td className="py-2.5 pr-3 text-right font-bold text-teal-800">{w.totalHours}h</td>
                        <td className="py-2.5 pr-3 text-center text-xs text-slate-500">
                          <span className="text-teal-700 font-semibold">{w.hoursDH}h</span> /{' '}
                          <span className="text-amber-700 font-semibold">{w.hoursSDH}h</span> /{' '}
                          <span className="text-blue-700 font-semibold">{w.hoursCME}h</span>
                        </td>
                        <td className="py-2.5 text-right">
                          {w.totalHours === 0 ? (
                            <Badge tone="slate">0 giờ</Badge>
                          ) : w.isOverloaded ? (
                            <Badge tone="red">Quá tải (+{w.deviationPct}%)</Badge>
                          ) : (
                            <Badge tone="emerald">Bình thường</Badge>
                          )}
                        </td>
                      </tr>

                      {/* Drill-down Accordion Danh sách ca học */}
                      {isExpanded && (
                        <tr>
                          <td colSpan={10} className="p-4 bg-slate-50 border-y border-teal-200">
                            <div className="space-y-2">
                              <div className="flex items-center justify-between text-xs font-bold text-teal-900 uppercase">
                                <span>📋 Chi tiết các buổi giảng & coi thi của {w.ho_ten}</span>
                                <span>Tổng cộng: {w.sessions.length} buổi</span>
                              </div>

                              {w.sessions.length === 0 ? (
                                <p className="text-xs text-slate-500 italic py-2">Không có ca học nào trong kỳ này.</p>
                              ) : (
                                <table className="w-full text-xs bg-white rounded-lg border border-slate-200 overflow-hidden">
                                  <thead>
                                    <tr className="bg-slate-100 text-slate-600 text-left">
                                      <th className="py-1.5 px-3">Ngày</th>
                                      <th className="py-1.5 px-2">Khung giờ</th>
                                      <th className="py-1.5 px-2">Hệ</th>
                                      <th className="py-1.5 px-3">Học phần / Bài giảng</th>
                                      <th className="py-1.5 px-3">Phòng học (Đa trạm)</th>
                                      <th className="py-1.5 px-2 text-right">Số giờ</th>
                                      <th className="py-1.5 px-3">Đặc thù</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {w.sessions.map((s) => (
                                      <tr key={s.session_id} className="hover:bg-slate-50/60">
                                        <td className="py-1.5 px-3 font-mono">{s.ngay}</td>
                                        <td className="py-1.5 px-2 font-mono">
                                          {s.gio_bd} - {s.gio_kt}
                                        </td>
                                        <td className="py-1.5 px-2 font-bold text-teal-800">{s.he}</td>
                                        <td className="py-1.5 px-3 font-medium text-slate-800">
                                          {s.bai_giang || s.hoc_phan}
                                        </td>
                                        <td className="py-1.5 px-3 text-slate-600">{s.room_names || '—'}</td>
                                        <td className="py-1.5 px-2 text-right font-bold text-teal-900">
                                          {s.duration}h
                                        </td>
                                        <td className="py-1.5 px-3">
                                          {s.isMakeUp && (
                                            <span className="px-1.5 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-bold mr-1">
                                              Dạy bù
                                            </span>
                                          )}
                                          {s.isCrossDept && (
                                            <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 text-[10px] font-bold">
                                              Liên BM
                                            </span>
                                          )}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Card View */}
          <div className="block md:hidden space-y-3">
            {paginatedLecturers.map((w) => {
              const isExpanded = expandedLecturerId === w.user_id;
              return (
                <div
                  key={w.user_id}
                  className="p-3.5 rounded-xl border border-slate-200 bg-white space-y-2 shadow-xs"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm">{w.ho_ten}</h4>
                      <p className="text-xs text-slate-500 font-mono">
                        {w.user_id} · {w.bo_mon_ten || 'Bộ môn'}
                      </p>
                    </div>
                    {w.isOverloaded ? (
                      <Badge tone="red">Quá tải</Badge>
                    ) : (
                      <Badge tone="emerald">{w.totalHours}h</Badge>
                    )}
                  </div>

                  <div className="grid grid-cols-3 gap-2 text-center text-xs bg-slate-50 p-2 rounded-lg">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Giảng dạy</span>
                      <strong className="text-slate-700">{w.teachingHours}h</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Coi thi</span>
                      <strong className="text-slate-700">{w.examHours}h</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Số buổi</span>
                      <strong className="text-teal-800 font-bold">{w.sessionCount}</strong>
                    </div>
                  </div>

                  <button
                    onClick={() => setExpandedLecturerId(isExpanded ? null : w.user_id)}
                    className="w-full py-1 text-xs text-center text-teal-700 font-semibold border-t border-slate-100 flex items-center justify-center gap-1"
                  >
                    <span>{isExpanded ? 'Ẩn chi tiết ca học ▲' : 'Xem chi tiết ca học ▼'}</span>
                  </button>

                  {isExpanded && (
                    <div className="pt-2 border-t border-slate-100 space-y-1.5">
                      {w.sessions.map((s) => (
                        <div key={s.session_id} className="text-xs p-2 bg-slate-50 rounded border border-slate-100">
                          <div className="flex justify-between font-semibold">
                            <span>{s.ngay} ({s.gio_bd}-{s.gio_kt})</span>
                            <span className="text-teal-800">{s.duration}h</span>
                          </div>
                          <div className="text-slate-700 mt-0.5">{s.bai_giang || s.hoc_phan}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5">Phòng: {s.room_names || '—'}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Thanh Phân Trang */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>Hiển thị:</span>
              <select
                value={pageSize}
                onChange={(e) => {
                  setPageSize(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="border border-slate-300 rounded px-2 py-1 bg-white text-xs"
              >
                <option value={10}>10 dòng/trang</option>
                <option value={25}>25 dòng/trang</option>
                <option value={50}>50 dòng/trang</option>
              </select>
              <span>Tổng cộng {filteredLecturers.length} giảng viên</span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 text-xs border border-slate-300 rounded bg-white hover:bg-slate-50 disabled:opacity-40"
              >
                ◀ Trước
              </button>
              <span className="text-xs text-slate-600 px-2 font-medium">
                Trang {currentPage} / {totalPages}
              </span>
              <button
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 text-xs border border-slate-300 rounded bg-white hover:bg-slate-50 disabled:opacity-40"
              >
                Sau ▶
              </button>
            </div>
          </div>
        </Card>
      )}

      {/* NỘI DUNG TAB 2: CÔNG SUẤT PHÒNG MÔ PHỎNG */}
      {activeTab === 'rooms' && (
        <Card>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-slate-500 border-b border-slate-200 bg-slate-50">
                  <th className="py-2.5 px-3">Mã phòng</th>
                  <th className="py-2.5 pr-3">Tên phòng học / Lab</th>
                  <th className="py-2.5 pr-3 text-center">Nhóm CECICS</th>
                  <th className="py-2.5 pr-3 text-center">Cơ sở</th>
                  <th className="py-2.5 pr-3 text-right">Sức chứa</th>
                  <th className="py-2.5 pr-3 text-center">Số buổi</th>
                  <th className="py-2.5 pr-3 text-right">Giờ hoạt động</th>
                  <th className="py-2.5 pr-3 text-right">Công suất chuẩn</th>
                  <th className="py-2.5 pr-3 text-right">Tỷ lệ lấp đầy</th>
                  <th className="py-2.5 text-right">Hiệu suất</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {metrics.roomUtilization.map((r) => (
                  <tr key={r.room_id} className="hover:bg-slate-50/60">
                    <td className="py-2.5 px-3 font-mono text-xs text-slate-500">{r.room_id}</td>
                    <td className="py-2.5 pr-3 font-semibold text-slate-900">{r.ten}</td>
                    <td className="py-2.5 pr-3 text-center">
                      <span className="px-2 py-0.5 rounded text-xs font-semibold bg-slate-100 text-slate-700">
                        {r.loai}
                      </span>
                    </td>
                    <td className="py-2.5 pr-3 text-center text-xs font-mono text-slate-500">{r.campus_id}</td>
                    <td className="py-2.5 pr-3 text-right text-slate-600">{r.suc_chua} người</td>
                    <td className="py-2.5 pr-3 text-center font-medium">{r.sessionCount}</td>
                    <td className="py-2.5 pr-3 text-right font-bold text-teal-800">{r.bookedHours}h</td>
                    <td className="py-2.5 pr-3 text-right text-slate-500">{r.capacityHours}h</td>
                    <td className="py-2.5 pr-3 text-right font-semibold text-slate-800">{r.utilizationPct}%</td>
                    <td className="py-2.5 text-right">
                      {r.performanceStatus === 'Cao' ? (
                        <Badge tone="amber">Cao (&gt;75%)</Badge>
                      ) : r.performanceStatus === 'Đạt chuẩn' ? (
                        <Badge tone="emerald">Đạt chuẩn (35-75%)</Badge>
                      ) : (
                        <Badge tone="slate">Thấp (&lt;35%)</Badge>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* POPUP MODAL: GỬI BÁO CÁO HÀNG LOẠT QUA SMTP */}
      {isBulkModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-xl w-full p-6 space-y-5 border border-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">
                  ✉ Gửi Báo Cáo Đối Soát Hàng Loạt qua Email
                </h3>
                <p className="text-xs text-slate-500">
                  Gửi từ: <code className="text-teal-700 font-bold">cecics@pnt.edu.vn</code> (Kèm tiền tố [AppCECICS] & tự động dọn Trash)
                </p>
              </div>
              <button
                onClick={() => setIsBulkModalOpen(false)}
                className="text-slate-400 hover:text-slate-600 text-lg font-bold"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between text-xs bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                <label className="flex items-center gap-2 cursor-pointer font-semibold text-slate-800">
                  <input
                    type="checkbox"
                    checked={selectedDeptIds.length === db.Departments.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedDeptIds(db.Departments.map((d) => d.bo_mon_id));
                      } else {
                        setSelectedDeptIds([]);
                      }
                    }}
                    className="rounded text-teal-600 focus:ring-teal-500"
                  />
                  <span>Chọn tất cả ({db.Departments.length} Bộ môn)</span>
                </label>
                <span className="text-slate-500 font-medium">
                  Đã chọn {selectedDeptIds.length}/{db.Departments.length}
                </span>
              </div>

              <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1 divide-y divide-slate-100">
                {db.Departments.map((d) => {
                  const isChecked = selectedDeptIds.includes(d.bo_mon_id);
                  const lock = (db.VerificationLocks || []).find(
                    (l) => l.period_key === periodKey && l.entity_id === d.bo_mon_id
                  );
                  return (
                    <label
                      key={d.bo_mon_id}
                      className="flex items-center justify-between py-2 px-1 cursor-pointer hover:bg-slate-50/60 rounded"
                    >
                      <div className="flex items-center gap-2.5 text-xs text-slate-800">
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedDeptIds([...selectedDeptIds, d.bo_mon_id]);
                            } else {
                              setSelectedDeptIds(selectedDeptIds.filter((id) => id !== d.bo_mon_id));
                            }
                          }}
                          className="rounded text-teal-600 focus:ring-teal-500"
                        />
                        <span className="font-medium">{d.ten}</span>
                      </div>
                      <div className="text-[11px] text-slate-400">
                        {lock?.email_sent_at ? (
                          <span className="text-teal-700 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                            Đã gửi: {lock.email_sent_at.slice(0, 16)}
                          </span>
                        ) : (
                          <span>Chưa gửi</span>
                        )}
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-slate-100">
              <button
                disabled={isSendingEmails}
                onClick={() => setIsBulkModalOpen(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
              >
                Hủy bỏ
              </button>
              <button
                disabled={isSendingEmails || !selectedDeptIds.length}
                onClick={handleSendBulkEmails}
                className="px-4 py-2 text-xs font-semibold text-white bg-teal-700 hover:bg-teal-800 disabled:opacity-50 rounded-lg flex items-center gap-1.5 shadow-sm"
              >
                {isSendingEmails ? (
                  <>
                    <span className="animate-spin">⏳</span> Đang gửi email & file Excel...
                  </>
                ) : (
                  <>
                    <span>🚀</span> Bắt đầu Gửi Email ({selectedDeptIds.length} Bộ môn)
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
