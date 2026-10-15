'use strict';
exports.handle=function(context){
 if(!context||context.FROM_APPID!=='wx775f636a27645c9d'||!context.FROM_OPENID)return{errCode:403,errMsg:'Shared application not allowed'};
 // This marker is consumed by resource-level rules; it grants no DB permissions by itself.
 return{errCode:0,errMsg:'',auth:JSON.stringify({namespace:'mgt',gameAppid:'wx775f636a27645c9d'})};
};
