import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

const PNT_TOKEN = process.env.PNT_AI_TOKEN || '68f67779de494d422cc6fe17f7f20b3974a6fdcb46cb804fbab24b232aaa6013';
const GEMMA_URL = process.env.PNT_GEMMA_URL || 'https://pnt.badt.vn/gemma4/chat';

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Chưa đăng nhập.' }, { status: 401 });
    }

    const body = await req.json();
    const { mode = 'general', prompt, conflicts = [], roomGroups = {}, sessionInfo = {} } = body;

    let sysPrompt = 'Bạn là Trợ lý AI Chuyên gia Điều phối Trung tâm Kỹ năng & Sáng tạo Mô phỏng Lâm sàng (CECICS) - Trường Đại học Y khoa Phạm Ngọc Thạch.';
    let userPrompt = '';

    if (mode === 'conflict') {
      sysPrompt += ' Nhiệm vụ: Phân tích nguyên nhân xung đột lịch và đưa ra lời khuyên y khoa/vận hành ấm áp, giải thích dễ hiểu, đề xuất giải pháp thay thế phù hợp.';
      userPrompt = `PHÁT HIỆN XUNG ĐỘT LỊCH PHÒNG:\n` +
        `Thông tin buổi học: ${sessionInfo.hoc_phan || ''} - ${sessionInfo.bai_giang || ''} (Ngày ${sessionInfo.ngay || ''}, ca ${sessionInfo.gio_bd || ''}-${sessionInfo.gio_kt || ''}).\n` +
        `Danh sách xung đột: ${JSON.stringify(conflicts, null, 2)}\n\n` +
        `Hãy phân tích nguyên nhân và đề xuất 2-3 hướng giải quyết theo cấu trúc 3 phần:\n` +
        `1. Tóm tắt nguyên nhân giao thoa thời gian.\n` +
        `2. Đề xuất phương án phòng thay thế hoặc điều chỉnh ca học.\n` +
        `3. Lưu ý vận hành và đảm bảo an toàn thiết bị mô phỏng.`;
    } else if (mode === 'osce_cluster' || mode === 'combo') {
      sysPrompt += ' Nhiệm vụ: Tư vấn phối hợp các nhóm phòng CECICS (OSCE, Phản hồi/Debriefing, Kỹ năng/Skills Lab, Simulation, Phòng họp).';
      userPrompt = `YÊU CẦU ĐIỀU PHỐI MÔ PHỎNG:\n${prompt || 'Tư vấn phân bổ phòng theo 5 nhóm cho hoạt động mô phỏng / thi chạy trạm OSCE.'}\n` +
        `Cơ cấu phòng hiện có: ${JSON.stringify(roomGroups, null, 2)}\n\n` +
        `Hãy tư vấn phương án bố trí các phòng tối ưu, chú ý luồng di chuyển của học viên/thí sinh và phân bổ phòng phản hồi (debriefing).`;
    } else {
      userPrompt = prompt || 'Giới thiệu các nhóm phòng tại trung tâm CECICS.';
    }

    // 1. Gọi cụm AI PNT Gemma 4
    try {
      const aiRes = await fetch(GEMMA_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${PNT_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: userPrompt,
          system_prompt: sysPrompt,
          max_tokens: 800,
          temperature: 0.2,
        }),
        signal: AbortSignal.timeout(15000),
      });

      if (aiRes.ok) {
        const data = await aiRes.json();
        const text = data.response || data.text || '';
        if (text) {
          return NextResponse.json({
            ok: true,
            source: 'pnt_gemma4_cluster',
            model: data.model || 'google/gemma-4-e2b-it',
            advice: text,
            usage: data.usage,
          });
        }
      }
    } catch {
      // Bỏ qua lỗi và chuyển sang fallback an toàn
    }

    // 2. Fallback Rule-Based an toàn khi cụm AI bận hoặc mất mạng
    const fallbackAdvice = mode === 'conflict'
      ? `### Lời khuyên điều phối (Hệ thống dự phòng):\n` +
        `- **Nguyên nhân**: Đã có lớp khác chiếm dụng một trong các phòng bạn chọn trong cùng khung giờ.\n` +
        `- **Giải pháp**: Ưu tiên kiểm tra danh sách phòng trống cùng cơ sở hoặc chuyển ca học sang khung giờ kế tiếp.\n` +
        `- **Gợi ý**: Với hoạt động cần phòng Phản hồi (Debriefing), có thể tận dụng phòng họp lân cận nếu phòng debriefing chính bị trùng.`
      : `### Hướng dẫn phân bổ phòng mô phỏng CECICS:\n` +
        `- Hoạt động Simulation High-Fidelity: Bắt buộc kết hợp 1 phòng Simulation + 1 phòng Phản hồi (Debriefing).\n` +
        `- Hoạt động thi OSCE: Phân bổ các trạm liên tiếp cùng tầng (OSCE 1 đến OSCE n) để tối ưu luồng di chuyển của sinh viên.`;

    return NextResponse.json({
      ok: true,
      source: 'rule_based_fallback',
      advice: fallbackAdvice,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Lỗi không xác định';
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
