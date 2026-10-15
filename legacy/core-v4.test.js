const {test}=require('node:test');
const assert=require('node:assert/strict');
const {Game,hash,day}=require('../src/core');
test('daily and campaign seeds reproduce identical layouts',()=>{
  assert.deepEqual(new Game(hash('2026-10-15'),5).blocks,new Game(hash('2026-10-15'),5).blocks);
  assert.notDeepEqual(new Game(1,5).blocks,new Game(2,5).blocks);
  assert.match(day(),/^\d{4}-\d{2}-\d{2}$/);
});
test('only three shots; cannot fire during flight or after result',()=>{
  const g=new Game(1);assert.equal(g.fire(62,480),false);
  for(let shot=0;shot<3;shot++){
    assert.equal(g.fire(60,300),true);assert.equal(g.fire(200,500),false);
    for(let i=0;i<500 && g.ball;i++)g.update(1/60);
  }
  for(let i=0;i<120;i++)g.update(1/60);
  assert.equal(g.shots,0);assert.equal(g.done,true);assert.equal(g.fire(200,400),false);
});
test('TNT chains terminate and each block scores only once',()=>{
  const g=new Game(1);g.blocks.forEach(b=>b.type='tnt');g.destroy(g.blocks[0]);
  assert.equal(g.ratio(),1);const score=g.score;g.destroy(g.blocks[0]);assert.equal(g.score,score);
});
test('connected bridge remains, unsupported tower collapses',()=>{
  const g=new Game(1);g.blocks=[{x:0,y:610,alive:true,type:'brick'},{x:0,y:578,alive:true,type:'brick'},{x:32,y:578,alive:true,type:'brick'},{x:96,y:578,alive:true,type:'brick'}];
  g.collapse();assert.deepEqual(g.blocks.map(b=>b.alive),[true,true,true,false]);
});
test('first level TNT is reachable and can produce a satisfying clear',()=>{
  let max=0;
  for(let y=280;y<620;y+=5){const g=new Game(hash('tour-1'),1);g.fire(240,y);for(let i=0;i<400;i++)g.update(1/60);max=Math.max(max,g.ratio());}
  assert.ok(max>=.7, 'first level needs at least one effective shot');
});
