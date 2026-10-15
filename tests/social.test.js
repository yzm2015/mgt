'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict');
const social=require('../cloudfunctions/mgt_gateway/social'),createStorage=require('../cloudfunctions/mgt_gateway/social-storage');
const {handle}=require('../cloudfunctions/mgt_gateway/handler'),config=require('../src/cloud-config');
const identity={FROM_APPID:config.gameAppid,FROM_OPENID:'social-user'};
function database(){const tables={};return{tables,command:{lt:n=>({lt:n})},async runTransaction(fn){return{result:await fn(this)};},collection(name){const map=tables[name]||(tables[name]=new Map());return{doc(id){return{async get(){if(!map.has(id))throw Error('document.get:fail document with _id '+id+' does not exist');return{data:map.get(id)};},async set({data}){assert.ok(!('_id' in data),'SDK forbids writing document identity');map.set(id,Object.assign({_id:id},data));}};},where(filter){let sorting=[],max=100;function rows(){return [...map.values()].filter(r=>Object.entries(filter).every(([k,v])=>v&&typeof v==='object'?r[k]<v.lt:r[k]===v)).sort((a,b)=>{for(const key of sorting){if(a[key]!==b[key])return a[key]<b[key]?-1:1;}return 0;});}const q={limit(n){max=n;return q;},orderBy(k){sorting.push(k);return q;},async get(){return{data:rows().slice(0,max)};},async count(){return{total:rows().length};}};return q;}};}};}
test('login uses platform identity, stable anonymous code and never exposes openid',async()=>{
 const store={social:createStorage(database())};const a=await handle({action:'login',userId:'spoof'},identity,store),b=await handle({action:'login'},identity,store);
 assert.deepEqual(a,b);assert.equal(a.profile.playerCode.length,12);assert.ok(!JSON.stringify(a).includes('social-user'));
 assert.equal(handle({action:'login'},{FROM_APPID:'foreign',FROM_OPENID:'u'},store).code,'MGT_CALLER_DENIED');
 assert.equal(handle({action:'health'},identity,store).features.leaderboard,true);
});
test('race needs same identity and date, valid elapsed time, and accepts identical retries',async()=>{
 const db=database(),store=createStorage(db),id='a'.repeat(64),date=social.day(),now=Date.now(),token='a'.repeat(48);
 await store.startRace(id,{session:token,date,startedAt:now-60000});
 assert.equal((await store.finishRace(id,'b'.repeat(48),30,now,date,'A')).ok,false);
 assert.equal((await store.finishRace(id,token,100,now,date,'A')).ok,false);
 assert.equal((await store.finishRace(id,token,30,now,'2000-01-01','A')).ok,false);
 assert.equal((await store.finishRace('other',token,30,now,date,'A')).ok,false);
 assert.equal((await store.finishRace(id,token,30,now,date,'A')).best,30);
 assert.equal((await store.finishRace(id,token,30,now,date,'A')).ok,true);
 assert.equal((await store.finishRace(id,token,20,now,date,'A')).ok,false);
 await store.startRace(id,{session:token,date,startedAt:now-60000});assert.equal((await store.finishRace(id,token,45,now,date,'A')).best,30);
 const board=await store.board(date,id);assert.equal(board.mine.rank,1);assert.equal(board.entries[0].mine,true);assert.deepEqual(Object.keys(board.entries[0]).sort(),['mine','name','seconds']);
 assert.equal((await store.board('2000-01-01',id)).entries.length,0);
});
test('score bounds, server-created sessions and query errors fail safely',async()=>{
 const store={social:createStorage(database())};for(const seconds of [-1,0,9,1801,30.5,'30',NaN])assert.equal((await handle({action:'raceFinish',session:'a'.repeat(48),seconds},identity,store)).code,'MGT_BAD_RACE');
 const start=await handle({action:'raceStart',date:'2000-01-01',session:'fake'},identity,store);assert.match(start.session,/^[a-f0-9]{48}$/);assert.equal(start.date,social.day());
 const error=await handle({action:'leaderboard'},identity,{social:{board:async()=>{throw Error('unavailable');}}});assert.equal(error.code,'MGT_STORAGE_UNAVAILABLE');
});
test('challenge query is bounded, old dates expire and injected values cannot alter mode',()=>{
 const share=require('../src/social'),date=social.day();assert.equal(share.parse({mode:'tour'},date),null);assert.equal(share.parse({mode:'daily',target:'-5'},date).target,null);
 assert.equal(share.parse({mode:'daily',date:'2000-01-01',target:'45'},date).expired,true);
 const query=share.query(date,45),parsed=share.parse(Object.fromEntries(new URLSearchParams(query)),date);assert.deepEqual(parsed,{date,target:45,expired:false});assert.equal(share.query(date,'45&admin=1'),'mode=daily&date='+date);
});
test('UI login, board retry, daily upload, share query and warm launch do not corrupt current play',async()=>{
 const start=require('../src/salvage-app'),core=require('../src/salvage-core');let frame,input,launch,g,now=1000,calls=[],shared,texts=[];
 const ctx=new Proxy({fillText:t=>texts.push(t)},{get:(o,k)=>o[k]||(()=>{}),set:(o,k,v)=>(o[k]=v,true)});
 class Game extends core.Game{constructor(...args){super(...args);g=this;}}
 start({canvas:{width:390,height:720,getContext:()=>ctx},load:()=>({}),save:()=>true,frame:fn=>frame=fn,input:fn=>input=fn,visibility:()=>{},event:()=>{},onLaunchQuery:fn=>launch=fn,share:(title,query)=>shared={title,query},login:async()=>({ok:true,profile:{name:'工程师 ABCDEF'}}),leaderboard:async()=>({ok:true,date:social.day(),entries:[],mine:null}),raceStart:async()=>{calls.push('start');return{ok:true,date:social.day(),session:'a'.repeat(48)};},raceFinish:async(session,seconds)=>{calls.push(['finish',session,seconds]);return{ok:true,best:seconds};}},Object.assign({},core,{Game}));
 const render=()=>{texts=[];now+=17;frame(now);};const flush=async()=>{await new Promise(r=>setImmediate(r));render();};const click=(x,y)=>{input('down',{x,y});input('up',{x,y});render();};render();
 click(90,692);assert.ok(texts.includes('微信一键登录'));click(120,466);await flush();assert.ok(texts.includes('工程师 ABCDEF'));click(100,651);click(280,692);await flush();assert.ok(texts.includes('每日竞速榜'));
 click(180,582);assert.equal(new URLSearchParams(shared.query).get('mode'),'daily');click(295,582);await flush();assert.equal(calls.filter(c=>c==='start').length,1);assert.equal(g.upgrades.magnet,0);
 const current=g;launch({mode:'daily',date:social.day(),target:'45'});render();assert.equal(current,g);
 g.time=45;g.done=true;render();await flush();assert.equal(calls.filter(c=>Array.isArray(c)).length,1);render();assert.equal(calls.filter(c=>Array.isArray(c)).length,1);click(270,516);assert.equal(new URLSearchParams(shared.query).get('target'),'45');
 click(100,459);await flush();assert.equal(calls.filter(c=>c==='start').length,2,'replay must create a fresh server session');
});
