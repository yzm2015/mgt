'use strict';
const crypto=require('crypto');
const day=()=>new Date(Date.now()+8*3600000).toISOString().slice(0,10);
exports.day=day;
exports.handle=async function(event,id,store){
 const now=Date.now(),date=day(),name='工程师 '+id.slice(0,6).toUpperCase();
 if(event.action==='login')return{ok:true,profile:{name,playerCode:id.slice(0,12)},date};
 if(event.action==='leaderboard')return Object.assign({ok:true,date},await store.board(date,id));
 if(event.action==='raceStart'){
  const session=crypto.randomBytes(24).toString('hex');
  await store.startRace(id,{session,date,startedAt:now});return{ok:true,session,date};
 }
 if(event.action==='raceFinish'){
  if(typeof event.session!=='string'||!/^[a-f0-9]{48}$/.test(event.session)||!Number.isInteger(event.seconds)||event.seconds<10||event.seconds>1800)return{ok:false,code:'MGT_BAD_RACE'};
  return store.finishRace(id,event.session,event.seconds,now,date,name);
 }
 return{ok:false,code:'MGT_ACTION_DENIED'};
};
