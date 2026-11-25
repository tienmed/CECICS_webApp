'use client';

import React, { useMemo, useState } from 'react';
import { canPerform } from '@/core/permissions';
import { diffDaysYmd, formatVnDate, todayVnYmd } from '@/core/time';
import { EQUIPMENT_STATUSES, INCIDENT_ASSESSMENTS, type ConsumableRecord, type EquipmentCatalogRecord, type EquipmentRecord } from '@/core/types';
import { calculateEquipmentUsageMap, dispatchLeastUsedEquipment, suggestEquipmentAndConsumablesForLesson } from '@/core/equipment-dispatch';
import { useApp } from '@/components/AppProvider';
import { Badge, Card, Modal, PageHeader } from '@/components/ui';

const inputCls = 'w-full text-sm border border-slate-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-teal-500 focus:outline-none';
const labelCls = 'block text-xs font-semibold text-slate-700 mb-1';

type TabKey = 'EQUIPMENT' | 'CATALOG' | 'CONSUMABLES' | 'MAINTENANCE' | 'REPORT';

export default function EquipmentPage() {
  const { user, db, execute } = useApp();
  const [activeTab, setActiveTab] = useState<TabKey>('EQUIPMENT');
  const [search, setSearch] = useState('');
  const [campusFilter, setCampusFilter] = useState('ALL');
  const [nhomFilter, setNhomFilter] = useState('ALL');
  const [catalogFilter, setCatalogFilter] = useState('ALL');

  // Modals state
  const [addOpen, setAddOpen] = useState(false);
  const [addCatOpen, setAddCatOpen] = useState(false);
  const [addConsumableOpen, setAddConsumableOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<EquipmentRecord | null>(null);
  const [simTestOpen, setSimTestOpen] = useState(false);

  // KTV Features State
  const [maintenanceOpen, setMaintenanceOpen] = useState(false);
  const [maintenanceTarget, setMaintenanceTarget] = useState<EquipmentRecord | null>(null);
  const [maintenanceForm, setMaintenanceForm] = useState({
    loai: 'Sau buổi học',
    sim_id: '',
    noi_dung: '',
    tinh_trang_sau: 'Tốt - Sẵn sàng',
    vi_tri_sau: '',
    ngay_bao_tri_tiep: '',
    so_gio_dung_them: 0,
    so_luot_dung_them: 0,
    ghi_chu: '',
  });

  const [locationMoveTarget, setLocationMoveTarget] = useState<EquipmentRecord | null>(null);
  const [locationMoveForm, setLocationMoveForm] = useState({
    vi_tri_moi: '',
    ly_do_di_chuyen: '',
    set_as_default_location: false,
  });

  const [lessonHelperOpen, setLessonHelperOpen] = useState(false);
  const [lessonHelperForm, setLessonHelperForm] = useState({
    noi_dung: '',
    boi_canh_lam_sang: '',
    ky_nang_mong_doi: '',
    so_hoc_vien: 16,
    so_nhom: 3,
    campus_id: 'HH',
  });
  const [lessonSuggestion, setLessonSuggestion] = useState<ReturnType<typeof suggestEquipmentAndConsumablesForLesson> | null>(null);

  // Forms state
  const [newEq, setNewEq] = useState({
    equipment_id: '',
    catalog_id: '',
    ten: '',
    nhom: 'Hồi sức cấp cứu & Tim mạch',
    campus_id: 'HH',
    so_seri: '',
    nam_sx: '2020',
    vi_tri: 'Lầu 8 Khu C',
    ghi_chu: '',
  });

  const [newCat, setNewCat] = useState({
    catalog_id: '',
    ten: '',
    nhom: 'Hồi sức cấp cứu & Tim mạch',
    hang_sx: '',
    dvt: 'Mô hình',
    mo_ta: '',
  });

  const [newConsumable, setNewConsumable] = useState({
    consumable_id: '',
    ten: '',
    nhom: 'Vật tư chung',
    dvt: 'Hộp',
    dinh_muc_mac_dinh: 1,
    ton_kho: 50,
    ghi_chu: '',
  });

  const [incidentForm, setIncidentForm] = useState({ mo_ta: '', danh_gia: 'Chưa đánh giá', du_kien_xong: '' });
  const [mitigationPick, setMitigationPick] = useState<Record<string, string>>({});

  // Dispatch simulation test state
  const [testCatalogId, setTestCatalogId] = useState('');
  const [testCount, setTestCount] = useState(2);
  const [testCampus, setTestCampus] = useState('HH');
  const [testResult, setTestResult] = useState<ReturnType<typeof dispatchLeastUsedEquipment> | null>(null);

  const today = todayVnYmd();
  const canManage = canPerform(user, 'manage_equipment');
  const canConfirmImpact = canPerform(user, 'confirm_incident_impact');

  const eqMap = useMemo(() => new Map(db.Equipment.map((e) => [e.equipment_id, e])), [db.Equipment]);
  const catMap = useMemo(() => new Map(db.EquipmentCatalogs.map((c) => [c.catalog_id, c])), [db.EquipmentCatalogs]);
  const usageMap = useMemo(() => calculateEquipmentUsageMap(db.Equipment, db.SimClasses, db.SimClassEquipment), [db.Equipment, db.SimClasses, db.SimClassEquipment]);

  // Unique nhóm list
  const nhomList = useMemo(() => {
    const set = new Set<string>();
    db.Equipment.forEach((e) => e.nhom && set.add(e.nhom));
    db.EquipmentCatalogs.forEach((c) => c.nhom && set.add(c.nhom));
    return Array.from(set).sort();
  }, [db.Equipment, db.EquipmentCatalogs]);

  const filteredEq = useMemo(() => {
    const q = search.trim().toLowerCase();
    return db.Equipment.filter((e) => {
      if (campusFilter !== 'ALL' && e.campus_id !== campusFilter) return false;
      if (nhomFilter !== 'ALL' && e.nhom !== nhomFilter) return false;
      if (catalogFilter !== 'ALL' && e.catalog_id !== catalogFilter) return false;
      if (q && !`${e.equipment_id} ${e.ten} ${e.nhom} ${e.so_seri || ''} ${e.vi_tri || ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [db.Equipment, search, campusFilter, nhomFilter, catalogFilter]);

  const filteredCatalogs = useMemo(() => {
    const q = search.trim().toLowerCase();
    return db.EquipmentCatalogs.filter((c) => {
      if (nhomFilter !== 'ALL' && c.nhom !== nhomFilter) return false;
      if (q && !`${c.catalog_id} ${c.ten} ${c.nhom} ${c.hang_sx || ''}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [db.EquipmentCatalogs, search, nhomFilter]);

  const filteredConsumables = useMemo(() => {
    const q = search.trim().toLowerCase();
    return db.Consumables.filter((c) => {
      if (q && !`${c.consumable_id} ${c.ten} ${c.nhom} ${c.dvt}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [db.Consumables, search]);

  const openIncidents = useMemo(
    () => db.Incidents.filter((i) => i.trang_thai === 'Đang mở').sort((a, b) => b.bao_luc.localeCompare(a.bao_luc)),
    [db.Incidents]
  );

  async function handleCreateEq(e: React.FormEvent) {
    e.preventDefault();
    const res = await execute('createEquipment', newEq, 'Đã thêm thiết bị mới vào hệ thống.');
    if (res.ok) {
      setAddOpen(false);
      setNewEq({
        equipment_id: '',
        catalog_id: '',
        ten: '',
        nhom: 'Hồi sức cấp cứu & Tim mạch',
        campus_id: 'HH',
        so_seri: '',
        nam_sx: '2020',
        vi_tri: 'Lầu 8 Khu C',
        ghi_chu: '',
      });
    }
  }

  async function handleCreateCat(e: React.FormEvent) {
    e.preventDefault();
    const res = await execute('upsertEquipmentCatalog', newCat, 'Đã lưu loại mô hình/thiết bị vào danh mục.');
    if (res.ok) {
      setAddCatOpen(false);
      setNewCat({
        catalog_id: '',
        ten: '',
        nhom: 'Hồi sức cấp cứu & Tim mạch',
        hang_sx: '',
        dvt: 'Mô hình',
        mo_ta: '',
      });
    }
  }

  async function handleCreateConsumable(e: React.FormEvent) {
    e.preventDefault();
    const res = await execute('upsertConsumable', newConsumable, 'Đã lưu vật tư tiêu hao vào danh mục.');
    if (res.ok) {
      setAddConsumableOpen(false);
      setNewConsumable({
        consumable_id: '',
        ten: '',
        nhom: 'Vật tư chung',
        dvt: 'Hộp',
        dinh_muc_mac_dinh: 1,
        ton_kho: 50,
        ghi_chu: '',
      });
    }
  }

  async function handleStatusChange(eq: EquipmentRecord, trang_thai: string) {
    await execute('updateEquipment', { equipment_id: eq.equipment_id, trang_thai }, `Đã cập nhật trạng thái ${eq.equipment_id} sang "${trang_thai}".`);
  }

  async function handleReportIncident(e: React.FormEvent) {
    e.preventDefault();
    if (!reportTarget) return;
    const res = await execute(
      'reportIncident',
      { equipment_id: reportTarget.equipment_id, ...incidentForm },
      'Đã ghi nhận sự cố và tự động quét các lớp bị ảnh hưởng.'
    );
    if (res.ok) {
      setReportTarget(null);
      setIncidentForm({ mo_ta: '', danh_gia: 'Chưa đánh giá', du_kien_xong: '' });
    }
  }

  async function handleAssess(incident_id: string, danh_gia: string) {
    await execute('assessIncident', { incident_id, danh_gia }, 'Đã cập nhật đánh giá sự cố.');
  }

  async function handleConfirmImpact(impact_id: string) {
    const phuong_an = mitigationPick[impact_id] || 'Đổi mô hình';
    await execute('confirmIncidentImpact', { impact_id, phuong_an }, 'Đã xác nhận phương án thay thế với Bộ môn.');
  }

  async function handleCloseIncident(incident_id: string) {
    await execute('closeIncident', { incident_id }, 'Đã đóng sự cố — thiết bị hoạt động trở lại.');
  }

  function runSimulationDispatch() {
    const res = dispatchLeastUsedEquipment(
      {
        catalog_id: testCatalogId || undefined,
        count: Number(testCount) || 1,
        campus_id: testCampus,
        ngay: today,
        gio_bd: '08:00',
        gio_kt: '11:30',
      },
      db
    );
    setTestResult(res);
  }

  function handleOpenMaintenance(eq: EquipmentRecord, loai = 'Sau buổi học') {
    setMaintenanceTarget(eq);
    setMaintenanceForm({
      loai,
      sim_id: '',
      noi_dung: loai === 'Sau buổi học'
        ? 'Vệ sinh mô hình, khử khuẩn bề mặt, sạc pin thiết bị, kiểm tra hoàn chỉnh phụ kiện.'
        : 'Bảo trì định kỳ: Kiểm tra vi mạch, bôi trơn linh kiện cơ khí, kiểm định cảm biến.',
      tinh_trang_sau: 'Tốt - Sẵn sàng',
      vi_tri_sau: eq.vi_tri || '',
      ngay_bao_tri_tiep: '',
      so_gio_dung_them: loai === 'Sau buổi học' ? 3.5 : 0,
      so_luot_dung_them: loai === 'Sau buổi học' ? 1 : 0,
      ghi_chu: '',
    });
    setMaintenanceOpen(true);
  }

  async function handleSaveMaintenance(e: React.FormEvent) {
    e.preventDefault();
    if (!maintenanceTarget) return;

    const res = await execute(
      'recordEquipmentMaintenance',
      {
        equipment_id: maintenanceTarget.equipment_id,
        ...maintenanceForm,
      },
      'Đã ghi nhận bảo dưỡng/bảo trì và cập nhật hồ sơ thiết bị.'
    );

    if (res.ok) {
      setMaintenanceOpen(false);
      setMaintenanceTarget(null);
    }
  }

  function handleOpenLocationMove(eq: EquipmentRecord) {
    setLocationMoveTarget(eq);
    setLocationMoveForm({
      vi_tri_moi: eq.vi_tri_hien_tai || eq.vi_tri || '',
      ly_do_di_chuyen: '',
      set_as_default_location: false,
    });
  }

  async function handleSaveLocationMove(e: React.FormEvent) {
    e.preventDefault();
    if (!locationMoveTarget) return;

    const res = await execute(
      'updateEquipmentLocation',
      {
        equipment_id: locationMoveTarget.equipment_id,
        ...locationMoveForm,
      },
      `Đã cập nhật vị trí thiết bị ${locationMoveTarget.equipment_id}.`
    );

    if (res.ok) {
      setLocationMoveTarget(null);
    }
  }

  function handleRunLessonSuggestion(e?: React.FormEvent) {
    if (e) e.preventDefault();
    const result = suggestEquipmentAndConsumablesForLesson(
      {
        noi_dung: lessonHelperForm.noi_dung,
        boi_canh_lam_sang: lessonHelperForm.boi_canh_lam_sang,
        ky_nang_mong_doi: lessonHelperForm.ky_nang_mong_doi,
        so_hoc_vien: Number(lessonHelperForm.so_hoc_vien) || 12,
        so_nhom: Number(lessonHelperForm.so_nhom) || 2,
        campus_id: lessonHelperForm.campus_id,
      },
      db
    );
    setLessonSuggestion(result);
  }

  return (
    <div className="space-y-6 pb-12">
      <PageHeader
        title="Quản lý Mô hình, Thiết bị & Vật tư Tiêu hao"
        subtitle="Quản lý 358 thiết bị/mô hình · Danh mục phân cấp theo mã Code · Điều phối cân bằng tải Least-Used First · Báo cáo PNT Mẫu 02/03"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => {
                setLessonHelperOpen(true);
                if (lessonHelperForm.noi_dung) handleRunLessonSuggestion();
              }}
              className="px-3.5 py-2 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-sm font-semibold flex items-center gap-1.5 transition-colors shadow-sm"
            >
              <span>🎓</span> Hỗ trợ GV chọn Mô hình &amp; Vật tư
            </button>
            <button
              onClick={() => {
                setTestCatalogId(db.EquipmentCatalogs[0]?.catalog_id || '');
                setSimTestOpen(true);
              }}
              className="px-3.5 py-2 rounded-lg border border-teal-600 text-teal-700 hover:bg-teal-50 text-sm font-semibold flex items-center gap-1.5 transition-colors"
            >
              <span>⚡</span> Thử nghiệm Điều phối Tự động
            </button>
            {canManage && (
              <>
                <button
                  onClick={() => setAddConsumableOpen(true)}
                  className="px-3.5 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium"
                >
                  + Vật tư mới
                </button>
                <button
                  onClick={() => setAddCatOpen(true)}
                  className="px-3.5 py-2 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 text-sm font-medium"
                >
                  + Loại mô hình
                </button>
                <button
                  onClick={() => setAddOpen(true)}
                  className="px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold shadow-sm"
                >
                  + Thêm thiết bị cá thể
                </button>
              </>
            )}
          </div>
        }
      />

      {/* Tabs navigation */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('EQUIPMENT')}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'EQUIPMENT' ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>📦</span> Cá thể Thiết bị ({db.Equipment.length})
        </button>
        <button
          onClick={() => setActiveTab('CATALOG')}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'CATALOG' ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>📑</span> Danh mục Loại mô hình ({db.EquipmentCatalogs.length})
        </button>
        <button
          onClick={() => setActiveTab('CONSUMABLES')}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'CONSUMABLES' ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>🧪</span> Vật tư tiêu hao ({db.Consumables.length})
        </button>
        <button
          onClick={() => setActiveTab('MAINTENANCE')}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'MAINTENANCE' ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>🔧</span> Bảo dưỡng &amp; Bảo trì định kỳ ({(db.EquipmentMaintenance || []).length})
        </button>
        <button
          onClick={() => setActiveTab('REPORT')}
          className={`px-5 py-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
            activeTab === 'REPORT' ? 'border-teal-600 text-teal-700' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <span>📊</span> Báo cáo Mẫu 02 &amp; 03 PNT
        </button>
      </div>

      {/* Sự cố mở */}
      {openIncidents.length > 0 && (
        <Card title={`Sự cố đang mở (${openIncidents.length})`} subtitle="Đánh giá sửa kịp/không kịp và thống nhất phương án với Bộ môn">
          <div className="space-y-4">
            {openIncidents.map((inc) => {
              const eq = eqMap.get(inc.equipment_id);
              const impacts = db.IncidentImpacts.filter((im) => im.incident_id === inc.incident_id);
              return (
                <div key={inc.incident_id} className="p-4 rounded-xl border border-red-200 bg-red-50/30 space-y-3">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <div className="flex items-center gap-2">
                        <Badge tone="red">{inc.incident_id}</Badge>
                        <span className="font-bold text-slate-900">
                          {eq?.ten || inc.equipment_id} ({inc.equipment_id})
                        </span>
                      </div>
                      <p className="text-sm text-slate-700 mt-1">{inc.mo_ta}</p>
                      <div className="text-xs text-slate-500 mt-0.5">
                        Đánh giá hiện tại: <strong>{inc.danh_gia}</strong>
                        {inc.du_kien_xong && ` · Dự kiến xong: ${formatVnDate(inc.du_kien_xong)}`}
                      </div>
                    </div>
                    {canManage && (
                      <div className="flex items-center gap-2">
                        {inc.danh_gia !== 'Sửa kịp' && (
                          <button
                            onClick={() => handleAssess(inc.incident_id, 'Sửa kịp')}
                            className="px-3 py-1.5 text-xs rounded-lg border border-teal-600 text-teal-700 bg-white hover:bg-teal-50"
                          >
                            Đánh giá: Sửa kịp
                          </button>
                        )}
                        {inc.danh_gia !== 'Không kịp' && (
                          <button
                            onClick={() => handleAssess(inc.incident_id, 'Không kịp')}
                            className="px-3 py-1.5 text-xs rounded-lg border border-red-300 text-red-700 bg-white hover:bg-red-50"
                          >
                            Đánh giá: Không kịp (báo BM)
                          </button>
                        )}
                        <button
                          onClick={() => handleCloseIncident(inc.incident_id)}
                          className="px-3 py-1.5 text-xs rounded-lg bg-teal-700 text-white hover:bg-teal-800"
                        >
                          Đã sửa xong / Đóng sự cố
                        </button>
                      </div>
                    )}
                  </div>

                  {impacts.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-red-200">
                      <div className="text-xs font-semibold text-red-800 uppercase tracking-wider mb-2">
                        Các lớp bị ảnh hưởng ({impacts.length}):
                      </div>
                      <div className="space-y-2">
                        {impacts.map((im) => {
                          const sc = db.SimClasses.find((s) => s.sim_id === im.sim_id);
                          return (
                            <div key={im.impact_id} className="flex flex-col sm:flex-row sm:items-center justify-between text-xs bg-white p-2.5 rounded-lg border border-red-100 gap-2">
                              <div>
                                <span className="font-semibold text-slate-900">{sc?.noi_dung || im.sim_id}</span>
                                <span className="text-slate-500 ml-2">({sc ? formatVnDate(sc.ngay) : ''})</span>
                                <span className="ml-2">
                                  Trạng thái BM: <strong>{im.bo_mon_xac_nhan ? 'Đã xác nhận' : 'Chờ phản hồi'}</strong>
                                </span>
                              </div>
                              {canConfirmImpact && !im.bo_mon_xac_nhan && (
                                <div className="flex items-center gap-1.5">
                                  <select
                                    value={mitigationPick[im.impact_id] || 'Đổi mô hình'}
                                    onChange={(e) => setMitigationPick({ ...mitigationPick, [im.impact_id]: e.target.value })}
                                    className="text-xs border border-slate-300 rounded px-2 py-1"
                                  >
                                    <option value="Đổi mô hình">Đổi mô hình khác</option>
                                    <option value="Giảm bài">Giảm bớt trạm/bài</option>
                                    <option value="Dời lịch">Dời ngày học</option>
                                  </select>
                                  <button
                                    onClick={() => handleConfirmImpact(im.impact_id)}
                                    className="px-2.5 py-1 rounded bg-teal-700 text-white hover:bg-teal-800"
                                  >
                                    Xác nhận với BM
                                  </button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* TAB 1: CÁ THỂ THIẾT BỊ */}
      {activeTab === 'EQUIPMENT' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-wrap gap-3 items-center justify-between">
            <div className="flex flex-wrap gap-2 items-center flex-1 min-w-[280px]">
              <input
                type="text"
                placeholder="Tìm theo mã TB, tên, serial, vị trí..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-72 text-sm border border-slate-300 rounded-lg px-3 py-1.5"
              />
              <select
                value={campusFilter}
                onChange={(e) => setCampusFilter(e.target.value)}
                className="text-sm border border-slate-300 rounded-lg px-2.5 py-1.5"
              >
                <option value="ALL">Tất cả cơ sở</option>
                <option value="HH">Khu C (Hòa Hưng)</option>
                <option value="TT">Khu A2 (Kho lưu trữ)</option>
              </select>
              <select
                value={nhomFilter}
                onChange={(e) => setNhomFilter(e.target.value)}
                className="text-sm border border-slate-300 rounded-lg px-2.5 py-1.5 max-w-[200px]"
              >
                <option value="ALL">Tất cả nhóm</option>
                {nhomList.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div className="text-xs text-slate-500">
              Hiển thị: <strong>{filteredEq.length}</strong> / {db.Equipment.length} thiết bị
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase">
                <tr>
                  <th className="px-3.5 py-3">Mã TB</th>
                  <th className="px-3.5 py-3">Mã Loại (Catalog)</th>
                  <th className="px-3.5 py-3">Tên Thiết Bị / Mô Hình</th>
                  <th className="px-3.5 py-3">Nhóm Chuyên Môn</th>
                  <th className="px-3.5 py-3">Số Seri</th>
                  <th className="px-3.5 py-3">Vị Trí Hiện Tại</th>
                  <th className="px-3.5 py-3 text-center">Lượt / Giờ Dùng</th>
                  <th className="px-3.5 py-3 text-center">Trạng Thái</th>
                  <th className="px-3.5 py-3 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredEq.slice(0, 100).map((eq) => {
                  const usage = usageMap.get(eq.equipment_id) || { so_luot_dung: 0, so_gio_dung: 0 };
                  const cat = eq.catalog_id ? catMap.get(eq.catalog_id) : undefined;
                  const isBusy = eq.trang_thai === 'Đang sử dụng';
                  const isBroken = eq.trang_thai === 'Hỏng' || eq.trang_thai === 'Bảo trì';

                  return (
                    <tr key={eq.equipment_id} className="hover:bg-slate-50/80 transition-colors">
                      <td className="px-3.5 py-2.5 font-mono text-xs font-bold text-teal-800">{eq.equipment_id}</td>
                      <td className="px-3.5 py-2.5">
                        {cat ? (
                          <span className="inline-block px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-700 font-mono">
                            {cat.catalog_id}
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400">—</span>
                        )}
                      </td>
                      <td className="px-3.5 py-2.5">
                        <div className="font-medium text-slate-900">{eq.ten}</div>
                        {eq.ghi_chu && <div className="text-xs text-slate-500 mt-0.5">{eq.ghi_chu}</div>}
                      </td>
                      <td className="px-3.5 py-2.5 text-xs text-slate-600">{eq.nhom}</td>
                      <td className="px-3.5 py-2.5 font-mono text-xs text-slate-600">{eq.so_seri || '—'}</td>
                      <td className="px-3.5 py-2.5 text-xs text-slate-600">
                        <div className="flex items-center gap-1">
                          <span className="inline-block px-2 py-0.5 rounded text-xs bg-slate-100 text-slate-800 font-medium">
                            {eq.vi_tri_hien_tai || eq.vi_tri || (eq.campus_id === 'HH' ? 'Lầu 8 Khu C' : 'Lầu 5 Khu A2')}
                          </span>
                          {canManage && (
                            <button
                              onClick={() => handleOpenLocationMove(eq)}
                              title="Cập nhật vị trí / Di chuyển phòng"
                              className="text-teal-700 hover:text-teal-900 text-xs px-1 hover:bg-teal-50 rounded"
                            >
                              📍
                            </button>
                          )}
                        </div>
                        {eq.ngay_bao_tri_tiep && (
                          <div className="text-[11px] text-slate-400 mt-0.5">
                            Bảo trì tiếp: {formatVnDate(eq.ngay_bao_tri_tiep)}
                          </div>
                        )}
                      </td>
                      <td className="px-3.5 py-2.5 text-center">
                        <div className="font-bold text-slate-800">{usage.so_luot_dung} lượt</div>
                        <div className="text-xs text-slate-500">{usage.so_gio_dung}h</div>
                      </td>
                      <td className="px-3.5 py-2.5 text-center">
                        <Badge tone={isBroken ? 'red' : isBusy ? 'amber' : 'emerald'}>{eq.trang_thai}</Badge>
                      </td>
                      <td className="px-3.5 py-2.5 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {canManage && (
                            <select
                              value={eq.trang_thai}
                              onChange={(e) => handleStatusChange(eq, e.target.value)}
                              className="text-xs border border-slate-300 rounded px-2 py-1 bg-white"
                            >
                              {EQUIPMENT_STATUSES.map((st) => (
                                <option key={st} value={st}>
                                  {st}
                                </option>
                              ))}
                            </select>
                          )}
                          {canManage && (
                            <button
                              onClick={() => handleOpenMaintenance(eq, 'Sau buổi học')}
                              title="Ghi nhận bảo dưỡng sau buổi học"
                              className="px-2 py-1 rounded bg-teal-50 text-teal-700 hover:bg-teal-100 text-xs font-semibold"
                            >
                              🧹 Bảo dưỡng
                            </button>
                          )}
                          {canManage && (
                            <button
                              onClick={() => setReportTarget(eq)}
                              title="Báo hỏng / sự cố"
                              className="p-1 rounded text-red-600 hover:bg-red-50 text-xs font-semibold"
                            >
                              ⚠️ Báo sự cố
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {filteredEq.length > 100 && (
              <div className="p-3 text-center text-xs text-slate-500 border-t border-slate-100 bg-slate-50">
                Đang hiển thị 100 / {filteredEq.length} thiết bị đầu tiên. Vui lòng dùng thanh tìm kiếm hoặc bộ lọc để xem chi tiết.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: DANH MỤC LOẠI MÔ HÌNH (CATALOG) */}
      {activeTab === 'CATALOG' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-wrap gap-3 items-center justify-between">
            <div className="flex flex-wrap gap-2 items-center flex-1">
              <input
                type="text"
                placeholder="Tìm mã loại, tên mô hình, model hãng..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-72 text-sm border border-slate-300 rounded-lg px-3 py-1.5"
              />
              <select
                value={nhomFilter}
                onChange={(e) => setNhomFilter(e.target.value)}
                className="text-sm border border-slate-300 rounded-lg px-2.5 py-1.5"
              >
                <option value="ALL">Tất cả nhóm</option>
                {nhomList.map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </div>
            <div className="text-xs text-slate-500">
              Tổng số Loại mô hình: <strong>{filteredCatalogs.length}</strong> nhóm
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCatalogs.map((cat) => {
              const items = db.Equipment.filter((e) => e.catalog_id === cat.catalog_id);
              const activeCount = items.filter((e) => e.trang_thai === 'Hoạt động').length;

              return (
                <div key={cat.catalog_id} className="p-4 rounded-xl border border-slate-200 bg-white hover:border-teal-500 transition-colors shadow-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200">
                      {cat.catalog_id}
                    </span>
                    <Badge tone={activeCount > 0 ? 'emerald' : 'red'}>
                      {activeCount} / {items.length} Khả dụng
                    </Badge>
                  </div>
                  <div>
                    <h4 className="font-bold text-slate-900 text-sm">{cat.ten}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">{cat.nhom} · {cat.dvt}</p>
                  </div>
                  {cat.hang_sx && (
                    <div className="text-xs text-slate-600 bg-slate-50 p-2 rounded border border-slate-100">
                      <strong>Model/Hãng:</strong> {cat.hang_sx}
                    </div>
                  )}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                    <span>Số lượng cá thể: <strong>{items.length}</strong> máy</span>
                    <button
                      onClick={() => {
                        setCatalogFilter(cat.catalog_id);
                        setActiveTab('EQUIPMENT');
                      }}
                      className="text-teal-700 hover:underline font-semibold"
                    >
                      Xem danh sách máy →
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 3: VẬT TƯ TIÊU HAO */}
      {activeTab === 'CONSUMABLES' && (
        <div className="space-y-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 flex flex-wrap gap-3 items-center justify-between">
            <input
              type="text"
              placeholder="Tìm vật tư tiêu hao..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-72 text-sm border border-slate-300 rounded-lg px-3 py-1.5"
            />
            <div className="text-xs text-slate-500">
              Tổng số Vật tư: <strong>{filteredConsumables.length}</strong> mặt hàng
            </div>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto shadow-sm">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase">
                <tr>
                  <th className="px-4 py-3">Mã Vật Tư</th>
                  <th className="px-4 py-3">Tên Vật Tư Tiêu Hao</th>
                  <th className="px-4 py-3">Nhóm Phân Loại</th>
                  <th className="px-4 py-3">Đơn Vị Tính</th>
                  <th className="px-4 py-3 text-center">Định Mức / Ca</th>
                  <th className="px-4 py-3 text-center">Tồn Kho Hiện Tại</th>
                  <th className="px-4 py-3">Ghi Chú</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredConsumables.map((c) => (
                  <tr key={c.consumable_id} className="hover:bg-slate-50">
                    <td className="px-4 py-3 font-mono text-xs font-bold text-teal-800">{c.consumable_id}</td>
                    <td className="px-4 py-3 font-semibold text-slate-900">{c.ten}</td>
                    <td className="px-4 py-3 text-xs text-slate-600">{c.nhom}</td>
                    <td className="px-4 py-3 text-xs text-slate-700">{c.dvt}</td>
                    <td className="px-4 py-3 text-center font-bold text-slate-800">{c.dinh_muc_mac_dinh}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2.5 py-0.5 rounded text-xs font-bold ${
                        c.ton_kho > 20 ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                      }`}>
                        {c.ton_kho} {c.dvt}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{c.ghi_chu || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: BẢO DƯỠNG & BẢO TRÌ ĐỊNH KỲ */}
      {activeTab === 'MAINTENANCE' && (
        <div className="space-y-6">
          {/* Thống kê hạn bảo trì */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-500 font-medium">Tổng đợt bảo dưỡng / bảo trì</div>
                <div className="text-2xl font-bold text-slate-900 mt-1">{(db.EquipmentMaintenance || []).length}</div>
              </div>
              <div className="w-10 h-10 rounded-lg bg-teal-50 flex items-center justify-center text-teal-700 text-lg">
                🔧
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-500 font-medium">Thiết bị bảo dưỡng sau buổi học</div>
                <div className="text-2xl font-bold text-teal-800 mt-1">
                  {(db.EquipmentMaintenance || []).filter((m) => m.loai === 'Sau buổi học').length}
                </div>
              </div>
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-700 text-lg">
                🧹
              </div>
            </div>
            <div className="bg-white p-4 rounded-xl border border-slate-200 flex items-center justify-between">
              <div>
                <div className="text-xs text-slate-500 font-medium">Bảo trì định kỳ / Đột xuất</div>
                <div className="text-2xl font-bold text-amber-700 mt-1">
                  {(db.EquipmentMaintenance || []).filter((m) => m.loai !== 'Sau buổi học').length}
                </div>
              </div>
              <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center text-amber-700 text-lg">
                📅
              </div>
            </div>
          </div>

          {/* Lịch sử bảo trì và checklist */}
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="p-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
              <h3 className="font-bold text-slate-800 text-sm flex items-center gap-2">
                <span>📋</span> Sổ Ghi Nhận Bảo Dưỡng Sau Ca Học &amp; Bảo Trì Thiết Bị
              </h3>
              <span className="text-xs text-slate-500">
                Ghi nhận thời gian sử dụng, khấu hao và cập nhật vị trí thiết bị
              </span>
            </div>
            {(db.EquipmentMaintenance || []).length === 0 ? (
              <div className="p-8 text-center text-slate-500 text-sm">
                Chưa có nhật ký bảo dưỡng nào được ghi nhận. KTV có thể bấm nút &quot;🧹 Bảo dưỡng&quot; ở danh sách thiết bị sau mỗi buổi học.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600 uppercase">
                    <tr>
                      <th className="px-4 py-3">Mã Đợt</th>
                      <th className="px-4 py-3">Thiết Bị / Mô Hình</th>
                      <th className="px-4 py-3">Loại Bảo Trì</th>
                      <th className="px-4 py-3">Lớp Học (Nếu có)</th>
                      <th className="px-4 py-3">Nội Dung Thực Hiện</th>
                      <th className="px-4 py-3 text-center">Tình Trạng Sau</th>
                      <th className="px-4 py-3">Vị Trí Cất Giữ</th>
                      <th className="px-4 py-3">KTV Thực Hiện</th>
                      <th className="px-4 py-3">Hạn Kế Tiếp</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {[...(db.EquipmentMaintenance || [])].reverse().map((m) => {
                      const eq = eqMap.get(m.equipment_id);
                      const sc = m.sim_id ? db.SimClasses.find((s) => s.sim_id === m.sim_id) : undefined;
                      return (
                        <tr key={m.maintenance_id} className="hover:bg-slate-50">
                          <td className="px-4 py-3 font-mono text-xs font-bold text-slate-700">{m.maintenance_id}</td>
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-900">{eq?.ten || m.equipment_id}</div>
                            <div className="font-mono text-xs text-teal-800">{m.equipment_id}</div>
                          </td>
                          <td className="px-4 py-3 text-xs">
                            <span className={`inline-block px-2 py-0.5 rounded font-medium ${
                              m.loai === 'Sau buổi học' ? 'bg-blue-50 text-blue-800' : 'bg-amber-50 text-amber-800'
                            }`}>
                              {m.loai}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-600">
                            {sc ? (
                              <div>
                                <span className="font-semibold text-slate-800">{sc.noi_dung}</span>
                                <div className="text-[11px] text-slate-400 font-mono">{sc.sim_id}</div>
                              </div>
                            ) : (
                              m.sim_id || '—'
                            )}
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-800 max-w-xs">{m.noi_dung}</td>
                          <td className="px-4 py-3 text-center">
                            <Badge tone={m.tinh_trang_sau.includes('Tốt') ? 'emerald' : m.tinh_trang_sau.includes('Hỏng') ? 'red' : 'amber'}>
                              {m.tinh_trang_sau}
                            </Badge>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-700 font-medium">{m.vi_tri_sau || '—'}</td>
                          <td className="px-4 py-3 text-xs text-slate-600">
                            <div>{m.nguoi_thuc_hien}</div>
                            <div className="text-[11px] text-slate-400">{formatVnDate(m.ngay_thuc_hien)}</div>
                          </td>
                          <td className="px-4 py-3 text-xs text-slate-600 font-mono">
                            {m.ngay_bao_tri_tiep ? formatVnDate(m.ngay_bao_tri_tiep) : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: BÁO CÁO MẪU 02 & 03 PNT */}
      {activeTab === 'REPORT' && (
        <div className="space-y-6">
          <div className="bg-white p-5 rounded-xl border border-slate-200 space-y-4">
            <div className="border-b border-slate-200 pb-3">
              <h3 className="text-base font-bold text-slate-900">
                TRƯỜNG ĐẠI HỌC Y KHOA PHẠM NGỌC THẠCH — TRUNG TÂM CECICS
              </h3>
              <p className="text-xs text-slate-500 mt-1">
                BÁO CÁO TỔNG HỢP HIỆN TRẠNG VÀ KẾ HOẠCH SỬ DỤNG TRANG THIẾT BỊ ĐƯỢC GIAO QUẢN LÝ SỬ DỤNG (MẪU 02 &amp; 03-TBDA-PNT-2021)
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse border border-slate-300">
                <thead className="bg-slate-100 text-slate-700 font-semibold text-center">
                  <tr>
                    <th className="border border-slate-300 px-2 py-2 w-10">STT</th>
                    <th className="border border-slate-300 px-3 py-2">Tên thiết bị</th>
                    <th className="border border-slate-300 px-3 py-2">Model, Hãng sx, Xuất xứ</th>
                    <th className="border border-slate-300 px-2 py-2">Số seri</th>
                    <th className="border border-slate-300 px-2 py-2">Năm SX</th>
                    <th className="border border-slate-300 px-2 py-2">Đưa vào SD</th>
                    <th className="border border-slate-300 px-2 py-2">Vị trí lắp đặt</th>
                    <th className="border border-slate-300 px-2 py-2 bg-teal-50">Tổng lượt SD (Kỳ)</th>
                    <th className="border border-slate-300 px-2 py-2 bg-teal-50">Tổng giờ SD (Kỳ)</th>
                    <th className="border border-slate-300 px-2 py-2">Hiện trạng thiết bị</th>
                  </tr>
                  <tr className="bg-slate-50 text-slate-500 text-[10px]">
                    <th className="border border-slate-300 py-0.5">(1)</th>
                    <th className="border border-slate-300 py-0.5">(2)</th>
                    <th className="border border-slate-300 py-0.5">(3)</th>
                    <th className="border border-slate-300 py-0.5">(3')</th>
                    <th className="border border-slate-300 py-0.5">(4)</th>
                    <th className="border border-slate-300 py-0.5">(5)</th>
                    <th className="border border-slate-300 py-0.5">(7)</th>
                    <th className="border border-slate-300 py-0.5">(14 - Mẫu 02)</th>
                    <th className="border border-slate-300 py-0.5">(14 - Mẫu 03)</th>
                    <th className="border border-slate-300 py-0.5">(Trạng thái)</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEq.slice(0, 50).map((eq, idx) => {
                    const usage = usageMap.get(eq.equipment_id) || { so_luot_dung: 0, so_gio_dung: 0 };
                    const cat = eq.catalog_id ? catMap.get(eq.catalog_id) : undefined;

                    return (
                      <tr key={eq.equipment_id} className="hover:bg-slate-50">
                        <td className="border border-slate-300 px-2 py-1.5 text-center font-mono">{idx + 1}</td>
                        <td className="border border-slate-300 px-3 py-1.5 font-medium text-slate-900">{eq.ten}</td>
                        <td className="border border-slate-300 px-3 py-1.5 text-slate-600">{cat?.hang_sx || eq.ghi_chu || '—'}</td>
                        <td className="border border-slate-300 px-2 py-1.5 font-mono text-center">{eq.so_seri || 'N/A'}</td>
                        <td className="border border-slate-300 px-2 py-1.5 text-center">{eq.nam_sx || '2020'}</td>
                        <td className="border border-slate-300 px-2 py-1.5 text-center">{eq.nam_sx || '2020'}</td>
                        <td className="border border-slate-300 px-2 py-1.5 text-center text-slate-600">{eq.vi_tri || (eq.campus_id === 'HH' ? 'Lầu 8 Khu C' : 'Lầu 5 Khu A2')}</td>
                        <td className="border border-slate-300 px-2 py-1.5 text-center font-bold text-teal-800 bg-teal-50/50">{usage.so_luot_dung}</td>
                        <td className="border border-slate-300 px-2 py-1.5 text-center font-bold text-teal-800 bg-teal-50/50">{usage.so_gio_dung} h</td>
                        <td className="border border-slate-300 px-2 py-1.5 text-center">
                          <span className={`inline-block px-1.5 py-0.5 rounded text-[11px] font-semibold ${
                            eq.trang_thai === 'Hoạt động' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {eq.trang_thai}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div className="flex justify-between items-center text-xs text-slate-500 pt-3">
              <div>* Dữ liệu đồng bộ trực tiếp từ phần mềm AMS và lịch mô phỏng CECICS.</div>
              <div className="text-slate-700 font-semibold">Người lập: Đơn vị Kỹ thuật CECICS · Phê duyệt: Ban Lãnh đạo Trung tâm</div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL THỬ NGHIỆM ĐIỀU PHỐI CÂN BẰNG TẢI (LEAST-USED FIRST) */}
      <Modal open={simTestOpen} onClose={() => setSimTestOpen(false)} title="Mô phỏng Thuật toán Điều phối Cân bằng Tải (Least-Used First)">
        <div className="space-y-4">
          <p className="text-xs text-slate-600">
            Hệ thống quét toàn bộ cá thể thiết bị thuộc Loại đã chọn, tự động loại trừ các máy bị hỏng/trùng lịch và ưu tiên gán các máy có <strong>số lượt sử dụng ít nhất</strong> để đảm bảo khấu hao và tần suất sử dụng đồng đều.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Chọn Loại mô hình / Thiết bị *</label>
              <select value={testCatalogId} onChange={(e) => setTestCatalogId(e.target.value)} className={inputCls}>
                {db.EquipmentCatalogs.map((c) => (
                  <option key={c.catalog_id} value={c.catalog_id}>
                    [{c.catalog_id}] {c.ten} ({c.so_luong_tong} máy)
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Số lượng máy cần điều phối *</label>
              <input
                type="number"
                min={1}
                max={10}
                value={testCount}
                onChange={(e) => setTestCount(Number(e.target.value))}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Cơ sở đào tạo *</label>
              <select value={testCampus} onChange={(e) => setTestCampus(e.target.value)} className={inputCls}>
                <option value="HH">Cơ sở A (Hòa Hưng - Lầu 8 Khu C)</option>
                <option value="TT">Trụ sở Tân Nhựt (Lầu 5 Khu A2)</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end">
            <button onClick={runSimulationDispatch} className="px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold">
              Khởi chạy Thuật toán Điều phối
            </button>
          </div>

          {testResult && (
            <div className="mt-4 pt-4 border-t border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-teal-800">
                  Kết quả Tự động Chọn: {testResult.selected.length} thiết bị tối ưu nhất
                </span>
                {testResult.missing_count > 0 && (
                  <Badge tone="red">Thiếu {testResult.missing_count} máy khả dụng!</Badge>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {testResult.selected.map((eq) => {
                  const usage = usageMap.get(eq.equipment_id) || { so_luot_dung: 0, so_gio_dung: 0 };
                  return (
                    <div key={eq.equipment_id} className="p-3 rounded-lg border border-emerald-300 bg-emerald-50/50 flex items-center justify-between">
                      <div>
                        <div className="font-bold text-slate-900 text-xs">{eq.ten}</div>
                        <div className="text-[11px] font-mono text-emerald-800">{eq.equipment_id} · Seri: {eq.so_seri || 'N/A'}</div>
                      </div>
                      <div className="text-right">
                        <span className="inline-block px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-200 text-emerald-900">
                          {usage.so_luot_dung} lượt ({usage.so_gio_dung}h)
                        </span>
                        <div className="text-[10px] text-emerald-700 mt-0.5">Ưu tiên điều phối ✓</div>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="text-xs font-semibold text-slate-700 mt-2">Bảng xếp hạng tất cả cá thể cùng loại (tăng dần theo lượt dùng):</div>
              <div className="max-h-48 overflow-y-auto border border-slate-200 rounded-lg divide-y divide-slate-100 text-xs">
                {testResult.candidates.map((c, i) => (
                  <div key={c.equipment.equipment_id} className={`p-2 flex items-center justify-between ${c.is_available ? 'bg-white' : 'bg-slate-50 text-slate-400'}`}>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-slate-400 w-4">{i + 1}.</span>
                      <span className={c.is_available ? 'font-medium text-slate-900' : 'line-through text-slate-400'}>
                        {c.equipment.ten} ({c.equipment.equipment_id})
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span>Lượt dùng: <strong>{c.so_luot_dung}</strong></span>
                      {c.is_available ? (
                        <Badge tone="emerald">Khả dụng</Badge>
                      ) : (
                        <Badge tone="red">{c.unavailability_reason || 'Bận'}</Badge>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </Modal>

      {/* Modal Thêm thiết bị mới */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Thêm thiết bị / mô hình cá thể mới">
        <form onSubmit={handleCreateEq} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Mã thiết bị (bỏ trống để tự sinh)</label>
              <input
                value={newEq.equipment_id}
                onChange={(e) => setNewEq({ ...newEq, equipment_id: e.target.value })}
                placeholder="VD: CPR-01-05"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Loại mô hình (Catalog)</label>
              <select
                value={newEq.catalog_id}
                onChange={(e) => {
                  const cat = catMap.get(e.target.value);
                  setNewEq({
                    ...newEq,
                    catalog_id: e.target.value,
                    ten: cat ? `${cat.ten} #${(cat.so_luong_tong || 0) + 1}` : newEq.ten,
                    nhom: cat ? cat.nhom : newEq.nhom,
                  });
                }}
                className={inputCls}
              >
                <option value="">-- Chọn loại mô hình chuẩn --</option>
                {db.EquipmentCatalogs.map((c) => (
                  <option key={c.catalog_id} value={c.catalog_id}>
                    [{c.catalog_id}] {c.ten}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Tên thiết bị *</label>
            <input required value={newEq.ten} onChange={(e) => setNewEq({ ...newEq, ten: e.target.value })} className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Số seri máy</label>
              <input value={newEq.so_seri} onChange={(e) => setNewEq({ ...newEq, so_seri: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Vị trí lắp đặt</label>
              <input value={newEq.vi_tri} onChange={(e) => setNewEq({ ...newEq, vi_tri: e.target.value })} className={inputCls} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Nhóm thiết bị *</label>
              <input required value={newEq.nhom} onChange={(e) => setNewEq({ ...newEq, nhom: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Cơ sở quản lý *</label>
              <select value={newEq.campus_id} onChange={(e) => setNewEq({ ...newEq, campus_id: e.target.value })} className={inputCls}>
                <option value="HH">Khu C (Hòa Hưng)</option>
                <option value="TT">Khu A2 (Tân Nhựt)</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Ghi chú</label>
            <input value={newEq.ghi_chu} onChange={(e) => setNewEq({ ...newEq, ghi_chu: e.target.value })} className={inputCls} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setAddOpen(false)} className="px-4 py-2 rounded-lg border border-slate-300 text-sm">
              Hủy
            </button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-teal-700 text-white text-sm font-semibold">
              Lưu thiết bị
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Thêm loại mô hình Catalog */}
      <Modal open={addCatOpen} onClose={() => setAddCatOpen(false)} title="Thêm Loại mô hình / Thiết bị mới (Catalog)">
        <form onSubmit={handleCreateCat} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Mã Loại (Catalog ID) *</label>
              <input
                required
                value={newCat.catalog_id}
                onChange={(e) => setNewCat({ ...newCat, catalog_id: e.target.value })}
                placeholder="VD: CPR-15"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Nhóm chuyên môn *</label>
              <input required value={newCat.nhom} onChange={(e) => setNewCat({ ...newCat, nhom: e.target.value })} className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Tên Loại mô hình *</label>
            <input required value={newCat.ten} onChange={(e) => setNewCat({ ...newCat, ten: e.target.value })} className={inputCls} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Model / Hãng sản xuất</label>
              <input value={newCat.hang_sx} onChange={(e) => setNewCat({ ...newCat, hang_sx: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Đơn vị tính</label>
              <select value={newCat.dvt} onChange={(e) => setNewCat({ ...newCat, dvt: e.target.value })} className={inputCls}>
                <option value="Mô hình">Mô hình</option>
                <option value="Máy">Máy</option>
                <option value="Bộ">Bộ</option>
                <option value="Giường">Giường</option>
                <option value="Bàn">Bàn</option>
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Mô tả chi tiết</label>
            <textarea rows={2} value={newCat.mo_ta} onChange={(e) => setNewCat({ ...newCat, mo_ta: e.target.value })} className={inputCls} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setAddCatOpen(false)} className="px-4 py-2 rounded-lg border border-slate-300 text-sm">
              Hủy
            </button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-teal-700 text-white text-sm font-semibold">
              Lưu loại mô hình
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Thêm vật tư tiêu hao */}
      <Modal open={addConsumableOpen} onClose={() => setAddConsumableOpen(false)} title="Thêm Vật tư Tiêu hao mới">
        <form onSubmit={handleCreateConsumable} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Mã Vật tư *</label>
              <input
                required
                value={newConsumable.consumable_id}
                onChange={(e) => setNewConsumable({ ...newConsumable, consumable_id: e.target.value })}
                placeholder="VD: VT-GEL-02"
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Nhóm vật tư *</label>
              <input required value={newConsumable.nhom} onChange={(e) => setNewConsumable({ ...newConsumable, nhom: e.target.value })} className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Tên Vật tư tiêu hao *</label>
            <input required value={newConsumable.ten} onChange={(e) => setNewConsumable({ ...newConsumable, ten: e.target.value })} className={inputCls} />
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelCls}>Đơn vị tính *</label>
              <input required value={newConsumable.dvt} onChange={(e) => setNewConsumable({ ...newConsumable, dvt: e.target.value })} className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Định mức / Ca</label>
              <input
                type="number"
                min={1}
                value={newConsumable.dinh_muc_mac_dinh}
                onChange={(e) => setNewConsumable({ ...newConsumable, dinh_muc_mac_dinh: Number(e.target.value) })}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Tồn kho ban đầu</label>
              <input
                type="number"
                min={0}
                value={newConsumable.ton_kho}
                onChange={(e) => setNewConsumable({ ...newConsumable, ton_kho: Number(e.target.value) })}
                className={inputCls}
              />
            </div>
          </div>
          <div>
            <label className={labelCls}>Ghi chú</label>
            <input value={newConsumable.ghi_chu} onChange={(e) => setNewConsumable({ ...newConsumable, ghi_chu: e.target.value })} className={inputCls} />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setAddConsumableOpen(false)} className="px-4 py-2 rounded-lg border border-slate-300 text-sm">
              Hủy
            </button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-teal-700 text-white text-sm font-semibold">
              Lưu vật tư
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Báo sự cố */}
      <Modal open={Boolean(reportTarget)} onClose={() => setReportTarget(null)} title={`Báo sự cố — ${reportTarget?.ten || ''}`}>
        <form onSubmit={handleReportIncident} className="space-y-4">
          <div>
            <label className={labelCls}>Mô tả lỗi / hư hỏng *</label>
            <textarea
              required
              rows={3}
              value={incidentForm.mo_ta}
              onChange={(e) => setIncidentForm({ ...incidentForm, mo_ta: e.target.value })}
              className={inputCls}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Tiên lượng khắc phục</label>
              <select
                value={incidentForm.danh_gia}
                onChange={(e) => setIncidentForm({ ...incidentForm, danh_gia: e.target.value })}
                className={inputCls}
              >
                {INCIDENT_ASSESSMENTS.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className={labelCls}>Dự kiến hoàn thành</label>
              <input
                type="date"
                value={incidentForm.du_kien_xong}
                onChange={(e) => setIncidentForm({ ...incidentForm, du_kien_xong: e.target.value })}
                className={inputCls}
              />
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setReportTarget(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-sm">
              Hủy
            </button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold">
              Ghi nhận &amp; Quét lớp ảnh hưởng
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Ghi nhận Bảo Dưỡng / Bảo Trì (KTV) */}
      <Modal
        open={maintenanceOpen}
        onClose={() => {
          setMaintenanceOpen(false);
          setMaintenanceTarget(null);
        }}
        title={`Ghi nhận Bảo Dưỡng / Bảo Trì — ${maintenanceTarget?.ten || ''} (${maintenanceTarget?.equipment_id || ''})`}
      >
        <form onSubmit={handleSaveMaintenance} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Loại hình thực hiện *</label>
              <select
                value={maintenanceForm.loai}
                onChange={(e) => setMaintenanceForm({ ...maintenanceForm, loai: e.target.value })}
                className={inputCls}
              >
                <option value="Sau buổi học">Sau buổi học (Post-session)</option>
                <option value="Định kỳ">Định kỳ (Periodic)</option>
                <option value="Đột xuất / Sửa chữa">Đột xuất / Khắc phục lỗi</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Lớp mô phỏng liên quan (nếu có)</label>
              <select
                value={maintenanceForm.sim_id}
                onChange={(e) => setMaintenanceForm({ ...maintenanceForm, sim_id: e.target.value })}
                className={inputCls}
              >
                <option value="">-- Không gắn lớp cụ thể --</option>
                {db.SimClasses.slice(0, 30).map((s) => (
                  <option key={s.sim_id} value={s.sim_id}>
                    [{s.sim_id}] {s.noi_dung} ({formatVnDate(s.ngay)})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className={labelCls}>Nội dung công việc thực hiện *</label>
            <textarea
              required
              rows={3}
              value={maintenanceForm.noi_dung}
              onChange={(e) => setMaintenanceForm({ ...maintenanceForm, noi_dung: e.target.value })}
              placeholder="VD: Vệ sinh đường thở, khử khuẩn lồng ngực, thay pin cảm biến, kiểm tra van 1 chiều..."
              className={inputCls}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Tình trạng thiết bị sau bảo dưỡng *</label>
              <select
                value={maintenanceForm.tinh_trang_sau}
                onChange={(e) => setMaintenanceForm({ ...maintenanceForm, tinh_trang_sau: e.target.value })}
                className={inputCls}
              >
                <option value="Tốt - Sẵn sàng">Tốt - Sẵn sàng phục vụ</option>
                <option value="Cần theo dõi">Cần theo dõi thêm</option>
                <option value="Hỏng - Chờ sửa">Hỏng - Cần chuyển sửa chữa</option>
              </select>
            </div>
            <div>
              <label className={labelCls}>Vị trí cất giữ / hoàn trả *</label>
              <input
                required
                value={maintenanceForm.vi_tri_sau}
                onChange={(e) => setMaintenanceForm({ ...maintenanceForm, vi_tri_sau: e.target.value })}
                placeholder="VD: Lầu 8 Khu C - Kho A1"
                className={inputCls}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3 rounded-lg border border-slate-200">
            <div>
              <label className={labelCls}>Cộng thêm giờ dùng (giờ)</label>
              <input
                type="number"
                step="0.5"
                min="0"
                value={maintenanceForm.so_gio_dung_them}
                onChange={(e) => setMaintenanceForm({ ...maintenanceForm, so_gio_dung_them: Number(e.target.value) })}
                className={inputCls}
              />
            </div>
            <div>
              <label className={labelCls}>Cộng thêm lượt dùng</label>
              <input
                type="number"
                min="0"
                value={maintenanceForm.so_luot_dung_them}
                onChange={(e) => setMaintenanceForm({ ...maintenanceForm, so_luot_dung_them: Number(e.target.value) })}
                className={inputCls}
              />
            </div>
          </div>

          <div>
            <label className={labelCls}>Hạn bảo trì định kỳ kế tiếp (tùy chọn)</label>
            <input
              type="date"
              value={maintenanceForm.ngay_bao_tri_tiep}
              onChange={(e) => setMaintenanceForm({ ...maintenanceForm, ngay_bao_tri_tiep: e.target.value })}
              className={inputCls}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => {
                setMaintenanceOpen(false);
                setMaintenanceTarget(null);
              }}
              className="px-4 py-2 rounded-lg border border-slate-300 text-sm"
            >
              Hủy
            </button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold">
              Hoàn tất &amp; Lưu hồ sơ
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Di Chuyển / Truy Vết Vị Trí (Location Tracking) */}
      <Modal
        open={Boolean(locationMoveTarget)}
        onClose={() => setLocationMoveTarget(null)}
        title={`Cập nhật Vị Trí & Truy Vết — ${locationMoveTarget?.ten || ''}`}
      >
        <form onSubmit={handleSaveLocationMove} className="space-y-4">
          <div className="p-3 bg-teal-50 border border-teal-200 rounded-lg text-xs text-teal-900">
            <div>Mã TB: <strong>{locationMoveTarget?.equipment_id}</strong></div>
            <div>Vị trí gốc ban đầu: <strong>{locationMoveTarget?.vi_tri}</strong></div>
            <div>Vị trí hiện thời: <strong>{locationMoveTarget?.vi_tri_hien_tai || locationMoveTarget?.vi_tri}</strong></div>
          </div>

          <div>
            <label className={labelCls}>Vị trí mới chuyển đến *</label>
            <input
              required
              value={locationMoveForm.vi_tri_moi}
              onChange={(e) => setLocationMoveForm({ ...locationMoveForm, vi_tri_moi: e.target.value })}
              placeholder="VD: Phòng Sim 8.02, Tủ Mô hình Kho C, Khu bảo dưỡng Lầu 7..."
              className={inputCls}
            />
          </div>

          <div>
            <label className={labelCls}>Mục đích / Lý do di chuyển</label>
            <input
              value={locationMoveForm.ly_do_di_chuyen}
              onChange={(e) => setLocationMoveForm({ ...locationMoveForm, ly_do_di_chuyen: e.target.value })}
              placeholder="VD: Cấp phát phục vụ lớp Nội soi chiều nay, hoặc thu hồi về kho"
              className={inputCls}
            />
          </div>

          <label className="flex items-center gap-2 text-xs text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={locationMoveForm.set_as_default_location}
              onChange={(e) => setLocationMoveForm({ ...locationMoveForm, set_as_default_location: e.target.checked })}
              className="accent-teal-700 rounded"
            />
            <span>Đặt làm vị trí lưu trữ mặc định mới của thiết bị</span>
          </label>

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={() => setLocationMoveTarget(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-sm">
              Hủy
            </button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold">
              Cập nhật vị trí
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Hỗ trợ Giảng viên chọn Mô hình & Vật tư theo bài học */}
      <Modal
        open={lessonHelperOpen}
        onClose={() => setLessonHelperOpen(false)}
        title="Trợ lý KTV: Đề xuất Mô hình Thiết bị & Vật tư Tiêu hao theo Bài học"
      >
        <div className="space-y-4 max-h-[80vh] overflow-y-auto pr-1">
          <form onSubmit={handleRunLessonSuggestion} className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
            <div>
              <label className={labelCls}>Nội dung / Tên bài giảng lâm sàng *</label>
              <input
                required
                value={lessonHelperForm.noi_dung}
                onChange={(e) => setLessonHelperForm({ ...lessonHelperForm, noi_dung: e.target.value })}
                placeholder="VD: Kỹ năng hồi sức tim phổi CPR nâng cao, đặt nội khí quản, siêu âm FAST..."
                className={inputCls}
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={labelCls}>Bối cảnh lâm sàng (tuỳ chọn)</label>
                <input
                  value={lessonHelperForm.boi_canh_lam_sang}
                  onChange={(e) => setLessonHelperForm({ ...lessonHelperForm, boi_canh_lam_sang: e.target.value })}
                  placeholder="VD: Cấp cứu ngoại viện, phòng mổ, khoa Hồi sức tích cực..."
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Kỹ năng mong đợi</label>
                <input
                  value={lessonHelperForm.ky_nang_mong_doi}
                  onChange={(e) => setLessonHelperForm({ ...lessonHelperForm, ky_nang_mong_doi: e.target.value })}
                  placeholder="VD: Ép tim đúng biên độ, cắt chỉ, soi thanh quản..."
                  className={inputCls}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className={labelCls}>Số học viên</label>
                <input
                  type="number"
                  min={1}
                  value={lessonHelperForm.so_hoc_vien}
                  onChange={(e) => setLessonHelperForm({ ...lessonHelperForm, so_hoc_vien: Number(e.target.value) })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Số nhóm thực hành</label>
                <input
                  type="number"
                  min={1}
                  value={lessonHelperForm.so_nhom}
                  onChange={(e) => setLessonHelperForm({ ...lessonHelperForm, so_nhom: Number(e.target.value) })}
                  className={inputCls}
                />
              </div>
              <div>
                <label className={labelCls}>Cơ sở đào tạo</label>
                <select
                  value={lessonHelperForm.campus_id}
                  onChange={(e) => setLessonHelperForm({ ...lessonHelperForm, campus_id: e.target.value })}
                  className={inputCls}
                >
                  <option value="HH">Khu C (Hòa Hưng)</option>
                  <option value="TT">Khu A2 (Tân Nhựt)</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end">
              <button type="submit" className="px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold flex items-center gap-1.5">
                <span>🔍</span> Phân tích &amp; Đề xuất danh mục
              </button>
            </div>
          </form>

          {lessonSuggestion && (
            <div className="space-y-4 pt-2">
              {/* Đề xuất mô hình thiết bị */}
              <div>
                <h4 className="font-bold text-slate-800 text-sm mb-2 flex items-center justify-between">
                  <span>Mô hình &amp; Thiết bị phù hợp ({lessonSuggestion.suggestedCatalogs.length})</span>
                  <span className="text-xs text-slate-500 font-normal">Dựa trên từ khóa bài giảng và mục tiêu</span>
                </h4>
                {lessonSuggestion.suggestedCatalogs.length === 0 ? (
                  <div className="p-3 text-xs text-slate-500 bg-slate-50 rounded-lg border border-slate-200">
                    Không tìm thấy mô hình tương thích trực tiếp. Vui lòng mở rộng từ khóa tìm kiếm.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {lessonSuggestion.suggestedCatalogs.map((sc) => (
                      <div key={sc.catalog.catalog_id} className="p-3 rounded-lg border border-slate-200 bg-white hover:border-teal-400 transition-colors">
                        <div className="flex items-start justify-between">
                          <div>
                            <span className="font-mono text-xs font-bold text-teal-800 mr-2">[{sc.catalog.catalog_id}]</span>
                            <span className="font-bold text-slate-900 text-sm">{sc.catalog.ten}</span>
                            <div className="text-xs text-slate-500 mt-0.5">{sc.catalog.nhom} · {sc.catalog.hang_sx || 'Nhiều hãng'}</div>
                          </div>
                          <div className="text-right">
                            <span className="inline-block px-2 py-0.5 rounded text-xs font-bold bg-teal-100 text-teal-900">
                              Đề xuất: {sc.recommendedCount} {sc.catalog.dvt}
                            </span>
                            <div className="text-[11px] text-slate-500 mt-0.5">Khả dụng: {sc.availableCount} máy</div>
                          </div>
                        </div>
                        <div className="mt-2 flex flex-wrap gap-1">
                          {sc.matchedKeywords.map((k) => (
                            <span key={k} className="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-medium">
                              ✓ {k}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Đề xuất vật tư tiêu hao */}
              <div>
                <h4 className="font-bold text-slate-800 text-sm mb-2 flex items-center justify-between">
                  <span>Vật tư tiêu hao ước tính ({lessonSuggestion.suggestedConsumables.length})</span>
                  <span className="text-xs text-slate-500 font-normal">Tính toán theo số nhóm/học viên</span>
                </h4>
                {lessonSuggestion.suggestedConsumables.length === 0 ? (
                  <div className="p-3 text-xs text-slate-500 bg-slate-50 rounded-lg border border-slate-200">
                    Chưa có danh mục vật tư tiêu hao đề xuất cho bài này.
                  </div>
                ) : (
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="px-3 py-2">Mã VT</th>
                          <th className="px-3 py-2">Tên Vật Tư Tiêu Hao</th>
                          <th className="px-3 py-2 text-center">Định Mức Cấp</th>
                          <th className="px-3 py-2 text-center">Tồn Kho Hiện Có</th>
                          <th className="px-3 py-2">Khả Năng Đáp Ứng</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {lessonSuggestion.suggestedConsumables.map((con) => (
                          <tr key={con.consumable.consumable_id}>
                            <td className="px-3 py-2 font-mono text-teal-800 font-bold">{con.consumable.consumable_id}</td>
                            <td className="px-3 py-2 font-medium text-slate-900">{con.consumable.ten}</td>
                            <td className="px-3 py-2 text-center font-bold text-slate-800">
                              {con.so_luong_de_xuat} {con.consumable.dvt}
                            </td>
                            <td className="px-3 py-2 text-center text-slate-600">
                              {con.ton_kho} {con.consumable.dvt}
                            </td>
                            <td className="px-3 py-2">
                              {con.is_low_stock ? (
                                <Badge tone="red">Cảnh báo: Thiếu tồn kho</Badge>
                              ) : (
                                <Badge tone="emerald">Đủ cấp phát ✓</Badge>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </Modal>
    </div>
  );
}
