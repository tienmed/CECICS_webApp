import {
  type DatabaseSnapshot,
  type EscalationRecord,
  type EquipmentRecord,
  parseSettings,
  ROLES,
  UNITS,
} from './types';
import {
  countWorkingDays,
  diffDaysYmd,
  durationHours,
  formatVnDate,
  formatVnTime,
  getPeriodRange,
  type PeriodKind,
  todayVnYmd,
  toVnDateTimeMs,
} from './time';

export interface RoomUtilizationRow {
  room_id: string;
  ten: string;
  campus_id: string;
  loai: string;
  suc_chua: number;
  sessionCount: number;
  bookedHours: number;
  capacityHours: number;
  utilizationPct: number;
  performanceStatus: 'Thấp' | 'Đạt chuẩn' | 'Cao';
}

export interface EquipmentGroupUsageRow {
  nhom: string;
  totalCount: number;
  activeCount: number;
  brokenCount: number;
  maintenanceCount: number;
  assignedClasses: number;
}

export interface LecturerSessionDetail {
  session_id: string;
  ngay: string;
  gio_bd: string;
  gio_kt: string;
  loai: string;
  he: string;
  hoc_phan: string;
  bai_giang: string;
  room_id: string;
  room_names: string;
  campus_id: string;
  duration: number;
  isMakeUp: boolean;
  isCrossDept: boolean;
  notes: string;
}

export interface RoomSessionDetail {
  id: string;
  type: 'Session' | 'SimClass';
  ngay: string;
  gio_bd: string;
  gio_kt: string;
  title: string;
  instructorOrOrganizer: string;
  campus_id: string;
  duration: number;
}

export interface LecturerWorkloadRow {
  user_id: string;
  ho_ten: string;
  email: string;
  don_vi: string;
  bo_mon_id: string;
  bo_mon_ten: string;
  isCoreStaff: boolean;
  sessionCount: number;
  teachingHours: number;
  examHours: number;
  totalHours: number;
  hoursDH: number;
  hoursSDH: number;
  hoursCME: number;
  isCrossDept: boolean;
  isOverloaded: boolean;
  deviationPct: number;
  sessions: LecturerSessionDetail[];
}

export interface TechBalanceRow {
  user_id: string;
  ho_ten: string;
  simClassCount: number;
}

export interface DashboardMetrics {
  period: { start: string; end: string; label: string };
  summary: {
    totalSessions: number;
    totalTeachingHours: number;
    totalExamHours: number;
    totalSimClasses: number;
    unassignedRoomsInWindow: number;
    urgentUnassignedRooms: number;
    pendingSimReviews: number;
    lateSimPending: number;
    brokenEquipmentCount: number;
    longBrokenEquipment: EquipmentRecord[];
    openEscalations: number;
    pendingSwaps: number;
  };
  roomUtilization: RoomUtilizationRow[];
  equipmentGroups: EquipmentGroupUsageRow[];
  lecturerWorkload: LecturerWorkloadRow[];
  avgLecturerHours: number;
  techBalance: TechBalanceRow[];
  targetsComparison: {
    chi_tieu: string;
    label: string;
    target: number;
    actual: number;
    pct: number;
  }[];
}

