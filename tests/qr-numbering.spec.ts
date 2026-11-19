import {test,expect} from './test';
import {DatabaseSync} from 'node:sqlite';
import {handle} from '../backend/api';
import type {Env} from '../backend/types';

function setup(previous?:number){
 const database=new DatabaseSync(':memory:');
 database.exec('CREATE TABLE counters(name TEXT PRIMARY KEY,value INTEGER NOT NULL); CREATE TABLE qr_codes(token TEXT PRIMARY KEY,label TEXT UNIQUE,batch_id TEXT,created_at TEXT,job_id TEXT,assigned_at TEXT);');
 database.prepare('INSERT INTO qr_codes VALUES(?,?,?,?,?,?)').run('old-token','SN-001','old-batch','old-date','original-job','assigned-date');
 if(previous!==undefined)database.prepare("INSERT INTO counters VALUES('qr',?)").run(previous);
 const db={prepare(sql:string){const query=database.prepare(sql);let values:any[]=[];
  return {bind(...input:unknown[]){values=input;return this;},async first(){return query.get(...values)||null;},async run(){return query.run(...values);}};
 },async batch(queries:any[]){return Promise.all(queries.map(q=>q.run()));}};
 const env:Env={DB:db as unknown as D1Database,ENVIRONMENT:'local',LOCAL_ADMIN_TOKEN:'qa-numbering',ALLOWED_ORIGINS:'http://127.0.0.1:5173'};
 const generate=(count:number)=>handle(new Request('http://127.0.0.1:8787/api/admin/batch',{method:'POST',headers:{Origin:env.ALLOWED_ORIGINS!,Authorization:'Bearer qa-numbering','Content-Type':'application/json'},body:JSON.stringify({count})}),env);
 return {database,generate};
}

for(const previous of [undefined,100])test(`new batches start at SN-4389 with ${previous===undefined?'no counter':'an older counter'}`,async()=>{
 const {database,generate}=setup(previous);
 try{
  expect((await generate(100)).status).toBe(201);
  expect((await generate(2)).status).toBe(201);
  const labels=database.prepare("SELECT label FROM qr_codes WHERE batch_id!='old-batch' ORDER BY label").all().map(r=>r.label);
  expect(labels).toHaveLength(102);expect(labels[0]).toBe('SN-4389');expect(labels.at(-1)).toBe('SN-4490');
  expect(database.prepare("SELECT job_id,assigned_at FROM qr_codes WHERE label='SN-001'").get()).toMatchObject({job_id:'original-job',assigned_at:'assigned-date'});
 }finally{database.close();}
});

test('a higher sequence never moves backward and simultaneous batches get different numbers',async()=>{
 const {database,generate}=setup(5000);
 try{
  const responses=await Promise.all([generate(3),generate(2)]);expect(responses.map(r=>r.status)).toEqual([201,201]);
  expect(database.prepare("SELECT label FROM qr_codes WHERE batch_id!='old-batch' ORDER BY label").all().map(r=>r.label)).toEqual(['SN-5001','SN-5002','SN-5003','SN-5004','SN-5005']);
 }finally{database.close();}
});
