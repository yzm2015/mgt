'use strict';
const fs=require('node:fs'),path=require('node:path');
function parse(value){const m=/^V?([1-9])\.(0|[1-9]\d?)\.([1-9]\d{0,3})$/.exec(value);if(!m)throw Error('版本须为 V1.0.1 至 V9.99.9999，不补零');return m.slice(1).map(Number);}
function next(value){let [x,y,z]=parse(value);z++;if(z>9999){z=1;y++;}if(y>99){y=0;x++;}if(x>9)throw Error('已到版本上限，停止递增');return `${x}.${y}.${z}`;}
function run(args){const root=path.join(__dirname,'..'),pkgPath=path.join(root,'package.json'),projectPath=path.join(root,'project.config.json'),sourcePath=path.join(root,'src/version.js'),pkg=JSON.parse(fs.readFileSync(pkgPath)),project=JSON.parse(fs.readFileSync(projectPath));let version;
 if(args[0]==='check'){parse(pkg.version);if(!fs.readFileSync(sourcePath,'utf8').includes("'"+pkg.version+"'")||!project.description.includes('V'+pkg.version+' '))throw Error('版本文件不一致');console.log('V'+pkg.version);return;}
 if(args[0]!=='next'&&args[0]!=='set')throw Error('使用 next 顺序递增，或 check 检查');
 version=args[0]==='set'?parse(args[1]).join('.'):next(pkg.version);pkg.version=version;project.description='磁吸拆迁队 V'+version+' - 救援引导与版本管理';
 const updates=[[pkgPath,JSON.stringify(pkg,null,2)+'\n'],[projectPath,JSON.stringify(project,null,2)+'\n'],[sourcePath,"(function(root){var version='"+version+"';if(typeof module!=='undefined')module.exports=version;else root.MagnetVersion=version;})(typeof globalThis!=='undefined'?globalThis:this);\n"]],before=updates.map(([p])=>fs.existsSync(p)?fs.readFileSync(p):null);
 try{updates.forEach(([p,s])=>fs.writeFileSync(p,s));}catch(e){updates.forEach(([p],i)=>{if(before[i]!==null)fs.writeFileSync(p,before[i]);});throw e;}console.log('V'+version);
}
module.exports={parse,next};if(require.main===module){try{run(process.argv.slice(2));}catch(e){console.error(e.message);process.exitCode=1;}}
