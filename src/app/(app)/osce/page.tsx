'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useApp } from '@/components/AppProvider';
import { Badge, Card, PageHeader } from '@/components/ui';
import {
  INITIAL_COMPLETED_CANDIDATES,
  INITIAL_HH_STATIONS,
  INITIAL_HOLDING_QUEUE,
  INITIAL_OSCE_EXAMS,
  INITIAL_TN_STATIONS,
  type OsceExam,
  type OsceStation,
  type OsceStationStatus,
  rotateOsceCircuit,
} from '@/core/osce-data';

// Web Audio API để phát âm thanh chuông báo chuyển trạm tự nhiên mà không cần file MP3 ngoài
function playStationChime(type: 'warning' | 'rotate') {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    if (type === 'warning') {
      // Chuông đơn cảnh báo 1 phút (880Hz - nốt La cao)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, now);
      gain.gain.setValueAtTime(0.3, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 1.2);
    } else {
      // Chuông đôi báo chuyển trạm (Ding-Dong: 784Hz -> 1046Hz)
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(784, now);
      gain1.gain.setValueAtTime(0.35, now);
      gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.start(now);
      osc1.stop(now + 0.8);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(1046, now + 0.25);
      gain2.gain.setValueAtTime(0.4, now + 0.25);
      gain2.gain.exponentialRampToValueAtTime(0.001, now + 1.8);
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.start(now + 0.25);
      osc2.stop(now + 1.8);
    }
  } catch (err) {
    // Audio context có thể bị chặn nếu chưa tương tác
    console.warn('Audio chime error:', err);
  }
}

