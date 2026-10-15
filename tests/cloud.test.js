'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const {handle}=require('../cloudfunctions/mgt_gateway/handler');
const config=require('../src/cloud-config'),create=require('../src/cloud-client');
const identity={FROM_APPID:config.gameAppid,FROM_OPENID:'test-user'};
test('gateway only trusts platform cross-account identity and denies arbitrary dispatch',()=>{
 assert.equal(handle({action:'health'},identity).ok,true);
 assert.equal(handle({action:'health',FROM_APPID:config.gameAppid},{}).ok,false);
 assert.equal(handle({action:'health'},{FROM_APPID:'other',FROM_OPENID:'test'}).ok,false);
 assert.equal(handle({action:'database',collection:'orders'},identity).code,'MGT_ACTION_DENIED');
 assert.equal(handle({action:'health'},{APPID:config.gameAppid,OPENID:'test'}).ok,false);
 assert.equal(handle({action:'health'},identity).features.cloudSave,false);
});
test('shared client awaits init, only calls mgt gateway and coalesces initialization',async()=>{
 const calls=[];class Cloud{constructor(c){calls.push(c);}async init(){calls.push('init');}async callFunction(c){calls.push(c);return{result:handle(c.data,identity)};}}
 const client=create({cloud:{Cloud}},config);const first=client.connect();assert.equal(client.connect(),first);assert.equal((await first).ok,true);assert.equal(client.status(),'ready');
 assert.deepEqual(calls[0],{resourceAppid:config.resourceAppid,resourceEnv:config.resourceEnv});assert.equal(calls[1],'init');assert.equal(calls[2].name,'mgt_gateway');
});
test('unavailable cloud fails gracefully without blocking offline play',async()=>{
 const client=create({},config);assert.equal((await client.connect()).ok,false);assert.equal(client.status(),'unavailable');
});
test('shared init authentication only accepts the game and does not trust event identity',()=>{
 const {handle:auth}=require('../cloudfunctions/cloudbase_auth/handler');
 assert.equal(auth(identity).errCode,0);assert.equal(JSON.parse(auth(identity).auth).namespace,'mgt');
 assert.equal(auth({FROM_APPID:'another-app',FROM_OPENID:'u'}).errCode,403);
 assert.equal(auth({APPID:config.gameAppid,OPENID:'u'}).errCode,403);
});
test('manual reconnect retries a failed connection and coalesces overlapping retries',async()=>{
 let attempts=0;class Cloud{async init(){attempts++;if(attempts===1)throw{code:'NETWORK_ERROR'};}async callFunction(){return{result:{ok:true,namespace:'mgt'}};}}
 const client=create({cloud:{Cloud}},config);assert.equal((await client.connect()).ok,false);assert.equal(client.errorCode(),'NETWORK_ERROR');
 const retry=client.retry();assert.equal(client.retry(),retry);assert.equal((await retry).ok,true);assert.equal(client.status(),'ready');assert.equal(attempts,2);assert.equal(client.errorCode(),'');
});
function saveFixture(){return{level:2,coins:100,upgrades:{magnet:1,cargo:0},dailyBest:{},records:{completed:1,bestScore:100,maxCombo:3,recovered:12,recent:[]}};}
function memoryStore(){const rows=new Map();return{rows,async load(id){return rows.get(id)||null;},async save(id,save,expected){const old=rows.get(id),rev=old?old.revision:0;if(rev!==expected)return{ok:false,code:'MGT_SAVE_CONFLICT',revision:rev};const next={save,revision:rev+1,updatedAt:Date.now()};rows.set(id,next);return{ok:true,revision:next.revision,updatedAt:next.updatedAt};}};}
test('cloud backup is scoped to platform identity and stale revisions never overwrite',async()=>{
 const store=memoryStore();assert.equal((await handle({action:'load'},identity,store)).revision,0);
 const first=await handle({action:'save',save:saveFixture(),expectedRevision:0,userId:'fake'},identity,store);assert.equal(first.revision,1);
 const stale=await handle({action:'save',save:Object.assign(saveFixture(),{coins:900}),expectedRevision:0},identity,store);assert.equal(stale.code,'MGT_SAVE_CONFLICT');
 const current=await handle({action:'load'},identity,store);assert.equal(current.save.coins,100);
 const other=await handle({action:'load',userId:identity.FROM_OPENID},{FROM_APPID:config.gameAppid,FROM_OPENID:'another-user'},store);assert.equal(other.save,null);
 assert.equal(handle({action:'health'},identity,store).features.cloudSave,true);assert.equal(handle({action:'health'},identity,store).features.leaderboard,false);
});
test('backup validation rejects invalid payloads and storage failures stay explicit',async()=>{
 const store=memoryStore();assert.equal((await handle({action:'save',save:saveFixture(),expectedRevision:'0'},identity,store)).code,'MGT_BAD_REVISION');
 assert.equal((await handle({action:'save',save:Object.assign(saveFixture(),{coins:-1}),expectedRevision:0},identity,store)).code,'MGT_BAD_SAVE');
 assert.equal((await handle({action:'save',save:Object.assign(saveFixture(),{extra:'x'.repeat(40000)}),expectedRevision:0},identity,store)).code,'MGT_BAD_SAVE');
 assert.equal(store.rows.size,0);
 const unavailable=await handle({action:'load'},identity,{load:async()=>{throw Error('unavailable');}});assert.equal(unavailable.code,'MGT_STORAGE_UNAVAILABLE');
});
test('client uses only its gateway for versioned load and save operations',async()=>{
 const calls=[],store=memoryStore();class Cloud{async init(){}async callFunction(request){calls.push(request);return{result:await handle(request.data,identity,store)};}}
 const client=create({cloud:{Cloud}},config);assert.equal((await client.load()).revision,0);assert.equal((await client.save(saveFixture(),0)).revision,1);assert.equal((await client.load()).save.coins,100);assert.ok(calls.every(c=>c.name==='mgt_gateway'));
});
test('storage adapter handles only the exact missing-document error on first backup',async()=>{
 const createStorage=require('../cloudfunctions/mgt_gateway/storage');let written;
 const fake={runTransaction:async fn=>({result:await fn({collection:()=>({doc:id=>({get:async()=>{throw{errCode:-1,errMsg:'document.get:fail document with _id '+id+' does not exist'};},set:async data=>{written=data.data;}})})})})};
 const result=await createStorage(fake).save('test',saveFixture(),0);assert.equal(result.revision,1);assert.equal(written.save.coins,100);
 const broken={runTransaction:async fn=>fn({collection:()=>({doc:()=>({get:async()=>{throw Error('Collection missing or permission denied');}})})})};
 await assert.rejects(createStorage(broken).save('test',saveFixture(),0),/Collection missing/);
});
