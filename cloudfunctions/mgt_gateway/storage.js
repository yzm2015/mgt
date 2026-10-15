'use strict';
module.exports=function(db){
 const NAME='mgt_saves';
 function row(response){return Array.isArray(response.data)?response.data[0]:response.data;}
 return{
  async load(id){const response=await db.collection(NAME).where({_id:id}).limit(1).get();return response.data[0]||null;},
  async save(id,save,expectedRevision){
   const result=await db.runTransaction(async tx=>{
    const doc=tx.collection(NAME).doc(id);let current;
    try{current=row(await doc.get());}catch(error){
     if(String(error.errMsg||error.message)!=='document.get:fail document with _id '+id+' does not exist')throw error;
     current=null;
    }
    const revision=current?current.revision:0;
    if(revision!==expectedRevision)return{ok:false,code:'MGT_SAVE_CONFLICT',revision};
    const updatedAt=Date.now(),next={revision:revision+1,save,updatedAt};await doc.set({data:next});return{ok:true,revision:next.revision,updatedAt};
   });
   return result.result||result;
  }
 };
};
