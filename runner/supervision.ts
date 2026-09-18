import {readFileSync,writeFileSync,mkdirSync,existsSync} from 'node:fs';
import {resolve} from 'node:path';
import {spawn} from 'node:child_process';
import {FACTORY_ROOT} from './executors';
import type {BridgeCommand} from '../lib/bridge/types';
/** The intent is persisted BEFORE spawn. Any crash gap is uncertain, never a retry. */
export function launchTask(job:BridgeCommand,executionId:string,base:string){
 const dir=resolve(base,job.id);mkdirSync(dir,{recursive:true,mode:0o700});const file=resolve(dir,'task.json');
 if(existsSync(file))throw Error('Execution intent already exists; never respawn.');
 writeFileSync(file,JSON.stringify({job,executionId}),{flag:'wx',mode:0o600});
 const child=spawn(process.execPath,['--conditions=react-server','--import','tsx',resolve('runner/real-task.ts'),file],{cwd:process.cwd(),shell:false,detached:true,stdio:'ignore',env:{TSX_TSCONFIG_PATH:resolve(FACTORY_ROOT,'dashboard/tsconfig.json'),PATH:process.env.PATH,HOME:process.env.HOME,USER:process.env.USER,LANG:process.env.LANG,TMPDIR:process.env.TMPDIR}});
 child.on('error',()=>{});child.unref();return child.pid;
}
export function taskState(base:string,id:string){try{return JSON.parse(readFileSync(resolve(base,id,'state.json'),'utf8'));}catch{return null;}}
export function supervisionDecision(state:any,executionId:string,now=Date.now()):'complete'|'running'|'uncertain'{if(!state||state.executionId!==executionId)return 'uncertain';if(state.state==='complete')return 'complete';return Number.isFinite(Date.parse(state.progressAt))&&now-Date.parse(state.progressAt)<30000?'running':'uncertain';}
