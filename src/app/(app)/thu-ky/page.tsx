'use client';

import React, { useState, useMemo, useEffect, ChangeEvent, DragEvent } from 'react';
import { useApp } from '@/components/AppProvider';
import { PageHeader, Card, Badge, Modal } from '@/components/ui';
import type { MeetingMinutesRecord, MeetingTaskRecord } from '@/core/types';
import officialStaffList from '../../../../data/cecics_official_staff.json';

interface ActionItem {
  tieu_de: string;
  nguoi_phu_trach: string;
  assignee_user_id?: string;
  deadline: string;
  muc_do_uu_tien: 'Cao' | 'Trung bình' | 'Thấp';
  trang_thai?: 'Chưa bắt đầu' | 'Đang làm' | 'Hoàn thành' | 'Quá hạn';
  ghi_chu?: string;
}

const STORAGE_KEY_MINUTES = 'cecics_local_meeting_minutes';
const STORAGE_KEY_TASKS = 'cecics_local_meeting_tasks';

export default function ThuKyPage() {
  const { user } = useApp();
  const [activeTab, setActiveTab] = useState<'tao_moi' | 'danh_sach' | 'dau_viec'>('tao_moi');

  // State cho Form tạo mới
  const [tieuDe, setTieuDe] = useState('Cuộc họp giao ban tuần CECICS');
  const [files, setFiles] = useState<File[]>([]);
  const [ghiChuTay, setGhiChuTay] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // State kết quả biên bản đang soạn
  const [generatedMd, setGeneratedMd] = useState('');
  const [actionItems, setActionItems] = useState<ActionItem[]>([]);
  const [meetingMeta, setMeetingMeta] = useState<{
    ngay_hop: string;
    chu_tri: string;
    thu_ky: string;
    thanh_phan: string[];
  }>({
    ngay_hop: new Date().toISOString().slice(0, 10),
    chu_tri: 'Ban Giám đốc CECICS',
    thu_ky: user.ho_ten,
    thanh_phan: [user.ho_ten],
  });

  // State lưu trữ cục bộ danh sách biên bản và tasks
  const [savedMinutes, setSavedMinutes] = useState<MeetingMinutesRecord[]>([]);
  const [savedTasks, setSavedTasks] = useState<MeetingTaskRecord[]>([]);

  // State bộ lọc và modal
  const [filterPriority, setFilterPriority] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [searchKeyword, setSearchKeyword] = useState<string>('');
  const [selectedMeeting, setSelectedMeeting] = useState<MeetingMinutesRecord | null>(null);

  // Load local data khi mount
  useEffect(() => {
    try {
      const storedMin = localStorage.getItem(STORAGE_KEY_MINUTES);
      if (storedMin) setSavedMinutes(JSON.parse(storedMin));

      const storedTasks = localStorage.getItem(STORAGE_KEY_TASKS);
      if (storedTasks) setSavedTasks(JSON.parse(storedTasks));
    } catch {
      // Bỏ qua lỗi parse storage
    }
  }, []);

  // Lưu danh sách biên bản
  const persistMinutes = (newList: MeetingMinutesRecord[]) => {
    setSavedMinutes(newList);
    try {
      localStorage.setItem(STORAGE_KEY_MINUTES, JSON.stringify(newList));
    } catch {}
  };

  // Lưu danh sách tasks
  const persistTasks = (newList: MeetingTaskRecord[]) => {
    setSavedTasks(newList);
    try {
      localStorage.setItem(STORAGE_KEY_TASKS, JSON.stringify(newList));
    } catch {}
  };

  // Xử lý nạp file
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      setFiles(Array.from(e.target.files));
    }
  };

  // Kéo thả file
  const handleDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      setFiles((prev) => [...prev, ...Array.from(e.dataTransfer.files)]);
    }
  };

  // Gửi tạo biên bản
  const handleGenerateMinutes = async () => {
    if (files.length === 0 && !ghiChuTay.trim()) {
      setErrorMessage('Vui lòng chọn ít nhất 1 tệp tài liệu (Word, Excel, Ghi âm, Ảnh) hoặc nhập nội dung ghi chú.');
      return;
    }

    setErrorMessage('');
    setIsProcessing(true);

    try {
      const formData = new FormData();
      formData.append('tieu_de', tieuDe);
      formData.append('ghi_chu_tay', ghiChuTay);
      files.forEach((f) => formData.append('files', f));

      const res = await fetch('/api/meeting-minutes', {
        method: 'POST',
        body: formData,
      });

      const json = await res.json();
      if (!res.ok || !json.ok) {
        throw new Error(json.error || 'Xảy ra sự cố khi gọi AI xử lý biên bản.');
      }

      const d = json.data;
      setGeneratedMd(d.noi_dung_md || '');
      setActionItems(d.action_items || []);
      setMeetingMeta({
        ngay_hop: d.ngay_hop,
        chu_tri: d.chu_tri,
        thu_ky: d.thu_ky,
        thanh_phan: d.thanh_phan,
      });
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Có lỗi xảy ra khi tạo biên bản.');
    } finally {
      setIsProcessing(false);
    }
  };

  // Lưu biên bản vào kho lưu trữ
  const handleSaveMinutes = () => {
    if (!generatedMd) return;
    const meetingId = `MEET-${Date.now()}`;
    const newRecord: MeetingMinutesRecord = {
      meeting_id: meetingId,
      tieu_de: tieuDe,
      ngay_hop: meetingMeta.ngay_hop,
      gio_bd: '08:30',
      gio_kt: '11:00',
      dia_diem: 'Phòng họp CECICS',
      chu_tri: meetingMeta.chu_tri,
      thu_ky: meetingMeta.thu_ky,
      thanh_phan: meetingMeta.thanh_phan,
      noi_dung_md: generatedMd,
      file_dinh_kem: files.map((f) => f.name),
      nguoi_tao: user.user_id,
      tao_luc: new Date().toISOString(),
    };

    // Tạo các task tương ứng
    const newTasks: MeetingTaskRecord[] = actionItems.map((item, idx) => ({
      task_id: `TASK-${Date.now()}-${idx}`,
      meeting_id: meetingId,
      tieu_de: item.tieu_de,
      nguoi_phu_trach: item.nguoi_phu_trach,
      assignee_user_id: item.assignee_user_id || '',
      deadline: item.deadline || '',
      muc_do_uu_tien: item.muc_do_uu_tien,
      trang_thai: item.trang_thai || 'Chưa bắt đầu',
      ghi_chu: item.ghi_chu || '',
      tao_luc: new Date().toISOString(),
    }));

    persistMinutes([newRecord, ...savedMinutes]);
    persistTasks([...newTasks, ...savedTasks]);

    alert('Đã lưu biên bản họp và đồng bộ bảng đầu việc thành công!');
    setActiveTab('dau_viec');
  };

  // Xuất file Markdown (.md)
  const handleExportMd = () => {
    if (!generatedMd) return;
    const blob = new Blob([generatedMd], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Bien_ban_${tieuDe.replace(/\s+/g, '_')}_${meetingMeta.ngay_hop}.md`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Sao chép Markdown vào clipboard
  const handleCopyMd = () => {
    if (!generatedMd) return;
    navigator.clipboard.writeText(generatedMd);
    alert('Đã sao chép toàn bộ nội dung Markdown vào bộ nhớ tạm (Clipboard)!');
  };

  // Chuyển trạng thái công việc
  const handleToggleTaskStatus = (taskId: string, currentStatus: string) => {
    const nextStatus = currentStatus === 'Hoàn thành' ? 'Đang làm' : 'Hoàn thành';
    const updated = savedTasks.map((t) => (t.task_id === taskId ? { ...t, trang_thai: nextStatus } : t));
    persistTasks(updated);
  };

  // Lọc danh sách đầu việc
  const filteredTasks = useMemo(() => {
    return savedTasks.filter((t) => {
      if (filterPriority !== 'all' && t.muc_do_uu_tien !== filterPriority) return false;
      if (filterStatus !== 'all' && t.trang_thai !== filterStatus) return false;
      if (searchKeyword.trim()) {
        const kw = searchKeyword.toLowerCase();
        const matchTitle = t.tieu_de.toLowerCase().includes(kw);
        const matchAssignee = t.nguoi_phu_trach.toLowerCase().includes(kw);
        if (!matchTitle && !matchAssignee) return false;
      }
      return true;
    });
  }, [savedTasks, filterPriority, filterStatus, searchKeyword]);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      <PageHeader
        title="Thư Ký & Biên Bản Họp Tự Động"
        subtitle="Nạp tệp cuộc họp (Ghi âm, Ảnh, Word, Excel), chuyển đổi Markdown chuẩn hành chính và quản lý tiến độ đầu việc."
        actions={
          <div className="flex items-center gap-2">
            <button
              type="button"
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
                activeTab === 'tao_moi'
                  ? 'bg-teal-600 text-white border-teal-600'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
              onClick={() => setActiveTab('tao_moi')}
            >
              ➕ Soạn Biên Bản Mới
            </button>
            <button
              type="button"
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
                activeTab === 'danh_sach'
                  ? 'bg-teal-600 text-white border-teal-600'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
              onClick={() => setActiveTab('danh_sach')}
            >
              📁 Kho Biên Bản ({savedMinutes.length})
            </button>
            <button
              type="button"
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition ${
                activeTab === 'dau_viec'
                  ? 'bg-teal-600 text-white border-teal-600'
                  : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
              }`}
              onClick={() => setActiveTab('dau_viec')}
            >
              📋 Quản Lý Đầu Việc ({savedTasks.length})
            </button>
          </div>
        }
      />

      {/* TAB 1: SOẠN BIÊN BẢN MỚI */}
      {activeTab === 'tao_moi' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Cột trái: Form nạp tài liệu */}
          <div className="lg:col-span-5 space-y-4">
            <Card className="p-5 space-y-4 shadow-sm border border-slate-200">
              <h3 className="font-semibold text-slate-800 text-base flex items-center gap-2">
                <span>📂</span> Nạp Tài Liệu & Ghi Chú Cuộc Họp
              </h3>

              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">Tên / Tiêu đề cuộc họp</label>
                <input
                  type="text"
                  value={tieuDe}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setTieuDe(e.target.value)}
                  placeholder="Ví dụ: Giao ban tuần CECICS - Tuần 48"
                  className="w-full text-xs p-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                />
              </div>

              {/* Vùng kéo thả file */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Đính kèm tệp (Audio, Ảnh chụp bảng/slide, Word .docx, Excel .xlsx, .txt)
                </label>
                <div
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={handleDrop}
                  className="border-2 border-dashed border-teal-300 hover:border-teal-500 rounded-xl p-5 text-center bg-teal-50/50 hover:bg-teal-50 transition cursor-pointer"
                  onClick={() => document.getElementById('file-upload-input')?.click()}
                >
                  <input
                    id="file-upload-input"
                    type="file"
                    multiple
                    accept=".docx,.xlsx,.xls,.mp3,.m4a,.wav,.jpg,.jpeg,.png,.txt,.md"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <div className="text-3xl mb-2">📥</div>
                  <p className="text-sm font-medium text-slate-700">Kéo thả tệp vào đây hoặc bấm để chọn tệp</p>
                  <p className="text-xs text-slate-500 mt-1">Hỗ trợ Audio ghi âm, Hình ảnh bảng, Word, Excel, Text</p>
                </div>

                {/* Danh sách file đã chọn */}
                {files.length > 0 && (
                  <div className="mt-3 space-y-1.5">
                    <p className="text-xs font-semibold text-slate-600">Đã chọn ({files.length} tệp):</p>
                    <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                      {files.map((f, i) => (
                        <div
                          key={i}
                          className="flex items-center justify-between text-xs bg-slate-100 px-2.5 py-1.5 rounded text-slate-700"
                        >
                          <span className="truncate max-w-[200px] font-mono">{f.name}</span>
                          <span className="text-slate-500 text-[11px]">{(f.size / 1024).toFixed(0)} KB</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Ghi chú tay của thư ký */}
              <div>
                <label className="block text-xs font-medium text-slate-600 mb-1">
                  Ghi chú nhanh / Ý kiến bổ sung của Thư ký
                </label>
                <textarea
                  rows={4}
                  value={ghiChuTay}
                  onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setGhiChuTay(e.target.value)}
                  placeholder="Nhập nhanh các ý chính, kết luận của chủ trì hoặc danh sách đại biểu có mặt..."
                  className="w-full text-xs p-2.5 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                />
              </div>

              {errorMessage && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg text-rose-700 text-xs">
                  {errorMessage}
                </div>
              )}

              <button
                type="button"
                onClick={handleGenerateMinutes}
                disabled={isProcessing}
                className="w-full justify-center text-xs py-2.5 font-semibold bg-teal-600 hover:bg-teal-700 text-white rounded-lg shadow transition disabled:opacity-50"
              >
                {isProcessing ? '⏳ AI đang bóc tách và tạo biên bản...' : '✨ Bắt đầu Tạo Biên Bản Chuẩn Hành Chính'}
              </button>
            </Card>
          </div>

          {/* Cột phải: Xem trước & Biên tập Markdown */}
          <div className="lg:col-span-7 space-y-4">
            <Card className="p-5 space-y-4 shadow-sm border border-slate-200 min-h-[500px]">
              <div className="flex items-center justify-between border-b pb-3 border-slate-100">
                <h3 className="font-semibold text-slate-800 text-base flex items-center gap-2">
                  <span>📝</span> Bản Thảo Biên Bản Họp (Markdown)
                </h3>
                {generatedMd && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="px-2.5 py-1 text-xs border border-slate-300 rounded hover:bg-slate-50 text-slate-700"
                      onClick={handleCopyMd}
                    >
                      📋 Sao chép
                    </button>
                    <button
                      type="button"
                      className="px-2.5 py-1 text-xs border border-slate-300 rounded hover:bg-slate-50 text-slate-700"
                      onClick={handleExportMd}
                    >
                      💾 Tải về .md
                    </button>
                    <button
                      type="button"
                      className="px-2.5 py-1 text-xs bg-teal-600 text-white rounded hover:bg-teal-700"
                      onClick={handleSaveMinutes}
                    >
                      ✅ Lưu & Đồng bộ Task
                    </button>
                  </div>
                )}
              </div>

              {isProcessing && (
                <div className="py-20 text-center space-y-3">
                  <div className="animate-spin text-4xl">⚙️</div>
                  <p className="text-sm font-medium text-slate-700">Đang đọc dữ liệu tệp và tổng hợp biên bản...</p>
                  <p className="text-xs text-slate-500">
                    AI PNT Gemma 4 đang cấu trúc hóa 4 phần: Thông tin chung, Nội dung, Kết luận, Bảng phân công.
                  </p>
                </div>
              )}

              {!isProcessing && !generatedMd && (
                <div className="py-24 text-center text-slate-400 space-y-2">
                  <div className="text-4xl">📄</div>
                  <p className="text-sm">Chưa có nội dung biên bản.</p>
                  <p className="text-xs">
                    Vui lòng nạp file hoặc nhập ghi chú ở cột bên trái rồi bấm &quot;Bắt đầu Tạo Biên Bản&quot;.
                  </p>
                </div>
              )}

              {!isProcessing && generatedMd && (
                <div className="space-y-4">
                  <textarea
                    rows={16}
                    value={generatedMd}
                    onChange={(e: ChangeEvent<HTMLTextAreaElement>) => setGeneratedMd(e.target.value)}
                    className="w-full text-xs font-mono p-3 border border-slate-200 rounded-lg bg-slate-50 focus:bg-white focus:ring-2 focus:ring-teal-500 transition"
                  />

                  {/* Bảng Action Items trích xuất được */}
                  {actionItems.length > 0 && (
                    <div className="mt-4 border-t pt-4 border-slate-100">
                      <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wide mb-2 flex items-center justify-between">
                        <span>🎯 Các đầu việc AI nhận diện ({actionItems.length})</span>
                        <span className="text-[11px] font-normal text-slate-500">
                          Thư ký có thể chỉnh sửa người phụ trách hoặc hạn chót trước khi Lưu
                        </span>
                      </h4>

                      <div className="overflow-x-auto border border-slate-200 rounded-lg">
                        <table className="min-w-full text-left text-xs divide-y divide-slate-200">
                          <thead className="bg-slate-100 text-slate-700 font-semibold">
                            <tr>
                              <th className="px-3 py-2">Đầu việc</th>
                              <th className="px-3 py-2 w-44">Người phụ trách</th>
                              <th className="px-3 py-2 w-32">Deadline</th>
                              <th className="px-3 py-2 w-24">Ưu tiên</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 bg-white">
                            {actionItems.map((item, idx) => (
                              <tr key={idx} className="hover:bg-slate-50">
                                <td className="px-3 py-2">
                                  <input
                                    type="text"
                                    value={item.tieu_de}
                                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                                      const next = [...actionItems];
                                      next[idx].tieu_de = e.target.value;
                                      setActionItems(next);
                                    }}
                                    className="w-full bg-transparent border-b border-transparent focus:border-teal-500 text-slate-800 focus:outline-none"
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <input
                                    type="text"
                                    list="staff-list"
                                    value={item.nguoi_phu_trach}
                                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                                      const next = [...actionItems];
                                      next[idx].nguoi_phu_trach = e.target.value;
                                      setActionItems(next);
                                    }}
                                    placeholder="Chọn hoặc nhập tên"
                                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded px-2 py-1"
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <input
                                    type="date"
                                    value={item.deadline}
                                    onChange={(e: ChangeEvent<HTMLInputElement>) => {
                                      const next = [...actionItems];
                                      next[idx].deadline = e.target.value;
                                      setActionItems(next);
                                    }}
                                    className="w-full text-xs bg-slate-50 border border-slate-200 rounded px-1.5 py-1"
                                  />
                                </td>
                                <td className="px-3 py-2">
                                  <select
                                    value={item.muc_do_uu_tien}
                                    onChange={(e: ChangeEvent<HTMLSelectElement>) => {
                                      const next = [...actionItems];
                                      next[idx].muc_do_uu_tien = e.target.value as 'Cao' | 'Trung bình' | 'Thấp';
                                      setActionItems(next);
                                    }}
                                    className="text-xs bg-slate-50 border border-slate-200 rounded px-1.5 py-1"
                                  >
                                    <option value="Cao">Cao</option>
                                    <option value="Trung bình">Trung bình</option>
                                    <option value="Thấp">Thấp</option>
                                  </select>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Card>
          </div>
        </div>
      )}

      {/* TAB 2: KHO LƯU TRỮ BIÊN BẢN */}
      {activeTab === 'danh_sach' && (
        <Card className="p-5 space-y-4 shadow-sm border border-slate-200">
          <div className="flex items-center justify-between border-b pb-3 border-slate-100">
            <h3 className="font-semibold text-slate-800 text-base">Sổ Lưu Trữ Biên Bản Cuộc Họp ({savedMinutes.length})</h3>
            <button
              type="button"
              className="px-3 py-1.5 text-xs font-semibold bg-teal-600 text-white rounded-lg hover:bg-teal-700"
              onClick={() => setActiveTab('tao_moi')}
            >
              ➕ Soạn Biên Bản Mới
            </button>
          </div>

          {savedMinutes.length === 0 ? (
            <div className="py-16 text-center text-slate-400">
              <div className="text-4xl mb-2">📂</div>
              <p className="text-sm">Chưa có biên bản nào được lưu trữ.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {savedMinutes.map((m) => (
                <div key={m.meeting_id} className="py-3 flex items-center justify-between hover:bg-slate-50 px-2 rounded">
                  <div>
                    <h4 className="text-sm font-semibold text-slate-800">{m.tieu_de}</h4>
                    <p className="text-xs text-slate-500 mt-0.5">
                      📅 Ngày họp: {m.ngay_hop} | 👤 Chủ trì: {m.chu_tri} | ✍️ Thư ký: {m.thu_ky}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      className="px-2.5 py-1 text-xs border border-slate-300 rounded hover:bg-slate-50 text-slate-700"
                      onClick={() => setSelectedMeeting(m)}
                    >
                      👁️ Xem Chi Tiết
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      )}

      {/* TAB 3: QUẢN LÝ ĐẦU VIỆC (TASK BOARD) */}
      {activeTab === 'dau_viec' && (
        <div className="space-y-4">
          <Card className="p-4 shadow-sm border border-slate-200">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2 flex-1 min-w-[280px]">
                <input
                  type="text"
                  placeholder="Tìm kiếm công việc, người phụ trách..."
                  value={searchKeyword}
                  onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchKeyword(e.target.value)}
                  className="w-full text-xs p-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                />
              </div>

              <div className="flex items-center gap-2 text-xs">
                <span className="text-slate-500">Ưu tiên:</span>
                <select
                  value={filterPriority}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => setFilterPriority(e.target.value)}
                  className="border border-slate-200 rounded px-2 py-1 text-xs"
                >
                  <option value="all">Tất cả</option>
                  <option value="Cao">Cao</option>
                  <option value="Trung bình">Trung bình</option>
                  <option value="Thấp">Thấp</option>
                </select>

                <span className="text-slate-500 ml-2">Trạng thái:</span>
                <select
                  value={filterStatus}
                  onChange={(e: ChangeEvent<HTMLSelectElement>) => setFilterStatus(e.target.value)}
                  className="border border-slate-200 rounded px-2 py-1 text-xs"
                >
                  <option value="all">Tất cả</option>
                  <option value="Chưa bắt đầu">Chưa bắt đầu</option>
                  <option value="Đang làm">Đang làm</option>
                  <option value="Hoàn thành">Hoàn thành</option>
                </select>
              </div>
            </div>
          </Card>

          <Card className="p-5 shadow-sm border border-slate-200">
            <div className="overflow-x-auto">
              <table className="min-w-full text-left text-xs divide-y divide-slate-200">
                <thead className="bg-slate-100 text-slate-700 font-semibold">
                  <tr>
                    <th className="px-3 py-2.5 w-12 text-center">Xong</th>
                    <th className="px-3 py-2.5">Nhiệm vụ / Đầu việc</th>
                    <th className="px-3 py-2.5 w-44">Người phụ trách</th>
                    <th className="px-3 py-2.5 w-32">Hạn chót (Deadline)</th>
                    <th className="px-3 py-2.5 w-24">Mức độ</th>
                    <th className="px-3 py-2.5 w-28">Trạng thái</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredTasks.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="text-center py-10 text-slate-400">
                        Không tìm thấy đầu việc nào phù hợp bộ lọc.
                      </td>
                    </tr>
                  ) : (
                    filteredTasks.map((t) => (
                      <tr key={t.task_id} className="hover:bg-slate-50">
                        <td className="px-3 py-2.5 text-center">
                          <input
                            type="checkbox"
                            checked={t.trang_thai === 'Hoàn thành'}
                            onChange={() => handleToggleTaskStatus(t.task_id, t.trang_thai)}
                            className="h-4 w-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500 cursor-pointer"
                          />
                        </td>
                        <td className="px-3 py-2.5 font-medium text-slate-800">
                          <span className={t.trang_thai === 'Hoàn thành' ? 'line-through text-slate-400' : ''}>
                            {t.tieu_de}
                          </span>
                        </td>
                        <td className="px-3 py-2.5 text-slate-700">
                          <div className="flex items-center gap-1.5">
                            <span>👤</span>
                            <span>{t.nguoi_phu_trach}</span>
                          </div>
                        </td>
                        <td className="px-3 py-2.5 text-slate-600">
                          {t.deadline ? (
                            <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded">
                              {t.deadline}
                            </span>
                          ) : (
                            <span className="text-slate-400 italic">Chưa đặt</span>
                          )}
                        </td>
                        <td className="px-3 py-2.5">
                          <Badge
                            tone={
                              t.muc_do_uu_tien === 'Cao'
                                ? 'red'
                                : t.muc_do_uu_tien === 'Trung bình'
                                ? 'amber'
                                : 'slate'
                            }
                          >
                            {t.muc_do_uu_tien}
                          </Badge>
                        </td>
                        <td className="px-3 py-2.5">
                          <Badge tone={t.trang_thai === 'Hoàn thành' ? 'emerald' : 'blue'}>
                            {t.trang_thai}
                          </Badge>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Datalist gợi ý nhanh 18 nhân sự chính thức của CECICS */}
      <datalist id="staff-list">
        {officialStaffList.map((s, idx) => (
          <option key={idx} value={s.ho_ten}>
            {s.ho_ten} ({s.role})
          </option>
        ))}
      </datalist>

      {/* Modal xem chi tiết biên bản */}
      {selectedMeeting && (
        <Modal
          open={!!selectedMeeting}
          title={selectedMeeting.tieu_de}
          onClose={() => setSelectedMeeting(null)}
        >
          <div className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
            <div className="text-xs text-slate-500 border-b pb-2 flex justify-between items-center">
              <div>
                <p>📅 Ngày: {selectedMeeting.ngay_hop} | 👤 Chủ trì: {selectedMeeting.chu_tri}</p>
                <p>✍️ Thư ký: {selectedMeeting.thu_ky}</p>
              </div>
              <button
                type="button"
                className="px-2.5 py-1 text-xs border border-slate-300 rounded hover:bg-slate-100"
                onClick={() => setSelectedMeeting(null)}
              >
                Đóng
              </button>
            </div>
            <pre className="text-xs font-mono bg-slate-50 p-3 rounded border border-slate-200 whitespace-pre-wrap">
              {selectedMeeting.noi_dung_md}
            </pre>
          </div>
        </Modal>
      )}
    </div>
  );
}
