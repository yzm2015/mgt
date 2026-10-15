'use strict';
const GAME_APPID='wx775f636a27645c9d';
const crypto=require('crypto'),schema=require('./save-schema');
// Do not accept caller identity, collection names or function names from event data.
exports.handle=function(event,context,store){
  if(!context || context.FROM_APPID!==GAME_APPID || !context.FROM_OPENID) return {ok:false,code:'MGT_CALLER_DENIED'};
  if(!event)return{ok:false,code:'MGT_ACTION_DENIED'};
  if(event.action==='health')return {ok:true,namespace:'mgt',version:2,features:{cloudSave:!!store,leaderboard:false},serverTime:Date.now()};
  if(!store||!['load','save'].includes(event.action))return{ok:false,code:'MGT_ACTION_DENIED'};
  const id=crypto.createHash('sha256').update(GAME_APPID+':'+context.FROM_OPENID).digest('hex');
  return(async()=>{
   try{
    if(event.action==='load'){const record=await store.load(id);return{ok:true,namespace:'mgt',revision:record?record.revision:0,save:record?record.save:null,updatedAt:record?record.updatedAt:0};}
    if(!Number.isSafeInteger(event.expectedRevision)||event.expectedRevision<0)return{ok:false,code:'MGT_BAD_REVISION'};
    const save=schema.validate(event.save),result=await store.save(id,save,event.expectedRevision);return Object.assign({namespace:'mgt'},result);
   }catch(error){return{ok:false,code:error.message==='MGT_BAD_SAVE'?'MGT_BAD_SAVE':'MGT_STORAGE_UNAVAILABLE'};}
  })();
};
