import {DatabaseSync} from 'node:sqlite';import {readFileSync} from 'node:fs';
export function environment(){
 const db=new DatabaseSync(':memory:');for(const p of ['0000_tranquil_dust.sql','0001_glorious_boomerang.sql','0002_reflective_slipstream.sql'])db.exec(readFileSync('drizzle/'+p,'utf8'));
 const DB={prepare(sql:string){let values:any[]=[];const statement={bind(...v:any[]){values=v;return statement;},async run(){const r=db.prepare(sql).run(...values);return {meta:{changes:Number(r.changes)}};},async first(){return db.prepare(sql).get(...values)||null;},async all(){return {results:db.prepare(sql).all(...values)};}};return statement;}};
 const objects=new Map();return {db,DB,BRIDGE_OPERATOR_TOKEN:'operator-test',BRIDGE_RUNNER_TOKEN:'runner-test',BRIDGE_RUNNER_ID:'test-mac',BRIDGE_OWNER_EMAIL:'owner@example.com',BRIDGE_VIEWER_EMAILS:'viewer@example.com',BUCKET:{async put(k:string,v:unknown){objects.set(k,v);},async get(k:string){return objects.has(k)?{body:objects.get(k)}:null;},async delete(keys:string[]){keys.forEach(k=>objects.delete(k));}},ASSETS:{async fetch(){return new Response('asset');}}} as any;
}
