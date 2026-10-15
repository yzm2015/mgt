'use strict';
function integer(v,max,min=0){if(!Number.isFinite(v)||!Number.isInteger(v)||v<min||v>max)throw Error('MGT_BAD_SAVE');return v;}
function optional(v,max){return integer(v===undefined?0:v,max);}
function progression(raw){
 if(raw===undefined)return{xp:0,parts:0,rig:'balanced',daily:{date:'',yards:0,recycle:0,chain:0,claimed:[]}};
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error('MGT_BAD_SAVE');
 const d=raw.daily===undefined?{}:raw.daily;if(!d||typeof d!=='object'||Array.isArray(d))throw Error('MGT_BAD_SAVE');
 const xp=optional(raw.xp,1000000),rig=raw.rig===undefined?'balanced':raw.rig,claimed=d.claimed===undefined?[]:d.claimed;
 if(!['balanced','hauler','striker'].includes(rig)||rig==='hauler'&&xp<120||rig==='striker'&&xp<720)throw Error('MGT_BAD_SAVE');
 if(!Array.isArray(claimed)||claimed.length>3||new Set(claimed).size!==claimed.length||claimed.some(k=>!['yards','recycle','chain'].includes(k)))throw Error('MGT_BAD_SAVE');
 const date=d.date===undefined?'':d.date;if(typeof date!=='string'||date!==''&&!/^\d{4}-\d{2}-\d{2}$/.test(date))throw Error('MGT_BAD_SAVE');
 return{xp,parts:optional(raw.parts,99999),rig,daily:{date,yards:optional(d.yards,9999),recycle:optional(d.recycle,999999),chain:optional(d.chain,999),claimed:claimed.slice()}};
}
exports.validate=function(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||Buffer.byteLength(JSON.stringify(raw),'utf8')>32768)throw Error('MGT_BAD_SAVE');
 const u=raw.upgrades||{},r=raw.records||{},daily={},stageBest={};
 for(const key of Object.keys(raw.stageBest||{})){if(!/^[1-8]$/.test(key))throw Error('MGT_BAD_SAVE');const item=raw.stageBest[key];if(!item||typeof item!=='object')throw Error('MGT_BAD_SAVE');stageBest[key]={stars:integer(item.stars,3,1),seconds:integer(item.seconds,999999)};}
 for(const key of Object.keys(raw.dailyBest||{}).slice(-62)){if(/^\d{4}-\d{2}-\d{2}$/.test(key))daily[key]=integer(raw.dailyBest[key],999999);}
 return{progression:progression(raw.progression),level:integer(raw.level,99,1),coins:integer(raw.coins,9999999),upgrades:{magnet:integer(u.magnet,5),cargo:integer(u.cargo,5),engine:optional(u.engine,5),reactor:optional(u.reactor,5),drone:optional(u.drone,5)},stageBest,dailyBest:daily,records:{completed:integer(r.completed||0,9999999),bestScore:integer(r.bestScore||0,999999999),maxCombo:integer(r.maxCombo||0,999),recovered:integer(r.recovered||0,999999999),recent:(Array.isArray(r.recent)?r.recent:[]).slice(0,6).map(item=>({mode:item.mode==='daily'?'daily':'tour',level:integer(item.level,99,1),score:integer(item.score,999999999),seconds:integer(item.seconds,999999),combo:integer(item.combo,999)}))}};
};
