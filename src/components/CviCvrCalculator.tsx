'use client';

import React, { useState, useMemo } from 'react';
import {
  calculateStationCviCvr,
  getMinimumAcceptableCvr,
  getSampleCprStationEvaluation,
  type CviItemEvaluation,
  type LikertRelevanceScore,
  type StationValidationReport,
} from '@/core/cvi-cvr-engine';

interface CviCvrCalculatorProps {
  initialStationName?: string;
  initialChuyenKhoa?: string;
}

export function CviCvrCalculator({
  initialStationName = 'Trạm Hồi sức Tim phổi Cấp cứu (CPR / ACLS)',
  initialChuyenKhoa = 'Hồi sức Cấp cứu & Ngoại Tim mạch',
}: CviCvrCalculatorProps) {
  const [stationName, setStationName] = useState(initialStationName);
  const [chuyenKhoa, setChuyenKhoa] = useState(initialChuyenKhoa);
  const [numExperts, setNumExperts] = useState<number>(8);
  const [items, setItems] = useState<CviItemEvaluation[]>(getSampleCprStationEvaluation());

  // Thêm tiêu chí mới vào bảng kiểm
  const [newItemDesc, setNewItemDesc] = useState('');

  // Điều chỉnh số lượng chuyên gia
  const handleExpertCountChange = (newCount: number) => {
    if (newCount < 3 || newCount > 20) return;
    setNumExperts(newCount);
    setItems((prevItems) =>
      prevItems.map((item) => {
        let scores = [...item.expertScores];
        let essential = [...(item.expertEssentialVotes || [])];
        if (scores.length < newCount) {
          while (scores.length < newCount) {
            scores.push(4);
            essential.push(true);
          }
        } else if (scores.length > newCount) {
          scores = scores.slice(0, newCount);
          essential = essential.slice(0, newCount);
        }
        return { ...item, expertScores: scores as LikertRelevanceScore[], expertEssentialVotes: essential };
      })
    );
  };

  // Cập nhật điểm của chuyên gia cho một item
  const updateScore = (itemIndex: number, expertIndex: number, score: LikertRelevanceScore) => {
    setItems((prev) => {
      const copy = [...prev];
      const targetItem = { ...copy[itemIndex] };
      const newScores = [...targetItem.expertScores];
      newScores[expertIndex] = score;
      targetItem.expertScores = newScores;

      // Tự động đồng bộ cờ Essential: điểm 4 là Essential
      if (targetItem.expertEssentialVotes) {
        const newEssential = [...targetItem.expertEssentialVotes];
        newEssential[expertIndex] = score === 4;
        targetItem.expertEssentialVotes = newEssential;
      }
      copy[itemIndex] = targetItem;
      return copy;
    });
  };

  const handleAddItem = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newItemDesc.trim()) return;
    const newItem: CviItemEvaluation = {
      itemId: `ITEM-${String(items.length + 1).padStart(2, '0')}`,
      itemDescription: newItemDesc.trim(),
      expertScores: Array(numExperts).fill(4) as LikertRelevanceScore[],
      expertEssentialVotes: Array(numExperts).fill(true),
    };
    setItems((prev) => [...prev, newItem]);
    setNewItemDesc('');
  };

  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) {
      alert('Bảng kiểm cần ít nhất 1 tiêu chí.');
      return;
    }
    setItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Tính toán báo cáo CVI & CVR
  const report: StationValidationReport = useMemo(() => {
    return calculateStationCviCvr({
      stationId: 'ST-EVAL',
      stationName,
      chuyenKhoa,
      items,
      chairperson: 'Hội đồng Khoa học & Đào tạo CECICS - ĐHYK Phạm Ngọc Thạch',
    });
  }, [stationName, chuyenKhoa, items]);

  const minCvr = getMinimumAcceptableCvr(numExperts);

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden p-6 space-y-6">
      {/* Header công cụ */}
      <div className="border-b border-slate-200 pb-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold uppercase bg-blue-100 text-blue-800">
                Chuẩn Đo Lường Y Khoa Quốc Tế
              </span>
              <span className="text-xs text-slate-500">
                Lawshe (1975) &bull; Lynn (1986) &bull; Polit & Beck (2006)
              </span>
            </div>
            <h2 className="text-xl font-bold text-slate-900 mt-1">
              Thẩm Định Độ Giá Trị Nội Dung (CVI & CVR) Trạm Mô Phỏng & Bảng Kiểm OSCE
            </h2>
            <p className="text-sm text-slate-600 mt-1">
              Chứng thực độ phù hợp nội dung, độ thiết yếu và sự đồng thuận của Hội đồng chuyên gia y khoa lâm sàng trước khi đưa vào kỳ thi chính thức.
            </p>
          </div>

          {/* Huy hiệu tổng kết */}
          <div
            className={`px-4 py-3 rounded-lg border text-right ${
              report.isStationValid
                ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                : 'bg-amber-50 border-amber-200 text-amber-800'
            }`}
          >
            <div className="text-xs font-semibold uppercase tracking-wider">
              {report.isStationValid ? '✅ ĐẠT CHUẨN XUẤT SẮC' : '⚠️ CẦN RÀ SOÁT / CHỈNH SỬA'}
            </div>
            <div className="text-2xl font-black mt-0.5">
              S-CVI/Ave: {report.sCviAve}{' '}
              <span className="text-xs font-normal text-slate-600">/ 1.00 (Chuẩn &ge; 0.90)</span>
            </div>
            <div className="text-xs mt-0.5">
              CVR Trung bình: <strong>{report.averageCvr}</strong> &bull; S-CVI/UA:{' '}
              <strong>{report.sCviUa}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Cấu hình trạm và Hội đồng */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
            Tên trạm mô phỏng / Kỳ thi OSCE
          </label>
          <input
            type="text"
            value={stationName}
            onChange={(e) => setStationName(e.target.value)}
            className="w-full text-sm font-semibold border border-slate-300 rounded px-3 py-1.5 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
            Chuyên khoa / Bộ môn phụ trách
          </label>
          <input
            type="text"
            value={chuyenKhoa}
            onChange={(e) => setChuyenKhoa(e.target.value)}
            className="w-full text-sm border border-slate-300 rounded px-3 py-1.5 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-xs font-bold text-slate-700 uppercase mb-1">
            Số lượng chuyên gia y khoa trong Hội đồng (N = {numExperts})
          </label>
          <div className="flex items-center gap-2">
            <input
              type="range"
              min="3"
              max="16"
              value={numExperts}
              onChange={(e) => handleExpertCountChange(Number(e.target.value))}
              className="w-full accent-blue-600 cursor-pointer"
            />
            <span className="text-sm font-bold bg-white border border-slate-300 rounded px-2.5 py-1 text-slate-800 min-w-[36px] text-center">
              {numExperts}
            </span>
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            Ngưỡng CVR tối thiểu của Lawshe: <strong>{minCvr}</strong> (với N={numExperts})
          </div>
        </div>
      </div>

      {/* Bảng nhập liệu ma trận chấm điểm của chuyên gia */}
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-300 text-slate-700 uppercase font-bold text-[11px]">
              <th className="py-2.5 px-3 w-12 text-center">Mã</th>
              <th className="py-2.5 px-3 min-w-[280px]">Tiêu chí Bảng kiểm / Kỹ năng thực hiện</th>
              {Array.from({ length: numExperts }).map((_, idx) => (
                <th key={idx} className="py-2.5 px-1.5 text-center min-w-[44px]">
                  CG {idx + 1}
                </th>
              ))}
              <th className="py-2.5 px-2 text-center font-bold text-blue-700 min-w-[65px]">I-CVI</th>
              <th className="py-2.5 px-2 text-center font-bold text-indigo-700 min-w-[65px]">CVR</th>
              <th className="py-2.5 px-3 text-center min-w-[120px]">Khuyến nghị</th>
              <th className="py-2.5 px-2 text-center w-10">Xóa</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {items.map((item, itemIdx) => {
              const res = report.itemsResults[itemIdx];
              return (
                <tr key={item.itemId} className="hover:bg-slate-50">
                  <td className="py-2 px-3 text-center font-bold text-slate-600">{item.itemId}</td>
                  <td className="py-2 px-3 text-slate-800 font-medium">
                    {item.itemDescription}
                    <div className="text-[11px] text-slate-500 font-normal italic mt-0.5">
                      {res.note}
                    </div>
                  </td>

                  {/* Cột điểm của từng chuyên gia */}
                  {Array.from({ length: numExperts }).map((_, expertIdx) => {
                    const score = item.expertScores[expertIdx] || 4;
                    return (
                      <td key={expertIdx} className="py-2 px-1 text-center">
                        <select
                          value={score}
                          onChange={(e) =>
                            updateScore(itemIdx, expertIdx, Number(e.target.value) as LikertRelevanceScore)
                          }
                          className={`text-xs font-bold rounded px-1 py-1 border focus:outline-none focus:ring-1 ${
                            score === 4
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                              : score === 3
                              ? 'bg-blue-50 text-blue-700 border-blue-300'
                              : score === 2
                              ? 'bg-amber-50 text-amber-700 border-amber-300'
                              : 'bg-red-50 text-red-700 border-red-300'
                          }`}
                          title={`Chuyên gia ${expertIdx + 1}: ${score}/4`}
                        >
                          <option value={4}>4 (Thiết yếu)</option>
                          <option value={3}>3 (Phù hợp)</option>
                          <option value={2}>2 (Chỉnh sửa)</option>
                          <option value={1}>1 (Không liên quan)</option>
                        </select>
                      </td>
                    );
                  })}

                  {/* I-CVI */}
                  <td className="py-2 px-2 text-center font-bold">
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded text-[11px] ${
                        res.isICviAcceptable
                          ? 'bg-blue-100 text-blue-800'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {res.iCvi.toFixed(2)}
                    </span>
                  </td>

                  {/* CVR */}
                  <td className="py-2 px-2 text-center font-bold">
                    <span
                      className={`inline-block px-1.5 py-0.5 rounded text-[11px] ${
                        res.isCvrAcceptable
                          ? 'bg-indigo-100 text-indigo-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {res.cvr.toFixed(2)}
                    </span>
                  </td>

                  {/* Khuyến nghị */}
                  <td className="py-2 px-3 text-center">
                    <span
                      className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                        res.recommendation === 'GIỮ NGUYÊN'
                          ? 'bg-emerald-100 text-emerald-800'
                          : res.recommendation === 'CHỈNH SỬA BỔ SUNG'
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-rose-100 text-rose-800'
                      }`}
                    >
                      {res.recommendation}
                    </span>
                  </td>

                  {/* Xóa dòng */}
                  <td className="py-2 px-2 text-center">
                    <button
                      type="button"
                      onClick={() => handleRemoveItem(itemIdx)}
                      className="text-slate-400 hover:text-red-600 transition-colors"
                      title="Xóa tiêu chí"
                    >
                      ✕
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Form thêm tiêu chí mới */}
      <form onSubmit={handleAddItem} className="flex gap-2 pt-2">
        <input
          type="text"
          value={newItemDesc}
          onChange={(e) => setNewItemDesc(e.target.value)}
          placeholder="Nhập nội dung tiêu chí kỹ năng lâm sàng mới cần thẩm định..."
          className="flex-1 text-xs border border-slate-300 rounded px-3 py-2 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          className="bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs px-4 py-2 rounded transition-colors whitespace-nowrap"
        >
          + Thêm Tiêu Chí
        </button>
      </form>

      {/* Tóm tắt kết luận của Hội đồng */}
      <div className="bg-slate-50 border border-slate-200 rounded-lg p-4 text-xs space-y-2">
        <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
          <span>📜 Biên Bản Kết Luận Hội Đồng Thẩm Định Khoa Học:</span>
          <span className="text-slate-500 font-normal">Ngày thẩm định: {report.auditDate}</span>
        </div>
        <p className="text-slate-700 leading-relaxed">{report.congratulationSummary}</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-200 text-slate-600">
          <div>
            &bull; Tiêu chuẩn S-CVI/Ave: <strong>{report.sCviAve}</strong> (Ngưỡng đạt &ge; 0.90 theo Polit & Beck 2006)
          </div>
          <div>
            &bull; Đồng thuận tuyệt đối (S-CVI/UA): <strong>{report.sCviUa}</strong> (Tỷ lệ 100% chuyên gia tán thành)
          </div>
          <div>
            &bull; Ngưỡng Lawshe CVR tối thiểu: <strong>{minCvr}</strong> (với Hội đồng {numExperts} chuyên gia)
          </div>
        </div>
      </div>
    </div>
  );
}
