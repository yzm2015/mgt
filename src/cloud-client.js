'use strict';
// This client exposes one namespaced gateway, never a raw database/storage handle.
module.exports = function createCloudClient(wx, config) {
  var state = 'pending', client, errorCode = '', pending,features={cloudSave:false,leaderboard:false};
  async function bounded(work) {
    var timer;
    try { return await Promise.race([work,new Promise(function(_,reject){timer=setTimeout(function(){reject(Object.assign(new Error('CLOUD_TIMEOUT'),{code:'CLOUD_TIMEOUT'}));},8000);})]); }
    finally { clearTimeout(timer); }
  }
  function connect() {
    if (pending) return pending;
    state = 'pending';errorCode = '';
    pending = (async function () {
      try {
        if (!wx.cloud || !wx.cloud.Cloud) throw Object.assign(new Error('CLOUD_UNAVAILABLE'), {code:'CLOUD_UNAVAILABLE'});
        client = new wx.cloud.Cloud({resourceAppid:config.resourceAppid, resourceEnv:config.resourceEnv});
        await bounded(client.init());
        var response = await bounded(client.callFunction({name:config.functionName, data:{action:'health'}}));
        var result = response && response.result;
        if (!result || !result.ok || result.namespace !== 'mgt') throw Object.assign(new Error('GATEWAY_REJECTED'), {code:result && result.code || 'GATEWAY_REJECTED'});
        features={cloudSave:!!(result.features&&result.features.cloudSave),leaderboard:!!(result.features&&result.features.leaderboard)};state = 'ready';return {ok:true};
      } catch (error) {
        state = 'unavailable';errorCode = String(error.errCode || error.code || 'CLOUD_CONNECT_FAILED');pending = null;return {ok:false,code:errorCode};
      }
    })();
    return pending;
  }
  async function request(action,data){
    var connected=await connect();if(!connected.ok)return connected;
    if(['load','save'].indexOf(action)>=0&&!features.cloudSave)return{ok:false,code:'MGT_SAVE_NOT_ENABLED'};
    try{var response=await bounded(client.callFunction({name:config.functionName,data:Object.assign({action:action},data)}));return response.result||{ok:false,code:'MGT_BAD_RESPONSE'};}
    catch(error){return{ok:false,code:String(error.errCode||error.code||'MGT_REQUEST_FAILED')};}
  }
  return {login:function(){return request('login');},leaderboard:function(){return request('leaderboard');},raceStart:function(){return request('raceStart');},raceFinish:function(session,seconds){return request('raceFinish',{session:session,seconds:seconds});},connect:connect, retry:function(){if(state==='unavailable')pending=null;return connect();},status:function(){return state;},errorCode:function(){return errorCode;},features:function(){return Object.assign({},features);},load:function(){return request('load');},save:function(save,expectedRevision){return request('save',{save:save,expectedRevision:expectedRevision});}};
};
