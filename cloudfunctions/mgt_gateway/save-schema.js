'use strict';
function integer(v,max,min=0){if(!Number.isFinite(v)||!Number.isInteger(v)||v<min||v>max)throw Error('MGT_BAD_SAVE');return v;}
exports.validate=function(raw){
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||Buffer.byteLength(JSON.stringify(raw),'utf8')>32768)throw Error('MGT_BAD_SAVE');
 const u=raw.upgrades||{},r=raw.records||{},daily={},stageBest={};
 for(const key of Object.keys(raw.stageBest||{})){if(!/^[1-8]$/.test(key))throw Error('MGT_BAD_SAVE');const item=raw.stageBest[key];stageBest[key]={stars:integer(item.stars,3,1),seconds:integer(item.seconds,999999)};}
 for(const key of Object.keys(raw.dailyBest||{}).slice(-62)){if(/^\d{4}-\d{2}-\d{2}$/.test(key))daily[key]=integer(raw.dailyBest[key],999999);}
 return{level:integer(raw.level,99,1),coins:integer(raw.coins,9999999),upgrades:{magnet:integer(u.magnet,5),cargo:integer(u.cargo,5)},stageBest,dailyBest:daily,records:{completed:integer(r.completed||0,9999999),bestScore:integer(r.bestScore||0,999999999),maxCombo:integer(r.maxCombo||0,999),recovered:integer(r.recovered||0,999999999),recent:(Array.isArray(r.recent)?r.recent:[]).slice(0,6).map(item=>({mode:item.mode==='daily'?'daily':'tour',level:integer(item.level,99,1),score:integer(item.score,999999999),seconds:integer(item.seconds,999999),combo:integer(item.combo,999)}))}};
};
