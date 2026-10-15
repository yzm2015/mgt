(function(root){
 'use strict';
 function parse(q,today){q=q||{};if(q.mode!=='daily')return null;var date=/^\d{4}-\d{2}-\d{2}$/.test(q.date||'')?q.date:today;var seconds=Number(q.target);return{date:date,expired:date!==today,target:Number.isInteger(seconds)&&seconds>=10&&seconds<=1800?seconds:null};}
 function query(date,seconds){return'mode=daily&date='+encodeURIComponent(date)+(Number.isInteger(seconds)&&seconds>=10&&seconds<=1800?'&target='+seconds:'');}
 var api={parse:parse,query:query};if(typeof module!=='undefined')module.exports=api;else root.MagnetSocial=api;
})(typeof globalThis!=='undefined'?globalThis:this);
