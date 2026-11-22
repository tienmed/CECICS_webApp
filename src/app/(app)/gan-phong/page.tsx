'use client';

import React, { useMemo, useState } from 'react';
import Link from 'next/link';
import { canPerform } from '@/core/permissions';
import { suggestAvailableRooms } from '@/core/suggest';
import { diffDaysYmd, formatVnDate, todayVnYmd } from '@/core/time';
import { parseSettings, ROOM_TYPES, type RoomRecord } from '@/core/types';
import { useApp } from '@/components/AppProvider';
import { Badge, Card, PageHeader } from '@/components/ui';
import { AiAdvisorModal } from '@/components/AiAdvisorModal';

export default function RoomAssignmentPage() {
  const { user, db, execute } = useApp();
  const [showAllFuture, setShowAllFuture] = useState(true);
  const [selectedRooms, setSelectedRooms] = useState<Record<string, string>>({});
  const [multiRoomModes, setMultiRoomModes] = useState<Record<string, boolean>>({});
  const [multiSelected, setMultiSelected] = useState<Record<string, string[]>>({});

  // Trợ lý AI Modal State
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiSessionTarget, setAiSessionTarget] = useState<any>(null);

  const settings = useMemo(() => parseSettings(db.Settings), [db.Settings]);
  const today = todayVnYmd();
  const canAssign = canPerform(user, 'assign_room');
  const userMap = useMemo(() => new Map(db.Users.map((u) => [u.user_id, u])), [db.Users]);

  const queue = useMemo(() => {
    return db.Sessions.filter((s) => {
      if (s.trang_thai === 'Đã hủy' || s.room_id) return false;
      const days = diffDaysYmd(today, s.ngay);
      if (days < 0) return false;
      return showAllFuture ? true : days <= settings.GAN_PHONG_TRUOC_NGAY;
    }).sort((a, b) => `${a.ngay}${a.gio_bd}`.localeCompare(`${b.ngay}${b.gio_bd}`));
  }, [db.Sessions, today, showAllFuture, settings.GAN_PHONG_TRUOC_NGAY]);

  async function handleAssignSingle(session_id: string, room_id: string) {
    if (!room_id) return;
    await execute('assignRoom', { session_id, room_id }, 'Đã gán phòng và gửi thông báo cho giảng viên.');
  }

  async function handleAssignMulti(session_id: string) {
    const list = multiSelected[session_id] || [];
    if (list.length === 0) return;
    await execute(
      'assignRoom',
      { session_id, room_id: list.join(',') },
      `Đã gán thành công ${list.length} phòng cho buổi học/thi chạy trạm.`
    );
  }

  function toggleMultiRoom(session_id: string, room_id: string) {
    const current = multiSelected[session_id] || [];
    const exists = current.includes(room_id);
    const updated = exists ? current.filter((id) => id !== room_id) : [...current, room_id];
    setMultiSelected({ ...multiSelected, [session_id]: updated });
  }

  function openAiForSession(s: any) {
    setAiSessionTarget(s);
    setAiModalOpen(true);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hàng chờ gán phòng học & mô phỏng"
        subtitle={`Cảnh báo đỏ với buổi còn ≤ ${settings.CANH_BAO_CHUA_GAN_PHONG_NGAY} ngày · Hỗ trợ gán đa phòng 5 nhóm (OSCE, Phản hồi, Kỹ năng, Simulation, Phòng họp)`}
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/osce"
              className="px-3.5 py-1.5 rounded-lg bg-teal-800 hover:bg-teal-900 text-white text-sm font-semibold flex items-center gap-1.5 shadow-2xs transition-colors"
            >
              <span>🧭</span>
              <span>Sơ đồ Trực quan OSCE</span>
            </Link>
            <button
              type="button"
              onClick={() => {
                setAiSessionTarget(null);
                setAiModalOpen(true);
              }}
              className="px-3.5 py-1.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-300 text-sm font-semibold flex items-center gap-1.5 shadow-2xs transition-colors"
            >
              <span>✨</span>
              <span>Hỏi Trợ lý AI</span>
            </button>
            <label className="inline-flex items-center gap-2 text-sm bg-white border border-slate-300 rounded-lg px-3 py-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={showAllFuture}
                onChange={(e) => setShowAllFuture(e.target.checked)}
                className="accent-teal-700"
              />
              Hiện cả buổi xa hơn {settings.GAN_PHONG_TRUOC_NGAY} ngày
            </label>
          </div>
        }
      />

      {!canAssign && (
        <div className="p-3 rounded-lg bg-slate-100 border border-slate-200 text-sm text-slate-600">
          Bạn đang ở chế độ xem. Chỉ Đơn vị Hành chính được gán phòng.
        </div>
      )}

      {queue.length === 0 ? (
        <Card>
          <div className="py-10 text-center text-emerald-700 font-medium">
            ✅ Tất cả buổi học trong phạm vi đều đã được gán phòng.
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {queue.map((s) => {
            const daysLeft = diffDaysYmd(today, s.ngay);
            const urgent = daysLeft <= settings.CANH_BAO_CHUA_GAN_PHONG_NGAY;
            const suggestions = suggestAvailableRooms({
              excludeId: s.session_id,
              campus_id: s.campus_id,
              ngay: s.ngay,
              gio_bd: s.gio_bd,
              gio_kt: s.gio_kt,
              rooms: db.Rooms,
              sessions: db.Sessions,
              simClasses: db.SimClasses,
            });

            const isMulti = multiRoomModes[s.session_id] || false;
            const currentSelectedMulti = multiSelected[s.session_id] || [];
            const pickedSingle = selectedRooms[s.session_id] ?? suggestions[0]?.room.room_id ?? '';

            // Phân nhóm phòng trống theo 5 nhóm phòng chuẩn CECICS
            const availableRooms = suggestions.map((sg) => sg.room);
            const groupedRooms: Record<string, RoomRecord[]> = {};
            for (const r of availableRooms) {
              const grp = r.loai || 'Lý thuyết';
              if (!groupedRooms[grp]) groupedRooms[grp] = [];
              groupedRooms[grp].push(r);
            }

            return (
              <div
                key={s.session_id}
                className={`bg-white rounded-xl border p-5 shadow-xs space-y-4 ${
                  urgent ? 'border-red-300 bg-red-50/20' : 'border-slate-200'
                }`}
              >
                {/* Thông tin buổi học */}
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-slate-500">{s.session_id}</span>
                      <Badge tone={urgent ? 'red' : 'amber'}>
                        {daysLeft === 0 ? 'Hôm nay!' : `Còn ${daysLeft} ngày`}
                      </Badge>
                      <Badge tone="teal">{s.campus_id === 'HH' ? 'Hòa Hưng' : 'Tân Nhật'}</Badge>
                      <Badge tone="slate">
                        {s.loai} · {s.he}
                      </Badge>
                    </div>
                    <div className="font-bold text-slate-900 text-base">
                      {s.hoc_phan} — {s.bai_giang}
                    </div>
                    <div className="text-xs text-slate-600">
                      📅 {formatVnDate(s.ngay)} ({s.gio_bd}–{s.gio_kt}) · 👨‍🏫{' '}
                      {userMap.get(s.giang_vien_id)?.ho_ten || s.giang_vien_id}
                    </div>
                  </div>

                  {/* Nút chuyển đổi Đơn phòng / Đa phòng & Hỏi AI */}
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openAiForSession(s)}
                      className="px-2.5 py-1.5 text-xs font-semibold rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 flex items-center gap-1 transition-colors"
                    >
                      <span>🤖</span> Gợi ý phòng AI
                    </button>
                    <button
                      type="button"
                      onClick={() =>
                        setMultiRoomModes({ ...multiRoomModes, [s.session_id]: !isMulti })
                      }
                      className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                        isMulti
                          ? 'bg-amber-100 text-amber-900 border-amber-300'
                          : 'bg-slate-100 text-slate-700 hover:bg-slate-200 border-slate-300'
                      }`}
                    >
                      {isMulti ? '✓ Đang bật Đa phòng (OSCE)' : '+ Gán đa phòng / OSCE'}
                    </button>
                  </div>
                </div>

                {/* Chế độ Gán phòng */}
                {suggestions.length === 0 ? (
                  <div className="text-xs font-semibold text-red-700 bg-red-100 px-3 py-2 rounded-lg">
                    ⚠️ Không còn phòng trống cùng cơ sở trong khung giờ này
                  </div>
                ) : !isMulti ? (
                  /* 1. GÁN ĐƠN PHÒNG */
                  <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 pt-2 border-t border-slate-100">
                    <div className="text-xs font-medium text-slate-500 whitespace-nowrap">
                      Chọn 1 phòng:
                    </div>
                    <select
                      aria-label={`Chọn phòng cho ${s.session_id}`}
                      disabled={!canAssign}
                      value={pickedSingle}
                      onChange={(e) =>
                        setSelectedRooms({ ...selectedRooms, [s.session_id]: e.target.value })
                      }
                      className="text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white flex-1"
                    >
                      {suggestions.map((sg) => (
                        <option key={sg.room.room_id} value={sg.room.room_id}>
                          [{sg.room.loai}] {sg.room.ten} — {sg.reason}
                        </option>
                      ))}
                    </select>
                    {canAssign && (
                      <button
                        type="button"
                        onClick={() => handleAssignSingle(s.session_id, pickedSingle)}
                        className="px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold whitespace-nowrap transition-colors"
                      >
                        Gán phòng
                      </button>
                    )}
                  </div>
                ) : (
                  /* 2. GÁN ĐA PHÒNG THEO 5 NHÓM PHÒNG CECICS */
                  <div className="space-y-3 pt-3 border-t border-slate-100 bg-slate-50/60 p-3.5 rounded-xl border border-slate-200">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
                        Chọn các phòng theo nhóm nhu cầu mô phỏng:
                      </span>
                      <span className="text-xs text-teal-800 font-semibold bg-teal-100 px-2.5 py-0.5 rounded-full">
                        Đã chọn: {currentSelectedMulti.length} phòng
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {ROOM_TYPES.map((group) => {
                        const roomsInGrp = groupedRooms[group] || [];
                        if (roomsInGrp.length === 0) return null;
                        return (
                          <div
                            key={group}
                            className="bg-white p-3 rounded-lg border border-slate-200 shadow-2xs space-y-2"
                          >
                            <div className="text-xs font-bold text-slate-700 flex items-center justify-between border-b pb-1">
                              <span>{group}</span>
                              <span className="text-[10px] text-slate-400 font-normal">
                                ({roomsInGrp.length} trống)
                              </span>
                            </div>
                            <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                              {roomsInGrp.map((r) => {
                                const isChecked = currentSelectedMulti.includes(r.room_id);
                                return (
                                  <label
                                    key={r.room_id}
                                    className={`flex items-center gap-2 p-1.5 rounded-md text-xs cursor-pointer border transition-colors ${
                                      isChecked
                                        ? 'bg-teal-50 border-teal-300 text-teal-950 font-semibold'
                                        : 'hover:bg-slate-50 border-transparent text-slate-700'
                                    }`}
                                  >
                                    <input
                                      type="checkbox"
                                      disabled={!canAssign}
                                      checked={isChecked}
                                      onChange={() => toggleMultiRoom(s.session_id, r.room_id)}
                                      className="accent-teal-700 h-3.5 w-3.5"
                                    />
                                    <span className="flex-1 truncate">{r.ten}</span>
                                    <span className="text-[10px] text-slate-400 font-mono">
                                      {r.suc_chua}c
                                    </span>
                                  </label>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* Hàng hành động đa phòng */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-2 border-t border-slate-200">
                      <div className="text-xs text-slate-600">
                        {currentSelectedMulti.length === 0 ? (
                          <span className="text-slate-400 italic">
                            Chưa chọn phòng nào. Hãy tích chọn các trạm OSCE hoặc phòng mô phỏng bên trên.
                          </span>
                        ) : (
                          <span>
                            Danh sách gán: <strong>{currentSelectedMulti.join(', ')}</strong>
                          </span>
                        )}
                      </div>
                      {canAssign && (
                        <button
                          type="button"
                          disabled={currentSelectedMulti.length === 0}
                          onClick={() => handleAssignMulti(s.session_id)}
                          className="px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 disabled:opacity-40 text-white text-xs sm:text-sm font-semibold whitespace-nowrap transition-colors"
                        >
                          Xác nhận gán {currentSelectedMulti.length} phòng
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Trợ lý AI Modal Dialog */}
      <AiAdvisorModal
        isOpen={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        initialMode={aiSessionTarget ? 'osce_cluster' : 'general'}
        sessionInfo={aiSessionTarget || {}}
      />
    </div>
  );
}