export function computeDashboardMetrics(
  db: DatabaseSnapshot,
  opts: {
    periodKind: PeriodKind;
    year: number;
    periodIndex: number;
    campusId?: string; // '' or 'ALL' means all campuses
    now?: Date;
  }
): DashboardMetrics {
  const settings = parseSettings(db.Settings);
  const period = getPeriodRange(opts.periodKind, opts.year, opts.periodIndex);
  const today = todayVnYmd(opts.now);
  const campusFilter = opts.campusId && opts.campusId !== 'ALL' ? opts.campusId : '';

  const inRange = (ymd: string) => ymd >= period.start && ymd <= period.end;
  const matchCampus = (cid: string) => !campusFilter || cid === campusFilter;

  const activeSessions = db.Sessions.filter(
    (s) => s.trang_thai !== 'Đã hủy' && inRange(s.ngay) && matchCampus(s.campus_id)
  );
  const activeSims = db.SimClasses.filter(
    (sc) =>
      sc.trang_thai !== 'Đã hủy' &&
      sc.trang_thai !== 'Từ chối' &&
      inRange(sc.ngay) &&
      matchCampus(sc.campus_id)
  );

  // 1. Room utilization
  const parseRoomList = (roomIdStr: string) =>
    roomIdStr ? roomIdStr.split(',').map((r) => r.trim()).filter(Boolean) : [];

  const bookedByRoom = new Map<string, number>();
  const roomSessionCountMap = new Map<string, number>();
  for (const s of activeSessions) {
    if (!s.room_id) continue;
    const dur = durationHours(s.gio_bd, s.gio_kt);
    for (const rId of parseRoomList(s.room_id)) {
      bookedByRoom.set(rId, (bookedByRoom.get(rId) || 0) + dur);
      roomSessionCountMap.set(rId, (roomSessionCountMap.get(rId) || 0) + 1);
    }
  }
  for (const sc of activeSims) {
    if (!sc.room_id) continue;
    const dur = durationHours(sc.gio_bd, sc.gio_kt);
    for (const rId of parseRoomList(sc.room_id)) {
      bookedByRoom.set(rId, (bookedByRoom.get(rId) || 0) + dur);
      roomSessionCountMap.set(rId, (roomSessionCountMap.get(rId) || 0) + 1);
    }
  }

  // Chuẩn công suất: 8 giờ/ngày làm việc (Thứ 2 - Thứ 6)
  const workDays = countWorkingDays(period.start, period.end, '1,2,3,4,5');
  const capacityHours = Math.max(1, workDays * 8);

  const rooms = db.Rooms.filter((r) => r.kich_hoat && matchCampus(r.campus_id));
  const roomUtilization: RoomUtilizationRow[] = rooms.map((r) => {
    const bookedHours = Math.round((bookedByRoom.get(r.room_id) || 0) * 10) / 10;
    const utilizationPct = Math.round((bookedHours / capacityHours) * 1000) / 10;
    const sessionCount = roomSessionCountMap.get(r.room_id) || 0;
    const performanceStatus: 'Thấp' | 'Đạt chuẩn' | 'Cao' =
      utilizationPct < 35 ? 'Thấp' : utilizationPct <= 75 ? 'Đạt chuẩn' : 'Cao';
    return {
      room_id: r.room_id,
      ten: r.ten,
      campus_id: r.campus_id,
      loai: r.loai,
      suc_chua: r.suc_chua || 0,
      sessionCount,
      bookedHours,
      capacityHours,
      utilizationPct,
      performanceStatus,
    };
  });

  // 2. Equipment groups usage
  const simIdsInPeriod = new Set(activeSims.map((s) => s.sim_id));
  const eqUsageCount = new Map<string, number>();
  for (const link of db.SimClassEquipment) {
    if (!simIdsInPeriod.has(link.sim_id)) continue;
    eqUsageCount.set(link.equipment_id, (eqUsageCount.get(link.equipment_id) || 0) + 1);
  }
  const eqFiltered = db.Equipment.filter((e) => e.trang_thai !== 'Thanh lý' && matchCampus(e.campus_id));
  const groupMap = new Map<string, EquipmentGroupUsageRow>();
  for (const e of eqFiltered) {
    const g = groupMap.get(e.nhom) || {
      nhom: e.nhom,
      totalCount: 0,
      activeCount: 0,
      brokenCount: 0,
      maintenanceCount: 0,
      assignedClasses: 0,
    };
    g.totalCount++;
    if (e.trang_thai === 'Hoạt động') g.activeCount++;
    else if (e.trang_thai === 'Hỏng') g.brokenCount++;
    else if (e.trang_thai === 'Bảo trì') g.maintenanceCount++;
    g.assignedClasses += eqUsageCount.get(e.equipment_id) || 0;
    groupMap.set(e.nhom, g);
  }
  const equipmentGroups = Array.from(groupMap.values()).sort((a, b) => b.assignedClasses - a.assignedClasses);

  // 3. Lecturer workload & overload warning
  const deptNameMap = new Map(db.Departments.map((d) => [d.bo_mon_id, d.ten]));
  const roomNameMap = new Map(db.Rooms.map((r) => [r.room_id, r.ten]));
  const formatRoomNames = (rIdStr: string) =>
    parseRoomList(rIdStr)
      .map((id) => roomNameMap.get(id) || id)
      .join(', ');

  const lecturers = db.Users.filter((u) => u.kich_hoat && u.vai_tro.includes(ROLES.GIANG_VIEN));
  const lecMap = new Map<
    string,
    {
      teaching: number;
      exam: number;
      count: number;
      hoursDH: number;
      hoursSDH: number;
      hoursCME: number;
      isCrossDept: boolean;
      sessions: LecturerSessionDetail[];
    }
  >();

  for (const l of lecturers) {
    lecMap.set(l.user_id, {
      teaching: 0,
      exam: 0,
      count: 0,
      hoursDH: 0,
      hoursSDH: 0,
      hoursCME: 0,
      isCrossDept: false,
      sessions: [],
    });
  }

  for (const s of activeSessions) {
    if (!s.giang_vien_id) continue;
    const rec = lecMap.get(s.giang_vien_id) || {
      teaching: 0,
      exam: 0,
      count: 0,
      hoursDH: 0,
      hoursSDH: 0,
      hoursCME: 0,
      isCrossDept: false,
      sessions: [],
    };
    const dur = Math.round(durationHours(s.gio_bd, s.gio_kt) * 10) / 10;
    if (s.loai === 'Coi thi') rec.exam += dur;
    else rec.teaching += dur;
    rec.count += 1;

    // Phân rã theo hệ đào tạo
    if (s.he === 'SĐH') rec.hoursSDH += dur;
    else if (s.he === 'CME') rec.hoursCME += dur;
    else rec.hoursDH += dur;

    // Kiểm tra ca dạy bù
    const isMakeUp =
      (s.ghi_chu && (s.ghi_chu.toLowerCase().includes('bù') || s.ghi_chu.toLowerCase().includes('dạy bù'))) ||
      false;

    // Kiểm tra liên bộ môn
    const lecturerUser = db.Users.find((u) => u.user_id === s.giang_vien_id);
    const isCross =
      (lecturerUser?.bo_mon_id && s.hoc_phan && !s.hoc_phan.includes(lecturerUser.bo_mon_id)) ||
      (s.ghi_chu && s.ghi_chu.toLowerCase().includes('liên bộ môn')) ||
      false;
    if (isCross) rec.isCrossDept = true;

    rec.sessions.push({
      session_id: s.session_id,
      ngay: s.ngay,
      gio_bd: s.gio_bd,
      gio_kt: s.gio_kt,
      loai: s.loai,
      he: s.he || 'ĐH',
      hoc_phan: s.hoc_phan,
      bai_giang: s.bai_giang,
      room_id: s.room_id,
      room_names: formatRoomNames(s.room_id),
      campus_id: s.campus_id,
      duration: dur,
      isMakeUp: Boolean(isMakeUp),
      isCrossDept: Boolean(isCross),
      notes: s.ghi_chu || '',
    });

    lecMap.set(s.giang_vien_id, rec);
  }

  const userMap = new Map(db.Users.map((u) => [u.user_id, u]));
  const rawWorkload = Array.from(lecMap.entries()).map(([user_id, v]) => {
    const u = userMap.get(user_id);
    const isCoreStaff = u ? !u.la_nguoi_ngoai && u.don_vi !== 'BO_MON' : false;
    const bo_mon_id = u?.bo_mon_id || '';
    const bo_mon_ten = deptNameMap.get(bo_mon_id) || (isCoreStaff ? 'Trung tâm CECICS' : '');
    const teachingHours = Math.round(v.teaching * 10) / 10;
    const examHours = Math.round(v.exam * 10) / 10;
    const totalHours = Math.round((teachingHours + examHours) * 10) / 10;

    return {
      user_id,
      ho_ten: u?.ho_ten || user_id,
      email: u?.email || '',
      don_vi: u?.don_vi || '',
      bo_mon_id,
      bo_mon_ten,
      isCoreStaff,
      sessionCount: v.count,
      teachingHours,
      examHours,
      totalHours,
      hoursDH: Math.round(v.hoursDH * 10) / 10,
      hoursSDH: Math.round(v.hoursSDH * 10) / 10,
      hoursCME: Math.round(v.hoursCME * 10) / 10,
      isCrossDept: v.isCrossDept,
      sessions: v.sessions.sort((a, b) => a.ngay.localeCompare(b.ngay)),
    };
  });

  const activeLecTotals = rawWorkload.filter((w) => w.totalHours > 0).map((w) => w.totalHours);
  const avgLecturerHours =
    activeLecTotals.length > 0
      ? Math.round((activeLecTotals.reduce((a, b) => a + b, 0) / activeLecTotals.length) * 10) / 10
      : 0;

  const overloadMultiplier = 1 + settings.LECH_TAI_PHAN_TRAM / 100;
  const lecturerWorkload: LecturerWorkloadRow[] = rawWorkload
    .map((w) => {
      const deviationPct =
        avgLecturerHours > 0 ? Math.round(((w.totalHours - avgLecturerHours) / avgLecturerHours) * 100) : 0;
      const isOverloaded = avgLecturerHours > 0 && w.totalHours > avgLecturerHours * overloadMultiplier;
      return { ...w, deviationPct, isOverloaded };
    })
    .sort((a, b) => b.totalHours - a.totalHours);

  // 4. Technician balance
  const techs = db.Users.filter(
    (u) => u.kich_hoat && (u.vai_tro.includes(ROLES.KY_THUAT) || u.don_vi === UNITS.KY_THUAT)
  );
  const techCounts = new Map<string, number>();
  for (const t of techs) techCounts.set(t.user_id, 0);
  for (const sc of activeSims) {
    if (!sc.ktv_phu_trach) continue;
    techCounts.set(sc.ktv_phu_trach, (techCounts.get(sc.ktv_phu_trach) || 0) + 1);
  }
  const techBalance: TechBalanceRow[] = Array.from(techCounts.entries())
    .map(([user_id, simClassCount]) => ({
      user_id,
      ho_ten: userMap.get(user_id)?.ho_ten || user_id,
      simClassCount,
    }))
    .sort((a, b) => b.simClassCount - a.simClassCount);

  // 5. Operational queues (live status relative to today)
  const upcomingNoRoom = db.Sessions.filter((s) => {
    if (s.trang_thai === 'Đã hủy' || s.room_id || !matchCampus(s.campus_id)) return false;
    const days = diffDaysYmd(today, s.ngay);
    return days >= 0 && days <= settings.GAN_PHONG_TRUOC_NGAY;
  });
  const urgentNoRoom = upcomingNoRoom.filter(
    (s) => diffDaysYmd(today, s.ngay) <= settings.CANH_BAO_CHUA_GAN_PHONG_NGAY
  );

  const longBrokenEquipment = eqFiltered.filter(
    (e) =>
      e.trang_thai === 'Hỏng' &&
      e.tu_ngay &&
      diffDaysYmd(e.tu_ngay, today) >= settings.THIET_BI_HONG_LEO_THANG_NGAY
  );

  const pendingSimReviews = db.SimClasses.filter(
    (sc) => sc.trang_thai === 'Chờ rà soát' && matchCampus(sc.campus_id)
  ).length;
  const lateSimPending = db.SimClasses.filter(
    (sc) => sc.trang_thai === 'Cần xét đặc biệt' && matchCampus(sc.campus_id)
  ).length;

  const totalTeachingHours = Math.round(
    activeSessions
      .filter((s) => s.loai !== 'Coi thi')
      .reduce((acc, s) => acc + durationHours(s.gio_bd, s.gio_kt), 0) * 100
  ) / 100;
  const totalExamHours = Math.round(
    activeSessions
      .filter((s) => s.loai === 'Coi thi')
      .reduce((acc, s) => acc + durationHours(s.gio_bd, s.gio_kt), 0) * 100
  ) / 100;

  // 6. Targets comparison (pro-rated for month/quarter)
  const scaleFactor = opts.periodKind === 'month' ? 1 / 12 : opts.periodKind === 'quarter' ? 1 / 4 : 1;
  const yearTargets = db.Targets.filter((t) => t.nam === opts.year);
  const getTarget = (key: string, fallback: number) => {
    const found = yearTargets.find((t) => t.chi_tieu === key);
    return Math.round((found ? found.gia_tri : fallback) * scaleFactor * 10) / 10;
  };
  const targetGioGiang = getTarget('GIO_GIANG', 1200);
  const targetLopMoPhong = getTarget('SO_LOP_MO_PHONG', 180);
  const targetGioCoiThi = getTarget('GIO_COI_THI', 240);

  const targetsComparison = [
    {
      chi_tieu: 'GIO_GIANG',
      label: 'Giờ giảng dạy',
      target: targetGioGiang,
      actual: totalTeachingHours,
      pct: targetGioGiang > 0 ? Math.round((totalTeachingHours / targetGioGiang) * 100) : 0,
    },
    {
      chi_tieu: 'SO_LOP_MO_PHONG',
      label: 'Số lớp mô phỏng',
      target: targetLopMoPhong,
      actual: activeSims.length,
      pct: targetLopMoPhong > 0 ? Math.round((activeSims.length / targetLopMoPhong) * 100) : 0,
    },
    {
      chi_tieu: 'GIO_COI_THI',
      label: 'Giờ coi thi',
      target: targetGioCoiThi,
      actual: totalExamHours,
      pct: targetGioCoiThi > 0 ? Math.round((totalExamHours / targetGioCoiThi) * 100) : 0,
    },
  ];

  return {
    period,
    summary: {
      totalSessions: activeSessions.length,
      totalTeachingHours,
      totalExamHours,
      totalSimClasses: activeSims.length,
      unassignedRoomsInWindow: upcomingNoRoom.length,
      urgentUnassignedRooms: urgentNoRoom.length,
      pendingSimReviews,
      lateSimPending,
      brokenEquipmentCount: eqFiltered.filter((e) => e.trang_thai === 'Hỏng').length,
      longBrokenEquipment,
      openEscalations: db.Escalations.filter((e) => e.trang_thai === 'Đang mở').length,
      pendingSwaps: db.SwapRequests.filter((sw) => sw.trang_thai === 'Chờ').length,
    },
    roomUtilization,
    equipmentGroups,
    lecturerWorkload,
    avgLecturerHours,
    techBalance,
    targetsComparison,
  };
}

