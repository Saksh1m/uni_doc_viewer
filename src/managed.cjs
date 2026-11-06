'use strict';
// This channel is a private anonymous pipe owned by the Windows broker host.
// Browser HTTP requests cannot register paths or reach these commands.
const path = require('node:path');
const {createBroker} = require('./broker.cjs');
const {ViewerError} = require('./snapshot.cjs');
const {FORMATS} = require('./formats.cjs');
const MAX_MESSAGE = 65536;

async function startManaged({input = process.stdin, output = process.stdout, options = {}} = {}) {
 const broker = await createBroker(options);
 const stop = () => { input.destroy(); void broker.close(); };
 input.on('error', stop);
 input.on('close', () => void broker.close());
 output.on('error', stop);
 broker.server.once('close', () => input.destroy());
 const send = value => output.write(JSON.stringify(value) + '\n');
 send({ready: '1'});
 const finished = (async () => {
  let pending = Buffer.alloc(0);
  try {
   for await (const chunk of input) {
    pending = Buffer.concat([pending, chunk]);
    if (pending.length > MAX_MESSAGE) throw new Error('Oversized private message');
    let end;
    while ((end = pending.indexOf(10)) >= 0) {
     const line = pending.subarray(0, end).toString('utf8');
     pending = pending.subarray(end + 1);
     try {
      const command = JSON.parse(line);
      if (command?.op === 'open' && typeof command.path === 'string') {
       if (!FORMATS.includes(path.extname(command.path).slice(1).toLowerCase())) throw new ViewerError('This file format is not supported by the installed viewer.');
       send(await broker.registerFile(command.path));
      } else if (command?.op === 'revoke' && /^[a-f0-9]{32}$/.test(command.fileId || '')) {
       broker.revoke(command.fileId); send({ok: '1'});
      } else send({error: 'The local viewer received an unsupported request.'});
     } catch (error) {
      send({error: error instanceof ViewerError ? error.message : 'The local viewer could not process this request. Reopen the file.'});
     }
    }
   }
  } catch { /* Broken or oversized private channel: close without logging secrets. */ }
  finally { await broker.close(); input.destroy(); }
 })();
 return {broker, finished};
}
module.exports = {startManaged};
if (require.main === module) {
 startManaged().then(({broker}) => {
  process.once('SIGTERM', () => void broker.close());
  process.once('SIGINT', () => void broker.close());
 }).catch(() => { process.stderr.write('The local viewer could not start.\n'); process.exitCode = 1; });
}
