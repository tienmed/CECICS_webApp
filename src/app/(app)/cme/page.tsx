'use client';

import React, { useState } from 'react';
import { useApp } from '@/components/AppProvider';

export default function CmeAdminPage() {
  const { db, refresh, user, execute } = useApp();
  const [activeTab, setActiveTab] = useState<'courses' | 'registrations' | 'legacy_import' | 'assessments' | 'settlement'>('courses');

  // Filter
  const [selectedCourseId, setSelectedCourseId] = useState<string>('ALL');

  // Legacy import form
  const [legacyJson, setLegacyJson] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any | null>(null);

  const courses = db.CmeCourses || [];
  const registrations = db.CmeRegistrations || [];
  const students = db.CmeStudents || [];
  const assessments = db.CmeAssessments || [];
  const settlements = db.CmeSettlements || [];
  const surveys = db.CmeSurveys || [];

  const studentMap = new Map(students.map((s) => [s.student_id, s]));
  const courseMap = new Map(courses.map((c) => [c.course_id, c]));

  // Xử lý import dữ liệu cũ
  const handleImportLegacy = async () => {
    if (!legacyJson.trim()) {
      alert('Vui lòng dán chuỗi JSON dữ liệu khóa cũ.');
      return;
    }
    setImporting(true);
    setImportResult(null);
    try {
      const parsed = JSON.parse(legacyJson);
      const res = await fetch('/api/cme/import-legacy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import thất bại');
      setImportResult(data.result);
      await refresh();
    } catch (err: any) {
      alert('Lỗi import: ' + err.message);
    } finally {
      setImporting(false);
    }
  };

  // Mẫu dữ liệu cũ chuẩn bị sẵn để người dùng ấn nạp nhanh
  const loadSampleLegacyData = () => {
    const sample = {
      courses: [
        {
          course_id: 'CME-2024-CC02',
          ma_khoa: 'CME-2024-CC02',
          ten_khoa: 'Hồi sức cấp cứu Tim mạch & Thần kinh nâng cao 2024',
          so_tiet_cme: 32,
          hoc_phi: 4000000,
          chi_tieu: 30,
          ngay_khai_giang: '2024-08-15',
          ngay_be_giang: '2024-08-18',
          trang_thai: 'COMPLETED',
          giang_vien_chu_nhiem: 'TS.BS. Trần Quốc Bảo',
        }
      ],
      students: [
        {
          student_id: 'STU-079088001122',
          cccd: '079088001122',
          ngay_sinh: '12/12/1988',
          ho_ten: 'BS. Võ Minh Trí',
          don_vi_cong_tac: 'Bệnh viện Chợ Rẫy',
          chuc_danh: 'Bác sĩ Cấp cứu',
          email: 'vminhtri.cr@gmail.com',
          sdt: '0908112233',
          so_cchn: '088112/HCM-CCHN',
        }
      ],
      registrations: [
        {
          reg_id: 'REG-2024-02-01',
          course_id: 'CME-2024-CC02',
          student_id: 'STU-079088001122',
          trang_thai: 'HOAN_THANH',
          so_tien: 4000000,
          so_chung_chi_cme: 'CME-2024-CR-0088',
          ngay_cap_chung_chi: '2024-08-25',
        }
      ],
      assessments: [
        {
          asm_id: 'ASM-2024-02-01',
          course_id: 'CME-2024-CC02',
          student_id: 'STU-079088001122',
          diem_pretest: 6.0,
          diem_posttest: 9.0,
          diem_thuc_hanh: 9.5,
          ket_qua: 'DAT',
          xep_loai: 'XUAT_SAC',
        }
      ]
    };
    setLegacyJson(JSON.stringify(sample, null, 2));
  };

  // Duyệt hồ sơ đăng ký
  const handleReviewReg = async (regId: string, status: string) => {
    try {
      const res = await fetch('/api/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reviewCmeRegistration',
          payload: { reg_id: regId, trang_thai: status },
        }),
      });
      if (!res.ok) throw new Error('Cập nhật thất bại');
      await refresh();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center space-x-2">
            <span className="p-2 bg-teal-100 text-teal-800 rounded-xl">
              🎓
            </span>
            <div>
              <h1 className="text-xl font-bold text-slate-800">Quản Trị Đào Tạo Liên Tục (CME)</h1>
              <p className="text-xs text-slate-500">
                Quy trình đào tạo khép kín: Mở lớp, duyệt học phí, điểm danh, pre/post-test, khảo sát, cấp chứng chỉ và giải chi.
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center space-x-2">
          <a
            href="/cme/dang-ky"
            target="_blank"
            className="px-3.5 py-2 bg-teal-600 hover:bg-teal-700 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 shadow-sm transition"
          >
            <span>Mở Cổng Đăng Ký Học Viên</span>
            <span>↗</span>
          </a>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex space-x-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('courses')}
          className={`px-4 py-2 text-xs font-bold border-b-2 transition ${
            activeTab === 'courses' ? 'border-teal-600 text-teal-800' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Khóa Học ({courses.length})
        </button>
        <button
          onClick={() => setActiveTab('registrations')}
          className={`px-4 py-2 text-xs font-bold border-b-2 transition ${
            activeTab === 'registrations' ? 'border-teal-600 text-teal-800' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Học Viên & Học Phí ({registrations.length})
        </button>
        <button
          onClick={() => setActiveTab('assessments')}
          className={`px-4 py-2 text-xs font-bold border-b-2 transition ${
            activeTab === 'assessments' ? 'border-teal-600 text-teal-800' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Khảo Thí & Đánh Giá ({assessments.length})
        </button>
        <button
          onClick={() => setActiveTab('settlement')}
          className={`px-4 py-2 text-xs font-bold border-b-2 transition ${
            activeTab === 'settlement' ? 'border-teal-600 text-teal-800' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          Nghiệm Thu & Giải Chi ({settlements.length})
        </button>
        <button
          onClick={() => setActiveTab('legacy_import')}
          className={`px-4 py-2 text-xs font-bold border-b-2 transition ${
            activeTab === 'legacy_import' ? 'border-amber-600 text-amber-800' : 'border-transparent text-slate-500 hover:text-slate-700'
          }`}
        >
          📥 Đẩy Dữ Liệu Khóa Cũ (Legacy Import)
        </button>
      </div>

      {/* Tab 1: Khóa học */}
      {activeTab === 'courses' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {courses.map((c) => (
            <div key={c.course_id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200">
                    {c.ma_khoa}
                  </span>
                  <h3 className="text-sm font-bold text-slate-800 mt-1">{c.ten_khoa}</h3>
                </div>
                <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                  c.trang_thai === 'OPEN' ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-700'
                }`}>
                  {c.trang_thai}
                </span>
              </div>

              <p className="text-xs text-slate-600 line-clamp-2">{c.noi_dung_tom_tat}</p>

              <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 pt-2 border-t border-slate-100">
                <div>⏱️ Số tiết: <strong>{c.so_tiet_cme} tiết CME</strong></div>
                <div>💰 Học phí: <strong>{c.hoc_phi.toLocaleString('vi-VN')} đ</strong></div>
                <div>📅 Khai giảng: <strong>{c.ngay_khai_giang || 'Chưa định'}</strong></div>
                <div>👥 Chỉ tiêu: <strong>{c.chi_tieu} học viên</strong></div>
                <div className="col-span-2">👨‍🏫 GV Chủ nhiệm: <strong>{c.giang_vien_chu_nhiem}</strong></div>
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <a
                  href={`/cme/dang-ky?courseId=${c.course_id}`}
                  target="_blank"
                  className="px-3 py-1.5 text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-medium"
                >
                  Link Đăng Ký
                </a>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tab 2: Danh sách đăng ký & Học phí */}
      {activeTab === 'registrations' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          <div className="p-4 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">Danh Sách Học Viên Đăng Ký & Trạng Thái Học Phí</h3>
            <span className="text-xs text-slate-500">Tổng cộng: {registrations.length} học viên</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">Học Viên</th>
                  <th className="p-3">Khóa Học</th>
                  <th className="p-3">Đơn Vị Công Tác</th>
                  <th className="p-3">Số Tiền & Giao Dịch</th>
                  <th className="p-3">Trạng Thái</th>
                  <th className="p-3 text-right">Thao Tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {registrations.map((r) => {
                  const student = studentMap.get(r.student_id);
                  const course = courseMap.get(r.course_id);
                  return (
                    <tr key={r.reg_id} className="hover:bg-slate-50/50">
                      <td className="p-3">
                        <div className="font-bold text-slate-800">{student?.ho_ten || r.student_id}</div>
                        <div className="text-[11px] text-slate-400">CCCD: {student?.cccd} · {student?.sdt}</div>
                      </td>
                      <td className="p-3">
                        <div className="font-medium text-slate-700">{course?.ten_khoa || r.course_id}</div>
                        <div className="text-[11px] text-slate-400">Mã: {r.reg_id}</div>
                      </td>
                      <td className="p-3">
                        <div>{student?.don_vi_cong_tac || 'Chưa cập nhật'}</div>
                        <div className="text-[11px] text-slate-400">{student?.chuc_danh}</div>
                      </td>
                      <td className="p-3">
                        <div className="font-bold text-teal-800">{r.so_tien.toLocaleString('vi-VN')} đ</div>
                        <div className="text-[11px] text-slate-400">GD: {r.ma_giao_dich || 'Chưa có'}</div>
                        {r.minh_chung_ck_url && (
                          <a href={r.minh_chung_ck_url} target="_blank" className="text-[11px] text-teal-600 underline">
                            Xem UNC
                          </a>
                        )}
                      </td>
                      <td className="p-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          r.trang_thai === 'DA_DUYET' || r.trang_thai === 'HOAN_THANH'
                            ? 'bg-emerald-100 text-emerald-800'
                            : r.trang_thai === 'DA_CHUYEN_KHOAN'
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-slate-100 text-slate-700'
                        }`}>
                          {r.trang_thai}
                        </span>
                        {r.so_chung_chi_cme && (
                          <div className="text-[10px] font-semibold text-teal-700 mt-0.5">Số: {r.so_chung_chi_cme}</div>
                        )}
                      </td>
                      <td className="p-3 text-right space-x-1">
                        {r.trang_thai === 'DA_CHUYEN_KHOAN' && (
                          <button
                            onClick={() => handleReviewReg(r.reg_id, 'DA_DUYET')}
                            className="px-2.5 py-1 bg-emerald-600 text-white rounded text-[11px] font-semibold hover:bg-emerald-700"
                          >
                            Duyệt Học Phí
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Khảo thí & Lượng giá */}
      {activeTab === 'assessments' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">Kết Quả Pre-test, Post-test & Lượng Giá Kỹ Năng Lâm Sàng</h3>
            <span className="text-xs text-slate-500">{assessments.length} kết quả</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-slate-600">
              <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-bold border-b border-slate-200">
                <tr>
                  <th className="p-3">Học Viên</th>
                  <th className="p-3">Khóa Học</th>
                  <th className="p-3">Pre-test</th>
                  <th className="p-3">Post-test</th>
                  <th className="p-3">Thực Hành</th>
                  <th className="p-3">Kết Quả</th>
                  <th className="p-3">Xếp Loại</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {assessments.map((a) => {
                  const student = studentMap.get(a.student_id);
                  const course = courseMap.get(a.course_id);
                  return (
                    <tr key={a.asm_id} className="hover:bg-slate-50/50">
                      <td className="p-3 font-bold text-slate-800">{student?.ho_ten || a.student_id}</td>
                      <td className="p-3">{course?.ten_khoa || a.course_id}</td>
                      <td className="p-3 font-semibold text-slate-700">{a.diem_pretest}</td>
                      <td className="p-3 font-semibold text-teal-700">{a.diem_posttest}</td>
                      <td className="p-3 font-semibold text-emerald-700">{a.diem_thuc_hanh}</td>
                      <td className="p-3">
                        <span className={`inline-flex px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          a.ket_qua === 'DAT' ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'
                        }`}>
                          {a.ket_qua}
                        </span>
                      </td>
                      <td className="p-3 font-bold text-slate-700">{a.xep_loai}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 4: Nghiệm thu & Giải chi */}
      {activeTab === 'settlement' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-slate-800">Hồ Sơ Nghiệm Thu & Giải Chi Tài Chính Các Khóa CME</h3>
            <span className="text-xs text-slate-500">{settlements.length} hồ sơ</span>
          </div>

          <div className="space-y-4">
            {settlements.map((s) => {
              const course = courseMap.get(s.course_id);
              return (
                <div key={s.settlement_id} className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3 text-xs text-slate-700">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-teal-100 text-teal-800">
                        {s.settlement_id}
                      </span>
                      <h4 className="text-sm font-bold text-slate-800 mt-1">{course?.ten_khoa || s.course_id}</h4>
                    </div>
                    <span className="px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-800">
                      {s.trang_thai}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-white p-3 rounded-lg border border-slate-200">
                    <div>Tổng thu học phí: <strong className="text-teal-800 block text-sm">{s.tong_thu_hoc_phi.toLocaleString('vi-VN')} đ</strong></div>
                    <div>Thù lao GV & Trợ giảng: <strong className="text-slate-800 block text-sm">{(s.thu_lao_giang_vien + s.thu_lao_tro_giang_ktv).toLocaleString('vi-VN')} đ</strong></div>
                    <div>Vật tư & Tổ chức: <strong className="text-slate-800 block text-sm">{(s.chi_phi_vat_tu + s.chi_phi_to_chuc).toLocaleString('vi-VN')} đ</strong></div>
                    <div>Thực nhận CECICS: <strong className="text-emerald-700 block text-sm">{s.thuc_nhan_cecics.toLocaleString('vi-VN')} đ</strong></div>
                  </div>

                  <p className="text-[11px] text-slate-500">
                    Người lập: {s.nguoi_lap} · Ngày duyệt: {s.ngay_duyet || 'Chưa duyệt'} · Ghi chú: {s.ghi_chu}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Tab 5: Import dữ liệu các khóa cũ */}
      {activeTab === 'legacy_import' && (
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <span className="text-amber-600">📥</span>
                <span>Công Cụ Đẩy Dữ Liệu Các Khóa CME Cũ Vào Hệ Thống</span>
              </h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Cho phép nhập lịch sử các khóa đã đào tạo, danh sách học viên cũ và mã chứng chỉ đã cấp để học viên tra cứu tái sử dụng hồ sơ sau này.
              </p>
            </div>
            <button
              onClick={loadSampleLegacyData}
              className="px-3 py-1.5 bg-amber-50 text-amber-800 border border-amber-300 rounded-lg text-xs font-semibold hover:bg-amber-100"
            >
              Nạp Mẫu Dữ Liệu Khóa Cũ
            </button>
          </div>

          <textarea
            value={legacyJson}
            onChange={(e) => setLegacyJson(e.target.value)}
            rows={10}
            className="w-full text-xs font-mono p-3 border border-slate-300 rounded-xl focus:ring-amber-500 focus:border-amber-500"
            placeholder="Dán JSON chứa { courses, students, registrations, assessments } tại đây..."
          />

          {importResult && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 space-y-1">
              <p className="font-bold">Đã nạp thành công dữ liệu khóa cũ!</p>
              <p>• Số khóa học: {importResult.importedCourses}</p>
              <p>• Số học viên: {importResult.importedStudents}</p>
              <p>• Số lượt đăng ký / cấp chứng chỉ: {importResult.importedRegistrations}</p>
              <p>• Số bảng điểm lượng giá: {importResult.importedAssessments}</p>
            </div>
          )}

          <div className="flex justify-end">
            <button
              onClick={handleImportLegacy}
              disabled={importing}
              className="px-5 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold shadow transition disabled:opacity-50"
            >
              {importing ? 'Đang import dữ liệu...' : 'Bắt Đầu Đẩy Dữ Liệu Khóa Cũ'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
