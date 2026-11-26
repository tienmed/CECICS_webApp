'use client';

import React, { useMemo, useState } from 'react';
import { findLecturerConflicts } from '@/core/conflict';
import { formatVnDate, todayVnYmd } from '@/core/time';
import { ROLES } from '@/core/types';
import { useApp } from '@/components/AppProvider';
import { Badge, Card, Modal, PageHeader } from '@/components/ui';

const inputCls = 'w-full text-sm border border-slate-300 rounded-lg px-3 py-2 bg-white';
const labelCls = 'block text-xs font-semibold text-slate-700 mb-1';

export default function SwapPage() {
  const { user, db, execute } = useApp();
  const [open, setOpen] = useState(false);
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [rejectTargetSwap, setRejectTargetSwap] = useState<(typeof db.SwapRequests)[0] | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [form, setForm] = useState({
    session_id: '',
    den_gv: '',
    target_session_id: '',
    loi_nhan: '',
  });

  const today = todayVnYmd();
  const userMap = useMemo(() => new Map(db.Users.map((u) => [u.user_id, u])), [db.Users]);
  const sessionMap = useMemo(() => new Map(db.Sessions.map((s) => [s.session_id, s])), [db.Sessions]);
  const roomMap = useMemo(() => new Map(db.Rooms.map((r) => [r.room_id, r])), [db.Rooms]);

  const myUpcoming = useMemo(
    () =>
      db.Sessions.filter((s) => s.trang_thai !== 'Đã hủy' && s.ngay >= today && s.giang_vien_id === user.user_id).sort(
        (a, b) => `${a.ngay}${a.gio_bd}`.localeCompare(`${b.ngay}${b.gio_bd}`)
      ),
    [db.Sessions, today, user.user_id]
  );

  const colleagues = useMemo(
    () => db.Users.filter((u) => u.kich_hoat && u.user_id !== user.user_id && u.vai_tro.includes(ROLES.GIANG_VIEN)),
    [db.Users, user.user_id]
  );

  const selectedSession = sessionMap.get(form.session_id);

  const allColleagueSessions = useMemo(() => {
    return db.Sessions.filter(
      (s) => s.trang_thai !== 'Đã hủy' && s.ngay >= today && s.giang_vien_id !== user.user_id
    ).sort((a, b) => `${a.ngay}${a.gio_bd}`.localeCompare(`${b.ngay}${b.gio_bd}`));
  }, [db.Sessions, today, user.user_id]);

  // Chỉ hiện danh sách các buổi còn lại của lớp đó để hoán đổi
  const targetColleagueSessions = useMemo(() => {
    if (!selectedSession) return [];
    const selectedClass = (selectedSession.lop || '').trim();
    if (selectedClass) {
      return allColleagueSessions.filter((s) => (s.lop || '').trim() === selectedClass);
    }
    // Nếu buổi hiện tại chưa có thông tin lớp cụ thể, lọc theo cùng học phần
    return allColleagueSessions.filter((s) => s.hoc_phan === selectedSession.hoc_phan);
  }, [allColleagueSessions, selectedSession]);

  const sameCourseColleagueSessions = useMemo(() => {
    if (!selectedSession) return [];
    return targetColleagueSessions.filter((s) => s.hoc_phan === selectedSession.hoc_phan);
  }, [targetColleagueSessions, selectedSession]);

  const otherCourseColleagueSessions = useMemo(() => {
    if (!selectedSession) return [];
    return targetColleagueSessions.filter((s) => s.hoc_phan !== selectedSession.hoc_phan);
  }, [targetColleagueSessions, selectedSession]);

  const incoming = db.SwapRequests.filter((sw) => sw.den_gv === user.user_id && sw.trang_thai === 'Chờ');
  const outgoing = db.SwapRequests.filter((sw) => sw.tu_gv === user.user_id && sw.trang_thai === 'Chờ');
  const history = db.SwapRequests.slice().sort((a, b) => b.tao_luc.localeCompare(a.tao_luc));

  const selectedTargetSession = sessionMap.get(form.target_session_id);
  const selectedColleague = userMap.get(form.den_gv);

  function openCreate() {
    setForm({
      session_id: myUpcoming[0]?.session_id || '',
      den_gv: '',
      target_session_id: '',
      loi_nhan: '',
    });
    setOpen(true);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const res = await execute(
      'createSwapRequest',
      form,
      form.target_session_id
        ? 'Đã gửi đề nghị hoán đổi ngày giảng 2 chiều và gửi email thông báo.'
        : 'Đã gửi yêu cầu dạy thay và email thông báo cho đồng nghiệp.'
    );
    if (res.ok) setOpen(false);
  }

  async function respond(swap_id: string, decision: 'Đồng ý' | 'Từ chối' | 'Hủy', ly_do_tu_choi?: string) {
    await execute(
      'respondSwapRequest',
      { swap_id, decision, ly_do_tu_choi },
      decision === 'Đồng ý'
        ? 'Hoán đổi thành công — Lịch giảng và Google Calendar đã tự động cập nhật.'
        : `Đã ${decision.toLowerCase()} yêu cầu.`
    );
  }

  function handleOpenReject(sw: (typeof db.SwapRequests)[0]) {
    setRejectTargetSwap(sw);
    setRejectReason('');
    setRejectModalOpen(true);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hoán đổi lịch giảng"
        subtitle="Quy tắc Y khoa: Đổi ngày giữa 2 giảng viên, không đổi nội dung bài giảng, phòng đi theo buổi giờ · Tự động đồng bộ Calendar & gửi email thông báo"
        actions={
          myUpcoming.length > 0 ? (
            <button
              onClick={openCreate}
              className="px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold shadow-xs transition-colors"
            >
              + Đề nghị đổi lịch giảng
            </button>
          ) : null
        }
      />

      {/* Banner ghi chú quy tắc lâm sàng */}
      <div className="p-4 rounded-xl bg-teal-50/60 border border-teal-200 text-sm text-teal-900 flex items-start gap-3">
        <span className="text-xl">🩺</span>
        <div className="space-y-1">
          <p className="font-bold">Quy chuẩn hoán đổi lịch đào tạo mô phỏng CECICS:</p>
          <p className="text-xs text-teal-800 leading-relaxed">
            Mỗi giảng viên phụ trách chuyên khoa lâm sàng riêng biệt. Khi hoán đổi lịch, hệ thống{' '}
            <strong>hoán đổi ngày/giờ giữa 2 giảng viên</strong> (nội dung học phần &amp; bài giảng của mỗi thầy/cô được giữ
            nguyên 100%, phòng học đi theo khung giờ). Khi đồng nghiệp bấm Đồng ý, hệ thống tự động hoàn tất mà không cần
            duyệt thêm cấp trên.
          </p>
        </div>
      </div>

      {/* Yêu cầu gửi đến bạn */}
      <Card
        title={`Yêu cầu gửi đến bạn (${incoming.length})`}
        subtitle="Kiểm tra xung đột 2 chiều trước khi phê duyệt"
      >
        {incoming.length === 0 ? (
          <div className="text-sm text-slate-400 py-4 text-center">Không có yêu cầu nào đang chờ bạn.</div>
        ) : (
          <div className="space-y-3">
            {incoming.map((sw) => {
              const sA = sessionMap.get(sw.session_id);
              const sB = sw.target_session_id ? sessionMap.get(sw.target_session_id) : null;
              const requester = userMap.get(sw.tu_gv);

              return (
                <div
                  key={sw.swap_id}
                  className="p-4 rounded-xl border border-teal-200 bg-teal-50/30 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Badge tone="teal">{sw.swap_id}</Badge>
                      {sB ? (
                        <Badge tone="emerald">Đổi ngày 2 chiều (Giữ bài)</Badge>
                      ) : (
                        <Badge tone="slate">Dạy thay 1 chiều</Badge>
                      )}
                      <span className="text-sm font-bold text-slate-900">
                        Từ: {requester?.ho_ten || sw.tu_gv} ({requester?.email})
                      </span>
                    </div>

                    {sB && sA ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs bg-white p-3 rounded-lg border border-teal-100">
                        <div className="p-2 rounded bg-teal-50/50 border-l-2 border-teal-600">
                          <span className="font-bold text-teal-800">Bài của Thầy/Cô ({user.ho_ten}):</span>
                          <div className="font-medium text-slate-800 mt-0.5">{sB.bai_giang} ({sB.hoc_phan})</div>
                          <div className="text-slate-600">
                            Ngày hiện tại: <strong>{formatVnDate(sB.ngay)}</strong> ({sB.gio_bd}–{sB.gio_kt})
                          </div>
                          <div className="text-teal-700 font-semibold mt-1">
                            ➔ Đề xuất chuyển sang: {formatVnDate(sA.ngay)} ({sA.gio_bd}–{sA.gio_kt}) tại {roomMap.get(sA.room_id)?.ten || sA.room_id}
                          </div>
                        </div>

                        <div className="p-2 rounded bg-amber-50/50 border-l-2 border-amber-600">
                          <span className="font-bold text-amber-800">Bài của đồng nghiệp ({requester?.ho_ten}):</span>
                          <div className="font-medium text-slate-800 mt-0.5">{sA.bai_giang} ({sA.hoc_phan})</div>
                          <div className="text-slate-600">
                            Ngày hiện tại: <strong>{formatVnDate(sA.ngay)}</strong> ({sA.gio_bd}–{sA.gio_kt})
                          </div>
                          <div className="text-amber-700 font-semibold mt-1">
                            ➔ Sẽ chuyển sang: {formatVnDate(sB.ngay)} ({sB.gio_bd}–{sB.gio_kt}) tại {roomMap.get(sB.room_id)?.ten || sB.room_id}
                          </div>
                        </div>
                      </div>
                    ) : sA ? (
                      <div className="text-sm text-slate-800">
                        Dạy thay bài: <strong>{sA.hoc_phan}</strong> — {sA.bai_giang} · {formatVnDate(sA.ngay)} ({sA.gio_bd}–{sA.gio_kt}) · {sA.campus_id}
                      </div>
                    ) : null}

                    {sw.loi_nhan && <div className="text-xs text-slate-600 italic">“{sw.loi_nhan}”</div>}
                  </div>

                  <div className="flex gap-2 shrink-0">
                    <button
                      onClick={() => respond(sw.swap_id, 'Đồng ý')}
                      className="px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold shadow-xs"
                    >
                      ✓ Đồng ý đổi
                    </button>
                    <button
                      onClick={() => handleOpenReject(sw)}
                      className="px-3.5 py-2 rounded-lg border border-red-300 text-red-700 hover:bg-red-50 text-sm font-medium transition-colors"
                    >
                      ✕ Từ chối
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Yêu cầu bạn đã gửi */}
      {outgoing.length > 0 && (
        <Card title={`Yêu cầu bạn đã gửi (${outgoing.length})`}>
          <div className="space-y-2.5">
            {outgoing.map((sw) => {
              const sA = sessionMap.get(sw.session_id);
              const sB = sw.target_session_id ? sessionMap.get(sw.target_session_id) : null;
              const receiver = userMap.get(sw.den_gv);

              return (
                <div
                  key={sw.swap_id}
                  className="p-3.5 rounded-lg border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Badge tone="slate">{sw.swap_id}</Badge>
                      {sB ? <Badge tone="emerald">Đổi ngày 2 chiều</Badge> : <Badge tone="slate">Dạy thay</Badge>}
                      <span className="text-sm font-semibold text-slate-900">
                        Gửi tới: {receiver?.ho_ten || sw.den_gv}
                      </span>
                    </div>

                    {sA && (
                      <div className="text-xs text-slate-600">
                        Bài của bạn: <strong>{sA.bai_giang}</strong> ({formatVnDate(sA.ngay)} {sA.gio_bd}–{sA.gio_kt})
                        {sB ? ` ⇄ Đổi lấy ngày ${formatVnDate(sB.ngay)} của bài "${sB.bai_giang}"` : ''}
                      </div>
                    )}
                    {sw.loi_nhan && <div className="text-xs text-slate-500 italic">“{sw.loi_nhan}”</div>}
                  </div>

                  <button
                    onClick={() => respond(sw.swap_id, 'Hủy')}
                    className="px-3 py-1.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50 shrink-0"
                  >
                    Hủy yêu cầu
                  </button>
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {/* Nhật ký lịch sử hoán đổi */}
      <Card title="Lịch sử hoán đổi lịch giảng">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs text-slate-500 border-b border-slate-200">
                <th className="pb-2 pr-3">Mã</th>
                <th className="pb-2 pr-3">Hình thức</th>
                <th className="pb-2 pr-3">Buổi của GV gửi</th>
                <th className="pb-2 pr-3">Buổi đối ứng (GV nhận)</th>
                <th className="pb-2 pr-3">Từ GV</th>
                <th className="pb-2 pr-3">Đến GV</th>
                <th className="pb-2">Trạng thái</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {history.map((sw) => {
                const sA = sessionMap.get(sw.session_id);
                const sB = sw.target_session_id ? sessionMap.get(sw.target_session_id) : null;
                const statusTone =
                  sw.trang_thai === 'Đồng ý'
                    ? 'emerald'
                    : sw.trang_thai === 'Chờ'
                      ? 'amber'
                      : sw.trang_thai === 'Từ chối'
                        ? 'red'
                        : 'slate';

                return (
                  <tr key={sw.swap_id}>
                    <td className="py-2.5 pr-3 font-mono text-xs text-slate-500">{sw.swap_id}</td>
                    <td className="py-2.5 pr-3">
                      <Badge tone={sB ? 'teal' : 'slate'}>
                        {sB ? 'Đổi ngày' : 'Dạy thay'}
                      </Badge>
                    </td>
                    <td className="py-2.5 pr-3">
                      {sA ? (
                        <div>
                          <div className="font-medium text-slate-900">{sA.bai_giang}</div>
                          <div className="text-xs text-slate-500">
                            {formatVnDate(sA.ngay)} ({sA.gio_bd}–{sA.gio_kt})
                          </div>
                        </div>
                      ) : (
                        sw.session_id
                      )}
                    </td>
                    <td className="py-2.5 pr-3">
                      {sB ? (
                        <div>
                          <div className="font-medium text-slate-900">{sB.bai_giang}</div>
                          <div className="text-xs text-slate-500">
                            {formatVnDate(sB.ngay)} ({sB.gio_bd}–{sB.gio_kt})
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-slate-400">— Không đổi đối ứng —</span>
                      )}
                    </td>
                    <td className="py-2.5 pr-3">{userMap.get(sw.tu_gv)?.ho_ten || sw.tu_gv}</td>
                    <td className="py-2.5 pr-3">{userMap.get(sw.den_gv)?.ho_ten || sw.den_gv}</td>
                    <td className="py-2.5">
                      <Badge tone={statusTone}>{sw.trang_thai}</Badge>
                      {sw.trang_thai === 'Từ chối' && sw.ly_do_tu_choi && (
                        <div className="text-[11px] text-red-600 italic mt-1 max-w-[220px] leading-tight bg-red-50/80 p-1.5 rounded border border-red-200">
                          <span className="font-semibold not-italic">Lý do:</span> “{sw.ly_do_tu_choi}”
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Modal gửi yêu cầu hoán đổi */}
      <Modal open={open} onClose={() => setOpen(false)} title="Đề nghị hoán đổi lịch giảng">
        <form onSubmit={handleCreate} className="space-y-4">
          <div>
            <label className={labelCls}>1. Chọn buổi giảng của bạn muốn đổi ngày *</label>
            <select
              required
              value={form.session_id}
              onChange={(e) => setForm({ ...form, session_id: e.target.value, target_session_id: '', den_gv: '' })}
              className={inputCls}
            >
              {myUpcoming.map((s) => (
                <option key={s.session_id} value={s.session_id}>
                  {formatVnDate(s.ngay)} ({s.gio_bd}–{s.gio_kt}){s.lop ? ` [${s.lop}]` : ''} · {s.hoc_phan} — {s.bai_giang}
                </option>
              ))}
            </select>
            {selectedSession?.lop && (
              <p className="text-xs text-teal-700 mt-1 font-medium">
                🎓 Lớp: <strong>{selectedSession.lop}</strong> — Chỉ hiện danh sách các buổi đối ứng cùng lớp này.
              </p>
            )}
          </div>

          <div>
            <label className={labelCls}>2. Chọn đồng nghiệp muốn đổi lịch *</label>
            <select
              required
              value={form.target_session_id || (form.den_gv ? `user:${form.den_gv}` : '')}
              onChange={(e) => {
                const val = e.target.value;
                if (val.startsWith('user:')) {
                  const gvId = val.replace('user:', '');
                  setForm({ ...form, den_gv: gvId, target_session_id: '' });
                } else if (val) {
                  const targetSession = sessionMap.get(val);
                  setForm({ ...form, target_session_id: val, den_gv: targetSession?.giang_vien_id || '' });
                } else {
                  setForm({ ...form, target_session_id: '', den_gv: '' });
                }
              }}
              className={inputCls}
            >
              <option value="">-- Chọn buổi giảng đối ứng của đồng nghiệp (hoặc chọn dạy thay) --</option>

              {sameCourseColleagueSessions.length > 0 && (
                <optgroup
                  label={`🎯 Cùng lớp & học phần: ${selectedSession?.lop ? `[${selectedSession.lop}] ` : ''}${selectedSession?.hoc_phan || ''} (Khuyên dùng)`}
                >
                  {sameCourseColleagueSessions.map((s) => {
                    const gvName = userMap.get(s.giang_vien_id)?.ho_ten || s.giang_vien_id;
                    const busyMe = selectedSession
                      ? findLecturerConflicts(
                          {
                            id: selectedSession.session_id,
                            ngay: s.ngay,
                            gio_bd: s.gio_bd,
                            gio_kt: s.gio_kt,
                            giang_vien_id: user.user_id,
                          },
                          db.Sessions.filter((x) => x.session_id !== selectedSession.session_id && x.session_id !== s.session_id)
                        ).length > 0
                      : false;
                    const hasPendingSwap = db.SwapRequests.some(
                      (sw) => sw.trang_thai === 'Chờ' && (sw.session_id === s.session_id || sw.target_session_id === s.session_id)
                    );

                    return (
                      <option key={s.session_id} value={s.session_id} disabled={busyMe || hasPendingSwap}>
                        {formatVnDate(s.ngay)} ({s.gio_bd}–{s.gio_kt}){s.lop ? ` [${s.lop}]` : ''} · {s.hoc_phan} — {s.bai_giang} · GV: {gvName}
                        {hasPendingSwap ? ' — [Đang chờ đổi]' : busyMe ? ' — [Bạn bị trùng lịch]' : ''}
                      </option>
                    );
                  })}
                </optgroup>
              )}

              {otherCourseColleagueSessions.length > 0 && (
                <optgroup
                  label={`📚 Cùng lớp: ${selectedSession?.lop ? `[${selectedSession.lop}] ` : ''}(Các học phần khác)`}
                >
                  {otherCourseColleagueSessions.map((s) => {
                    const gvName = userMap.get(s.giang_vien_id)?.ho_ten || s.giang_vien_id;
                    const busyMe = selectedSession
                      ? findLecturerConflicts(
                          {
                            id: selectedSession.session_id,
                            ngay: s.ngay,
                            gio_bd: s.gio_bd,
                            gio_kt: s.gio_kt,
                            giang_vien_id: user.user_id,
                          },
                          db.Sessions.filter((x) => x.session_id !== selectedSession.session_id && x.session_id !== s.session_id)
                        ).length > 0
                      : false;
                    const hasPendingSwap = db.SwapRequests.some(
                      (sw) => sw.trang_thai === 'Chờ' && (sw.session_id === s.session_id || sw.target_session_id === s.session_id)
                    );

                    return (
                      <option key={s.session_id} value={s.session_id} disabled={busyMe || hasPendingSwap}>
                        {formatVnDate(s.ngay)} ({s.gio_bd}–{s.gio_kt}){s.lop ? ` [${s.lop}]` : ''} · {s.hoc_phan} — {s.bai_giang} · GV: {gvName}
                        {hasPendingSwap ? ' — [Đang chờ đổi]' : busyMe ? ' — [Bạn bị trùng lịch]' : ''}
                      </option>
                    );
                  })}
                </optgroup>
              )}

              {targetColleagueSessions.length === 0 && (
                <option value="" disabled>
                  (Không tìm thấy buổi giảng nào khác của đồng nghiệp trong cùng lớp này)
                </option>
              )}

              <optgroup label="👤 Dạy thay 1 chiều (không đổi ngày đối ứng)">
                {colleagues.map((l) => (
                  <option key={l.user_id} value={`user:${l.user_id}`}>
                    [Dạy thay 1 chiều] — GV: {l.ho_ten} ({l.don_vi || 'Bộ môn'})
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          {/* Hộp xem trước kết quả đổi lịch theo quy tắc y khoa */}
          {selectedSession && selectedTargetSession && selectedColleague && (
            <div className="p-3.5 rounded-lg bg-teal-50 border border-teal-200 text-xs text-slate-800 space-y-1.5">
              <div className="font-bold text-teal-900 flex items-center gap-1.5">
                <span>🔄</span> Xem trước kết quả hoán đổi (Bài ai nấy dạy):
              </div>
              <ul className="list-disc pl-4 space-y-1 text-slate-700">
                <li>
                  <strong>Bạn ({user.ho_ten}):</strong> Vẫn dạy bài <em>"{selectedSession.bai_giang}"</em> nhưng chuyển sang ngày{' '}
                  <strong className="text-teal-800">{formatVnDate(selectedTargetSession.ngay)} ({selectedTargetSession.gio_bd}–{selectedTargetSession.gio_kt})</strong> tại {roomMap.get(selectedTargetSession.room_id)?.ten || (selectedTargetSession.room_id || 'Phòng theo lịch')}.
                </li>
                <li>
                  <strong>{selectedColleague.ho_ten}:</strong> Vẫn dạy bài <em>"{selectedTargetSession.bai_giang}"</em> nhưng chuyển sang ngày{' '}
                  <strong className="text-amber-800">{formatVnDate(selectedSession.ngay)} ({selectedSession.gio_bd}–{selectedSession.gio_kt})</strong> tại {roomMap.get(selectedSession.room_id)?.ten || (selectedSession.room_id || 'Phòng theo lịch')}.
                </li>
                <li>
                  <strong>Phòng học:</strong> Phòng học đi theo buổi giờ đã xếp ban đầu.
                </li>
              </ul>
            </div>
          )}

          {selectedSession && form.den_gv && !form.target_session_id && selectedColleague && (
            <div className="p-3.5 rounded-lg bg-sky-50 border border-sky-200 text-xs text-slate-800 space-y-1.5">
              <div className="font-bold text-sky-900 flex items-center gap-1.5">
                <span>👤</span> Xem trước kết quả dạy thay 1 chiều:
              </div>
              <p className="text-slate-700">
                Đồng nghiệp <strong>{selectedColleague.ho_ten}</strong> sẽ dạy thay bài <em>"{selectedSession.bai_giang}"</em> vào ngày{' '}
                <strong>{formatVnDate(selectedSession.ngay)} ({selectedSession.gio_bd}–{selectedSession.gio_kt})</strong>.
              </p>
            </div>
          )}

          <div>
            <label className={labelCls}>Lời nhắn</label>
            <textarea
              rows={2}
              value={form.loi_nhan}
              onChange={(e) => setForm({ ...form, loi_nhan: e.target.value })}
              placeholder="VD: Bận lịch trực lâm sàng đột xuất, nhờ Thầy/Cô đổi ngày giúp..."
              className={inputCls}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold shadow-xs"
            >
              Gửi đề nghị
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal từ chối yêu cầu hoán đổi & ghi chú lý do */}
      <Modal
        open={rejectModalOpen}
        onClose={() => setRejectModalOpen(false)}
        title={`Từ chối yêu cầu hoán đổi lịch (${rejectTargetSwap?.swap_id || ''})`}
      >
        {rejectTargetSwap && (
          <div className="space-y-4">
            <div className="p-3.5 rounded-xl bg-red-50/90 border border-red-200 text-xs text-red-900 space-y-1.5">
              <div className="font-bold text-sm text-red-950 flex items-center gap-1.5">
                <span>⚠️</span>
                <span>Từ chối yêu cầu từ Giảng viên: {userMap.get(rejectTargetSwap.tu_gv)?.ho_ten || rejectTargetSwap.tu_gv}</span>
              </div>
              <div className="text-slate-700">
                Buổi đề nghị: <strong>{sessionMap.get(rejectTargetSwap.session_id)?.bai_giang}</strong> (
                {sessionMap.get(rejectTargetSwap.session_id)?.hoc_phan})
              </div>
              {rejectTargetSwap.loi_nhan && (
                <div className="text-slate-600 italic bg-white/70 p-2 rounded border border-red-100">
                  Lời nhắn từ người gửi: “{rejectTargetSwap.loi_nhan}”
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-800 mb-1.5">
                Lý do từ chối <span className="text-red-600">*</span> (Sẽ gửi email thông báo và hiển thị trực tiếp cho đồng nghiệp):
              </label>
              <textarea
                rows={3}
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Nhập lý do cụ thể (VD: Trùng lịch phẫu thuật tại bệnh viện, trực cấp cứu, đi công tác...)"
                className="w-full text-sm rounded-lg border border-slate-300 p-2.5 focus:border-red-500 focus:ring-1 focus:ring-red-500 bg-white"
              />
            </div>

            <div className="space-y-1.5">
              <span className="text-[11px] font-semibold text-slate-500">Gợi ý lý do lâm sàng thường gặp:</span>
              <div className="flex flex-wrap gap-1.5">
                {[
                  'Trùng lịch phẫu thuật tại bệnh viện',
                  'Trùng ca trực cấp cứu bệnh viện',
                  'Bận công tác / hội nghị khoa học',
                  'Trùng lịch giảng dạy chuyên khoa khác',
                  'Trùng lịch coi thi',
                ].map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    onClick={() => setRejectReason(chip)}
                    className="px-2.5 py-1 rounded-md bg-slate-100 hover:bg-red-50 hover:text-red-700 border border-slate-200 text-slate-700 text-xs transition-colors"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setRejectModalOpen(false)}
                className="px-4 py-2 rounded-lg border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
              >
                Quay lại
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!rejectTargetSwap) return;
                  await respond(rejectTargetSwap.swap_id, 'Từ chối', rejectReason);
                  setRejectModalOpen(false);
                }}
                className="px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-semibold shadow-xs transition-colors"
              >
                Xác nhận từ chối
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
