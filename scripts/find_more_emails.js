const tls = require('tls');

const user = 'cecics@pnt.edu.vn';
const pass = 'ytcydmmyaidfsfxq';

const socket = tls.connect(
  {
    host: 'imap.gmail.com',
    port: 993,
    rejectUnauthorized: false,
  },
  () => {}
);

socket.setEncoding('utf8');
let buffer = '';
let tagCounter = 1;

function sendCommand(cmd) {
  const tag = `T${tagCounter++}`;
  socket.write(`${tag} ${cmd}\r\n`);
  return tag;
}

let pending = {};
socket.on('data', (chunk) => {
  buffer += chunk;
  const lines = buffer.split('\r\n');
  buffer = lines.pop();

  for (const line of lines) {
    for (const tag of Object.keys(pending)) {
      if (line.startsWith(`${tag} `)) {
        const { resolve } = pending[tag];
        delete pending[tag];
        resolve(line);
      }
    }
  }
});

function waitTag(tag) {
  return new Promise((resolve, reject) => {
    pending[tag] = { resolve, reject };
  });
}

async function searchUids(cmd) {
  const t = sendCommand(cmd);
  const uids = [];
  await new Promise((resolve) => {
    const onData = (chunk) => {
      const lines = chunk.split('\r\n');
      for (const l of lines) {
        if (l.startsWith('* SEARCH')) {
          const parts = l.replace('* SEARCH', '').trim().split(/\s+/).filter(Boolean);
          uids.push(...parts);
        }
        if (l.startsWith(`${t} `)) {
          socket.removeListener('data', onData);
          resolve();
        }
      }
    };
    socket.on('data', onData);
  });
  return uids;
}

async function fetchHeaders(uids) {
  if (uids.length === 0) return [];
  const t = sendCommand(`UID FETCH ${uids.join(',')} (BODY.PEEK[HEADER.FIELDS (FROM TO CC SUBJECT DATE)])`);
  let raw = '';
  await new Promise((resolve) => {
    const onData = (chunk) => {
      raw += chunk;
      if (chunk.includes(`${t} OK`)) {
        socket.removeListener('data', onData);
        resolve();
      }
    };
    socket.on('data', onData);
  });

  const results = [];
  const blocks = raw.split(/\* \d+ FETCH/);
  for (const block of blocks) {
    if (!block.trim()) continue;
    const from = (block.match(/From: ([^\r\n]+)/i) || [])[1] || '';
    const to = (block.match(/To: ([^\r\n]+)/i) || [])[1] || '';
    const cc = (block.match(/Cc: ([^\r\n]+)/i) || [])[1] || '';
    const subject = (block.match(/Subject: ([^\r\n]+)/i) || [])[1] || '';
    const date = (block.match(/Date: ([^\r\n]+)/i) || [])[1] || '';
    results.push({ from, to, cc, subject, date });
  }
  return results;
}

async function run() {
  try {
    await new Promise((r) => setTimeout(r, 1000));
    let t = sendCommand(`LOGIN ${user} ${pass}`);
    await waitTag(t);

    t = sendCommand('SELECT "[Gmail]/T&HqU-t c&HqM- th&AbA-"');
    await waitTag(t);

    const searches = [
      'trinh',
      'bstrinh',
      'tutrinh',
      'trinhtt',
      'thunnp',
      'phuongthu',
      'ngocphuongthu',
      'lananh',
      'bslananh',
      'anhntl',
      'kimngan',
      'nganvk',
      'ngocthanh',
      'thanhdtn',
      'khoadd-ktyh',
    ];

    for (const q of searches) {
      const uids = await searchUids(`UID SEARCH TEXT "${q}"`);
      console.log(`Query "${q}": found ${uids.length} uids`);
      if (uids.length > 0) {
        const top = uids.slice(-3);
        const headers = await fetchHeaders(top);
        for (const h of headers) {
          console.log(` [${q}] From: ${h.from} | To: ${h.to} | Cc: ${h.cc} | Subj: ${h.subject}`);
        }
      }
    }

    socket.end();
  } catch (err) {
    console.error(err);
    socket.end();
  }
}

run();
