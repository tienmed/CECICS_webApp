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

async function run() {
  try {
    await new Promise((r) => setTimeout(r, 1000));
    let t = sendCommand(`LOGIN ${user} ${pass}`);
    await waitTag(t);

    const folders = [
      'INBOX',
      '"B&Htk- m&APQ-n/N&Htk-i"',
      '"B&Htk- m&APQ-n/Ngo&HqE-i"',
      '"B&Htk- m&APQ-n/&ARA-i&HsE-u d&AbAe4Q-ng"',
      '"Ph&API-ngBan/Qu&HqM-n l&AP0- &AREA4A-o t&HqE-o"',
      '"[Gmail]/T&HqU-t c&HqM- th&AbA-"',
    ];

    for (const f of folders) {
      t = sendCommand(`EXAMINE ${f}`);
      let lines = [];
      const onData = (chunk) => {
        lines.push(chunk);
      };
      socket.on('data', onData);
      const res = await waitTag(t);
      socket.removeListener('data', onData);
      console.log(`EXAMINE ${f} ->`, res);
      for (const raw of lines) {
        for (const l of raw.split('\r\n')) {
          if (l.includes('EXISTS')) console.log(' ', l);
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
