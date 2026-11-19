import type {QR} from './types';

export function orderStickers(codes:QR[]){
 return [...codes].sort((a,b)=>(b.created_at||'').localeCompare(a.created_at||'')||a.label.localeCompare(b.label,undefined,{numeric:true}));
}
export function stickerBatches(codes:QR[]){
 const groups=new Map<string,QR[]>();
 for(const code of codes){if(code.batch_id==='demo')continue;const group=groups.get(code.batch_id)||[];group.push(code);groups.set(code.batch_id,group);}
 return [...groups].map(([id,items])=>{
  const sorted=[...items].sort((a,b)=>a.label.localeCompare(b.label,undefined,{numeric:true}));
  const createdAt=items.reduce((latest,q)=>(q.created_at||'')>latest?q.created_at!:latest,'');
  return {id,createdAt,first:sorted[0].label,last:sorted.at(-1)!.label};
 }).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)||b.last.localeCompare(a.last,undefined,{numeric:true}));
}
