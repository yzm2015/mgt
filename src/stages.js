(function(root){
 'use strict';
 var stages=[
  {id:1,name:'老厂改造',subtitle:'初次出勤',icon:'magnet',color:'#65edff',par:150,goal:'combo',target:3,goalLabel:'达成 3 连击',quota:.7,layout:[[196,483,96,67,3],[96,343,82,66,4],[270,284,98,73,5]]},
  {id:2,name:'仓储街区',subtitle:'穿行窄巷',icon:'dash',color:'#a48aff',par:165,goal:'dash',target:3,goalLabel:'使用 3 次推进',quota:.72,layout:[[210,480,88,60,4],[95,320,84,64,5],[290,340,74,62,4]]},
  {id:3,name:'采石旧楼',subtitle:'规划回收路线',icon:'cargo',color:'#96ffd4',par:175,goal:'drone',target:3,goalLabel:'呼叫 3 次无人机',quota:.78,layout:[[120,470,80,60,3],[285,430,78,62,5],[200,285,90,65,5]]},
  {id:4,name:'钢构厂房',subtitle:'连锁拆解',icon:'pulse',color:'#ffbd72',par:150,goal:'combo',target:6,goalLabel:'达成 6 连击',quota:.72,layout:[[190,485,82,56,4],[125,355,78,58,5],[268,345,78,58,5]]},
  {id:5,name:'集装码头',subtitle:'远程运输',icon:'drone',color:'#96ffd4',par:200,goal:'drone',target:4,goalLabel:'呼叫 4 次无人机',quota:.86,layout:[[290,475,78,58,5],[90,370,74,62,5],[280,275,80,58,6]]},
  {id:6,name:'矿场通道',subtitle:'突进与折返',icon:'dash',color:'#a48aff',par:180,goal:'dash',target:5,goalLabel:'使用 5 次推进',quota:.78,layout:[[145,485,92,58,4],[282,385,74,62,5],[112,275,80,58,5]]},
  {id:7,name:'厂区高楼',subtitle:'装甲核心',icon:'shield',color:'#65edff',par:210,goal:'pulse',target:3,goalLabel:'释放 3 次脉冲',quota:.8,armor:1.25,layout:[[205,480,96,62,6],[90,345,74,64,6],[280,290,82,60,7]]},
  {id:8,name:'港区终场',subtitle:'首章终局',icon:'bolt',color:'#ffbd72',par:200,goal:'combo',target:8,goalLabel:'达成 8 连击',quota:.82,armor:1.35,layout:[[196,490,90,58,6],[110,360,78,60,7],[265,340,78,60,7]]}
 ];
 function progress(game){if(!game.stage)return 0;return game.stage.goal==='combo'?game.maxCombo:(game.actions[game.stage.goal]||0);}
 function stars(game){return game.done?1+(game.time<=game.stage.par?1:0)+(progress(game)>=game.stage.target?1:0):0;}
 var api={list:stages,progress:progress,stars:stars};if(typeof module!=='undefined')module.exports=api;else root.MagnetStages=api;
})(typeof globalThis!=='undefined'?globalThis:this);
