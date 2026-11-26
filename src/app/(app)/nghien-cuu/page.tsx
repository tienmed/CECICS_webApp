'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { type ResearchProject } from '@/lib/research-projects';
import { type SimulationArticle, type SimulationConference } from '@/lib/simulation-crawler';
import { useApp } from '@/components/AppProvider';

export default function ResearchPage() {
  const { user } = useApp();
  const [activeTab, setActiveTab] = useState<'PROJECTS' | 'CONFERENCES' | 'ARTICLES'>('PROJECTS');
  const [loading, setLoading] = useState(true);
  const [projects, setProjects] = useState<ResearchProject[]>([]);
  const [conferences, setConferences] = useState<SimulationConference[]>([]);
  const [articles, setArticles] = useState<SimulationArticle[]>([]);
  
  // Filter state
  const [projectSearch, setProjectSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [confScope, setConfScope] = useState<'ALL' | 'INTERNATIONAL' | 'DOMESTIC'>('ALL');

  // Modal thêm/sửa đề tài
  const [showModal, setShowModal] = useState(false);
  const [editingProject, setEditingProject] = useState<Partial<ResearchProject>>({
    ten_de_tai: '',
    chu_nhiem: user?.ho_ten || '',
    email_chu_nhiem: user?.email || '',
    bo_mon_phoi_hop: 'Trung tâm CECICS',
    trang_thai: 'Ý tưởng',
    thoi_gian_bat_dau: new Date().toISOString().split('T')[0],
    thoi_gian_du_kien_hoan_thanh: '',
    tom_tat_muc_tieu: '',
    linh_vuc: 'Y khoa Mô phỏng & Giáo dục Y học',
    file_bao_cao_url: '',
  });

  const fetchData = async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/research');
      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects || []);
        setConferences(data.conferences || []);
        setArticles(data.articles || []);
      }
    } catch (err) {
      console.error('Lỗi nạp dữ liệu nghiên cứu:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleSaveProject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingProject.ten_de_tai || !editingProject.chu_nhiem) {
      alert('Vui lòng nhập tên đề tài và chủ nhiệm đề tài!');
      return;
    }

    try {
      const res = await fetch('/api/research', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingProject),
      });

      if (res.ok) {
        const data = await res.json();
        setProjects(data.projects);
        setShowModal(false);
        setEditingProject({
          ten_de_tai: '',
          chu_nhiem: user?.ho_ten || '',
          email_chu_nhiem: user?.email || '',
          bo_mon_phoi_hop: 'Trung tâm CECICS',
          trang_thai: 'Ý tưởng',
          thoi_gian_bat_dau: new Date().toISOString().split('T')[0],
          thoi_gian_du_kien_hoan_thanh: '',
          tom_tat_muc_tieu: '',
          linh_vuc: 'Y khoa Mô phỏng & Giáo dục Y học',
          file_bao_cao_url: '',
        });
      } else {
        alert('Có lỗi xảy ra khi lưu đề tài');
      }
    } catch (err) {
      console.error(err);
      alert('Lỗi kết nối máy chủ');
    }
  };

  // Lọc đề tài
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      const matchSearch =
        p.ten_de_tai.toLowerCase().includes(projectSearch.toLowerCase()) ||
        p.chu_nhiem.toLowerCase().includes(projectSearch.toLowerCase()) ||
        p.bo_mon_phoi_hop.toLowerCase().includes(projectSearch.toLowerCase());
      const matchStatus = statusFilter === 'ALL' || p.trang_thai === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [projects, projectSearch, statusFilter]);

  // Lọc hội nghị
  const filteredConferences = useMemo(() => {
    return conferences.filter((c) => {
      if (confScope === 'ALL') return true;
      const isDomestic =
        c.location.includes('Việt Nam') ||
        c.location.includes('TP. Hồ Chí Minh') ||
        c.location.includes('Hà Nội') ||
        c.organizer.includes('Việt Nam') ||
        c.organizer.includes('Phạm Ngọc Thạch');
      return confScope === 'DOMESTIC' ? isDomestic : !isDomestic;
    });
  }, [conferences, confScope]);

  return (
    <div className="space-y-6">
      {/* Header Phân hệ */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b pb-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800 flex items-center gap-2">
            <span>🔬</span> Đơn Vị Nghiên Cứu CECICS & Cổng Hội Nghị Y Khoa
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            Theo dõi danh mục đề tài khoa học nội bộ, cập nhật hội nghị giáo dục mô phỏng trong nước & quốc tế, và y văn PubMed/Europe PMC.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setEditingProject({
                ten_de_tai: '',
                chu_nhiem: user?.ho_ten || '',
                email_chu_nhiem: user?.email || '',
                bo_mon_phoi_hop: 'Trung tâm CECICS',
                trang_thai: 'Ý tưởng',
                thoi_gian_bat_dau: new Date().toISOString().split('T')[0],
                thoi_gian_du_kien_hoan_thanh: '',
                tom_tat_muc_tieu: '',
                linh_vuc: 'Y khoa Mô phỏng & Giáo dục Y học',
                file_bao_cao_url: '',
              });
              setShowModal(true);
            }}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-semibold flex items-center gap-2 shadow-sm transition"
          >
            <span>➕</span> Đăng ký Đề tài Mới
          </button>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('PROJECTS')}
          className={`py-3 px-5 text-sm font-semibold border-b-2 flex items-center gap-2 transition ${
            activeTab === 'PROJECTS'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <span>📋</span> Đề tài Nội bộ CECICS ({projects.length})
        </button>
        <button
          onClick={() => setActiveTab('CONFERENCES')}
          className={`py-3 px-5 text-sm font-semibold border-b-2 flex items-center gap-2 transition ${
            activeTab === 'CONFERENCES'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <span>🌐</span> Hội Nghị Trong Nước & Quốc Tế ({conferences.length})
        </button>
        <button
          onClick={() => setActiveTab('ARTICLES')}
          className={`py-3 px-5 text-sm font-semibold border-b-2 flex items-center gap-2 transition ${
            activeTab === 'ARTICLES'
              ? 'border-emerald-600 text-emerald-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          <span>📚</span> Y Văn Mô Phỏng Thời Gian Thực ({articles.length})
        </button>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="p-12 text-center text-slate-400">
          <div className="animate-spin inline-block w-8 h-8 border-4 border-current border-t-transparent text-emerald-600 rounded-full mb-2"></div>
          <p className="text-sm">Đang tải dữ liệu nghiên cứu và cập nhật hội nghị...</p>
        </div>
      )}

      {!loading && activeTab === 'PROJECTS' && (
        <div className="space-y-4">
          {/* Controls lọc */}
          <div className="flex flex-col sm:flex-row gap-3 justify-between">
            <input
              type="text"
              placeholder="Tìm kiếm đề tài, chủ nhiệm, bộ môn..."
              value={projectSearch}
              onChange={(e) => setProjectSearch(e.target.value)}
              className="px-3 py-2 border rounded-lg text-sm w-full sm:w-80 bg-white"
            />
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500 font-medium">Trạng thái:</span>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border rounded-lg text-sm bg-white"
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="Ý tưởng">💡 Ý tưởng</option>
                <option value="Đang thực hiện">⚙️ Đang thực hiện</option>
                <option value="Đã nghiệm thu">✅ Đã nghiệm thu</option>
                <option value="Đã công bố (Bài báo/Hội nghị)">📢 Đã công bố</option>
              </select>
            </div>
          </div>

          {/* Danh sách đề tài */}
          <div className="grid grid-cols-1 gap-4">
            {filteredProjects.map((proj) => (
              <div
                key={proj.id}
                className="p-5 border rounded-xl bg-white shadow-sm hover:border-emerald-300 transition space-y-3"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-mono font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded border">
                      {proj.id}
                    </span>
                    <span
                      className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                        proj.trang_thai === 'Đã nghiệm thu'
                          ? 'bg-emerald-100 text-emerald-800'
                          : proj.trang_thai === 'Đang thực hiện'
                          ? 'bg-blue-100 text-blue-800'
                          : proj.trang_thai === 'Đã công bố (Bài báo/Hội nghị)'
                          ? 'bg-purple-100 text-purple-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {proj.trang_thai}
                    </span>
                    <span className="text-xs text-slate-400 font-medium">Lĩnh vực: {proj.linh_vuc}</span>
                  </div>
                  <div className="text-xs text-slate-400">
                    Bắt đầu: {proj.thoi_gian_bat_dau} | Dự kiến: {proj.thoi_gian_du_kien_hoan_thanh || 'Chưa định'}
                  </div>
                </div>

                <h3 className="text-base font-semibold text-slate-800 leading-snug">{proj.ten_de_tai}</h3>
                <p className="text-sm text-slate-600">{proj.tom_tat_muc_tieu}</p>

                <div className="flex flex-wrap items-center justify-between text-xs text-slate-500 pt-2 border-t gap-2">
                  <div className="flex items-center gap-4">
                    <span>
                      👤 <strong>Chủ nhiệm:</strong> {proj.chu_nhiem} ({proj.email_chu_nhiem})
                    </span>
                    <span>
                      🏥 <strong>Phối hợp:</strong> {proj.bo_mon_phoi_hop}
                    </span>
                  </div>
                  <div>
                    <button
                      onClick={() => {
                        setEditingProject(proj);
                        setShowModal(true);
                      }}
                      className="text-emerald-600 hover:text-emerald-700 font-medium"
                    >
                      ✏️ Cập nhật tiến độ
                    </button>
                  </div>
                </div>
              </div>
            ))}

            {filteredProjects.length === 0 && (
              <div className="p-8 text-center text-slate-400 border border-dashed rounded-xl">
                Không có đề tài nghiên cứu nào phù hợp điều kiện lọc.
              </div>
            )}
          </div>
        </div>
      )}

      {!loading && activeTab === 'CONFERENCES' && (
        <div className="space-y-4">
          {/* Controls phạm vi */}
          <div className="flex items-center justify-between">
            <div className="flex gap-2">
              <button
                onClick={() => setConfScope('ALL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                  confScope === 'ALL' ? 'bg-slate-800 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Tất cả ({conferences.length})
              </button>
              <button
                onClick={() => setConfScope('INTERNATIONAL')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                  confScope === 'INTERNATIONAL'
                    ? 'bg-blue-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Quốc tế (IMSH, SESAM, ASPiH, ASPE...)
              </button>
              <button
                onClick={() => setConfScope('DOMESTIC')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                  confScope === 'DOMESTIC'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
              >
                Trong nước (VAME, PNTU, Sim-Summit...)
              </button>
            </div>
            <span className="text-xs text-slate-400">100% Cổng thông tin chính thức đã xác minh kết nối</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredConferences.map((conf) => (
              <div
                key={conf.id}
                className="p-5 border rounded-xl bg-white shadow-sm flex flex-col justify-between hover:border-blue-300 transition"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-blue-600 uppercase tracking-wider">{conf.organizer}</span>
                    <span className="text-xs px-2 py-0.5 rounded bg-blue-50 text-blue-700 font-medium">
                      📅 {conf.dates}
                    </span>
                  </div>
                  <h3 className="text-base font-semibold text-slate-800">{conf.name}</h3>
                  <p className="text-xs text-slate-500">📍 Địa điểm: {conf.location}</p>
                  <p className="text-sm text-slate-600 mt-2">{conf.themeOrHighlights}</p>

                  {conf.callForPapersDeadline && (
                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                      <strong>📢 Hạn Nộp Báo Cáo (Call for Abstracts):</strong> {conf.callForPapersDeadline}
                    </div>
                  )}

                  <div className="p-2.5 bg-slate-50 border rounded-lg text-xs text-slate-700">
                    <strong>🎯 Hướng Nghiên cứu CECICS:</strong> {conf.researchFocusForCECICS}
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t flex justify-end">
                  <a
                    href={conf.website}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1"
                  >
                    Xem Cổng Hội Nghị Chính Thức ↗
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {!loading && activeTab === 'ARTICLES' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">
              Các công trình nghiên cứu y học mô phỏng mới nhất truy xuất trực tiếp từ <strong>Europe PMC REST API</strong> (100% DOI & PMID thực tế).
            </p>
            <span className="text-xs px-2.5 py-1 bg-emerald-50 text-emerald-700 font-medium rounded-full">
              Live Feed
            </span>
          </div>

          <div className="space-y-3">
            {articles.map((art) => (
              <div key={art.id} className="p-4 border rounded-xl bg-white shadow-sm space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                    {art.source}
                  </span>
                  <span className="text-xs text-slate-400">{art.pubDate}</span>
                </div>
                <h4 className="text-sm font-semibold text-slate-800">{art.title}</h4>
                <p className="text-xs text-slate-600 italic">Tác giả: {art.authors.join(', ')}</p>
                <p className="text-xs text-slate-500">{art.abstract}</p>
                <div className="flex items-center justify-between pt-2 border-t text-xs">
                  <div className="flex gap-2">
                    {art.categories.map((c) => (
                      <span key={c} className="bg-slate-100 text-slate-600 px-2 py-0.5 rounded text-[11px]">
                        {c}
                      </span>
                    ))}
                  </div>
                  <a
                    href={art.url}
                    target="_blank"
                    rel="noreferrer"
                    className="font-medium text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
                  >
                    Đọc toàn văn ↗
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal Đăng ký/Cập nhật đề tài */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b pb-3">
              <h3 className="font-bold text-slate-800 text-lg">
                {editingProject.id ? 'Cập Nhật Tiến Độ Đề Tài' : 'Đăng Ký Đề Tài Nghiên Cứu Mới'}
              </h3>
              <button
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-600 text-xl font-bold"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleSaveProject} className="space-y-4 text-sm">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Tên Đề Tài Nghiên Cứu *</label>
                <textarea
                  rows={2}
                  required
                  value={editingProject.ten_de_tai || ''}
                  onChange={(e) => setEditingProject({ ...editingProject, ten_de_tai: e.target.value })}
                  placeholder="Ví dụ: Đánh giá hiệu quả mô phỏng trong cấp cứu ngừng tim..."
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Chủ Nhiệm Đề Tài *</label>
                  <input
                    type="text"
                    required
                    value={editingProject.chu_nhiem || ''}
                    onChange={(e) => setEditingProject({ ...editingProject, chu_nhiem: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Email Công Vụ</label>
                  <input
                    type="email"
                    value={editingProject.email_chu_nhiem || ''}
                    onChange={(e) => setEditingProject({ ...editingProject, email_chu_nhiem: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Bộ Môn / Đơn Vị Phối Hợp</label>
                  <input
                    type="text"
                    value={editingProject.bo_mon_phoi_hop || ''}
                    onChange={(e) => setEditingProject({ ...editingProject, bo_mon_phoi_hop: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Trạng Thái Đề Tài</label>
                  <select
                    value={editingProject.trang_thai || 'Ý tưởng'}
                    onChange={(e) =>
                      setEditingProject({
                        ...editingProject,
                        trang_thai: e.target.value as ResearchProject['trang_thai'],
                      })
                    }
                    className="w-full px-3 py-2 border rounded-lg bg-white"
                  >
                    <option value="Ý tưởng">💡 Ý tưởng</option>
                    <option value="Đang thực hiện">⚙️ Đang thực hiện</option>
                    <option value="Đã nghiệm thu">✅ Đã nghiệm thu</option>
                    <option value="Đã công bố (Bài báo/Hội nghị)">📢 Đã công bố</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Ngày Bắt Đầu</label>
                  <input
                    type="date"
                    value={editingProject.thoi_gian_bat_dau || ''}
                    onChange={(e) => setEditingProject({ ...editingProject, thoi_gian_bat_dau: e.target.value })}
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Dự Kiến Hoàn Thành</label>
                  <input
                    type="date"
                    value={editingProject.thoi_gian_du_kien_hoan_thanh || ''}
                    onChange={(e) =>
                      setEditingProject({ ...editingProject, thoi_gian_du_kien_hoan_thanh: e.target.value })
                    }
                    className="w-full px-3 py-2 border rounded-lg"
                  />
                </div>
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Tóm Tắt Mục Tiêu & Phương Pháp</label>
                <textarea
                  rows={3}
                  value={editingProject.tom_tat_muc_tieu || ''}
                  onChange={(e) => setEditingProject({ ...editingProject, tom_tat_muc_tieu: e.target.value })}
                  placeholder="Mô tả ngắn gọn về thiết kế nghiên cứu, quy mô mẫu và các chỉ số đo lường..."
                  className="w-full px-3 py-2 border rounded-lg"
                />
              </div>

              <div className="flex justify-end gap-2 pt-3 border-t">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border rounded-lg text-slate-600 hover:bg-slate-50 font-medium"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold shadow-sm"
                >
                  Lưu Đề Tài
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
