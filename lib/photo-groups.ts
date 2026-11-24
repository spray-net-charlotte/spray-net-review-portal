export type PairPhoto={id:string;label:string;kind:string;pair_id?:string|null};
export type PhotoGroup<T extends PairPhoto>={id:string;photos:T[]};
export function photoGroups<T extends PairPhoto>(photos:T[]):PhotoGroup<T>[] {
 const result:PhotoGroup<T>[]=[];const used=new Set<string>();
 const view=(p:T)=>p.label.replace(/\b(before|after|now)\b/gi,'').replace(/[_-]/g,' ').trim().toLowerCase().replace(/\s+/g,' ');
 for(const p of photos){
  if(used.has(p.id))continue;
  let members:T[];
  if(p.pair_id)members=photos.filter(q=>q.pair_id===p.pair_id);
  else {
   const others=photos.filter(q=>!q.pair_id&&q.kind!==p.kind&&['before','after'].includes(q.kind)&&view(q)===view(p)&&view(p));
   const same=photos.filter(q=>!q.pair_id&&q.kind===p.kind&&view(q)===view(p));
   members=['before','after'].includes(p.kind)&&others.length===1&&same.length===1?[p,others[0]]:[p];
   if(photos.length===2&&photos.every(q=>!q.pair_id)&&new Set(photos.map(q=>q.kind)).size===2&&photos.every(q=>['before','after'].includes(q.kind)))members=[...photos];
  }
  members.sort((a,b)=>(a.kind==='before'?0:1)-(b.kind==='before'?0:1));
  members.forEach(q=>used.add(q.id));result.push({id:p.pair_id||`auto-${p.id}`,photos:members});
 }
 return result;
}
