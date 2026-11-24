import {useState} from 'react';
import {Upload,ChevronUp,ChevronDown,Trash2} from 'lucide-react';
import {toast} from 'sonner';
import {api} from '@/lib/client';
import {photoGroups,type PhotoGroup} from '@/lib/photo-groups';
import type {Photo} from '@/lib/types';
import PrivatePhoto from './PrivatePhoto';

type Group=PhotoGroup<Photo>;
export default function PhotoManager({jobId,photos,busy,onBusy,onChange}:{jobId:string;photos:Photo[];busy:boolean;onBusy:(v:boolean)=>void;onChange:(photos:Photo[])=>void}){
 const [kind,setKind]=useState('after');const [label,setLabel]=useState('');const [progress,setProgress]=useState('');const [error,setError]=useState('');
 const [retry,setRetry]=useState<{files:File[];kind:string}|null>(null);
 const groups=photoGroups(photos);
 async function run(action:()=>Promise<void>){onBusy(true);setError('');try{await action();}catch(e){setError((e as Error).message);}finally{onBusy(false);setProgress('');}}
 async function commit(rows:Group[]){
  const job=await api('admin/photo-layout',{method:'POST',body:JSON.stringify({job_id:jobId,photos:rows.flatMap(g=>g.photos.map(p=>({id:p.id,pair_id:g.id})))})});
  onChange(job.photos);
 }
 async function upload(files:File[],type=kind){
  if(files.length+photos.length>30){setError('This project can have up to 30 photos. Choose fewer files.');return;}
  await run(async()=>{
   let saved=0;const failed:File[]=[];
   for(const [i,file] of files.entries()){
    setProgress(`Uploading ${i+1} of ${files.length}…`);
    try{
     const bitmap=await createImageBitmap(file);const ratio=Math.min(1,2048/Math.max(bitmap.width,bitmap.height));
     const canvas=document.createElement('canvas');canvas.width=Math.round(bitmap.width*ratio);canvas.height=Math.round(bitmap.height*ratio);
     canvas.getContext('2d')!.drawImage(bitmap,0,0,canvas.width,canvas.height);bitmap.close();
     const blob=await new Promise<Blob|null>(resolve=>canvas.toBlob(resolve,'image/jpeg',.88));if(!blob)throw Error('Unsupported image');
     const name=label.trim()?(files.length===1?label.trim():`${label.trim()} ${i+1}`):file.name.replace(/\.[^.]+$/,'').replace(/[_-]+/g,' ').trim();
     const form=new FormData();form.set('job_id',jobId);form.set('kind',type);form.set('label',(name||'Project photo').slice(0,160));form.set('file',new File([blob],'project.jpg',{type:'image/jpeg'}));
     const job=await api('admin/photos',{method:'POST',body:form});onChange(job.photos);saved++;
    }catch{failed.push(file);}
   }
   setRetry(failed.length?{files:failed,kind:type}:null);
   if(failed.length)setError(`${saved} uploaded; ${failed.length} could not upload: ${failed.map(f=>f.name).join(', ')}. Retry failed files, or export unsupported photos as JPEG.`);
   if(saved)toast.success(saved===1?'Photo uploaded.':`${saved} photos uploaded.`);
  });
 }
 function match(group:Group,target:string){
  const before=group.photos.find(p=>p.kind==='before')!;const old=group.photos.find(p=>p.kind==='after');
  const next=photos.find(p=>p.id===target);
  const rows=groups.flatMap(g=>g.id===group.id?[{id:group.id,photos:next?[before,next]:[before]},...(old&&old.id!==target?[{id:`solo-${old.id}`,photos:[old]}]:[])]:next&&g.photos.some(p=>p.id===next.id)?[]:[g]);
  void run(()=>commit(rows));
 }
 function move(index:number,delta:number){const rows=[...groups];[rows[index],rows[index+delta]]=[rows[index+delta],rows[index]];void run(()=>commit(rows));}
 return <section className="panel stack">
  <h2>Project photos</h2>
  <p>Choose Before or Now, then select several photos at once. Match the same views and move the best pairs to the top.</p>
  <div className="field-grid"><label>Photo type<select className="label-layout" aria-label="Upload photo type" value={kind} disabled={busy} onChange={e=>setKind(e.target.value)}><option value="before">Before</option><option value="after">Now</option><option value="detail">Detail</option></select></label><label>Photo label (optional)<input value={label} maxLength={140} disabled={busy} placeholder="Leave blank to use filenames" onChange={e=>setLabel(e.target.value)}/></label></div>
  <label className="button secondary"><Upload/>Upload photos<input aria-label="Upload project photos" className="visually-hidden" type="file" multiple accept="image/jpeg,image/png,image/webp" disabled={busy} onChange={e=>{const files=Array.from(e.target.files||[]);e.target.value='';if(files.length)void upload(files);}}/></label>
  <small>Uploads are resized and hidden metadata is removed. Up to 30 photos per project.</small>
  {progress&&<p role="status">{progress}</p>}{error&&<div className="notice error" role="alert">{error}</div>}
  {retry&&<button disabled={busy} className="secondary" onClick={()=>upload(retry.files,retry.kind)}>Retry failed uploads</button>}
  <div className="photo-editor photo-set-list">{groups.map((group,index)=>{
   const before=group.photos.find(p=>p.kind==='before');const after=group.photos.find(p=>p.kind==='after');
   const available=groups.filter(g=>g.photos.length===1).flatMap(g=>g.photos).filter(p=>p.kind==='after');
   return <section className="photo-set stack" key={group.id} aria-label={`Photo set ${index+1}`}>
    <div className="section-heading"><h3>Photo set {index+1}</h3><div className="actions"><button aria-label={`Move photo set ${index+1} up`} className="secondary" disabled={busy||index===0} onClick={()=>move(index,-1)}><ChevronUp/></button><button aria-label={`Move photo set ${index+1} down`} className="secondary" disabled={busy||index===groups.length-1} onClick={()=>move(index,1)}><ChevronDown/></button><button className="quiet" disabled={busy||index===groups.length-1} onClick={()=>void run(()=>commit([...groups.filter(g=>g.id!==group.id),group]))}>Move to bottom</button></div></div>
    {before&&<label>Matching Now photo<select className="label-layout" aria-label={`Matching Now photo for ${before.label}`} value={after?.id||''} disabled={busy} onChange={e=>match(group,e.target.value)}><option value="">No matching photo yet</option>{[...(after?[after]:[]),...available.filter(p=>p.id!==after?.id)].map(p=><option key={p.id} value={p.id}>{p.label}</option>)}</select></label>}
    <div className={`photo-comparison-row${group.photos.length===1?' single-photo':''}`}>{group.photos.map(p=><PhotoFields key={p.id} photo={p} busy={busy} onEdit={changes=>run(async()=>{await api(`admin/photos/${p.id}`,{method:'PATCH',body:JSON.stringify({...p,...changes})});onChange((await api(`admin/jobs/${jobId}`)).photos);})} onDelete={()=>{if(window.confirm('Delete this photo from the project and private storage?'))void run(async()=>{await api(`admin/photos/${p.id}`,{method:'DELETE'});onChange((await api(`admin/jobs/${jobId}`)).photos);});}}/>)}</div>
   </section>;
  })}</div>
 </section>;
}
function PhotoFields({photo,busy,onEdit,onDelete}:{photo:Photo;busy:boolean;onEdit:(changes:Partial<Photo>)=>void;onDelete:()=>void}){
 const [label,setLabel]=useState(photo.label);
 return <div className="photo-manager-card"><strong>{photo.kind==='after'?'Now':photo.kind==='before'?'Before':'Detail'}</strong><PrivatePhoto id={photo.id} label={photo.label}/><label>Photo label<input aria-label={`Label for ${photo.label}`} maxLength={160} disabled={busy} value={label} onChange={e=>setLabel(e.target.value)}/></label><button className="quiet" disabled={busy||label===photo.label||!label.trim()} onClick={()=>onEdit({label})}>Save label</button><label>Photo type<select className="label-layout" aria-label={`Type for ${photo.label}`} disabled={busy} value={photo.kind} onChange={e=>onEdit({kind:e.target.value})}><option value="before">Before</option><option value="after">Now</option><option value="detail">Detail</option></select></label><button aria-label={`Delete ${photo.label}`} className="quiet" disabled={busy} onClick={onDelete}><Trash2/>Delete photo</button></div>;
}
