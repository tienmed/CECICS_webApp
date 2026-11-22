'use client';

import React, { useMemo, useState } from 'react';
import { canPerform } from '@/core/permissions';
import { diffDaysYmd, formatVnDate, todayVnYmd } from '@/core/time';
import { EQUIPMENT_STATUSES, INCIDENT_ASSESSMENTS, type EquipmentRecord } from '@/core/types';
import { useApp } from '@/components/AppProvider';
import { Badge, Card, Modal, PageHeader } from '@/components/ui';

const inputCls = 'w-full text-sm border border-slate-300 rounded-lg px-3 py-2';
const labelCls = 'block text-xs font-semibold text-slate-700 mb-1';

export default function EquipmentPage() {
  const { user, db, execute } = useApp();
  const [search, setSearch] = useState('');
  const [campusFilter, setCampusFilter] = useState('ALL');
  const [addOpen, setAddOpen] = useState(false);
  const [reportTarget, setReportTarget] = useState<EquipmentRecord | null>(null);
  const [newEq, setNewEq] = useState({ equipment_id: '', ten: '', nhom: 'Mô hình hồi sức', campus_id: 'HH', ghi_chu: '' });
  const [incidentForm, setIncidentForm] = useState({ mo_ta: '', danh_gia: 'Chưa đánh giá', du_kien_xong: '' });
  const [mitigationPick, setMitigationPick] = useState<Record<string, string>>({});

  const today = todayVnYmd();
  const canManage = canPerform(user, 'manage_equipment');
  const canConfirmImpact = canPerform(user, 'confirm_incident_impact');

  const eqMap = useMemo(() => new Map(db.Equipment.map((e) => [e.equipment_id, e])), [db.Equipment]);
  const simMap = useMemo(() => new Map(db.SimClasses.map((s) => [s.sim_id, s])), [db.SimClasses]);

  const filteredEq = useMemo(() => {
    const q = search.trim().toLowerCase();
    return db.Equipment.filter((e) => {
      if (campusFilter !== 'ALL' && e.campus_id !== campusFilter) return false;
      if (q && !`${e.equipment_id} ${e.ten} ${e.nhom}`.toLowerCase().includes(q)) return false;
      return true;
    });
  }, [db.Equipment, search, campusFilter]);

  const openIncidents = useMemo(
    () => db.Incidents.filter((i) => i.trang_thai === 'Đang mở').sort((a, b) => b.bao_luc.localeCompare(a.bao_luc)),
    [db.Incidents]
  );

  async function handleCreateEq(e: React.FormEvent) {
    e.preventDefault();
    const res = await execute('createEquipment', newEq, 'Đã thêm thiết bị mới.');
    if (res.ok) {
      setAddOpen(false);
      setNewEq({ equipment_id: '', ten: '', nhom: 'Mô hình hồi sức', campus_id: 'HH', ghi_chu: '' });
    }
  }

  async function handleStatusChange(eq: EquipmentRecord, trang_thai: string) {
    await execute('updateEquipment', { equipment_id: eq.equipment_id, trang_thai }, `Đã cập nhật trạng thái ${eq.equipment_id}.`);
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Thiết bị Mô phỏng & Xử lý Sự cố"
        subtitle="Tra cứu theo mã/tên · Báo hỏng tự động quét lớp bị ảnh hưởng và thông báo Bộ môn thống nhất phương án"
        actions={
          canManage && (
            <button
              onClick={() => setAddOpen(true)}
              className="px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold"
            >
              + Thêm thiết bị
            </button>
          )
        }
      />

      {/* Open Incidents */}
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
                        {inc.du_kien_xong ? ` · Dự kiến xong: ${formatVnDate(inc.du_kien_xong)}` : ''}
                      </div>
                    </div>

                    {canManage && (
                      <div className="flex flex-wrap items-center gap-2">
                        <select
                          value={inc.danh_gia}
                          onChange={(e) => handleAssess(inc.incident_id, e.target.value)}
                          className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white"
                        >
                          {INCIDENT_ASSESSMENTS.map((a) => (
                            <option key={a} value={a}>
                              {a}
                            </option>
                          ))}
                        </select>
                        <button
                          onClick={() => handleCloseIncident(inc.incident_id)}
                          className="px-3 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold"
                        >
                          ✓ Đã sửa xong
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Affected Simulation Classes */}
                  {impacts.length > 0 && (
                    <div className="bg-white rounded-lg border border-slate-200 p-3 space-y-2">
                      <div className="text-xs font-bold text-slate-700">
                        Lớp mô phỏng tương lai bị ảnh hưởng ({impacts.length}):
                      </div>
                      {impacts.map((im) => {
                        const sc = simMap.get(im.sim_id);
                        return (
                          <div
                            key={im.impact_id}
                            className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs border-t border-slate-100 pt-2"
                          >
                            <div>
                              <span className="font-semibold text-slate-900">{sc?.noi_dung || im.sim_id}</span>
                              {sc && (
                                <span className="text-slate-500">
                                  {' '}
                                  · {formatVnDate(sc.ngay)} ({sc.gio_bd}–{sc.gio_kt})
                                </span>
                              )}
                            </div>
                            {im.bo_mon_xac_nhan ? (
                              <Badge tone="emerald">✓ Bộ môn đã chốt: {im.phuong_an}</Badge>
                            ) : canConfirmImpact ? (
                              <div className="flex items-center gap-2">
                                <select
                                  value={mitigationPick[im.impact_id] || 'Đổi mô hình'}
                                  onChange={(e) => setMitigationPick({ ...mitigationPick, [im.impact_id]: e.target.value })}
                                  className="border border-slate-300 rounded px-2 py-1"
                                >
                                  <option value="Đổi mô hình">Đổi mô hình</option>
                                  <option value="Giảm bài">Giảm bài</option>
                                  <option value="Dời lịch">Dời lịch</option>
                                </select>
                                <button
                                  onClick={() => handleConfirmImpact(im.impact_id)}
                                  className="px-2.5 py-1 rounded bg-teal-700 text-white font-semibold"
                                >
                                  Xác nhận
                                </button>
                              </div>
                            ) : (
                              <Badge tone="amber">Chờ Bộ môn xác nhận</Badge>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Equipment Directory */}
      <Card
        title={`Danh mục thiết bị (${filteredEq.length})`}
        action={
          <div className="flex flex-wrap gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm mã hoặc tên thiết bị..."
              className="text-xs border border-slate-300 rounded-lg px-3 py-1.5"
            />
            <select
              value={campusFilter}
              onChange={(e) => setCampusFilter(e.target.value)}
              className="text-xs border border-slate-300 rounded-lg px-2.5 py-1.5 bg-white"
            >
              <option value="ALL">Cả 2 cơ sở</option>
              {db.Campuses.map((c) => (
                <option key={c.campus_id} value={c.campus_id}>
                  {c.campus_id}
                </option>
              ))}
            </select>
          </div>
        }
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                <th className="pb-2 pr-3">Mã TB</th>
                <th className="pb-2 pr-3">Tên &amp; Nhóm</th>
                <th className="pb-2 pr-3">Cơ sở</th>
                <th className="pb-2 pr-3">Trạng thái</th>
                <th className="pb-2 pr-3">Ghi chú</th>
                {canManage && <th className="pb-2 text-right">Thao tác</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredEq.map((eq) => {
                const brokenDays = eq.trang_thai === 'Hỏng' && eq.tu_ngay ? diffDaysYmd(eq.tu_ngay, today) : 0;
                const tone =
                  eq.trang_thai === 'Hoạt động'
                    ? 'emerald'
                    : eq.trang_thai === 'Hỏng'
                      ? 'red'
                      : eq.trang_thai === 'Bảo trì'
                        ? 'amber'
                        : 'slate';
                return (
                  <tr key={eq.equipment_id}>
                    <td className="py-2.5 pr-3 font-mono text-xs text-slate-600">{eq.equipment_id}</td>
                    <td className="py-2.5 pr-3">
                      <div className="font-semibold text-slate-900">{eq.ten}</div>
                      <div className="text-xs text-slate-500">{eq.nhom}</div>
                    </td>
                    <td className="py-2.5 pr-3">
                      <Badge tone="teal">{eq.campus_id}</Badge>
                    </td>
                    <td className="py-2.5 pr-3">
                      <Badge tone={tone}>
                        {eq.trang_thai}
                        {brokenDays > 0 ? ` (${brokenDays} ngày)` : ''}
                      </Badge>
                    </td>
                    <td className="py-2.5 pr-3 text-xs text-slate-600 max-w-xs">{eq.ghi_chu}</td>
                    {canManage && (
                      <td className="py-2.5 text-right whitespace-nowrap space-x-2">
                        <select
                          aria-label={`Đổi trạng thái ${eq.equipment_id}`}
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
                        <button
                          onClick={() => setReportTarget(eq)}
                          className="px-2.5 py-1 rounded bg-red-600 hover:bg-red-700 text-white text-xs font-semibold"
                        >
                          Báo sự cố
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal Add Equipment */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Thêm thiết bị mô phỏng">
        <form onSubmit={handleCreateEq} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Mã thiết bị (bỏ trống tự sinh)</label>
              <input value={newEq.equipment_id} onChange={(e) => setNewEq({ ...newEq, equipment_id: e.target.value })} placeholder="VD: TB-SIM-03" className={inputCls} />
            </div>
            <div>
              <label className={labelCls}>Cơ sở *</label>
              <select value={newEq.campus_id} onChange={(e) => setNewEq({ ...newEq, campus_id: e.target.value })} className={inputCls}>
                {db.Campuses.map((c) => (
                  <option key={c.campus_id} value={c.campus_id}>
                    {c.ten}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Tên thiết bị *</label>
            <input required value={newEq.ten} onChange={(e) => setNewEq({ ...newEq, ten: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Nhóm thiết bị *</label>
            <input required value={newEq.nhom} onChange={(e) => setNewEq({ ...newEq, nhom: e.target.value })} className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Ghi chú</label>
            <input value={newEq.ghi_chu} onChange={(e) => setNewEq({ ...newEq, ghi_chu: e.target.value })} className={inputCls} />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setAddOpen(false)} className="px-4 py-2 rounded-lg border border-slate-300 text-sm">
              Hủy
            </button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-teal-700 text-white text-sm font-semibold">
              Lưu thiết bị
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Report Incident */}
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
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setReportTarget(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-sm">
              Hủy
            </button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold">
              Ghi nhận &amp; Quét lớp ảnh hưởng
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
