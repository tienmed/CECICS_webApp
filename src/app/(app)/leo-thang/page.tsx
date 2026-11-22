'use client';

import React, { useMemo, useState } from 'react';
import { canPerform } from '@/core/permissions';
import { ESCALATION_ACTIONS, UNIT_LABELS, type EscalationRecord, type Unit } from '@/core/types';
import { useApp } from '@/components/AppProvider';
import { Badge, Card, Modal, PageHeader } from '@/components/ui';

export default function EscalationsPage() {
  const { user, db, execute } = useApp();
  const [selected, setSelected] = useState<EscalationRecord | null>(null);
  const [actionType, setActionType] = useState<string>('Chỉ đạo');
  const [comment, setComment] = useState('');

  const canResolve = canPerform(user, 'resolve_escalation');
  const userMap = useMemo(() => new Map(db.Users.map((u) => [u.user_id, u])), [db.Users]);

  const sorted = useMemo(
    () =>
      db.Escalations.slice().sort((a, b) => {
        if (a.trang_thai === 'Đang mở' && b.trang_thai !== 'Đang mở') return -1;
        if (a.trang_thai !== 'Đang mở' && b.trang_thai === 'Đang mở') return 1;
        return b.tao_luc.localeCompare(a.tao_luc);
      }),
    [db.Escalations]
  );

  async function runChecksNow() {
    await execute('runDailyChecks', {}, 'Đã chạy quét kiểm tra leo thang và hết hạn đổi lịch.');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    const res = await execute(
      'resolveEscalation',
      { esc_id: selected.esc_id, hanh_dong_ld: actionType, y_kien: comment },
      `Đã ghi nhận ${actionType.toLowerCase()} và gửi thông báo đến Trưởng đơn vị.`
    );
    if (res.ok) {
      setSelected(null);
      setComment('');
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leo thang & Chỉ đạo Ban Lãnh đạo"
        subtitle="Tự động tổng hợp thiết bị hỏng kéo dài, buổi sát giờ chưa có phòng, lớp trễ hạn tồn đọng · Trưởng & Phó TT cùng theo dõi và chỉ đạo"
        actions={
          <button
            onClick={runChecksNow}
            className="px-3.5 py-2 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 text-sm font-medium text-slate-700"
          >
            ↻ Quét cảnh báo ngay
          </button>
        }
      />

      <div className="space-y-3">
        {sorted.length === 0 ? (
          <Card>
            <div className="py-10 text-center text-emerald-700">✅ Chưa có mục leo thang nào.</div>
          </Card>
        ) : (
          sorted.map((esc) => {
            const isOpen = esc.trang_thai === 'Đang mở';
            return (
              <div
                key={esc.esc_id}
                className={`bg-white rounded-xl border p-4 shadow-xs ${
                  isOpen ? 'border-amber-300 bg-amber-50/20' : 'border-slate-200'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs text-slate-500">{esc.esc_id}</span>
                      <Badge tone={isOpen ? 'red' : esc.trang_thai === 'Trả lại đơn vị' ? 'amber' : 'emerald'}>
                        {esc.trang_thai}
                      </Badge>
                      <Badge tone="slate">{esc.loai}</Badge>
                      <Badge tone="teal">{UNIT_LABELS[esc.don_vi as Unit] || esc.don_vi}</Badge>
                    </div>
                    <p className="text-sm font-medium text-slate-900">{esc.ly_do}</p>
                    {esc.y_kien && (
                      <div className="p-2.5 rounded-lg bg-slate-100 text-xs text-slate-800">
                        <strong>
                          {esc.hanh_dong_ld} ({userMap.get(esc.boi)?.ho_ten || esc.boi}):
                        </strong>{' '}
                        {esc.y_kien}
                      </div>
                    )}
                  </div>

                  {canResolve && (
                    <button
                      onClick={() => {
                        setSelected(esc);
                        setActionType('Chỉ đạo');
                        setComment(esc.y_kien || '');
                      }}
                      className="px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-xs font-semibold shrink-0"
                    >
                      {isOpen ? 'Chỉ đạo / Phê duyệt' : 'Cập nhật ý kiến'}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      <Modal open={Boolean(selected)} onClose={() => setSelected(null)} title={`Ý kiến Ban Lãnh đạo — ${selected?.esc_id || ''}`}>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="text-sm text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-200">{selected?.ly_do}</div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Hình thức xử lý</label>
            <select
              value={actionType}
              onChange={(e) => setActionType(e.target.value)}
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2"
            >
              {ESCALATION_ACTIONS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Nội dung chỉ đạo *</label>
            <textarea
              required
              rows={3}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Nhập ý kiến chỉ đạo cho Trưởng đơn vị thực hiện..."
              className="w-full text-sm border border-slate-300 rounded-lg px-3 py-2"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setSelected(null)} className="px-4 py-2 rounded-lg border border-slate-300 text-sm">
              Đóng
            </button>
            <button type="submit" className="px-4 py-2 rounded-lg bg-teal-700 hover:bg-teal-800 text-white text-sm font-semibold">
              Gửi chỉ đạo
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
