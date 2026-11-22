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

  const t = cmd('UID SEARCH TEXT "0903661133"');
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

  console.log('Uids for 0903661133:', uids);
  if (uids.length > 0) {
    const ft = cmd(`UID FETCH ${uids.slice(-2).join(',')} (BODY.PEEK[TEXT])`);
    let raw = '';
    await new Promise(res => {
      const onD = chunk => {
        raw += chunk;
        if (chunk.includes(`${ft} OK`)) { socket.removeListener('data', onD); res(); }
      };
      socket.on('data', onD);
    });

    const emailMatches = raw.match(/[a-zA-Z0-9._%+-]+@pnt\.edu\.vn/g) || [];
    console.log('PNT emails found in body of 0903661133:', [...new Set(emailMatches)]);
    // Print snippet around 0903661133
    const idx = raw.indexOf('0903661133');
    if (idx !== -1) {
      console.log('Snippet:', raw.substring(Math.max(0, idx - 200), idx + 200));
    }
  }

  // Also check 0778771795
  const t2 = cmd('UID SEARCH TEXT "0778771795"');
  let uids2 = [];
  await new Promise(res => {
    const onD = chunk => {
      for (const l of chunk.split('\r\n')) {
        if (l.startsWith('* SEARCH')) uids2.push(...l.replace('* SEARCH', '').trim().split(/\s+/).filter(Boolean));
        if (l.startsWith(t2 + ' ')) { socket.removeListener('data', onD); res(); }
      }
    };
    socket.on('data', onD);
  });
  console.log('Uids for 0778771795:', uids2);
  if (uids2.length > 0) {
    const ft2 = cmd(`UID FETCH ${uids2.join(',')} (BODY.PEEK[TEXT])`);
    let raw2 = '';
    await new Promise(res => {
      const onD = chunk => {
        raw2 += chunk;
        if (chunk.includes(`${ft2} OK`)) { socket.removeListener('data', onD); res(); }
      };
      socket.on('data', onD);
    });
    const emailMatches2 = raw2.match(/[a-zA-Z0-9._%+-]+@pnt\.edu\.vn/g) || [];
    console.log('PNT emails found in body of 0778771795:', [...new Set(emailMatches2)]);
    const idx2 = raw2.indexOf('0778771795');
    if (idx2 !== -1) {
      console.log('Snippet 2:', raw2.substring(Math.max(0, idx2 - 200), idx2 + 200));
    }
  }

  socket.end();
}
run();
