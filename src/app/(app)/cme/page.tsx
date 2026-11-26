'use client';

import React, { useState } from 'react';
import { useApp } from '@/components/AppProvider';
import { Modal } from '@/components/ui';

export default function CmeAdminPage() {
  const { db, refresh, user, execute } = useApp();
  const [activeTab, setActiveTab] = useState<'courses' | 'registrations' | 'legacy_import' | 'assessments' | 'settlement'>('courses');

  // Filter
  const [selectedCourseId, setSelectedCourseId] = useState<string>('ALL');

  // Modal tạo mới / nhân bản khóa học CME
  const [courseModalOpen, setCourseModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'create' | 'clone' | 'edit'>('create');
  const [sourceCourseForClone, setSourceCourseForClone] = useState<any>(null);

  const initialCourseForm = {
    course_id: '',
    ma_khoa: '',
    ten_khoa: '',
    doi_tuong: 'Bác sĩ, Điều dưỡng, Nhân viên y tế',
    so_tiet_cme: 16,
    hoc_phi: 2500000,
    chi_tieu: 30,
    ngay_khai_giang: '',
    ngay_be_giang: '',
    han_dang_ky: '',
    campus_id: 'HH',
    phong_hoc_mac_dinh: '',
    giang_vien_chu_nhiem: '',
    noi_dung_tom_tat: '',
    trang_thai: 'OPEN',
  };
  const [courseForm, setCourseForm] = useState(initialCourseForm);

  // Legacy import form
  const [legacyJson, setLegacyJson] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any | null>(null);

  // Gửi thông báo & đồng bộ Google Calendar
  const [notifying, setNotifying] = useState(false);
  const [notifyModalOpen, setNotifyModalOpen] = useState(false);
  const [selectedCourseForNotify, setSelectedCourseForNotify] = useState<any>(null);
  const [selectedRegIdsForNotify, setSelectedRegIdsForNotify] = useState<string[]>([]);
  const [customNotifyMessage, setCustomNotifyMessage] = useState('');
  const [notifySuccessMsg, setNotifySuccessMsg] = useState('');

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

  // Mở modal tạo mới khóa học
  const handleOpenCreateCourse = () => {
    setModalMode('create');
    setSourceCourseForClone(null);
    const year = new Date().getFullYear();
    const count = courses.length + 1;
    const generatedCode = `CME-${year}-${count < 10 ? '0' + count : count}`;
    setCourseForm({
      ...initialCourseForm,
      course_id: generatedCode,
      ma_khoa: generatedCode,
    });
    setCourseModalOpen(true);
  };

  // Mở modal nhân bản / tái sử dụng nội dung khóa cũ mở khóa mới
  const handleOpenCloneCourse = (source: any) => {
    setModalMode('clone');
    setSourceCourseForClone(source);
    const year = new Date().getFullYear();
    
    // Tự sinh mã khóa mới kế thừa nhưng phân biệt rõ ràng
    let newCode = `${source.ma_khoa || source.course_id}-K2`;
    const matchK = (source.ma_khoa || source.course_id).match(/^(.*)-K(\d+)$/i);
    if (matchK) {
      const nextNum = parseInt(matchK[2], 10) + 1;
      newCode = `${matchK[1]}-K${nextNum}`;
    } else if (source.ma_khoa && source.ma_khoa.includes(`${year}`)) {
      newCode = `${source.ma_khoa}-L2`;
    }

    setCourseForm({
      ...initialCourseForm,
      course_id: newCode,
      ma_khoa: newCode,
      ten_khoa: `${source.ten_khoa} (Khóa mới)`,
      doi_tuong: source.doi_tuong || initialCourseForm.doi_tuong,
      so_tiet_cme: Number(source.so_tiet_cme || 16),
      hoc_phi: Number(source.hoc_phi || 2500000),
      chi_tieu: Number(source.chi_tieu || 30),
      campus_id: source.campus_id || 'HH',
      phong_hoc_mac_dinh: source.phong_hoc_mac_dinh || '',
      giang_vien_chu_nhiem: source.giang_vien_chu_nhiem || '',
      noi_dung_tom_tat: source.noi_dung_tom_tat || '',
      ngay_khai_giang: '',
      ngay_be_giang: '',
      han_dang_ky: '',
      trang_thai: 'OPEN',
    });
    setCourseModalOpen(true);
  };

  // Mở modal chỉnh sửa khóa hiện tại
  const handleOpenEditCourse = (course: any) => {
    setModalMode('edit');
    setSourceCourseForClone(null);
    setCourseForm({
      course_id: course.course_id,
      ma_khoa: course.ma_khoa || course.course_id,
      ten_khoa: course.ten_khoa,
      doi_tuong: course.doi_tuong || initialCourseForm.doi_tuong,
      so_tiet_cme: Number(course.so_tiet_cme || 16),
      hoc_phi: Number(course.hoc_phi || 0),
      chi_tieu: Number(course.chi_tieu || 30),
      ngay_khai_giang: course.ngay_khai_giang || '',
      ngay_be_giang: course.ngay_be_giang || '',
      han_dang_ky: course.han_dang_ky || '',
      campus_id: course.campus_id || 'HH',
      phong_hoc_mac_dinh: course.phong_hoc_mac_dinh || '',
      giang_vien_chu_nhiem: course.giang_vien_chu_nhiem || '',
      noi_dung_tom_tat: course.noi_dung_tom_tat || '',
      trang_thai: course.trang_thai || 'OPEN',
    });
    setCourseModalOpen(true);
  };

  // Xử lý lưu khóa học (Tạo mới / Nhân bản / Sửa)
  const handleSaveCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseForm.course_id.trim() || !courseForm.ten_khoa.trim()) {
      alert('Vui lòng nhập Mã khóa và Tên khóa đào tạo CME.');
      return;
    }

    const payload = {
      ...courseForm,
      thoi_khoa_bieu_json: sourceCourseForClone?.thoi_khoa_bieu_json || '[]',
      ngan_hang_cau_hoi_pretest_json: sourceCourseForClone?.ngan_hang_cau_hoi_pretest_json || '[]',
      ngan_hang_cau_hoi_posttest_json: sourceCourseForClone?.ngan_hang_cau_hoi_posttest_json || '[]',
    };

    const res = await execute(
      'upsertCmeCourse',
      payload,
      modalMode === 'clone'
        ? `Đã nhân bản và mở lớp mới "${courseForm.ten_khoa}" (${courseForm.ma_khoa}) thành công từ khóa cũ.`
        : modalMode === 'edit'
        ? `Đã cập nhật thông tin khóa "${courseForm.ten_khoa}".`
        : `Đã tạo khóa đào tạo CME mới "${courseForm.ten_khoa}" (${courseForm.ma_khoa}) thành công.`
    );

    if (res && res.ok) {
      setCourseModalOpen(false);
      await refresh();
    }
  };

  // Mở modal gửi thông báo lịch học
  const handleOpenNotifyModal = (course: any, regId?: string) => {
    setSelectedCourseForNotify(course);
    if (regId) {
      setSelectedRegIdsForNotify([regId]);
    } else {
      // Gửi cho tất cả học viên đã duyệt/chuyển khoản của khóa
      const regs = registrations
        .filter((r) => r.course_id === course.course_id && (r.trang_thai === 'DA_DUYET' || r.trang_thai === 'DA_CHUYEN_KHOAN'))
        .map((r) => r.reg_id);
      setSelectedRegIdsForNotify(regs);
    }
    setCustomNotifyMessage('');
    setNotifySuccessMsg('');
    setNotifyModalOpen(true);
  };

  // Thực thi gửi thông báo lịch học & file .ics
  const handleSendSchedule = async () => {
    if (!selectedCourseForNotify) return;
    setNotifying(true);
    setNotifySuccessMsg('');
    try {
      const res = await fetch('/api/cme/notify-schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          course_id: selectedCourseForNotify.course_id,
          registration_ids: selectedRegIdsForNotify,
          custom_message: customNotifyMessage,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gửi lịch học thất bại');
      setNotifySuccessMsg(data.message || 'Đã gửi thông báo lịch học thành công.');
    } catch (err: any) {
      alert('Lỗi: ' + err.message);
    } finally {
      setNotifying(false);
    }
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
          <button
            type="button"
            onClick={handleOpenCreateCourse}
            className="px-3.5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white rounded-xl text-xs font-semibold flex items-center space-x-1.5 shadow-sm transition"
          >
            <span>➕</span>
            <span>Tạo Khóa CME Mới</span>
          </button>
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

              <div className="pt-2 flex items-center justify-between border-t border-slate-100">
                <div className="flex items-center space-x-1.5">
                  <button
                    type="button"
                    onClick={() => handleOpenCloneCourse(c)}
                    className="px-2.5 py-1 text-xs bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-lg font-medium flex items-center gap-1 shadow-sm transition"
                    title="1-Click Mở lại khóa từ khóa cũ: Kế thừa nội dung, giáo trình, ngân hàng test và phòng học"
                  >
                    <span>📑</span>
                    <span>Mở Lại Khóa Cũ</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenNotifyModal(c)}
                    className="px-2.5 py-1 text-xs bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-300 rounded-lg font-medium flex items-center gap-1 shadow-sm transition"
                    title="Gửi email thông báo thời khóa biểu & tệp iCalendar (.ics) đồng bộ Google Calendar cho học viên"
                  >
                    <span>📅</span>
                    <span>Gửi Lịch Học</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenEditCourse(c)}
                    className="px-2 py-1 text-xs bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200 rounded-lg font-medium"
                    title="Chỉnh sửa thông tin khóa học"
                  >
                    Sửa
                  </button>
                </div>
                <a
                  href={`/cme/dang-ky?courseId=${c.course_id}`}
                  target="_blank"
                  className="px-3 py-1.5 text-xs bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 rounded-lg font-medium flex items-center gap-1"
                >
                  <span>Link Đăng Ký</span>
                  <span>↗</span>
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

      {/* Modal Tạo Mới / Nhân Bản Khóa Học CME */}
      <Modal
        open={courseModalOpen}
        onClose={() => setCourseModalOpen(false)}
        title={
          modalMode === 'clone'
            ? `Nhân Bản Khóa Học & Mở Lớp Mới (Kế thừa từ ${sourceCourseForClone?.ma_khoa})`
            : modalMode === 'edit'
            ? `Cập Nhật Thông Tin Khóa Học (${courseForm.ma_khoa})`
            : 'Tạo Khóa Đào Tạo CME Mới'
        }
        maxWidth="max-w-2xl"
      >
        <form onSubmit={handleSaveCourse} className="space-y-4">
          {modalMode === 'clone' && (
            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 leading-relaxed">
              💡 <strong>Tái sử dụng nội dung:</strong> Toàn bộ số tiết CME, mức học phí, đối tượng, giảng viên chủ nhiệm và ngân hàng câu hỏi pre/post-test của khóa cũ đã được kế thừa tự động. Hãy điều chỉnh <strong>Mã khóa</strong> và <strong>Thời gian khai giảng</strong> để phân biệt lớp mới.
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Mã khóa học (Duy nhất) *
              </label>
              <input
                type="text"
                required
                value={courseForm.ma_khoa}
                onChange={(e) =>
                  setCourseForm({
                    ...courseForm,
                    ma_khoa: e.target.value,
                    course_id: e.target.value,
                  })
                }
                placeholder="VD: CME-2026-ACLS-K2"
                className="w-full text-xs font-mono border border-slate-300 rounded-lg p-2 focus:ring-teal-500 focus:border-teal-500"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Trạng thái tuyển sinh *
              </label>
              <select
                value={courseForm.trang_thai}
                onChange={(e) => setCourseForm({ ...courseForm, trang_thai: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:ring-teal-500 focus:border-teal-500"
              >
                <option value="OPEN">Đang mở tuyển sinh (OPEN)</option>
                <option value="IN_PROGRESS">Đang đào tạo (IN_PROGRESS)</option>
                <option value="COMPLETED">Đã kết thúc (COMPLETED)</option>
                <option value="CLOSED">Đóng tuyển sinh (CLOSED)</option>
              </select>
            </div>
          </div>

          <div className="text-xs">
            <label className="block font-semibold text-slate-700 mb-1">
              Tên khóa đào tạo liên tục (CME) *
            </label>
            <input
              type="text"
              required
              value={courseForm.ten_khoa}
              onChange={(e) => setCourseForm({ ...courseForm, ten_khoa: e.target.value })}
              placeholder="VD: Cấp cứu Tim mạch nâng cao (ACLS) - Khóa 2"
              className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:ring-teal-500 focus:border-teal-500 font-medium"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Số tiết CME tích lũy *
              </label>
              <input
                type="number"
                min={1}
                max={120}
                required
                value={courseForm.so_tiet_cme}
                onChange={(e) =>
                  setCourseForm({ ...courseForm, so_tiet_cme: Number(e.target.value) || 16 })
                }
                className="w-full text-xs border border-slate-300 rounded-lg p-2"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Mức học phí (VNĐ) *
              </label>
              <input
                type="number"
                min={0}
                step={50000}
                required
                value={courseForm.hoc_phi}
                onChange={(e) =>
                  setCourseForm({ ...courseForm, hoc_phi: Number(e.target.value) || 0 })
                }
                className="w-full text-xs border border-slate-300 rounded-lg p-2"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Chỉ tiêu tuyển sinh (Học viên) *
              </label>
              <input
                type="number"
                min={1}
                max={200}
                required
                value={courseForm.chi_tieu}
                onChange={(e) =>
                  setCourseForm({ ...courseForm, chi_tieu: Number(e.target.value) || 30 })
                }
                className="w-full text-xs border border-slate-300 rounded-lg p-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Hạn đăng ký
              </label>
              <input
                type="date"
                value={courseForm.han_dang_ky}
                onChange={(e) => setCourseForm({ ...courseForm, han_dang_ky: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg p-2"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Ngày khai giảng
              </label>
              <input
                type="date"
                value={courseForm.ngay_khai_giang}
                onChange={(e) => setCourseForm({ ...courseForm, ngay_khai_giang: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg p-2"
              />
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Ngày bế giảng
              </label>
              <input
                type="date"
                value={courseForm.ngay_be_giang}
                onChange={(e) => setCourseForm({ ...courseForm, ngay_be_giang: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg p-2"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Cơ sở đào tạo
              </label>
              <select
                value={courseForm.campus_id}
                onChange={(e) => setCourseForm({ ...courseForm, campus_id: e.target.value })}
                className="w-full text-xs border border-slate-300 rounded-lg p-2"
              >
                {db.Campuses.map((c) => (
                  <option key={c.campus_id} value={c.campus_id}>
                    {c.ten} ({c.campus_id})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-semibold text-slate-700 mb-1">
                Giảng viên chủ nhiệm khóa
              </label>
              <input
                type="text"
                value={courseForm.giang_vien_chu_nhiem}
                onChange={(e) => setCourseForm({ ...courseForm, giang_vien_chu_nhiem: e.target.value })}
                placeholder="VD: PGS.TS.BS. Nguyễn Văn A"
                className="w-full text-xs border border-slate-300 rounded-lg p-2"
              />
            </div>
          </div>

          <div className="text-xs">
            <label className="block font-semibold text-slate-700 mb-1">
              Đối tượng chiêu sinh
            </label>
            <input
              type="text"
              value={courseForm.doi_tuong}
              onChange={(e) => setCourseForm({ ...courseForm, doi_tuong: e.target.value })}
              placeholder="VD: Bác sĩ cấp cứu, Bác sĩ hồi sức, Điều dưỡng chuyên khoa..."
              className="w-full text-xs border border-slate-300 rounded-lg p-2"
            />
          </div>

          <div className="text-xs">
            <label className="block font-semibold text-slate-700 mb-1">
              Tóm tắt nội dung khóa học & Mục tiêu đào tạo
            </label>
            <textarea
              rows={3}
              value={courseForm.noi_dung_tom_tat}
              onChange={(e) => setCourseForm({ ...courseForm, noi_dung_tom_tat: e.target.value })}
              placeholder="Mô tả kỹ năng mô phỏng, tình huống lâm sàng thực hành..."
              className="w-full text-xs border border-slate-300 rounded-lg p-2"
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setCourseModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="px-5 py-2 text-xs font-bold bg-teal-700 hover:bg-teal-800 text-white rounded-lg shadow-xs"
            >
              {modalMode === 'clone'
                ? 'Xác Nhận Mở Lớp Tiếp Theo'
                : modalMode === 'edit'
                ? 'Cập Nhật Khóa Học'
                : 'Lưu Khóa Học Mới'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal gửi thông báo lịch học & đồng bộ Google Calendar */}
      <Modal
        isOpen={notifyModalOpen}
        onClose={() => setNotifyModalOpen(false)}
        title={`Đồng Bộ Google Calendar & Thông Báo Lịch Học: ${selectedCourseForNotify?.ten_khoa || ''}`}
      >
        <div className="space-y-4">
          <div className="bg-teal-50 border border-teal-200 p-3 rounded-xl text-xs text-teal-800">
            <p className="font-semibold mb-1">
              📅 Quy tắc đồng bộ Google Calendar duy nhất:
            </p>
            <p>
              Hệ thống tự động <strong>thêm địa chỉ email của học viên vào danh sách Attention / Khách mời (Attendee)</strong> của sự kiện lịch thuộc tài khoản công vụ <strong>cecics@pnt.edu.vn</strong> với cờ <code>sendInvites: false</code>. Lịch học sẽ tự động xuất hiện trên Google Calendar trên điện thoại/máy tính của học viên mà <strong>hoàn toàn không gửi tệp đính kèm .ics hay email rác VEVENT</strong>.
            </p>
          </div>

          <div className="text-xs text-slate-700 space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-200">
            <p>• Khóa học: <strong>{selectedCourseForNotify?.ten_khoa}</strong> ({selectedCourseForNotify?.ma_khoa})</p>
            <p>• Thời lượng: <strong>{selectedCourseForNotify?.so_tiet_cme} tiết CME</strong></p>
            <p>• Khai giảng dự kiến: <strong>{selectedCourseForNotify?.ngay_khai_giang || 'Chưa định'}</strong></p>
            <p>• Số lượng học viên được thêm vào Calendar: <strong className="text-teal-700">{selectedRegIdsForNotify.length} học viên</strong></p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Ghi chú bổ sung gửi kèm cho học viên (nếu có)
            </label>
            <textarea
              rows={3}
              value={customNotifyMessage}
              onChange={(e) => setCustomNotifyMessage(e.target.value)}
              placeholder="VD: Đề nghị học viên mang theo áo blouse trắng và có mặt trước giờ học 15 phút tại phòng A3-401..."
              className="w-full text-xs border border-slate-300 rounded-lg p-2 focus:ring-teal-500 focus:border-teal-500"
            />
          </div>

          {notifySuccessMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-300 rounded-xl text-xs text-emerald-800 font-medium">
              ✅ {notifySuccessMsg}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={() => setNotifyModalOpen(false)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-lg"
            >
              Đóng
            </button>
            <button
              type="button"
              disabled={notifying || selectedRegIdsForNotify.length === 0}
              onClick={handleSendSchedule}
              className="px-5 py-2 text-xs font-bold bg-teal-700 hover:bg-teal-800 text-white rounded-lg shadow-sm transition flex items-center gap-1.5 disabled:opacity-50"
            >
              <span>{notifying ? 'Đang đồng bộ...' : '🚀 Thêm Học Viên Vào Calendar CECICS & Gửi Thông Báo'}</span>
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
