'use strict';
// Test source assets with Node and isolated Chromium; never rebuild or invoke the Windows launcher.
const {spawnSync}=require('node:child_process');
const result=spawnSync(process.execPath,['--test','tests/renderers.test.cjs'],{cwd:require('node:path').resolve(__dirname,'..'),stdio:'inherit',env:{...process.env,UFV_TEST_SOURCE:'1'}});
if(result.error)throw result.error;
process.exitCode=result.status??1;
