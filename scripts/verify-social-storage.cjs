'use strict';
const crypto=require('crypto'),assert=require('assert/strict'),fs=require('fs'),path=require('path');
(async()=>{
 const {manager,environment,credentials}=await require('./owner-cloud.cjs')(),sdk=require('../.cloud-backup/mgt-gateway-before-save/node_modules/wx-server-sdk');sdk.init(Object.assign({env:environment,region:'ap-shanghai'},credentials));
 const db=sdk.database(),social=require('../cloudfunctions/mgt_gateway/social-storage')(db),handler=require('../cloudfunctions/mgt_gateway/handler'),date=require('../cloudfunctions/mgt_gateway/social').day(),openid='mgt-social-smoke-'+crypto.randomUUID(),id=crypto.createHash('sha256').update('wx775f636a27645c9d:'+openid).digest('hex'),context={FROM_APPID:'wx775f636a27645c9d',FROM_OPENID:openid},store={social};
 const report={environment,checks:[],testRecordsRemoved:false};
 try{
  for(const collection of ['mgt_races','mgt_scores']){const acl=await manager.commonService().call({Action:'DescribeDatabaseACL',Param:{EnvId:environment,CollectionName:collection}});assert.equal(acl.AclTag,'ADMINONLY');}report.checks.push('both collections private');
  const login=await handler.handle({action:'login'},context,store);assert.equal(login.ok,true);assert.ok(login.profile.name);report.checks.push('anonymous stable platform login');
  const start=await handler.handle({action:'raceStart'},context,store);assert.equal(start.ok,true);assert.equal(start.date,date);
  const bad=await handler.handle({action:'raceFinish',session:start.session,seconds:60},context,store);assert.equal(bad.ok,false);report.checks.push('instant result rejected');
  // Test-only record: move the synthetic start into the past instead of waiting on a real player.
  await db.collection('mgt_races').doc(id).update({data:{startedAt:Date.now()-120000}});
  const first=await social.finishRace(id,start.session,60,Date.now(),date,login.profile.name);assert.equal(first.ok,true,'first score: '+first.code);assert.equal(first.best,60);report.checks.push('first score transaction');
  assert.equal((await handler.handle({action:'raceFinish',session:start.session,seconds:60},context,store)).ok,true);assert.equal((await handler.handle({action:'raceFinish',session:start.session,seconds:30},context,store)).ok,false);report.checks.push('idempotent retry and changed replay denied');
  const board=await handler.handle({action:'leaderboard'},context,store);assert.equal(board.ok,true,'board: '+board.code);assert.equal(board.mine.seconds,60);assert.ok(board.mine.rank>=1);assert.ok(board.entries.every(x=>!('player' in x)&&!('_id' in x)));report.checks.push('indexed leaderboard, own rank and public projection');
  const next=await handler.handle({action:'raceStart'},context,store);await db.collection('mgt_races').doc(id).update({data:{startedAt:Date.now()-120000}});assert.equal((await handler.handle({action:'raceFinish',session:next.session,seconds:80},context,store)).best,60);report.checks.push('slower score preserves best');
 }finally{await db.collection('mgt_scores').doc(date+'_'+id).remove();await db.collection('mgt_races').doc(id).remove();report.testRecordsRemoved=true;fs.writeFileSync(path.resolve(__dirname,'../../social-smoke.local.json'),JSON.stringify(report,null,2));}
 console.log(JSON.stringify(report));
})().catch(e=>{console.error('Social smoke failed:',e.code||e.errCode||'ERROR',String(e.message||e.errMsg||'').slice(0,300));console.error(String(e.stack||'').split('\n').filter(x=>x.includes('verify-social-storage.cjs')).slice(0,2).join('\n'));process.exitCode=1;});