/**
 * Quét các điều kiện cần tự động tạo mục Leo thang lên Ban Lãnh đạo:
 * 1. Thiết bị hỏng quá N ngày (mặc định 7 ngày)
 * 2. Buổi học còn ≤ 2 ngày chưa được gán phòng
 * 3. Lớp mô phỏng "Cần xét đặc biệt" chưa xử lý quá 3 ngày
 */
export function detectPendingEscalations(
  db: DatabaseSnapshot,
  now: Date = new Date()
): Omit<EscalationRecord, 'esc_id' | 'tao_luc' | 'trang_thai' | 'hanh_dong_ld' | 'y_kien' | 'boi' | 'luc'>[] {
  const settings = parseSettings(db.Settings);
  const today = todayVnYmd(now);
  const existingOpenKeys = new Set(
    db.Escalations.filter((e) => e.trang_thai === 'Đang mở').map((e) => `${e.loai}:${e.doi_tuong_id}`)
  );

  const toCreate: Omit<
    EscalationRecord,
    'esc_id' | 'tao_luc' | 'trang_thai' | 'hanh_dong_ld' | 'y_kien' | 'boi' | 'luc'
  >[] = [];

  for (const eq of db.Equipment) {
    if (eq.trang_thai !== 'Hỏng' || !eq.tu_ngay) continue;
    const days = diffDaysYmd(eq.tu_ngay, today);
    if (days >= settings.THIET_BI_HONG_LEO_THANG_NGAY && !existingOpenKeys.has(`THIET_BI_HONG:${eq.equipment_id}`)) {
      toCreate.push({
        loai: 'THIET_BI_HONG',
        doi_tuong_id: eq.equipment_id,
        don_vi: UNITS.KY_THUAT,
        ly_do: `Thiết bị "${eq.ten}" (${eq.equipment_id}) hỏng đã ${days} ngày (từ ${formatVnDate(eq.tu_ngay)}) chưa khắc phục.`,
      });
    }
  }

  const nowMs = now.getTime();

  for (const s of db.Sessions) {
    if (s.trang_thai === 'Đã hủy' || s.room_id) continue;
    // Bỏ qua các buổi trong quá khứ (đã bắt đầu hoặc kết thúc)
    const sessionStartMs = toVnDateTimeMs(s.ngay, s.gio_bd);
    if (!Number.isNaN(sessionStartMs) && sessionStartMs <= nowMs) {
      continue;
    }
    const daysLeft = diffDaysYmd(today, s.ngay);
    if (
      daysLeft >= 0 &&
      daysLeft <= settings.CANH_BAO_CHUA_GAN_PHONG_NGAY &&
      !existingOpenKeys.has(`CHUA_GAN_PHONG:${s.session_id}`)
    ) {
      const dateFormatted = formatVnDate(s.ngay);
      const startTime = formatVnTime(s.gio_bd);
      const endTime = formatVnTime(s.gio_kt);
      toCreate.push({
        loai: 'CHUA_GAN_PHONG',
        doi_tuong_id: s.session_id,
        don_vi: UNITS.HANH_CHINH,
        ly_do: `Buổi "${s.hoc_phan} - ${s.bai_giang}" ngày ${dateFormatted} (${startTime}–${endTime}) còn ${daysLeft} ngày nhưng chưa gán phòng.`,
      });
    }
  }

  for (const sc of db.SimClasses) {
    if (sc.trang_thai !== 'Cần xét đặc biệt') continue;
    const createdDay = sc.tao_luc.slice(0, 10);
    const waitingDays = diffDaysYmd(createdDay, today);
    if (
      waitingDays >= settings.LOP_TRE_LEO_THANG_NGAY &&
      !existingOpenKeys.has(`LOP_TRE_TON_DONG:${sc.sim_id}`)
    ) {
      toCreate.push({
        loai: 'LOP_TRE_TON_DONG',
        doi_tuong_id: sc.sim_id,
        don_vi: UNITS.KY_THUAT,
        ly_do: `Lớp mô phỏng đăng ký trễ "${sc.noi_dung}" (${sc.sim_id}, ngày ${formatVnDate(sc.ngay)}) chờ xét đặc biệt đã ${waitingDays} ngày.`,
      });
    }
  }

  return toCreate;
}
