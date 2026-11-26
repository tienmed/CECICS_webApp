'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { OFFICIAL_CME_BANK, generateCmeTransferMemo, generateVietQrUrl } from '@/lib/cme-utils';

interface Course {
  course_id: string;
  ma_khoa: string;
  ten_khoa: string;
  so_tiet_cme: number;
  hoc_phi: number;
  chi_tieu: number;
  ngay_khai_giang: string;
  ngay_be_giang: string;
  han_dang_ky: string;
  noi_dung_tom_tat: string;
  giang_vien_chu_nhiem: string;
  campus_id?: string;
  phong_hoc_mac_dinh?: string;
}

function CmeRegistrationContent() {
  const searchParams = useSearchParams();
  const defaultCourseId = searchParams.get('courseId') || 'CME-2026-02';

  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState(defaultCourseId);
  const [loadingCourses, setLoadingCourses] = useState(true);

  // Search state
  const [searchCccd, setSearchCccd] = useState('');
  const [searchDob, setSearchDob] = useState('');
  const [searching, setSearching] = useState(false);
  const [searchFound, setSearchFound] = useState<boolean | null>(null);
  const [isLegacyStudent, setIsLegacyStudent] = useState<boolean>(false);
  const [historyRegs, setHistoryRegs] = useState<any[]>([]);

  // Student Form state
  const [formData, setFormData] = useState({
    cccd: '',
    ngay_sinh: '',
    ho_ten: '',
    gioi_tinh: 'Nam',
    don_vi_cong_tac: '',
    chuc_danh: 'Bác sĩ',
    email: '',
    sdt: '',
    dia_chi: '',
    so_cchn: '',
    anh_bang_cap_url: '',
    ma_giao_dich: '',
    minh_chung_ck_url: '',
  });

  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [successResult, setSuccessResult] = useState<any | null>(null);
  const [errorMessage, setErrorMessage] = useState('');

  // Tải danh sách khóa học
  useEffect(() => {
    fetch('/api/data')
      .then((res) => res.json())
      .then((data) => {
        const cmeCourses = (data?.CmeCourses || []).filter(
          (c: any) => c.trang_thai === 'OPEN' || c.trang_thai === 'DRAFT'
        );
        setCourses(cmeCourses);
        if (cmeCourses.length > 0 && !cmeCourses.some((c: any) => c.course_id === selectedCourseId)) {
          setSelectedCourseId(cmeCourses[0].course_id);
        }
      })
      .catch((err) => console.error(err))
      .finally(() => setLoadingCourses(false));
  }, []);

  const currentCourse = courses.find((c) => c.course_id === selectedCourseId);

  // Tra cứu tự động hồ sơ cũ bằng CCCD + Ngày sinh
  const handleLookup = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchCccd || searchCccd.trim().length < 9) {
      alert('Vui lòng nhập số CCCD/CMND hợp lệ (tối thiểu 9 số).');
      return;
    }

    setSearching(true);
    setSearchFound(null);
    setErrorMessage('');

    try {
      const res = await fetch(`/api/cme/lookup-student?cccd=${encodeURIComponent(searchCccd.trim())}&dob=${encodeURIComponent(searchDob.trim())}`);
      const data = await res.json();

      if (data.found && data.student) {
        setSearchFound(true);
        setIsLegacyStudent(true);
        setFormData((prev) => ({
          ...prev,
          cccd: data.student.cccd || searchCccd,
          ngay_sinh: data.student.ngay_sinh || searchDob,
          ho_ten: data.student.ho_ten || '',
          gioi_tinh: data.student.gioi_tinh || 'Nam',
          don_vi_cong_tac: data.student.don_vi_cong_tac || '',
          chuc_danh: data.student.chuc_danh || 'Bác sĩ',
          email: data.student.email || '',
          sdt: data.student.sdt || '',
          dia_chi: data.student.dia_chi || '',
          so_cchn: data.student.so_cchn || '',
          anh_bang_cap_url: data.student.anh_bang_cap_url || '',
        }));
        setHistoryRegs(data.historyRegistrations || []);
      } else {
        setSearchFound(false);
        setIsLegacyStudent(false);
        setFormData((prev) => ({
          ...prev,
          cccd: searchCccd.trim(),
          ngay_sinh: searchDob.trim(),
        }));
      }
    } catch (err: any) {
      console.error(err);
      setErrorMessage('Không thể kết nối đến máy chủ tra cứu. Vui lòng thử lại.');
    } finally {
      setSearching(false);
    }
  };

  // Cú pháp nội dung chuyển khoản và URL VietQR động
  const memoText = generateCmeTransferMemo(
    currentCourse?.ma_khoa || selectedCourseId,
    formData.sdt || formData.cccd || 'HOCVIEN'
  );

  const qrImageUrl = generateVietQrUrl({
    amount: currentCourse?.hoc_phi || 0,
    memo: memoText,
  });

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2500);
  };

  // Xử lý nộp đơn đăng ký
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.ho_ten || !formData.cccd || !formData.sdt || !formData.email) {
      setErrorMessage('Vui lòng điền đầy đủ các thông tin bắt buộc (*).');
      return;
    }

    setSubmitting(true);
    setErrorMessage('');

    try {
      const res = await fetch('/api/cme/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          course_id: selectedCourseId,
          student: {
            cccd: formData.cccd,
            ngay_sinh: formData.ngay_sinh,
            ho_ten: formData.ho_ten,
            gioi_tinh: formData.gioi_tinh,
            don_vi_cong_tac: formData.don_vi_cong_tac,
            chuc_danh: formData.chuc_danh,
            email: formData.email,
            sdt: formData.sdt,
            dia_chi: formData.dia_chi,
            so_cchn: formData.so_cchn,
            anh_bang_cap_url: formData.anh_bang_cap_url,
          },
          payment: {
            ma_giao_dich: formData.ma_giao_dich,
            minh_chung_ck_url: formData.minh_chung_ck_url,
            so_tien: currentCourse?.hoc_phi || 0,
          },
        }),
      });

      const json = await res.json();
      if (!res.ok) {
        throw new Error(json.error || 'Đăng ký không thành công');
      }

      setSuccessResult(json);
    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Banner tiêu đề */}
        <div className="bg-gradient-to-r from-teal-800 to-teal-600 rounded-2xl shadow-xl p-8 text-white">
          <div className="flex items-center space-x-3 mb-2">
            <span className="bg-white/20 px-3 py-1 rounded-full text-xs font-semibold tracking-wider uppercase">
              Cổng Tuyển Sinh CME Trực Tuyến
            </span>
            <span className="text-teal-200 text-sm">Trường ĐHYK Phạm Ngọc Thạch — CECICS</span>
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight">Đăng Ký Đào Tạo Y Khoa Liên Tục (CME)</h1>
          <p className="mt-2 text-teal-100 text-sm max-w-2xl">
            Tự động tra cứu tái sử dụng hồ sơ học viên cũ qua CCCD & Ngày sinh (miễn kê khai lại giấy tờ đã nộp). Đóng học phí siêu nhanh qua VietQR cấu hình sẵn và nhận thông báo lịch học linh động.
          </p>
        </div>

        {/* Thông báo thành công */}
        {successResult && (
          <div className="bg-emerald-50 border border-emerald-300 rounded-2xl p-6 shadow-sm">
            <div className="flex items-start space-x-4">
              <span className="text-2xl text-emerald-600 shrink-0 mt-1">✅</span>
              <div className="space-y-2">
                <h3 className="text-xl font-bold text-emerald-900">Đăng Ký Khóa Học Thành Công!</h3>
                <p className="text-emerald-800 text-sm">
                  Cảm ơn Quý Thầy/Cô và Học viên <strong className="underline">{successResult.student.ho_ten}</strong> đã đăng ký khóa học.
                </p>
                <div className="bg-white p-4 rounded-xl border border-emerald-200 text-sm space-y-1 text-slate-700">
                  <p>• Mã hồ sơ đăng ký: <strong>{successResult.registration.reg_id}</strong></p>
                  <p>• Khóa học: <strong>{currentCourse?.ten_khoa || selectedCourseId}</strong></p>
                  <p>• Trạng thái hồ sơ: <span className="inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">{successResult.registration.trang_thai}</span></p>
                  <p>• Email xác nhận đã gửi về: <strong>{successResult.student.email}</strong></p>
                </div>
                <p className="text-xs text-slate-500 mt-2">
                  Ban Đào tạo CECICS sẽ đối soát giao dịch chuyển khoản và gửi thông báo nhập học, thời khóa biểu và thư mời Google Calendar (kèm file .ics) trong vòng 24 giờ làm việc.
                </p>
                <button
                  onClick={() => setSuccessResult(null)}
                  className="mt-4 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700"
                >
                  Đăng ký cho học viên khác
                </button>
              </div>
            </div>
          </div>
        )}

        {!successResult && (
          <div className="space-y-6">
            {/* Bước 1: Chọn Khóa học */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <h2 className="text-lg font-bold text-slate-800 mb-4 flex items-center">
                <span className="w-7 h-7 rounded-full bg-teal-100 text-teal-800 inline-flex items-center justify-center text-sm font-bold mr-2">1</span>
                Chọn Khóa Học Đào Tạo Liên Tục
              </h2>

              {loadingCourses ? (
                <div className="animate-pulse flex space-x-4">
                  <div className="h-10 bg-slate-200 rounded w-full"></div>
                </div>
              ) : (
                <div className="space-y-4">
                  <select
                    value={selectedCourseId}
                    onChange={(e) => setSelectedCourseId(e.target.value)}
                    className="w-full rounded-xl border-slate-300 shadow-sm focus:border-teal-500 focus:ring-teal-500 py-2.5 px-3 text-slate-800 text-sm border font-medium"
                  >
                    {courses.map((c) => (
                      <option key={c.course_id} value={c.course_id}>
                        [{c.ma_khoa}] {c.ten_khoa} — {c.so_tiet_cme} tiết CME ({c.hoc_phi.toLocaleString('vi-VN')} đ)
                      </option>
                    ))}
                  </select>

                  {currentCourse && (
                    <div className="bg-teal-50/60 rounded-xl p-4 border border-teal-100 text-xs space-y-2 text-slate-700">
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 font-medium">
                        <div>⏱️ Thời lượng: <span className="font-bold text-teal-800">{currentCourse.so_tiet_cme} tiết CME</span></div>
                        <div>💰 Học phí: <span className="font-bold text-teal-800">{currentCourse.hoc_phi.toLocaleString('vi-VN')} đ</span></div>
                        <div>👥 Chỉ tiêu: <span className="font-bold text-teal-800">{currentCourse.chi_tieu} học viên</span></div>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-600">
                        <div>🗓️ Khai giảng: {currentCourse.ngay_khai_giang || 'Dự kiến'} (Hạn ĐK: {currentCourse.han_dang_ky || 'Đang mở'})</div>
                        <div>👨‍🏫 GV Chủ nhiệm: {currentCourse.giang_vien_chu_nhiem || 'Bộ môn / CECICS'}</div>
                      </div>
                      {currentCourse.noi_dung_tom_tat && (
                        <p className="text-slate-500 border-t border-teal-100/60 pt-2 italic">
                          {currentCourse.noi_dung_tom_tat}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bước 2: Tra Cứu Tự Động Hồ Sơ Cũ */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6">
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-lg font-bold text-slate-800 flex items-center">
                  <span className="w-7 h-7 rounded-full bg-teal-100 text-teal-800 inline-flex items-center justify-center text-sm font-bold mr-2">2</span>
                  Tra Cứu Hồ Sơ & Tự Động Kế Thừa Giấy Tờ Học Viên Cũ
                </h2>
                <span className="text-xs bg-amber-50 text-amber-700 border border-amber-200 px-2.5 py-1 rounded-full font-medium">
                  ⚡ Tiết kiệm 90% thời gian nhập liệu
                </span>
              </div>
              <p className="text-xs text-slate-500 mb-4">
                Nếu bạn đã từng tham gia bất kỳ khóa đào tạo nào tại CECICS hoặc ĐHYK Phạm Ngọc Thạch, chỉ cần nhập số CCCD và Ngày sinh để tự động điền lại hồ sơ và kế thừa toàn bộ chứng chỉ/văn bằng đã nộp.
              </p>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-1">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Số CCCD / CMND (*)</label>
                  <input
                    type="text"
                    value={searchCccd}
                    onChange={(e) => setSearchCccd(e.target.value)}
                    placeholder="VD: 079088001122"
                    className="w-full text-sm rounded-lg border-slate-300 shadow-sm border p-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>
                <div className="sm:col-span-1">
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Ngày sinh (dd/mm/yyyy)</label>
                  <input
                    type="text"
                    value={searchDob}
                    onChange={(e) => setSearchDob(e.target.value)}
                    placeholder="VD: 12/12/1988"
                    className="w-full text-sm rounded-lg border-slate-300 shadow-sm border p-2 focus:ring-teal-500 focus:border-teal-500"
                  />
                </div>
                <div className="sm:col-span-1 flex items-end">
                  <button
                    type="button"
                    onClick={handleLookup}
                    disabled={searching}
                    className="w-full py-2 px-4 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-sm font-semibold shadow-sm transition flex items-center justify-center space-x-1 disabled:opacity-50"
                  >
                    <span>{searching ? 'Đang tìm kiếm...' : '🔍 Tra Cứu Hồ Sơ'}</span>
                  </button>
                </div>
              </div>

              {searchFound === true && (
                <div className="mt-4 p-3 bg-emerald-50 border border-emerald-200 rounded-xl text-xs text-emerald-800 space-y-1">
                  <div className="font-bold flex items-center text-emerald-900">
                    <span className="mr-1.5">🎉</span> Đã tìm thấy hồ sơ học viên cũ: {formData.ho_ten} ({formData.don_vi_cong_tac || 'N/A'})
                  </div>
                  <p>Hệ thống đã tự động điền các thông tin cá nhân và <strong>kế thừa toàn bộ hồ sơ bằng cấp/CCHN</strong> của bạn. Bạn không cần phải nộp lại scan bằng cấp nếu không có thay đổi.</p>
                  {historyRegs.length > 0 && (
                    <div className="mt-2 text-slate-600">
                      <strong>Lịch sử các khóa đã đăng ký:</strong>
                      <ul className="list-disc list-inside mt-1 space-y-0.5">
                        {historyRegs.map((hr, idx) => (
                          <li key={idx}>
                            {hr.course_name} — Trạng thái: <span className="font-medium text-slate-800">{hr.trang_thai}</span>
                            {hr.so_chung_chi_cme ? ` (Số CC: ${hr.so_chung_chi_cme})` : ''}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {searchFound === false && (
                <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800">
                  ℹ️ Không tìm thấy hồ sơ cũ với CCCD này. Vui lòng nhập thông tin mới ở bước 3 bên dưới để lần đầu mở hồ sơ tại CECICS.
                </div>
              )}
            </div>

            {/* Bước 3: Thông tin Học viên & Đóng học phí qua VietQR */}
            <form onSubmit={handleSubmit} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-6 space-y-6">
              <h2 className="text-lg font-bold text-slate-800 flex items-center">
                <span className="w-7 h-7 rounded-full bg-teal-100 text-teal-800 inline-flex items-center justify-center text-sm font-bold mr-2">3</span>
                Kê Khai Thông Tin Học Viên & Đóng Học Phí
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Họ và Tên (*)</label>
                  <input
                    type="text"
                    required
                    value={formData.ho_ten}
                    onChange={(e) => setFormData({ ...formData, ho_ten: e.target.value })}
                    className="w-full text-sm rounded-lg border-slate-300 shadow-sm border p-2 focus:ring-teal-500 focus:border-teal-500"
                    placeholder="VD: TS.BS. Lê Hoàng Long"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Giới tính</label>
                  <select
                    value={formData.gioi_tinh}
                    onChange={(e) => setFormData({ ...formData, gioi_tinh: e.target.value })}
                    className="w-full text-sm rounded-lg border-slate-300 shadow-sm border p-2 focus:ring-teal-500 focus:border-teal-500"
                  >
                    <option value="Nam">Nam</option>
                    <option value="Nữ">Nữ</option>
                  </select>
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Số CCCD / Định danh cá nhân (*)</label>
                  <input
                    type="text"
                    required
                    value={formData.cccd}
                    onChange={(e) => setFormData({ ...formData, cccd: e.target.value })}
                    className="w-full text-sm rounded-lg border-slate-300 shadow-sm border p-2 focus:ring-teal-500 focus:border-teal-500 font-mono"
                    placeholder="079088001122"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Ngày sinh (dd/mm/yyyy) (*)</label>
                  <input
                    type="text"
                    required
                    value={formData.ngay_sinh}
                    onChange={(e) => setFormData({ ...formData, ngay_sinh: e.target.value })}
                    className="w-full text-sm rounded-lg border-slate-300 shadow-sm border p-2 focus:ring-teal-500 focus:border-teal-500"
                    placeholder="dd/mm/yyyy"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Đơn vị công tác hiện nay (*)</label>
                  <input
                    type="text"
                    required
                    value={formData.don_vi_cong_tac}
                    onChange={(e) => setFormData({ ...formData, don_vi_cong_tac: e.target.value })}
                    className="w-full text-sm rounded-lg border-slate-300 shadow-sm border p-2 focus:ring-teal-500 focus:border-teal-500"
                    placeholder="VD: Bệnh viện Đa khoa Khu vực Hóc Môn"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Chức danh / Chuyên khoa</label>
                  <input
                    type="text"
                    value={formData.chuc_danh}
                    onChange={(e) => setFormData({ ...formData, chuc_danh: e.target.value })}
                    className="w-full text-sm rounded-lg border-slate-300 shadow-sm border p-2 focus:ring-teal-500 focus:border-teal-500"
                    placeholder="VD: Bác sĩ Hồi sức cấp cứu"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Thư điện tử (Email) (* nhận lịch & Google Calendar)</label>
                  <input
                    type="email"
                    required
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    className="w-full text-sm rounded-lg border-slate-300 shadow-sm border p-2 focus:ring-teal-500 focus:border-teal-500"
                    placeholder="VD: bs.lehoanglong@gmail.com"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Số điện thoại di động (*)</label>
                  <input
                    type="tel"
                    required
                    value={formData.sdt}
                    onChange={(e) => setFormData({ ...formData, sdt: e.target.value })}
                    className="w-full text-sm rounded-lg border-slate-300 shadow-sm border p-2 focus:ring-teal-500 focus:border-teal-500 font-mono"
                    placeholder="VD: 0903123456"
                  />
                </div>

                <div>
                  <label className="block font-semibold text-slate-700 mb-1">Số CCHN / Giấy phép hành nghề (nếu có)</label>
                  <input
                    type="text"
                    value={formData.so_cchn}
                    onChange={(e) => setFormData({ ...formData, so_cchn: e.target.value })}
                    className="w-full text-sm rounded-lg border-slate-300 shadow-sm border p-2 focus:ring-teal-500 focus:border-teal-500"
                    placeholder="VD: 012345/HCM-CCHN"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Đường dẫn ảnh Bằng cấp / CCHN {isLegacyStudent ? '(Đã kế thừa từ khóa cũ)' : '(nếu có)'}
                  </label>
                  <input
                    type="url"
                    value={formData.anh_bang_cap_url}
                    onChange={(e) => setFormData({ ...formData, anh_bang_cap_url: e.target.value })}
                    className="w-full text-sm rounded-lg border-slate-300 shadow-sm border p-2 focus:ring-teal-500 focus:border-teal-500"
                    placeholder={isLegacyStudent ? 'Đã lưu trong hồ sơ CECICS (không bắt buộc nhập lại)' : 'https://drive.google.com/...'}
                  />
                </div>
              </div>

              {/* KHỐI ĐÓNG HỌC PHÍ QUA VIETQR TỰ ĐỘNG CẤU HÌNH SẴN */}
              <div className="border-t border-slate-200 pt-6">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-sm font-bold text-teal-900 flex items-center">
                    <span className="mr-1.5 text-base">💳</span>
                    Đóng Học Phí Tiện Lợi Qua VietQR Chuẩn Động
                  </h3>
                  <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-semibold">
                    ⚡ Quét mã tự điền STK & Số tiền
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-12 gap-6 bg-slate-50 p-5 rounded-2xl border border-slate-200">
                  {/* Cột hiển thị Mã VietQR */}
                  <div className="md:col-span-4 flex flex-col items-center justify-center p-3 bg-white rounded-xl shadow-sm border border-slate-200 text-center">
                    <img
                      src={qrImageUrl}
                      alt="VietQR Học Phí CME"
                      className="w-48 h-auto object-contain rounded-lg border border-slate-100"
                    />
                    <p className="text-[11px] text-slate-500 mt-2 font-medium">
                      Mở app ngân hàng (VCB, Sacombank, BIDV, MoMo...) quét để nộp học phí tức thì
                    </p>
                  </div>

                  {/* Cột chi tiết thông tin chuyển khoản kèm nút Copy nhanh */}
                  <div className="md:col-span-8 flex flex-col justify-between space-y-3 text-xs">
                    <div className="space-y-2.5">
                      <div className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-slate-200">
                        <div>
                          <span className="text-slate-500 text-[11px] block">Đơn vị thụ hưởng:</span>
                          <strong className="text-slate-800">{OFFICIAL_CME_BANK.accountName}</strong>
                        </div>
                      </div>

                      <div className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-slate-200">
                        <div>
                          <span className="text-slate-500 text-[11px] block">Số tài khoản & Ngân hàng:</span>
                          <strong className="text-teal-800 text-sm font-mono">{OFFICIAL_CME_BANK.accountNo}</strong>
                          <span className="text-slate-600 block text-[11px]">{OFFICIAL_CME_BANK.bankName}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(OFFICIAL_CME_BANK.accountNo, 'stk')}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-[11px] font-semibold transition"
                        >
                          {copiedField === 'stk' ? '✓ Đã chép' : 'Sao chép STK'}
                        </button>
                      </div>

                      <div className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-slate-200">
                        <div>
                          <span className="text-slate-500 text-[11px] block">Số tiền học phí:</span>
                          <strong className="text-teal-700 text-sm font-bold">
                            {(currentCourse?.hoc_phi || 0).toLocaleString('vi-VN')} VNĐ
                          </strong>
                        </div>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(String(currentCourse?.hoc_phi || 0), 'amount')}
                          className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md text-[11px] font-semibold transition"
                        >
                          {copiedField === 'amount' ? '✓ Đã chép' : 'Sao chép số tiền'}
                        </button>
                      </div>

                      <div className="flex items-center justify-between p-2.5 bg-white rounded-lg border border-slate-200">
                        <div>
                          <span className="text-slate-500 text-[11px] block">Nội dung chuyển khoản chuẩn hóa:</span>
                          <strong className="text-slate-900 font-mono text-sm bg-yellow-50 px-2 py-0.5 rounded border border-yellow-200">
                            {memoText}
                          </strong>
                        </div>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(memoText, 'memo')}
                          className="px-2.5 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-md text-[11px] font-semibold transition shadow-sm"
                        >
                          {copiedField === 'memo' ? '✓ Đã chép' : 'Sao chép cú pháp'}
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Mã giao dịch ngân hàng (nếu đã chuyển khoản)</label>
                        <input
                          type="text"
                          value={formData.ma_giao_dich}
                          onChange={(e) => setFormData({ ...formData, ma_giao_dich: e.target.value })}
                          className="w-full text-xs rounded-lg border-slate-300 shadow-sm border p-2 focus:ring-teal-500 focus:border-teal-500"
                          placeholder="VD: FT26118899..."
                        />
                      </div>
                      <div>
                        <label className="block font-semibold text-slate-700 mb-1">Link ảnh Biên lai / Bill chuyển khoản</label>
                        <input
                          type="url"
                          value={formData.minh_chung_ck_url}
                          onChange={(e) => setFormData({ ...formData, minh_chung_ck_url: e.target.value })}
                          className="w-full text-xs rounded-lg border-slate-300 shadow-sm border p-2 focus:ring-teal-500 focus:border-teal-500"
                          placeholder="https://drive.google.com/... hoặc ảnh bill"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {errorMessage && (
                <div className="p-3 bg-red-50 text-red-700 border border-red-200 rounded-lg text-xs font-semibold">
                  {errorMessage}
                </div>
              )}

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-6 py-3 bg-teal-700 hover:bg-teal-800 text-white rounded-xl font-bold text-sm shadow-md transition flex items-center space-x-2 disabled:opacity-50"
                >
                  <span>{submitting ? 'Đang gửi đăng ký...' : 'Xác Nhận Đăng Ký Khóa Học'}</span>
                  <span>➔</span>
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

export default function CmeRegistrationPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6 text-sm text-slate-500 font-medium">
          Đang tải cổng tuyển sinh CME...
        </div>
      }
    >
      <CmeRegistrationContent />
    </Suspense>
  );
}
