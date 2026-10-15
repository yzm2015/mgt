'use strict';
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
(async()=>{
 const {manager,environment,credentials}=await require('./owner-cloud.cjs')();
 const sdk=require('../.cloud-backup/mgt-gateway-before-save/node_modules/wx-server-sdk');
 sdk.init(Object.assign({env:environment,region:'ap-shanghai'},credentials));const db=sdk.database();
 const storage=require('../cloudfunctions/mgt_gateway/storage')(db),id=crypto.createHash('sha256').update('mgt-smoke:'+crypto.randomUUID()).digest('hex');
 const report={environment,collection:'mgt_saves',scope:'real database via game storage adapter; no UI input',checks:[],testRecordRemoved:false};
 try{
  const acl=await manager.commonService().call({Action:'DescribeDatabaseACL',Param:{EnvId:environment,CollectionName:'mgt_saves'}});assert.equal(acl.AclTag,'ADMINONLY');report.checks.push('private ACL');
  assert.equal(await storage.load(id),null);report.checks.push('empty read');
  const save={level:1,coins:0,upgrades:{magnet:0,cargo:0},stageBest:{},dailyBest:{},records:{completed:0,bestScore:0,maxCombo:0,recovered:0,recent:[]}};
  const first=await storage.save(id,save,0);assert.equal(first.ok,true);assert.equal(first.revision,1);report.checks.push('first backup');
  const loaded=await storage.load(id);assert.deepEqual(loaded.save,save);assert.equal(loaded.revision,1);report.checks.push('readback');
  const stale=await storage.save(id,Object.assign({},save,{coins:999}),0);assert.equal(stale.code,'MGT_SAVE_CONFLICT');assert.equal((await storage.load(id)).save.coins,0);report.checks.push('stale revision rejected');
  const next=await storage.save(id,Object.assign({},save,{level:2}),1);assert.equal(next.revision,2);report.checks.push('next revision');
  const denied=await manager.functions.invokeFunction('mgt_gateway',{action:'health'});
  const response=typeof denied.RetMsg==='string'?JSON.parse(denied.RetMsg):denied.RetMsg;assert.ok(response.code==='MGT_CALLER_DENIED'||response.ok===true);report.checks.push('live gateway invocation responds; privileged management invocation is not proof of end-user authentication');
 }finally{
  await db.collection('mgt_saves').doc(id).remove();report.testRecordRemoved=true;fs.writeFileSync(path.resolve(__dirname,'../cloud-smoke.local.json'),JSON.stringify(report,null,2));
 }
 console.log(JSON.stringify(report,null,2));
})().catch(e=>{console.error('Cloud smoke failed:',e.code||e.errCode||'UNKNOWN',String(e.errMsg||e.message||'').slice(0,500));if(e.code==='ERR_ASSERTION')console.error(e.stack.split('\n').slice(0,5).join('\n'));process.exitCode=1;});
