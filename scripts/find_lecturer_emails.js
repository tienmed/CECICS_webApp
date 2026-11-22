const tls = require('tls');

const user = 'cecics@pnt.edu.vn';
const pass = 'ytcydmmyaidfsfxq';

const socket = tls.connect(
  {
    host: 'imap.gmail.com',
    port: 993,
    rejectUnauthorized: false,
  },
  () => {
    console.log('Connected to IMAP server');
  }
);

socket.setEncoding('utf8');

let buffer = '';
let tagCounter = 100;

function nextTag() {
  return `A${String(tagCounter++).padStart(4, '0')}`;
}

function sendCommand(cmd) {
  const tag = nextTag();
  socket.write(`${tag} ${cmd}\r\n`);
  return tag;
}

let pendingResolves = {};

function waitTag(tag) {
  return new Promise((resolve, reject) => {
    pendingResolves[tag] = { resolve, reject };
  });
}

socket.on('data', (chunk) => {
  buffer += chunk;
  const lines = buffer.split('\r\n');
  buffer = lines.pop();

  for (const line of lines) {
    for (const tag of Object.keys(pendingResolves)) {
      if (line.startsWith(`${tag} `)) {
        const { resolve } = pendingResolves[tag];
        delete pendingResolves[tag];
        resolve(line);
      }
    }
  }
});

async function run() {
  try {
    await new Promise((r) => setTimeout(r, 1000));
    let tag = sendCommand(`LOGIN ${user} ${pass}`);
    await waitTag(tag);
    console.log('Logged in successfully.');

    // Select "[Gmail]/T&HqU-t c&HqM- th&AbA-" (All Mail)
    tag = sendCommand('SELECT "[Gmail]/T&HqU-t c&HqM- th&AbA-"');
    let selResp = await waitTag(tag);
    console.log('Select All Mail:', selResp);

    const lecturers = [
      { name: 'Nguyễn Minh Luân', phone: '0384808747', query: 'Luân 0384808747 OR "Nguyễn Minh Luân" OR luan' },
      { name: 'Nguyễn Thị Mỹ Linh', phone: '0903607915', query: 'Linh 0903607915 OR "Mỹ Linh" OR linh.ntm' },
      { name: 'Trịnh Trung Tiến', phone: '0989220934', query: 'Tiến 0989220934 OR "Trịnh Trung Tiến" OR tien.tt' },
      { name: 'Bùi Phan Quỳnh Phương', phone: '0989985275', query: 'Phương 0989985275 OR "Quỳnh Phương" OR phuong.bpq' },
      { name: 'Trần Tú Trinh', phone: '0975376758', query: 'Trinh 0975376758 OR "Tú Trinh" OR trinh.tt' },
      { name: 'Võ Kim Ngân', phone: '0908614742', query: 'Ngân 0908614742 OR "Kim Ngân" OR ngan.vk' },
      { name: 'Đặng Trần Ngọc Thanh', phone: '', query: '"Ngọc Thanh" OR "Đặng Trần Ngọc Thanh" OR thanh.dtn' },
    ];

    for (const lec of lecturers) {
      console.log(`\n========================================`);
      console.log(`Searching for: ${lec.name} (${lec.phone})`);
      
      const searchCmd = `UID SEARCH X-GM-RAW "${lec.query}"`;
      tag = sendCommand(searchCmd);

      const uids = await new Promise((resolve) => {
        let foundUids = [];
        const onData = (chunk) => {
          const lines = chunk.split('\r\n');
          for (const l of lines) {
            if (l.startsWith('* SEARCH')) {
              const parts = l.replace('* SEARCH', '').trim().split(/\s+/).filter(Boolean);
              foundUids.push(...parts);
            }
            if (l.startsWith(`${tag} `)) {
              socket.removeListener('data', onData);
              resolve(foundUids);
            }
          }
        };
        socket.on('data', onData);
      });

      console.log(`Matched ${uids.length} emails for ${lec.name}`);
      const latestUids = uids.slice(-5); // Lấy 5 email gần nhất

      if (latestUids.length > 0) {
        tag = sendCommand(`UID FETCH ${latestUids.join(',')} (BODY.PEEK[HEADER.FIELDS (FROM TO CC SUBJECT DATE)])`);
        let fetchBuffer = '';
        await new Promise((resolve) => {
          const onData = (chunk) => {
            fetchBuffer += chunk;
            if (chunk.includes(`${tag} OK`)) {
              socket.removeListener('data', onData);
              resolve();
            }
          };
          socket.on('data', onData);
        });

        const msgBlocks = fetchBuffer.split(/\* \d+ FETCH/);
        for (const block of msgBlocks) {
          if (!block.trim()) continue;
          const fromMatch = block.match(/From: ([^\r\n]+)/i);
          const toMatch = block.match(/To: ([^\r\n]+)/i);
          const ccMatch = block.match(/Cc: ([^\r\n]+)/i);
          const subjMatch = block.match(/Subject: ([^\r\n]+)/i);
          const dateMatch = block.match(/Date: ([^\r\n]+)/i);

          console.log('--- FOUND EMAIL ---');
          if (fromMatch) console.log('  From:', fromMatch[1]);
          if (toMatch) console.log('  To:', toMatch[1]);
          if (ccMatch) console.log('  Cc:', ccMatch[1]);
          if (subjMatch) console.log('  Subject:', subjMatch[1]);
          if (dateMatch) console.log('  Date:', dateMatch[1]);
        }
      }
    }

    socket.end();
  } catch (e) {
    console.error('Error:', e);
    socket.end();
  }
}

run();
