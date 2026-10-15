'use strict';
module.exports=function(db){
 const sessions='mgt_races',scores='mgt_scores';
 // Query reads distinguish an absent row from database errors without SDK-specific error parsing.
 async function query(collection,id){const r=await db.collection(collection).where({_id:id}).limit(1).get();return r.data[0]||null;}
 return{
  async startRace(id,data){await db.collection(sessions).doc(id).set({data});},
  async finishRace(id,session,seconds,now,date,name){
   const result=await db.runTransaction(async tx=>{
    async function get(collection,key){try{const r=await tx.collection(collection).doc(key).get();return Array.isArray(r.data)?r.data[0]:r.data;}catch(e){if(String(e.errMsg||e.message)==='document.get:fail document with _id '+key+' does not exist')return null;throw e;}}
    const race=await get(sessions,id);
    if(!race||race.session!==session||race.date!==date||now-race.startedAt>3600000||now-race.startedAt<(seconds-1)*1000)return{ok:false,code:'MGT_RACE_EXPIRED'};
    const key=date+'_'+id,previous=await get(scores,key);
    if(race.used)return race.seconds===seconds&&previous?{ok:true,best:previous.seconds,improved:false}:{ok:false,code:'MGT_RACE_EXPIRED'};
    await tx.collection(sessions).doc(id).set({data:{session:race.session,date:race.date,startedAt:race.startedAt,used:true,seconds}});
    const best=Math.min(seconds,previous?previous.seconds:Infinity);
    if(!previous||seconds<previous.seconds)await tx.collection(scores).doc(key).set({data:{date,player:id,name,seconds,updatedAt:now}});
    return{ok:true,best,improved:!previous||seconds<previous.seconds};
   });return result.result||result;
  },
  async board(date,id){
   const rows=await db.collection(scores).where({date}).orderBy('seconds','asc').orderBy('_id','asc').limit(20).get();
   const own=await query(scores,date+'_'+id);let rank=null;
   if(own){const count=await db.collection(scores).where({date,seconds:db.command.lt(own.seconds)}).count();rank=count.total+1;}
   return{entries:rows.data.map(r=>({name:r.name,seconds:r.seconds,mine:r.player===id})),mine:own?{seconds:own.seconds,rank}:null};
  }
 };
};
