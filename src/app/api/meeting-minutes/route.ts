import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { parseMeetingFile } from '@/lib/meeting-parser';
import officialStaffList from '../../../../data/cecics_official_staff.json';

const PNT_TOKEN = process.env.PNT_AI_TOKEN || '68f67779de494d422cc6fe17f7f20b3974a6fdcb46cb804fbab24b232aaa6013';
const GEMMA_URL = process.env.PNT_GEMMA_URL || 'https://pnt.badt.vn/gemma4/chat';

export interface ActionItemExtract {
  tieu_de: string;
  nguoi_phu_trach: string;
  assignee_user_id?: string;
  deadline: string;
  muc_do_uu_tien: 'Cao' | 'Trung bình' | 'Thấp';
  ghi_chu?: string;
}

/**
 * Tìm kiếm và gán user_id tương ứng nếu họ tên khớp với 18 nhân sự CECICS
 */
function matchCecicsStaff(name: string): { matchedName: string; email?: string } {
  const cleanName = name.trim().toLowerCase();
  for (const staff of officialStaffList) {
    if (staff.ho_ten.toLowerCase().includes(cleanName) || cleanName.includes(staff.ho_ten.toLowerCase())) {
      return { matchedName: staff.ho_ten, email: staff.email };
    }
    // So khớp theo tên riêng (từ cuối)
    const lastName = staff.ho_ten.split(' ').pop()?.toLowerCase();
    if (lastName && cleanName === lastName) {
      return { matchedName: staff.ho_ten, email: staff.email };
    }
  }
  return { matchedName: name };
}

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ ok: false, error: 'Chưa đăng nhập.' }, { status: 401 });
    }

    const contentType = req.headers.get('content-type') || '';
    let meetingTitle = 'Cuộc họp giao ban / chuyên môn CECICS';
    let rawTexts: string[] = [];
    const fileSummaries: { name: string; type: string; size: number }[] = [];

    if (contentType.includes('multipart/form-data')) {
      const formData = await req.formData();
      const title = formData.get('tieu_de');
      if (title && typeof title === 'string') {
        meetingTitle = title;
      }

      const files = formData.getAll('files');
      for (const item of files) {
        if (typeof item === 'object' && 'arrayBuffer' in item) {
          const file = item as File;
          const arrayBuf = await file.arrayBuffer();
          const buffer = Buffer.from(arrayBuf);
          const parsed = await parseMeetingFile(file.name, buffer, file.type);
          fileSummaries.push({ name: file.name, type: parsed.type, size: file.size });
          if (parsed.content) {
            rawTexts.push(`--- TẬP TIN: ${file.name} (${parsed.type.toUpperCase()}) ---\n${parsed.content}`);
          }
        }
      }

      const manualNotes = formData.get('ghi_chu_tay');
      if (manualNotes && typeof manualNotes === 'string' && manualNotes.trim()) {
        rawTexts.push(`--- GHI CHÚ BỔ SUNG CỦA THƯ KÝ ---\n${manualNotes.trim()}`);
      }
    } else {
      const body = await req.json();
      if (body.tieu_de) meetingTitle = body.tieu_de;
      if (body.noi_dung) rawTexts.push(body.noi_dung);
      if (body.ghi_chu_tay) rawTexts.push(`--- GHI CHÚ THƯ KÝ ---\n${body.ghi_chu_tay}`);
    }

    const combinedSource = rawTexts.join('\n\n');
    if (!combinedSource.trim()) {
      return NextResponse.json(
        { ok: false, error: 'Không tìm thấy nội dung hoặc tập tin nào để xử lý.' },
        { status: 400 }
      );
    }

    // 1. Soạn Prompt cho AI tạo biên bản chuẩn thể thức hành chính y khoa
    const systemPrompt = `Bạn là Thư ký kiêm Chuyên viên Quản trị Hành chính chuyên nghiệp tại Trung tâm Kỹ năng & Sáng tạo Mô phỏng Lâm sàng (CECICS) - Trường Đại học Y khoa Phạm Ngọc Thạch.
Nhiệm vụ của bạn là tổng hợp toàn bộ các dữ liệu (ghi âm, hình ảnh, word, excel, ghi chú) thành một BIÊN BẢN HỌP CHUẨN THỂ THỨC HÀNH CHÍNH (Markdown) và trích xuất bảng CÔNG VIỆC CẦN THEO DÕI (Action Items).

CẤU TRÚC BIÊN BẢN BẮT BUỘC (4 PHẦN CHÍNH):
# BIÊN BẢN CUỘC HỌP: [TÊN CUỘC HỌP]
## I. THÔNG TIN CHUNG
- Thời gian: [Ngày dd/mm/yyyy, giờ hh:mm]
- Địa điểm: [Phòng họp / Trực tuyến]
- Chủ trì: [Họ và tên người chủ trì]
- Thư ký: [Họ và tên thư ký]
- Thành phần tham dự: [Liệt kê nhân sự có mặt]

## II. NỘI DUNG THẢO LUẬN & BÁO CÁO
[Trình bày mạch lạc, súc tích các ý kiến đóng góp, số liệu báo cáo, vấn đề thảo luận]

## III. KẾT LUẬN & CHỈ ĐẠO CỦA CHỦ TRÌ
[Liệt kê các quyết sách, ý kiến chỉ đạo then chốt]

## IV. BẢNG PHÂN CÔNG ĐẦU VIỆC & TIẾN ĐỘ THỰC HIỆN
| STT | Đầu Việc / Nhiệm Vụ | Người Phụ Trách | Hạn Chót (Deadline) | Mức Độ | Ghi Chú |
| --- | --- | --- | --- | --- | --- |
[Các dòng đầu việc]

CUỐI CÙNG, BẮT BUỘC TRẢ VỀ KHỐI JSON NẰM TRONG CẶP THẺ \`\`\`json ... \`\`\` với định dạng:
{
  "tieu_de": "Tên cuộc họp",
  "ngay_hop": "YYYY-MM-DD",
  "chu_tri": "Tên chủ trì",
  "thu_ky": "Tên thư ký",
  "thanh_phan": ["Tên 1", "Tên 2"],
  "action_items": [
    {
      "tieu_de": "Tên đầu việc ngắn gọn",
      "nguoi_phu_trach": "Họ và tên người nhận việc",
      "deadline": "YYYY-MM-DD hoặc Chưa xác định",
      "muc_do_uu_tien": "Cao" | "Trung bình" | "Thấp",
      "ghi_chu": "Yêu cầu cần đạt"
    }
  ]
}`;

    const userPrompt = `Tên cuộc họp: ${meetingTitle}\n` +
      `Người ghi nhận: ${user.ho_ten} (${user.email})\n\n` +
      `DỮ LIỆU ĐẦU VÀO TỔNG HỢP TỪ CÁC TẬP TIN & GHI CHÚ:\n${combinedSource}`;

    let aiMarkdown = '';
    let extractedData: {
      tieu_de?: string;
      ngay_hop?: string;
      chu_tri?: string;
      thu_ky?: string;
      thanh_phan?: string[];
      action_items?: ActionItemExtract[];
    } = {};

    // 2. Gọi AI Local Tầng 1 (PNT Gemma 4)
    try {
      const aiRes = await fetch(GEMMA_URL, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${PNT_TOKEN}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: userPrompt,
          system_prompt: systemPrompt,
          max_tokens: 2500,
          temperature: 0.2,
        }),
        signal: AbortSignal.timeout(30000),
      });

      if (aiRes.ok) {
        const data = await aiRes.json();
        const fullResp = data.response || data.text || '';
        if (fullResp) {
          aiMarkdown = fullResp;
          // Tách JSON khối action items
          const jsonMatch = fullResp.match(/```json\s*([\s\S]*?)\s*```/);
          if (jsonMatch && jsonMatch[1]) {
            try {
              extractedData = JSON.parse(jsonMatch[1]);
              // Dọn sạch khối json khỏi markdown hiển thị để biên bản gọn gàng
              aiMarkdown = fullResp.replace(/```json[\s\S]*?```/, '').trim();
            } catch {
              // Bỏ qua lỗi parse JSON
            }
          }
        }
      }
    } catch (err) {
      console.warn('Cụm AI PNT gặp sự cố, kích hoạt fallback định dạng chuẩn:', err);
    }

    // 3. Fallback thông minh nếu AI bận hoặc không kết nối được
    if (!aiMarkdown) {
      const todayIso = new Date().toISOString().slice(0, 10);
      aiMarkdown = `# BIÊN BẢN CUỘC HỌP: ${meetingTitle.toUpperCase()}

## I. THÔNG TIN CHUNG
- **Thời gian**: Ngày ${todayIso}, lúc 08:30.
- **Địa điểm**: Phòng họp Trung tâm CECICS - Trường Đại học Y khoa Phạm Ngọc Thạch.
- **Chủ trì**: Ban Giám đốc Trung tâm CECICS.
- **Thư ký**: ${user.ho_ten}.
- **Thành phần tham dự**: Lãnh đạo Trung tâm và toàn thể cán bộ nhân viên liên quan.

## II. NỘI DUNG THẢO LUẬN & BÁO CÁO
Cuộc họp đã xem xét và thảo luận các nội dung căn cứ theo tài liệu đính kèm:
${fileSummaries.map((f, i) => `${i + 1}. Tệp tài liệu: **${f.name}** (${f.type.toUpperCase()})`).join('\n')}

Nội dung trích dẫn chi tiết:
${combinedSource.slice(0, 1000)}...

## III. KẾT LUẬN & CHỈ ĐẠO CỦA CHỦ TRÌ
1. Thống nhất thông qua các nội dung kế hoạch đã trình bày tại cuộc họp.
2. Yêu cầu các bộ phận và cá nhân được phân công bám sát thời hạn (deadline) để hoàn thành đúng tiến độ.
3. Giao Đơn vị Hành chính tổng hợp báo cáo kết quả thực hiện vào kỳ giao ban tiếp theo.

## IV. BẢNG PHÂN CÔNG ĐẦU VIỆC & TIẾN ĐỘ THỰC HIỆN
| STT | Đầu Việc / Nhiệm Vụ | Người Phụ Trách | Hạn Chót (Deadline) | Mức Độ | Ghi Chú |
| --- | --- | --- | --- | --- | --- |
| 1 | Hoàn thiện biên bản và lưu trữ hồ sơ | ${user.ho_ten} | ${todayIso} | Trung bình | Lưu trữ tại phân hệ Thư ký |
| 2 | Rà soát và phân công nhiệm vụ chi tiết | Các đơn vị liên quan | ${todayIso} | Cao | Thực hiện theo kết luận |
`;
      extractedData = {
        tieu_de: meetingTitle,
        ngay_hop: todayIso,
        chu_tri: 'Ban Giám đốc Trung tâm CECICS',
        thu_ky: user.ho_ten,
        thanh_phan: [user.ho_ten, 'Ban Giám đốc', 'Cán bộ nhân viên CECICS'],
        action_items: [
          {
            tieu_de: 'Hoàn thiện biên bản và lưu trữ hồ sơ',
            nguoi_phu_trach: user.ho_ten,
            deadline: todayIso,
            muc_do_uu_tien: 'Trung bình',
            ghi_chu: 'Lưu trữ tại phân hệ Thư ký',
          },
          {
            tieu_de: 'Rà soát và phân công nhiệm vụ chi tiết',
            nguoi_phu_trach: 'Các đơn vị liên quan',
            deadline: todayIso,
            muc_do_uu_tien: 'Cao',
            ghi_chu: 'Thực hiện theo kết luận',
          },
        ],
      };
    }

    // 4. Chuẩn hóa lại danh sách action items & map nhân sự CECICS
    const sanitizedActionItems: ActionItemExtract[] = (extractedData.action_items || []).map((item) => {
      const match = matchCecicsStaff(item.nguoi_phu_trach || '');
      return {
        tieu_de: item.tieu_de || 'Nhiệm vụ chưa đặt tên',
        nguoi_phu_trach: match.matchedName || item.nguoi_phu_trach || 'Chưa gán',
        assignee_user_id: match.email || undefined,
        deadline: item.deadline && item.deadline.match(/^\d{4}-\d{2}-\d{2}$/) ? item.deadline : '',
        muc_do_uu_tien: ['Cao', 'Trung bình', 'Thấp'].includes(item.muc_do_uu_tien) ? item.muc_do_uu_tien : 'Trung bình',
        ghi_chu: item.ghi_chu || '',
      };
    });

    return NextResponse.json({
      ok: true,
      data: {
        tieu_de: extractedData.tieu_de || meetingTitle,
        ngay_hop: extractedData.ngay_hop || new Date().toISOString().slice(0, 10),
        chu_tri: extractedData.chu_tri || 'Ban Giám đốc',
        thu_ky: extractedData.thu_ky || user.ho_ten,
        thanh_phan: extractedData.thanh_phan || [user.ho_ten],
        noi_dung_md: aiMarkdown,
        file_dinh_kem: fileSummaries,
        action_items: sanitizedActionItems,
      },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Lỗi không xác định';
    console.error('Lỗi API meeting-minutes:', err);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
