'use client';

import React, { useState, useEffect } from 'react';

interface AiAdvisorModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialMode?: 'conflict' | 'osce_cluster' | 'general';
  conflicts?: Array<{ id: string; resourceId: string; label?: string }>;
  sessionInfo?: {
    session_id?: string;
    hoc_phan?: string;
    bai_giang?: string;
    ngay?: string;
    gio_bd?: string;
    gio_kt?: string;
    campus_id?: string;
  };
}

export function AiAdvisorModal({
  isOpen,
  onClose,
  initialMode = 'general',
  conflicts = [],
  sessionInfo = {},
}: AiAdvisorModalProps) {
  const [activeTab, setActiveTab] = useState<'advisor' | 'qa'>(
    initialMode === 'conflict' ? 'advisor' : 'qa'
  );
  const [loading, setLoading] = useState(false);
  const [adviceText, setAdviceText] = useState<string>('');
  const [source, setSource] = useState<string>('');
  const [userQuery, setUserQuery] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (isOpen) {
      if (initialMode === 'conflict' && conflicts.length > 0) {
        setActiveTab('advisor');
        fetchAdvice('conflict');
      } else if (!adviceText) {
        fetchAdvice('osce_cluster');
      }
    }
  }, [isOpen, initialMode, conflicts.length]);

  async function fetchAdvice(mode: string, customQuery?: string) {
    setLoading(true);
    try {
      const res = await fetch('/api/ai-advisor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode,
          prompt: customQuery || userQuery,
          conflicts,
          sessionInfo,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setAdviceText(data.advice || 'Không nhận được phản hồi từ AI.');
        setSource(data.source === 'pnt_gemma4_cluster' ? 'Cụm AI PNT (Gemma 4)' : 'Thuật toán dự phòng');
      } else {
        setAdviceText(`⚠️ Lỗi: ${data.error}`);
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Lỗi kết nối';
      setAdviceText(`⚠️ Lỗi kết nối tới dịch vụ AI: ${message}`);
    } finally {
      setLoading(false);
    }
  }

  function handleQuickPrompt(promptText: string) {
    setUserQuery(promptText);
    setActiveTab('qa');
    fetchAdvice('general', promptText);
  }

  function copyToClipboard() {
    if (!adviceText) return;
    navigator.clipboard.writeText(adviceText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-800 to-teal-700 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-white/20 flex items-center justify-center text-xl">
              🤖
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-lg">Trợ Lý AI CECICS</h3>
                <span className="text-[11px] font-semibold px-2 py-0.5 rounded bg-teal-500/40 text-teal-100">
                  ✨ Gemma 4
                </span>
              </div>
              <p className="text-xs text-teal-200">
                Tư vấn phân bổ 5 nhóm phòng (OSCE, Phản hồi, Kỹ năng, Simulation, Phòng họp)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition-colors text-lg leading-none"
          >
            ✕
          </button>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-200 bg-slate-50 px-6 pt-3 gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('advisor')}
            className={`pb-2.5 px-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'advisor'
                ? 'border-teal-700 text-teal-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            💡 Tư vấn Xung đột &amp; Gợi ý Phòng
            {conflicts.length > 0 && (
              <span className="h-5 w-5 rounded-full bg-red-100 text-red-700 text-xs flex items-center justify-center font-bold">
                {conflicts.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('qa')}
            className={`pb-2.5 px-3 text-sm font-semibold border-b-2 transition-colors flex items-center gap-2 ${
              activeTab === 'qa'
                ? 'border-teal-700 text-teal-800'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            💬 Hỏi đáp Trợ lý AI
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6 overflow-y-auto flex-1 space-y-4">
          {/* Conflict Banner if applicable */}
          {conflicts.length > 0 && activeTab === 'advisor' && (
            <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs sm:text-sm flex items-start gap-3">
              <span className="text-lg">⚠️</span>
              <div>
                <span className="font-bold">Cảnh báo giao thoa thời gian ({conflicts.length} ca):</span>
                <ul className="list-disc list-inside mt-1 space-y-0.5 text-xs text-amber-800">
                  {conflicts.map((c, i) => (
                    <li key={i}>
                      Phòng <strong>{c.resourceId}</strong> trùng với buổi: <em>{c.label || c.id}</em>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}

          {/* Quick Prompts Chips */}
          <div className="space-y-1.5">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
              Gợi ý câu hỏi nhanh:
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => handleQuickPrompt('Gợi ý bố trí 6 trạm thi chạy trạm OSCE cùng tầng')}
                className="text-xs bg-slate-100 hover:bg-teal-50 hover:text-teal-800 border border-slate-200 hover:border-teal-300 rounded-lg px-2.5 py-1.5 transition-colors text-slate-700"
              >
                🏥 Bố trí 6 trạm thi OSCE
              </button>
              <button
                type="button"
                onClick={() => handleQuickPrompt('Phối hợp phòng mô phỏng High-Fidelity (Simulation + Debriefing)')}
                className="text-xs bg-slate-100 hover:bg-teal-50 hover:text-teal-800 border border-slate-200 hover:border-teal-300 rounded-lg px-2.5 py-1.5 transition-colors text-slate-700"
              >
                🔄 Combo Simulation + Phản hồi
              </button>
              <button
                type="button"
                onClick={() => handleQuickPrompt('Quy tắc giải quyết xung đột lịch tại CECICS')}
                className="text-xs bg-slate-100 hover:bg-teal-50 hover:text-teal-800 border border-slate-200 hover:border-teal-300 rounded-lg px-2.5 py-1.5 transition-colors text-slate-700"
              >
                ⚖️ Quy tắc giải quyết xung đột
              </button>
            </div>
          </div>

          {/* AI Response Display */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 min-h-[160px] relative">
            <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200/60 text-xs text-slate-500">
              <span className="flex items-center gap-1.5 font-medium">
                ✨ Nguồn: {source || 'Sẵn sàng'}
              </span>
              {adviceText && (
                <button
                  type="button"
                  onClick={copyToClipboard}
                  className="inline-flex items-center gap-1 hover:text-slate-900 text-slate-600"
                >
                  {copied ? '✓ Đã sao chép' : '📋 Sao chép'}
                </button>
              )}
            </div>

            {loading ? (
              <div className="py-8 text-center text-slate-500 text-sm flex flex-col items-center justify-center gap-2">
                <div className="animate-spin h-6 w-6 border-2 border-teal-600 border-t-transparent rounded-full" />
                <span>Trợ lý Gemma 4 đang phân tích và soạn thảo lời khuyên...</span>
              </div>
            ) : adviceText ? (
              <div className="text-sm text-slate-800 whitespace-pre-line leading-relaxed font-sans">
                {adviceText}
              </div>
            ) : (
              <div className="py-8 text-center text-slate-400 text-sm">
                Bấm vào các gợi ý bên trên hoặc nhập câu hỏi để nhận tư vấn từ Trợ lý AI.
              </div>
            )}
          </div>
        </div>

        {/* Footer Input */}
        <div className="p-4 bg-white border-t border-slate-200 flex items-center gap-2">
          <input
            type="text"
            value={userQuery}
            onChange={(e) => setUserQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && userQuery.trim() && !loading) {
                fetchAdvice('general');
              }
            }}
            placeholder="Hỏi trợ lý AI về bố trí phòng, trạm OSCE, thiết bị..."
            className="flex-1 text-sm border border-slate-300 rounded-xl px-3.5 py-2.5 focus:outline-hidden focus:ring-2 focus:ring-teal-600"
          />
          <button
            type="button"
            disabled={!userQuery.trim() || loading}
            onClick={() => fetchAdvice('general')}
            className="px-4 py-2.5 bg-teal-700 hover:bg-teal-800 disabled:opacity-50 text-white rounded-xl text-sm font-semibold flex items-center gap-2 shadow-xs transition-colors"
          >
            <span>Gửi</span>
            <span>➤</span>
          </button>
        </div>
      </div>
    </div>
  );
}
