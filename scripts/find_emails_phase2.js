const tls = require('tls');

const user = 'cecics@pnt.edu.vn';
const pass = 'ytcydmmyaidfsfxq';

const socket = tls.connect({ host: 'imap.gmail.com', port: 993, rejectUnauthorized: false });
socket.setEncoding('utf8');
let buffer = '';
let tag = 1;
function cmd(c) { const t = 'C' + tag++; socket.write(t + ' ' + c + '\r\n'); return t; }
let p = {};
socket.on('data', d => {
  buffer += d;
  const lines = buffer.split('\r\n');
  buffer = lines.pop();
  for (const l of lines) {
    for (const k of Object.keys(p)) {
      if (l.startsWith(k + ' ')) { const res = p[k]; delete p[k]; res(l); }
    }
  }
});
function wait(k) { return new Promise(r => p[k] = r); }

async function run() {
  await new Promise(r => setTimeout(r, 1000));
  await wait(cmd(`LOGIN ${user} ${pass}`));
  await wait(cmd('SELECT "[Gmail]/T&HqU-t c&HqM- th&AbA-"'));

  const queries = [
    '0903661133',
    '0778771795',
    '0909791002',
    'thunnp',
    'phuongthu',
    'thanhtinh',
    'tinhntt',
    'hangttm',
    'linhmd',
    'ngocthanh',
    'thanhdtn',
  ];

  for (const q of queries) {
    const t = cmd(`UID SEARCH TEXT "${q}"`);
    let uids = [];
    await new Promise(res => {
      const onD = chunk => {
        for (const l of chunk.split('\r\n')) {
          if (l.startsWith('* SEARCH')) uids.push(...l.replace('* SEARCH', '').trim().split(/\s+/).filter(Boolean));
          if (l.startsWith(t + ' ')) { socket.removeListener('data', onD); res(); }
        }
      };
      socket.on('data', onD);
    });
    console.log(`[${q}] found ${uids.length} emails`);
    if (uids.length > 0) {
      const ft = cmd(`UID FETCH ${uids.slice(-3).join(',')} (BODY.PEEK[HEADER.FIELDS (FROM TO CC SUBJECT DATE)])`);
      let raw = '';
      await new Promise(res => {
        const onD = chunk => {
          raw += chunk;
          if (chunk.includes(ft + ' OK')) { socket.removeListener('data', onD); res(); }
        };
        socket.on('data', onD);
      });
      for (const b of raw.split(/\* \d+ FETCH/)) {
        const from = (b.match(/From: ([^\r\n]+)/i) || [])[1];
        const to = (b.match(/To: ([^\r\n]+)/i) || [])[1];
        const cc = (b.match(/Cc: ([^\r\n]+)/i) || [])[1];
        if (from || to) console.log('  ', { from, to, cc });
      }
    }
  }
  socket.end();
}
run();