export default function OsceFloorPlanPage() {
  const { user, db, execute } = useApp();
  const [mounted, setMounted] = useState(false);

  // Chọn kỳ thi & cơ sở
  const [selectedExamId, setSelectedExamId] = useState<string>('OSCE-2026-K1');
  const [currentCampus, setCurrentCampus] = useState<'HH' | 'TN'>('HH');

  // Chế độ xem
  const [viewMode, setViewMode] = useState<'map' | 'table' | 'kiosk'>('map');
  const [showArrows, setShowArrows] = useState(true);
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Dữ liệu trạm và thí sinh
  const [stations, setStations] = useState<OsceStation[]>(INITIAL_HH_STATIONS);
  const [queue, setQueue] = useState(INITIAL_HOLDING_QUEUE);
  const [completed, setCompleted] = useState(INITIAL_COMPLETED_CANDIDATES);

  // Quản lý đồng hồ đếm ngược trạm (Timer)
  const currentExam = useMemo(
    () => INITIAL_OSCE_EXAMS.find((e) => e.id === selectedExamId) || INITIAL_OSCE_EXAMS[0],
    [selectedExamId]
  );
  const stationDurationSec = currentExam.thoi_gian_tram_phut * 60;
  const [timeLeftSec, setTimeLeftSec] = useState(stationDurationSec);
  const [isRunning, setIsRunning] = useState(false);
  const [isRotating, setIsRotating] = useState(false);
  const [rotationCount, setRotationCount] = useState(1);
  const [audioNotification, setAudioNotification] = useState<string | null>(null);

  // Trạm đang được chọn để xem chi tiết (Drawer / Modal)
  const [selectedStation, setSelectedStation] = useState<OsceStation | null>(null);

  // Modal Báo sự cố thiết bị tại trạm
  const [incidentStation, setIncidentStation] = useState<OsceStation | null>(null);
  const [incidentDesc, setIncidentDesc] = useState('');
  const [incidentEquipmentId, setIncidentEquipmentId] = useState('');

  // Hydration prevention
  useEffect(() => {
    setMounted(true);
  }, []);

  // Chuyển cơ sở hoặc kỳ thi
  useEffect(() => {
    if (currentCampus === 'HH') {
      setStations(INITIAL_HH_STATIONS);
      setSelectedExamId('OSCE-2026-K1');
    } else {
      setStations(INITIAL_TN_STATIONS);
      setSelectedExamId('OSCE-2026-K2');
    }
    setTimeLeftSec(currentExam.thoi_gian_tram_phut * 60);
    setIsRunning(false);
    setIsRotating(false);
  }, [currentCampus, currentExam.thoi_gian_tram_phut]);

  // Bộ đếm thời gian trạm (Interval)
  useEffect(() => {
    if (!isRunning) return;

    const timer = setInterval(() => {
      setTimeLeftSec((prev) => {
        if (prev <= 1) {
          // Hết giờ trạm -> Báo chuông chuyển trạm!
          if (soundEnabled) playStationChime('rotate');
          setAudioNotification('🛑 HẾT GIỜ TRẠM! Mời thí sinh di chuyển sang trạm kế tiếp theo luồng 1 chiều!');
          setIsRotating(true);
          return currentExam.thoi_gian_chuyen_tram_giay;
        }

        // Cảnh báo 1 phút cuối
        if (prev === 61 && !isRotating) {
          if (soundEnabled) playStationChime('warning');
          setAudioNotification('🔔 Cảnh báo: Còn 1 phút làm bài! Chuẩn bị kết thúc trạm.');
        }

        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isRunning, isRotating, soundEnabled, currentExam.thoi_gian_chuyen_tram_giay]);

  // Tự động tắt audio notification sau 6s
  useEffect(() => {
    if (!audioNotification) return;
    const t = setTimeout(() => setAudioNotification(null), 6000);
    return () => clearTimeout(t);
  }, [audioNotification]);

  // Hàm chuyển trạm tự động hoặc thủ công
  const handleRotateCircuit = useCallback(() => {
    if (soundEnabled) playStationChime('rotate');
    const nowStr = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const result = rotateOsceCircuit(stations, queue, completed, nowStr);
    setStations(result.stations);
    setQueue(result.queue);
    setCompleted(result.completed);
    setRotationCount((c) => c + 1);
    setIsRotating(false);
    setTimeLeftSec(stationDurationSec);
    setAudioNotification(`✅ Đã chuyển sang Vòng ${rotationCount + 1}! Bắt đầu tính giờ trạm mới.`);
  }, [stations, queue, completed, rotationCount, stationDurationSec, soundEnabled]);

  // Format mm:ss
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // Tính phần trăm thời gian
  const timeProgress = useMemo(() => {
    const total = isRotating ? currentExam.thoi_gian_chuyen_tram_giay : stationDurationSec;
    return Math.max(0, Math.min(100, ((total - timeLeftSec) / total) * 100));
  }, [isRotating, currentExam.thoi_gian_chuyen_tram_giay, stationDurationSec, timeLeftSec]);

  // Đổi trạng thái trạm
  const handleUpdateStationStatus = (stationId: string, newStatus: OsceStationStatus, note?: string) => {
    setStations((prev) =>
      prev.map((s) => (s.id === stationId ? { ...s, status: newStatus, status_note: note || s.status_note } : s))
    );
    if (selectedStation && selectedStation.id === stationId) {
      setSelectedStation((prev) => (prev ? { ...prev, status: newStatus, status_note: note || prev.status_note } : null));
    }
  };

  // Báo sự cố thiết bị tại trạm
  const handleReportIncident = async () => {
    if (!incidentStation || !incidentDesc) return;
    try {
      await execute(
        'reportIncident',
        {
          equipment_id: incidentEquipmentId || 'TB-US-01',
          mo_ta: `[SỰ CỐ TRẠM OSCE ${incidentStation.room_name}]: ${incidentDesc}`,
          nguoi_bao: user.user_id,
        },
        `Đã phát tín hiệu báo động sự cố tại ${incidentStation.room_name} tới Đội Kỹ thuật & Điều hành.`
      );
      handleUpdateStationStatus(incidentStation.id, 'ALERT', `Sự cố: ${incidentDesc}`);
      setIncidentStation(null);
      setIncidentDesc('');
    } catch (err: any) {
      alert(`Lỗi khi gửi sự cố: ${err.message}`);
    }
  };

  if (!mounted) {
    return (
      <div className="p-8 text-center text-slate-500">
        <div className="animate-spin text-3xl mb-2">🧭</div>
        <p className="text-sm">Đang tải Sơ đồ Mặt bằng Trạm thi OSCE Trung tâm CECICS...</p>
      </div>
    );
  }

  return (
    <div className={`space-y-6 ${viewMode === 'kiosk' ? 'fixed inset-0 z-50 bg-slate-950 p-6 overflow-y-auto text-white' : ''}`}>
      {/* Thông báo chuông / trạng thái chuyển trạm */}
      {audioNotification && (
        <div className="p-4 rounded-xl bg-amber-500 text-slate-950 font-bold flex items-center justify-between shadow-lg border-2 border-amber-300 animate-bounce">
          <div className="flex items-center gap-3">
            <span className="text-2xl">📢</span>
            <span className="text-base sm:text-lg">{audioNotification}</span>
          </div>
          <button
            onClick={() => setAudioNotification(null)}
            className="text-slate-950 hover:bg-amber-600/30 p-1.5 rounded-lg text-sm"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header & Bộ lọc */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🧭</span>
            <h1 className={`text-xl sm:text-2xl font-bold tracking-tight ${viewMode === 'kiosk' ? 'text-white' : 'text-slate-900'}`}>
              Sơ đồ Trực quan hóa Phòng & Trạm thi OSCE
            </h1>
            <Badge tone="teal">Vận hành Thời gian thực</Badge>
          </div>
          <p className={`text-sm mt-1 ${viewMode === 'kiosk' ? 'text-slate-400' : 'text-slate-500'}`}>
            Mặt bằng luân chuyển 1 chiều · Điều phối vòng trạm · Đồng hồ chuông báo trung tâm · Giám sát AV & Sự cố CECICS
          </p>
        </div>

        {/* Nút tác vụ & View Mode */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Nút chuyển cơ sở */}
          <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5 shadow-2xs">
            <button
              onClick={() => setCurrentCampus('HH')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                currentCampus === 'HH' ? 'bg-teal-700 text-white' : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              🏥 Cơ sở Hòa Hưng (8 Trạm)
            </button>
            <button
              onClick={() => setCurrentCampus('TN')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors ${
                currentCampus === 'TN' ? 'bg-teal-700 text-white' : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              🏢 Cơ sở Tân Nhựt (12 Trạm)
            </button>
          </div>

          {/* Chọn chế độ hiển thị */}
          <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5 shadow-2xs">
            <button
              onClick={() => setViewMode('map')}
              className={`px-2.5 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1 ${
                viewMode === 'map' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
              }`}
              title="Sơ đồ Mặt bằng 2D"
            >
              <span>🗺️</span>
              <span className="hidden sm:inline">Mặt bằng</span>
            </button>
            <button
              onClick={() => setViewMode('table')}
              className={`px-2.5 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1 ${
                viewMode === 'table' ? 'bg-slate-900 text-white' : 'text-slate-700 hover:bg-slate-100'
              }`}
              title="Bảng Giám sát Chi tiết"
            >
              <span>📋</span>
              <span className="hidden sm:inline">Bảng trạm</span>
            </button>
            <button
              onClick={() => setViewMode(viewMode === 'kiosk' ? 'map' : 'kiosk')}
              className={`px-2.5 py-1.5 text-xs font-semibold rounded-md transition-colors flex items-center gap-1 ${
                viewMode === 'kiosk' ? 'bg-amber-600 text-white' : 'text-slate-700 hover:bg-slate-100'
              }`}
              title="Chế độ Chiếu Màn hình lớn Phòng Điều hành"
            >
              <span>🖥️</span>
              <span className="hidden sm:inline">{viewMode === 'kiosk' ? 'Thoát Kiosk' : 'Kiosk TV'}</span>
            </button>
          </div>

          {/* Bật/Tắt Âm thanh chuông */}
          <button
            onClick={() => setSoundEnabled(!soundEnabled)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-1.5 transition-colors ${
              soundEnabled
                ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                : 'bg-slate-100 text-slate-500 border-slate-200'
            }`}
            title="Bật/Tắt chuông báo âm thanh Web Audio"
          >
            <span>{soundEnabled ? '🔔' : '🔕'}</span>
            <span>{soundEnabled ? 'Chuông BẬT' : 'Chuông TẮT'}</span>
          </button>

          {/* Liên kết sang Gán phòng */}
          <Link
            href="/gan-phong"
            className="px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-semibold transition-colors flex items-center gap-1"
          >
            <span>🚪</span>
            <span>Gán phòng học</span>
          </Link>
        </div>
      </div>

      {/* Thông tin Kỳ thi & Bảng điều khiển Trung tâm Timer */}
      <div className={`p-5 rounded-2xl border ${viewMode === 'kiosk' ? 'bg-slate-900 border-slate-800' : 'bg-gradient-to-r from-teal-900 via-slate-900 to-teal-950 text-white border-teal-800 shadow-md'}`}>
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-center">
          {/* Thông tin ca thi */}
          <div className="md:col-span-5 space-y-1.5">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-xs font-bold uppercase tracking-wider bg-teal-500/20 text-teal-300 border border-teal-400/30">
                {currentExam.doi_tuong}
              </span>
              <span className="text-xs text-slate-300">
                Ngày thi: <strong>{currentExam.ngay_thi}</strong> · {currentExam.ca_thi}
              </span>
            </div>
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight leading-snug">
              {currentExam.ten_ky_thi}
            </h2>
            <div className="text-xs text-slate-300 flex flex-wrap gap-x-4 gap-y-1 pt-1">
              <span>📍 {currentExam.phong_dieu_hanh}</span>
              <span>🔄 Vòng luân chuyển: <strong>#{rotationCount}</strong></span>
              <span>⏱️ Chu kỳ: <strong>{currentExam.thoi_gian_tram_phut} phút/trạm</strong> (+{currentExam.thoi_gian_chuyen_tram_giay}s chuyển)</span>
            </div>
          </div>

          {/* Đồng hồ đếm ngược trung tâm (Timer) */}
          <div className="md:col-span-4 flex flex-col items-center justify-center p-3 rounded-xl bg-black/30 border border-white/10 backdrop-blur-xs">
            <div className="text-xs font-semibold uppercase tracking-wider text-slate-300 mb-1 flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${isRunning ? 'bg-emerald-400 animate-ping' : 'bg-amber-400'}`}></span>
              <span>{isRotating ? 'ĐANG CHUYỂN TRẠM' : isRunning ? 'ĐANG LÀM BÀI THI' : 'ĐANG TẠM DỪNG'}</span>
            </div>
            <div className="flex items-baseline gap-2">
              <div
                className={`text-4xl sm:text-5xl font-black font-mono tracking-tight ${
                  isRotating
                    ? 'text-amber-400 animate-pulse'
                    : timeLeftSec <= 60
                    ? 'text-rose-400 animate-pulse'
                    : 'text-white'
                }`}
              >
                {formatTime(timeLeftSec)}
              </div>
              <span className="text-xs text-slate-400 font-medium">
                /{isRotating ? `${currentExam.thoi_gian_chuyen_tram_giay}s` : `${currentExam.thoi_gian_tram_phut}:00`}
              </span>
            </div>

            {/* Thanh tiến trình thời gian */}
            <div className="w-full bg-white/10 h-2 rounded-full overflow-hidden mt-2.5">
              <div
                className={`h-full transition-all duration-1000 ${
                  isRotating
                    ? 'bg-amber-400'
                    : timeLeftSec <= 60
                    ? 'bg-rose-500'
                    : 'bg-teal-400'
                }`}
                style={{ width: `${timeProgress}%` }}
              ></div>
            </div>
          </div>

          {/* Nút bấm điều khiển Timer & Luân chuyển */}
          <div className="md:col-span-3 flex flex-col gap-2">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setIsRunning(!isRunning)}
                className={`px-3 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 shadow-xs ${
                  isRunning
                    ? 'bg-amber-500 hover:bg-amber-600 text-slate-950'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                }`}
              >
                <span>{isRunning ? '⏸ Tạm dừng' : '▶ Bắt đầu'}</span>
              </button>
              <button
                type="button"
                onClick={handleRotateCircuit}
                className="px-3 py-2 rounded-lg bg-teal-500 hover:bg-teal-600 text-slate-950 text-xs font-bold transition-all flex items-center justify-center gap-1 shadow-xs"
                title="Luân chuyển thí sinh sang trạm kế tiếp"
              >
                <span>⚡ Chuyển trạm</span>
              </button>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => {
                  if (soundEnabled) playStationChime('warning');
                  setAudioNotification('🔔 Kiểm tra chuông 1 phút thành công.');
                }}
                className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-colors flex items-center justify-center gap-1 border border-white/10"
              >
                <span>🔔 Thử chuông</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setTimeLeftSec(stationDurationSec);
                  setIsRunning(false);
                  setIsRotating(false);
                }}
                className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white text-xs font-medium transition-colors flex items-center justify-center gap-1 border border-white/10"
              >
                <span>🔄 Reset giờ</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Hiển thị chế độ Mặt bằng (Map View) */}
      {viewMode !== 'table' && (
        <div className="space-y-6">
          {/* Sơ đồ 3 Khu vực Luân Chuyển Khép Kín */}
          <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
            {/* CỘT TRÁI: Khu vực Cách ly Trước thi (Holding Area A) */}
            <div className="xl:col-span-3 space-y-4">
              <div className={`p-4 rounded-xl border ${viewMode === 'kiosk' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'}`}>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🚪</span>
                    <div>
                      <h3 className={`font-bold text-sm ${viewMode === 'kiosk' ? 'text-white' : 'text-slate-900'}`}>Phòng Chờ Trước Thi</h3>
                      <p className="text-xs text-slate-500">{currentExam.phong_cho_truoc}</p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-200">
                    {queue.length} Thí sinh
                  </span>
                </div>

                <div className="mt-3 text-xs bg-amber-50/70 text-amber-900 p-2.5 rounded-lg border border-amber-200">
                  🔒 <strong>Vùng Cách Ly Cấp 1</strong>: Thí sinh nộp điện thoại, không tiếp xúc thí sinh đã thi để bảo mật đề thi.
                </div>

                {/* Hàng chờ thí sinh */}
                <div className="mt-3 space-y-2 max-h-72 overflow-y-auto pr-1">
                  {queue.length === 0 ? (
                    <div className="text-center py-6 text-slate-400 text-xs italic">
                      Đã vào hết tất cả trạm thi.
                    </div>
                  ) : (
                    queue.map((c, idx) => (
                      <div
                        key={c.id}
                        className={`p-2.5 rounded-lg border flex items-center justify-between text-xs transition-all ${
                          idx === 0
                            ? 'bg-teal-50 border-teal-300 shadow-2xs'
                            : viewMode === 'kiosk'
                            ? 'bg-slate-800/80 border-slate-700'
                            : 'bg-slate-50 border-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-xs ${
                            idx === 0 ? 'bg-teal-700 text-white' : 'bg-slate-200 text-slate-700'
                          }`}>
                            {idx + 1}
                          </span>
                          <div>
                            <div className="font-semibold text-slate-900">{c.ho_ten}</div>
                            <div className="text-[11px] text-slate-500">{c.ma_sv} · {c.lop}</div>
                          </div>
                        </div>
                        {idx === 0 && (
                          <span className="px-1.5 py-0.5 rounded bg-teal-200/80 text-teal-900 text-[10px] font-bold animate-pulse">
                            VÀO TRẠM 1 TIẾP THEO ➔
                          </span>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Khu vực Cách ly Sau thi (Holding Area B) */}
              <div className={`p-4 rounded-xl border ${viewMode === 'kiosk' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-xs'}`}>
                <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">🏁</span>
                    <div>
                      <h3 className={`font-bold text-sm ${viewMode === 'kiosk' ? 'text-white' : 'text-slate-900'}`}>Phòng Cách Ly Sau Thi</h3>
                      <p className="text-xs text-slate-500">{currentExam.phong_cho_sau}</p>
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                    {completed.length} Đã xong
                  </span>
                </div>

                <div className="mt-3 text-xs bg-emerald-50/70 text-emerald-900 p-2.5 rounded-lg border border-emerald-200">
                  🛡️ Thí sinh sau khi hoàn thành toàn bộ vòng thi tập trung tại đây cho đến khi hết ca thi.
                </div>

                <div className="mt-3 space-y-2 max-h-56 overflow-y-auto pr-1">
                  {completed.map((c) => (
                    <div
                      key={c.id}
                      className={`p-2 rounded-lg border flex items-center justify-between text-xs ${
                        viewMode === 'kiosk' ? 'bg-slate-800/80 border-slate-700' : 'bg-slate-50 border-slate-200'
                      }`}
                    >
                      <div>
                        <div className="font-semibold text-slate-900">{c.ho_ten}</div>
                        <div className="text-[11px] text-slate-500">{c.ma_sv} · Xong lúc {c.hoan_thanh_luc}</div>
                      </div>
                      <span className="font-mono font-bold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded">
                        {c.diem_tb.toFixed(2)} đ
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* CỘT GIỮA: Sơ đồ Mạch Vòng Trạm (Circuit Grid & One-Way Arrows) */}
            <div className="xl:col-span-9 space-y-4">
              <div className={`p-5 rounded-2xl border ${viewMode === 'kiosk' ? 'bg-slate-900 border-slate-800' : 'bg-white border-slate-200 shadow-sm'}`}>
                {/* Thanh trạng thái chú giải màu sắc */}
                <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-100 text-xs">
                  <div className="flex items-center gap-1 font-semibold text-slate-700">
                    <span>🧭 Sơ đồ Vòng Trạm Khép Kín:</span>
                    <span className="text-teal-700 font-bold">
                      {currentCampus === 'HH' ? '8 Trạm Cơ sở Hòa Hưng' : '12 Trạm Cơ sở Tân Nhựt'}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3 text-slate-600">
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                      <span>Sẵn sàng / Trống</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                      <span>Đang thi</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-rose-500 animate-pulse"></span>
                      <span>Báo động Sự cố</span>
                    </span>
                    <span className="flex items-center gap-1.5">
                      <span className="w-3 h-3 rounded-full bg-slate-400"></span>
                      <span>Trạm nghỉ / Đổi đề</span>
                    </span>
                    <label className="inline-flex items-center gap-1 ml-2 cursor-pointer font-medium text-teal-800">
                      <input
                        type="checkbox"
                        checked={showArrows}
                        onChange={(e) => setShowArrows(e.target.checked)}
                        className="accent-teal-700"
                      />
                      <span>Mũi tên 1 chiều</span>
                    </label>
                  </div>
                </div>

                {/* Grid các Trạm OSCE */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 relative">
                  {stations.map((st, index) => {
                    const isNext = index === 0;
                    const statusBg =
                      st.status === 'ALERT'
                        ? 'border-rose-400 bg-rose-50/60 ring-2 ring-rose-400/40'
                        : st.status === 'IN_PROGRESS'
                        ? 'border-amber-300 bg-amber-50/40 ring-1 ring-amber-300/30'
                        : st.status === 'RESTING'
                        ? 'border-slate-300 bg-slate-100'
                        : 'border-emerald-300 bg-emerald-50/30';

                    return (
                      <div
                        key={st.id}
                        onClick={() => setSelectedStation(st)}
                        className={`group relative rounded-xl border-2 p-3.5 transition-all duration-200 hover:shadow-md cursor-pointer flex flex-col justify-between min-h-[220px] ${statusBg}`}
                      >
                        {/* Header của Trạm: Số trạm, Room ID, Camera Status */}
                        <div>
                          <div className="flex items-center justify-between gap-1.5 mb-2">
                            <div className="flex items-center gap-1.5">
                              <span className="w-6 h-6 rounded-lg bg-slate-900 text-white font-black text-xs flex items-center justify-center shadow-xs">
                                {st.station_number}
                              </span>
                              <span className="font-mono text-xs font-bold text-slate-800">
                                {st.room_id}
                              </span>
                            </div>

                            <div className="flex items-center gap-1">
                              {st.camera_status === 'RECORDING' && (
                                <span className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-200">
                                  <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-ping"></span>
                                  REC
                                </span>
                              )}
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                  st.status === 'ALERT'
                                    ? 'bg-rose-600 text-white'
                                    : st.status === 'IN_PROGRESS'
                                    ? 'bg-amber-500 text-slate-950 font-extrabold'
                                    : st.status === 'RESTING'
                                    ? 'bg-slate-200 text-slate-700'
                                    : 'bg-emerald-600 text-white'
                                }`}
                              >
                                {st.status === 'ALERT'
                                  ? 'SỰ CỐ'
                                  : st.status === 'IN_PROGRESS'
                                  ? 'ĐANG THI'
                                  : st.status === 'RESTING'
                                  ? 'TRẠM NGHỈ'
                                  : 'SẴN SÀNG'}
                              </span>
                            </div>
                          </div>

                          {/* Tên kỹ năng trạm */}
                          <h4 className="font-bold text-xs sm:text-sm text-slate-900 leading-snug line-clamp-2 group-hover:text-teal-800 transition-colors">
                            {st.name}
                          </h4>

                          <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-1">
                            <span className="font-medium text-teal-700">{st.chuyen_khoa}</span>
                            <span>•</span>
                            <span className="italic">{st.type_label}</span>
                          </div>
                        </div>

                        {/* Thông tin Giám khảo & Thí sinh hiện tại */}
                        <div className="pt-2.5 mt-2.5 border-t border-slate-200/80 space-y-1.5 text-xs">
                          {/* Thí sinh đang trong trạm */}
                          <div className="p-2 rounded-lg bg-white/90 border border-slate-200 shadow-2xs">
                            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider flex items-center justify-between">
                              <span>Thí sinh:</span>
                              {st.current_candidate && (
                                <span className="font-mono text-teal-700 font-bold">{st.current_candidate.ma_sv}</span>
                              )}
                            </div>
                            {st.current_candidate ? (
                              <div className="font-bold text-slate-900 truncate">
                                {st.current_candidate.ho_ten}
                                <span className="text-[11px] font-normal text-slate-500 ml-1">({st.current_candidate.lop})</span>
                              </div>
                            ) : (
                              <div className="text-slate-400 italic text-[11px]">Trống / Sẵn sàng đón thí sinh</div>
                            )}
                          </div>

                          {/* Giám khảo chấm thi */}
                          <div className="flex items-center justify-between text-[11px] text-slate-600">
                            <span className="truncate">👨‍⚕️ {st.examiner_name}</span>
                            <span className="text-slate-400 font-mono text-[10px]">{st.checklist.length} TC</span>
                          </div>
                        </div>

                        {/* Mũi tên chỉ hướng luồng 1 chiều nếu bật */}
                        {showArrows && (
                          <div className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 z-10 hidden sm:block pointer-events-none">
                            <span className="px-2 py-0.5 rounded-full bg-slate-900 text-teal-300 text-[10px] font-bold shadow-md border border-teal-500/40 whitespace-nowrap">
                              ➔ Đi Trạm {index === stations.length - 1 ? 'Cách Ly Sau' : index + 2}
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Hướng dẫn luồng di chuyển */}
                <div className="mt-8 p-3 rounded-xl bg-teal-50 border border-teal-200 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-teal-900">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">🔄</span>
                    <div>
                      <strong>Quy tắc Luồng Di Chuyển Một Chiều (One-Way Circuit Flow):</strong>
                      <div className="text-slate-600">
                        Phòng chờ Trước thi ➔ Trạm 01 ➔ Trạm 02 ➔ ... ➔ Trạm cuối ➔ Phòng cách ly Sau thi. Tuyệt đối không quay đầu lại.
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={handleRotateCircuit}
                    className="px-3 py-1.5 rounded-lg bg-teal-700 hover:bg-teal-800 text-white font-bold whitespace-nowrap shadow-xs transition-colors"
                  >
                    ⚡ Mô phỏng Chuyển trạm
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Chế độ Bảng Giám sát Chi tiết (Table View) */}
      {viewMode === 'table' && (
        <Card title="Bảng Tổng hợp Vận hành Chi tiết các Trạm OSCE" subtitle="Theo dõi giám khảo, thí sinh, camera, thiết bị và điểm số trung bình">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100 text-slate-700 font-semibold border-b border-slate-200">
                  <th className="py-2.5 px-3">STT</th>
                  <th className="py-2.5 px-3">Phòng CECICS</th>
                  <th className="py-2.5 px-3">Tên Trạm Kỹ năng</th>
                  <th className="py-2.5 px-3">Loại Trạm</th>
                  <th className="py-2.5 px-3">Giám khảo Chấm</th>
                  <th className="py-2.5 px-3">Thí sinh Hiện tại</th>
                  <th className="py-2.5 px-3">Trạng thái</th>
                  <th className="py-2.5 px-3">Camera / AV</th>
                  <th className="py-2.5 px-3 text-right">Tác vụ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {stations.map((st) => (
                  <tr key={st.id} className="hover:bg-slate-50 transition-colors">
                    <td className="py-2.5 px-3 font-bold text-slate-900">#{st.station_number}</td>
                    <td className="py-2.5 px-3 font-mono font-semibold text-teal-800">{st.room_id}</td>
                    <td className="py-2.5 px-3">
                      <div className="font-semibold text-slate-900">{st.name}</div>
                      <div className="text-[11px] text-slate-500">{st.chuyen_khoa}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium text-[11px]">
                        {st.type_label}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <div className="font-medium text-slate-900">{st.examiner_name}</div>
                      <div className="text-[11px] text-slate-500">{st.examiner_dept}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      {st.current_candidate ? (
                        <div>
                          <span className="font-bold text-slate-900">{st.current_candidate.ho_ten}</span>
                          <div className="text-[11px] text-slate-500">{st.current_candidate.ma_sv} · {st.current_candidate.lop}</div>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Trống</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`px-2 py-0.5 rounded-full font-bold text-[10px] uppercase ${
                          st.status === 'ALERT'
                            ? 'bg-rose-100 text-rose-800'
                            : st.status === 'IN_PROGRESS'
                            ? 'bg-amber-100 text-amber-800'
                            : st.status === 'RESTING'
                            ? 'bg-slate-100 text-slate-700'
                            : 'bg-emerald-100 text-emerald-800'
                        }`}
                      >
                        {st.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="flex items-center gap-1 font-mono text-[11px] text-slate-600">
                        <span className="w-2 h-2 rounded-full bg-rose-500 animate-ping"></span>
                        {st.camera_status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => setSelectedStation(st)}
                        className="px-2.5 py-1 rounded bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 font-semibold text-xs"
                      >
                        Chi tiết
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* DRAWER / MODAL: Chi tiết Trạm & Bảng kiểm OSCE */}
      {selectedStation && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200 p-6 space-y-5 text-slate-900">
            {/* Header Modal */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <span className="w-7 h-7 rounded-lg bg-teal-800 text-white font-bold flex items-center justify-center text-sm">
                    {selectedStation.station_number}
                  </span>
                  <h3 className="font-bold text-lg text-slate-900">{selectedStation.name}</h3>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Phòng: <strong>{selectedStation.room_id}</strong> · Chuyên khoa: <strong>{selectedStation.chuyen_khoa}</strong> · Hình thức: <strong>{selectedStation.type_label}</strong>
                </p>
              </div>
              <button
                onClick={() => setSelectedStation(null)}
                className="text-slate-400 hover:text-slate-700 text-xl font-bold p-1"
              >
                ✕
              </button>
            </div>

            {/* Thông tin Giám khảo & Thí sinh */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-1">
                <div className="font-semibold text-slate-500 uppercase tracking-wider text-[10px]">Giám khảo Chấm thi</div>
                <div className="font-bold text-sm text-slate-900">{selectedStation.examiner_name}</div>
                <div className="text-slate-600">{selectedStation.examiner_title} · {selectedStation.examiner_dept}</div>
                {selectedStation.sp_actor && (
                  <div className="pt-1 text-teal-800 font-medium">🎭 Bệnh nhân chuẩn: {selectedStation.sp_actor}</div>
                )}
              </div>

              <div className="p-3 rounded-xl bg-teal-50 border border-teal-200 space-y-1">
                <div className="font-semibold text-teal-700 uppercase tracking-wider text-[10px]">Thí sinh hiện tại</div>
                {selectedStation.current_candidate ? (
                  <>
                    <div className="font-bold text-sm text-teal-950">{selectedStation.current_candidate.ho_ten}</div>
                    <div className="text-teal-800">
                      MSSV: <strong>{selectedStation.current_candidate.ma_sv}</strong> · Lớp: {selectedStation.current_candidate.lop}
                    </div>
                    <div className="text-[11px] text-teal-700">Điểm số ước tính: {selectedStation.score_average || 8.5}/10.0</div>
                  </>
                ) : (
                  <div className="text-slate-500 italic py-2">Trạm đang trống.</div>
                )}
              </div>
            </div>

            {/* Danh mục Thiết bị & Mô hình tại trạm */}
            <div>
              <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500 mb-2">
                Trang thiết bị & Vật tư tại Trạm
              </h4>
              <div className="flex flex-wrap gap-1.5">
                {selectedStation.equipment_needed.map((eq, i) => (
                  <span key={i} className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200 text-xs font-medium text-slate-700">
                    🛠️ {eq}
                  </span>
                ))}
              </div>
            </div>

            {/* Bảng kiểm OSCE (Checklist) */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-500">
                  Bảng kiểm Đánh giá Kỹ năng Lâm sàng ({selectedStation.checklist.length} tiêu chí)
                </h4>
                <span className="text-xs font-bold text-teal-700">Thang điểm 10.0</span>
              </div>
              <div className="border border-slate-200 rounded-xl overflow-hidden divide-y divide-slate-100 text-xs">
                {selectedStation.checklist.map((item, idx) => (
                  <div key={item.id} className="p-3 flex items-start justify-between gap-3 bg-white hover:bg-slate-50">
                    <div className="flex items-start gap-2">
                      <span className="font-bold text-slate-400 mt-0.5">{idx + 1}.</span>
                      <span className="text-slate-800 font-medium">{item.noi_dung}</span>
                    </div>
                    <span className="px-2 py-0.5 rounded bg-teal-50 text-teal-800 font-bold border border-teal-200 shrink-0">
                      {item.diem_toi_da.toFixed(1)} đ
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Các nút hành động */}
            <div className="pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setIncidentStation(selectedStation);
                    setSelectedStation(null);
                  }}
                  className="px-3.5 py-2 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 text-xs font-bold transition-colors flex items-center gap-1.5"
                >
                  <span>🚨 Báo sự cố trạm</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdateStationStatus(selectedStation.id, 'RESTING', 'Đang vệ sinh khử khuẩn')}
                  className="px-3 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
                >
                  ⚪ Khử khuẩn trạm
                </button>
                <button
                  type="button"
                  onClick={() => handleUpdateStationStatus(selectedStation.id, 'READY')}
                  className="px-3 py-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-semibold"
                >
                  🟢 Sẵn sàng
                </button>
              </div>

              <button
                type="button"
                onClick={() => setSelectedStation(null)}
                className="px-4 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: Báo Sự Cố Thiết Bị / Kỹ Thuật Tại Trạm */}
      {incidentStation && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full shadow-2xl border border-rose-200 p-6 space-y-4 text-slate-900">
            <div className="flex items-center gap-3 text-rose-700">
              <span className="text-3xl">🚨</span>
              <div>
                <h3 className="font-bold text-base">Báo Động Sự Cố Kỹ Thuật Trạm OSCE</h3>
                <p className="text-xs text-slate-500">{incidentStation.name} ({incidentStation.room_id})</p>
              </div>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Thiết bị gặp sự cố</label>
                <select
                  value={incidentEquipmentId}
                  onChange={(e) => setIncidentEquipmentId(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 bg-white"
                >
                  <option value="">-- Chọn thiết bị bị hỏng/trục trặc --</option>
                  {db.Equipment.map((eq) => (
                    <option key={eq.equipment_id} value={eq.equipment_id}>
                      {eq.equipment_id} - {eq.ten} ({eq.nhom})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Mô tả sự cố cần KTV can thiệp khẩn cấp</label>
                <textarea
                  rows={3}
                  value={incidentDesc}
                  onChange={(e) => setIncidentDesc(e.target.value)}
                  placeholder="Ví dụ: Mô hình SimMan bị mất kết nối nhịp tim, máy sốc điện hết pin, SP bị choáng cần nghỉ..."
                  className="w-full px-3 py-2 rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-rose-500"
                ></textarea>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setIncidentStation(null)}
                className="px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={handleReportIncident}
                disabled={!incidentDesc}
                className="px-4 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold disabled:opacity-50"
              >
                Phát tín hiệu khẩn cấp
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
