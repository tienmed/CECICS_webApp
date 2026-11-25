import fs from 'fs';
import crypto from 'crypto';

interface SessionRecord {
  session_id: string;
  loai: string;
  he: string;
  hoc_phan: string;
  bai_giang: string;
  lop: string;
  ngay: string;
  gio_bd: string;
  gio_kt: string;
  campus_id: string;
  giang_vien_id: string;
  room_id: string;
  trang_thai: string;
  calendar_event_id?: string;
  rsvp?: string;
  ghi_chu?: string;
}

interface UserRecord {
  user_id: string;
  email: string;
  ho_ten: string;
  vai_tro: string[];
  don_vi: string;
  email_ca_nhan?: string;
}

interface RoomRecord {
  room_id: string;
  ten: string;
  campus_id: string;
}

function loadEnv(): { url: string; secret: string } {
  let url = process.env.GAS_WEBAPP_URL || '';
  let secret = process.env.GAS_HMAC_SECRET || '';

  if (fs.existsSync('.env.local')) {
    const lines = fs.readFileSync('.env.local', 'utf8').split('\n');
    for (const line of lines) {
      if (line.startsWith('GAS_WEBAPP_URL=')) url = line.split('=')[1].trim();
      if (line.startsWith('GAS_HMAC_SECRET=')) secret = line.split('=')[1].trim();
    }
  }

  return { url, secret };
}

async function runRetrofit() {
  console.log('================================================================');
  console.log('CECICS - QUÉT & ĐỒNG BỘ GOOGLE CALENDAR TỪ ĐẦU TUẦN (23/11/2026)');
  console.log('Tài khoản chủ trì: cecics@pnt.edu.vn | Cơ chế: sendInvites: false');
  console.log('================================================================\n');

  const { url, secret } = loadEnv();
  const dbRaw = fs.readFileSync('.data/db.json', 'utf8');
  const db = JSON.parse(dbRaw);

  const users: UserRecord[] = db.Users;
  const userMap = new Map(users.map((u) => [u.user_id, u]));
  const rooms: RoomRecord[] = db.Rooms;
  const roomMap = new Map(rooms.map((r) => [r.room_id, r]));

  const targetDate = '2026-11-23';
  const targetSessions: SessionRecord[] = db.Sessions.filter(
    (s: SessionRecord) => s.ngay >= targetDate && s.trang_thai !== 'Đã hủy'
  );

  console.log(`Tìm thấy ${targetSessions.length} buổi học/họp/coi thi từ ${targetDate}:`);
  console.log('----------------------------------------------------------------');

  const attendeePreviewList: Array<{
    session_id: string;
    ngay: string;
    gio: string;
    loai: string;
    title: string;
    phong: string;
    attendees: string[];
  }> = [];

  for (const s of targetSessions) {
    const attendeeEmails: string[] = [];
    const seen: Record<string, boolean> = {};

    const addEmail = (em?: string) => {
      if (!em) return;
      const clean = em.trim().toLowerCase();
      if (clean && clean.includes('@') && !seen[clean]) {
        seen[clean] = true;
        attendeeEmails.push(clean);
      }
    };

    if (s.loai === 'Họp' || s.giang_vien_id === 'U-CECICS-ALL') {
      for (const u of users) {
        const roles = u.vai_tro || [];
        const isCecics =
          u.don_vi === 'CECICS' ||
          u.don_vi === 'BAN_LANH_DAO' ||
          roles.includes('ADMIN') ||
          roles.includes('LANH_DAO') ||
          roles.includes('DIEU_PHOI');
        if (isCecics) {
          addEmail(u.email);
          if (u.email_ca_nhan) addEmail(u.email_ca_nhan);
        }
      }
      addEmail('cecics@pnt.edu.vn');
      addEmail('bstien@pnt.edu.vn');
      addEmail('thunnp@pnt.edu.vn');
    } else {
      const gv = userMap.get(s.giang_vien_id);
      if (gv) {
        addEmail(gv.email);
        if (gv.email_ca_nhan) addEmail(gv.email_ca_nhan);
      }
    }

    const rids = (s.room_id || '').split(',').map((r) => r.trim()).filter(Boolean);
    const roomName =
      rids.length > 0
        ? rids.map((id) => roomMap.get(id)?.ten || id).join(', ')
        : 'Chưa gán phòng';

    attendeePreviewList.push({
      session_id: s.session_id,
      ngay: s.ngay,
      gio: `${s.gio_bd} - ${s.gio_kt}`,
      loai: s.loai,
      title: s.bai_giang || s.hoc_phan,
      phong: roomName,
      attendees: attendeeEmails,
    });
  }

  // In mẫu 5 buổi đầu tiên
  attendeePreviewList.slice(0, 5).forEach((item, idx) => {
    console.log(
      `[${idx + 1}] ${item.ngay} (${item.gio}) [${item.loai}] ${item.title}`
    );
    console.log(`    📍 Phòng: ${item.phong}`);
    console.log(`    👥 Attendees (${item.attendees.length}): ${item.attendees.join(', ')}`);
  });
  if (attendeePreviewList.length > 5) {
    console.log(`... và ${attendeePreviewList.length - 5} buổi tiếp theo.`);
  }

  console.log('\n----------------------------------------------------------------');
  console.log('BẮT ĐẦU GỌI GOOGLE APPS SCRIPT WEB APP (Action: retrofitCalendar)...');

  if (!url || !secret) {
    console.error('❌ Thiếu GAS_WEBAPP_URL hoặc GAS_HMAC_SECRET trong môi trường.');
    return;
  }

  const action = 'retrofitCalendar';
  const actor = 'cecics@pnt.edu.vn';
  const payload = { fromDate: targetDate };
  const ts = Date.now();
  const canonical = `${action}|${actor}|${ts}|${JSON.stringify(payload)}`;
  const sig = crypto.createHmac('sha256', secret).update(canonical, 'utf8').digest('hex');

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ action, payload, actor, ts, sig }),
      redirect: 'follow',
    });

    console.log(`Trạng thái phản hồi HTTP: ${res.status}`);
    const resText = await res.text();
    let resJson: any = null;
    try {
      resJson = JSON.parse(resText);
    } catch {
      console.log('Raw response:', resText);
    }

    if (resJson && resJson.ok) {
      console.log('✅ ĐỒNG BỘ THÀNH CÔNG LÊN GOOGLE CALENDAR QUA APPS SCRIPT!');
      console.log('Chi tiết phản hồi:', resJson.data);
    } else {
      console.log('⚠️ Phản hồi từ GAS:', resJson || resText);
      console.log(
        '\n💡 LƯU Ý TRIỂN KHAI APPS SCRIPT: Nếu phiên bản Web App trên Google Apps Script chưa được cập nhật file mới, Thầy/Cô chỉ cần mở Apps Script Editor của tài khoản cecics@pnt.edu.vn, copy nội dung file "apps-script/dist/ALL_IN_ONE_CODE.js" vào và bấm "Triển khai mới" (New Deployment).'
      );
    }
  } catch (err) {
    console.error('❌ Lỗi kết nối đến GAS Web App:', err);
  }
}

runRetrofit();
