import fs from "node:fs";
import assert from "node:assert/strict";
import vm from "node:vm";
import ts from "typescript";
const timers=new Map();let id=0,data='data:image/jpeg;base64,QQ==';
const win={setTimeout:fn=>{timers.set(++id,fn);return id;},clearTimeout:id=>timers.delete(id)};
class FileReader{readAsDataURL(){this.result=data;queueMicrotask(()=>this.onload());}}
const sandbox={exports:{},window:win,FileReader,queueMicrotask,navigator:{},DOMException};
vm.runInNewContext(ts.transpile(fs.readFileSync('features/social/lib/native-social.ts','utf8'),{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}),sandbox);
const api=sandbox.exports,keys=()=>Object.keys(win).filter(k=>k.startsWith('__avenzo'));
(async()=>{
 assert.equal(api.hasNativePhotoStudio(),false);await assert.rejects(()=>api.processStudioImage({},'frame'),/latest/);
 win.AvenzoNative={processStudioImage:(url,action,callback)=>{assert.equal(action,'frame');win[callback](JSON.stringify({ok:true,image:'data:image/png;base64,QQ=='}));}};
 assert.equal((await api.processStudioImage({},'frame')).ok,true);assert.equal(keys().length,0);assert.equal(timers.size,0);
 win.AvenzoNative.processStudioImage=(u,a,c)=>win[c]('{bad');await assert.rejects(()=>api.processStudioImage({},'codes'),/read the result/);assert.equal(keys().length,0);
 win.AvenzoNative.processStudioImage=(u,a,c)=>win[c](JSON.stringify({ok:true,image:'https://malicious.test'}));await assert.rejects(()=>api.processStudioImage({},'cutout'),/read the result/);
 win.AvenzoNative.processStudioImage=()=>{};const pending=api.processStudioImage({},'codes');await new Promise(r=>setImmediate(r));[...timers.values()][0]();await assert.rejects(()=>pending,/timed out/);assert.equal(keys().length,0);assert.equal(timers.size,0);
 data='x'.repeat(12000001);await assert.rejects(()=>api.processStudioImage({},'frame'),/smaller/);
 console.log('Studio bridge: unsupported, success, malformed/unsafe preview, timeout cleanup and size limit passed.');
})().catch(e=>{console.error(e);process.exitCode=1;});
