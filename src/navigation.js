(function(root){
 'use strict';
 function plan(game,x,y){
  var nodes=[],map=Object.create(null),buildings=game.buildings.filter(function(b){return b.state==='standing';});
  for(var gy=240;gy<=620;gy+=10)for(var gx=22;gx<=362;gx+=10){if(buildings.some(function(b){return gx>b.x-b.w/2-16&&gx<b.x+b.w/2+16&&gy>b.y-b.h/2-12&&gy<b.y+b.h/2+15;}))continue;map[gx+':'+gy]=nodes.length;nodes.push({x:gx,y:gy});}
  if(!nodes.length)return[];
  function nearest(p){var best=0,d=Infinity;nodes.forEach(function(n,i){var v=Math.hypot(n.x-p.x,n.y-p.y);if(v<d){d=v;best=i;}});return best;}
  var start=nearest(game.car),goal=nearest({x:x,y:y}),queue=[start],parent=Object.create(null);parent[start]=-1;
  for(var h=0;h<queue.length&&parent[goal]===undefined;h++){var idx=queue[h],n=nodes[idx];[[10,0],[-10,0],[0,10],[0,-10]].forEach(function(d){var next=map[(n.x+d[0])+':'+(n.y+d[1])];if(next!==undefined&&parent[next]===undefined){parent[next]=idx;queue.push(next);}});}
  if(parent[goal]===undefined)return[];var path=[],i=goal;while(i!==-1){path.unshift({x:nodes[i].x,y:nodes[i].y});i=parent[i];}return path;
 }
 if(typeof module!=='undefined')module.exports=plan;else root.planMagnetRoute=plan;
})(typeof globalThis!=='undefined'?globalThis:this);
