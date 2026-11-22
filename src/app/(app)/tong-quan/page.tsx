'use client';

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { computeDashboardMetrics } from '@/core/analytics';
import { type PeriodKind, todayVnYmd } from '@/core/time';
import { ROLES, UNITS } from '@/core/types';
import { useApp } from '@/components/AppProvider';
import { Badge, Card, KpiCard, PageHeader } from '@/components/ui';

export default function DashboardPage() {
  const { user, db } = useApp();
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const todayYmd = useMemo(() => todayVnYmd(), []);
  const currentYear = Number(todayYmd.slice(0, 4));
  const currentMonth = Number(todayYmd.slice(5, 7));

  const [periodKind, setPeriodKind] = useState<PeriodKind>('month');
  const [year, setYear] = useState<number>(currentYear);
  const [periodIndex, setPeriodIndex] = useState<number>(currentMonth);
  const [campusId, setCampusId] = useState<string>('ALL');

  const metrics = useMemo(
    () => computeDashboardMetrics(db, { periodKind, year, periodIndex, campusId }),
    [db, periodKind, year, periodIndex, campusId]
  );

  const isLeader = user.vai_tro.includes(ROLES.LANH_DAO) || user.vai_tro.includes(ROLES.ADMIN);
  const isHC = user.don_vi === UNITS.HANH_CHINH || user.vai_tro.includes(ROLES.HANH_CHINH);
  const isDT = user.don_vi === UNITS.DAO_TAO || user.vai_tro.includes(ROLES.DAO_TAO);
  const isKT = user.don_vi === UNITS.KY_THUAT || user.vai_tro.includes(ROLES.KY_THUAT);

  const overloadedLecturers = metrics.lecturerWorkload.filter((w) => w.isOverloaded);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Bảng điều hành tổng quan"
        subtitle={`Kỳ thống kê: ${metrics.period.label} (${metrics.period.start} → ${metrics.period.end})`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={campusId}
              onChange={(e) => setCampusId(e.target.value)}
              className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 bg-white"
            >
              <option value="ALL">Tất cả cơ sở (HH + TN)</option>
              {db.Campuses.map((c) => (
                <option key={c.campus_id} value={c.campus_id}>
                  {c.ten}
                </option>
              ))}
            </select>

            <select
              value={periodKind}
              onChange={(e) => {
                const k = e.target.value as PeriodKind;
                setPeriodKind(k);
                if (k === 'month') setPeriodIndex(currentMonth);
                if (k === 'quarter') setPeriodIndex(Math.floor((currentMonth - 1) / 3) + 1);
              }}
              className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 bg-white"
            >
              <option value="month">Theo Tháng</option>
              <option value="quarter">Theo Quý</option>
              <option value="year">Theo Năm</option>
            </select>

            {periodKind === 'month' && (
              <select
                value={periodIndex}
                onChange={(e) => setPeriodIndex(Number(e.target.value))}
                className="text-sm border border-slate-300 rounded-lg px-3 py-1.5 bg-white"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    Tháng {m}
                  </option>
                ))}
              </select>
            )}

            {periodKind === 'quarter' && (
              <select
                value={periodIndex}
                onChange={(e) => setPeriodIndex(Number(e.target.value))}
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
                  Năm {y}
                </option>
              ))}
            </select>
          </div>
        }
      />

      {/* Top KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <KpiCard
          label="Giờ giảng / Coi thi"
          value={`${metrics.summary.totalTeachingHours}h / ${metrics.summary.totalExamHours}h`}
          hint={`${metrics.summary.totalSessions} buổi trong kỳ`}
          tone="teal"
        />
        <KpiCard
          label="Chờ gán phòng (7 ngày)"
          value={metrics.summary.unassignedRoomsInWindow}
          hint={
            metrics.summary.urgentUnassignedRooms > 0
              ? `⚠️ ${metrics.summary.urgentUnassignedRooms} buổi gấp (≤ 2 ngày)`
              : 'Không có buổi gấp'
          }
          tone={metrics.summary.urgentUnassignedRooms > 0 ? 'red' : 'default'}
        />
        <KpiCard
          label="Lớp mô phỏng"
          value={metrics.summary.totalSimClasses}
          hint={`${metrics.summary.pendingSimReviews} chờ rà soát · ${metrics.summary.lateSimPending} xét đặc biệt`}
          tone={metrics.summary.lateSimPending > 0 ? 'amber' : 'default'}
        />
        <KpiCard
          label="Thiết bị báo hỏng"
          value={metrics.summary.brokenEquipmentCount}
          hint={
            metrics.summary.longBrokenEquipment.length > 0
              ? `🚨 ${metrics.summary.longBrokenEquipment.length} thiết bị hỏng ≥ 7 ngày`
              : 'Trong tầm kiểm soát'
          }
          tone={metrics.summary.longBrokenEquipment.length > 0 ? 'red' : 'emerald'}
        />
        <KpiCard
          label="Leo thang đang mở"
          value={metrics.summary.openEscalations}
          hint={`${metrics.summary.pendingSwaps} yêu cầu hoán đổi chờ`}
          tone={metrics.summary.openEscalations > 0 ? 'amber' : 'emerald'}
        />
      </div>

      {/* Role-focused Quick Action Strip */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Targets vs Actuals */}
        <Card
          title="Tiến độ mục tiêu vs. Thực hiện"
          subtitle={`Chỉ tiêu quy đổi theo ${metrics.period.label}`}
          action={
            <Link href="/quan-tri" className="text-xs text-teal-700 font-medium hover:underline">
              Sửa chỉ tiêu →
            </Link>
          }
        >
          <div className="space-y-4">
            {metrics.targetsComparison.map((t) => (
              <div key={t.chi_tieu}>
                <div className="flex justify-between text-sm mb-1">
                  <span className="font-medium text-slate-800">{t.label}</span>
                  <span className="text-slate-600">
                    <strong>{t.actual}</strong> / {t.target} ({t.pct}%)
                  </span>
                </div>
                <div className="h-2.5 bg-slate-100 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      t.pct >= 80 ? 'bg-teal-600' : t.pct >= 40 ? 'bg-amber-500' : 'bg-slate-400'
                    }`}
                    style={{ width: `${Math.min(100, t.pct)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </Card>

        {/* Bottlenecks / Escalations */}
        <Card
          title="Điểm nghẽn & Mục leo thang đang mở"
          subtitle="Thiết bị hỏng kéo dài, buổi sát giờ chưa có phòng, lớp trễ hạn tồn đọng"
          action={
            <Link href="/leo-thang" className="text-xs text-teal-700 font-medium hover:underline">
              Xử lý leo thang →
            </Link>
          }
        >
          {db.Escalations.filter((e) => e.trang_thai === 'Đang mở').length === 0 ? (
            <div className="py-8 text-center text-sm text-emerald-700 bg-emerald-50/50 rounded-lg">
              ✅ Không có điểm nghẽn nào đang leo thang.
            </div>
          ) : (
            <div className="space-y-2.5 max-h-64 overflow-y-auto">
              {db.Escalations.filter((e) => e.trang_thai === 'Đang mở').map((esc) => (
                <div key={esc.esc_id} className="p-3 rounded-lg border border-red-200 bg-red-50/40">
                  <div className="flex items-center justify-between gap-2">
                    <Badge tone="red">{esc.loai}</Badge>
                    <span className="text-xs text-slate-500">{esc.esc_id}</span>
                  </div>
                  <p className="text-sm text-slate-800 mt-1.5">{esc.ly_do}</p>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Room Utilization */}
        {(isLeader || isHC || isKT) && (
          <Card
            title="Công suất sử dụng phòng (%)"
            subtitle="Tính trên tổng giờ làm việc trong kỳ (gồm lịch giảng, coi thi và lớp mô phỏng)"
          >
            <div className="h-64">
              {mounted ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metrics.roomUtilization} margin={{ top: 8, right: 16, left: -12, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="room_id" tick={{ fontSize: 11 }} />
                    <YAxis unit="%" tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(val, name) =>
                        name === 'utilizationPct' ? [`${val}%`, 'Công suất'] : [`${val}h`, 'Giờ đặt']
                      }
                    />
                    <Bar dataKey="utilizationPct" name="Công suất (%)" fill="#0f766e" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full w-full bg-slate-50 animate-pulse rounded-lg" />
              )}
            </div>
          </Card>
        )}

        {/* Lecturer Workload & Overload Alert */}
        {(isLeader || isDT) && (
          <Card
            title="Phân bổ tải lượng giảng dạy (giờ)"
            subtitle={`Trung bình: ${metrics.avgLecturerHours}h · Cảnh báo đỏ khi vượt quá ngưỡng lệch tải`}
            action={
              overloadedLecturers.length > 0 ? (
                <Badge tone="red">⚠️ {overloadedLecturers.length} GV lệch tải</Badge>
              ) : (
                <Badge tone="emerald">Cân bằng</Badge>
              )
            }
          >
            <div className="h-64">
              {mounted ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={metrics.lecturerWorkload.map((w) => ({
                      ...w,
                      shortName: w.ho_ten.split('(')[0].trim().split(' ').slice(-2).join(' '),
                    }))}
                    margin={{ top: 8, right: 16, left: -12, bottom: 8 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="shortName" tick={{ fontSize: 11 }} />
                    <YAxis unit="h" tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Bar dataKey="totalHours" name="Tổng giờ" radius={[6, 6, 0, 0]}>
                      {metrics.lecturerWorkload.map((entry) => (
                        <Cell key={entry.user_id} fill={entry.isOverloaded ? '#dc2626' : '#0284c7'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full w-full bg-slate-50 animate-pulse rounded-lg" />
              )}
            </div>
          </Card>
        )}

        {/* Equipment group status */}
        {(isLeader || isKT) && (
          <Card title="Tình trạng & Tần suất nhóm thiết bị" subtitle="Số lượng thiết bị theo trạng thái và số lớp đã gán">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                    <th className="pb-2">Nhóm thiết bị</th>
                    <th className="pb-2 text-center">Hoạt động</th>
                    <th className="pb-2 text-center">Bảo trì</th>
                    <th className="pb-2 text-center">Hỏng</th>
                    <th className="pb-2 text-right">Lượt gán lớp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {metrics.equipmentGroups.map((g) => (
                    <tr key={g.nhom}>
                      <td className="py-2.5 font-medium text-slate-800">{g.nhom}</td>
                      <td className="py-2.5 text-center">
                        <Badge tone="emerald">{g.activeCount}</Badge>
                      </td>
                      <td className="py-2.5 text-center">
                        <Badge tone="amber">{g.maintenanceCount}</Badge>
                      </td>
                      <td className="py-2.5 text-center">
                        <Badge tone={g.brokenCount > 0 ? 'red' : 'slate'}>{g.brokenCount}</Badge>
                      </td>
                      <td className="py-2.5 text-right font-semibold text-teal-800">{g.assignedClasses}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* Technician workload balance */}
        {(isLeader || isKT) && (
          <Card title="Cân bằng hỗ trợ lớp giữa Kỹ thuật viên" subtitle="Số lớp mô phỏng phân công theo KTV trong kỳ">
            <div className="h-56">
              {mounted ? (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={metrics.techBalance} margin={{ top: 8, right: 16, left: -12, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                    <XAxis dataKey="ho_ten" tick={{ fontSize: 11 }} />
                    <YAxis allowDecimals={false} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    <Bar dataKey="simClassCount" name="Số lớp mô phỏng" fill="#0d9488" radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full w-full bg-slate-50 animate-pulse rounded-lg" />
              )}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
}
