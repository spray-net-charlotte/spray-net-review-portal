import {test,expect} from './test';
import {photoGroups} from '../lib/photo-groups';
import {login,browserAdmin,site,fixture,patch} from './helpers';
import sharp from 'sharp';

test('legacy Before/Now view names become pairs without mixing repeated or unrelated labels',()=>{
 const photos=['Stove View Before','Island View Before','Sink View Before','Stove View Now','Island View Now','Sink View Now'].map((label,i)=>({id:String(i),label,kind:i<3?'before':'after'}));
 expect(photoGroups(photos).map(g=>g.photos.map(p=>p.id))).toEqual([['0','3'],['1','4'],['2','5']]);
 expect(photoGroups([{id:'1',label:'Before',kind:'before'},{id:'2',label:'Before',kind:'before'},{id:'3',label:'After',kind:'after'}]).every(g=>g.photos.length===1)).toBe(true);
});

test('bulk uploads strip metadata and saved pairs stay side by side in the selected order on mobile',async({page,browser,request},info)=>{
 const {admin,token}=await login();const job=await(await admin.post('/api/admin/jobs',{data:{...fixture,internal_name:'Photo pairs QA'}})).json();
 const source=await sharp({create:{width:2500,height:1700,channels:3,background:'#c38750'}}).jpeg().withExif({IFD0:{Make:'Private camera QA'}}).toBuffer();
 const types=['Stove','Island','Sink'];
 try{
  await browserAdmin(page,token);await page.goto(site+'?admin=1');await page.getByLabel('Find a project').fill('Photo pairs QA');await page.locator('.project-row').getByRole('button',{name:'Open project',exact:true}).click();
  await page.getByLabel('Upload photo type',{exact:true}).selectOption('before');
  await page.getByLabel('Upload project photos').setInputFiles(types.map(name=>({name:`${name} View Before.jpg`,mimeType:'image/jpeg',buffer:source})));
  await expect.poll(async()=>(await(await admin.get('/api/admin/jobs/'+job.id)).json()).photos.length).toBe(3);
  await expect(page.getByLabel('Upload project photos')).toBeEnabled();
  await page.getByLabel('Upload photo type',{exact:true}).selectOption('after');
  await page.getByLabel('Upload project photos').setInputFiles(types.map(name=>({name:`${name} View Now.jpg`,mimeType:'image/jpeg',buffer:source})));
  await expect(page.getByRole('region',{name:'Photo set 3',exact:true})).toBeVisible();
  await expect.poll(async()=>(await(await admin.get('/api/admin/jobs/'+job.id)).json()).photos.length).toBe(6);
  await expect(page.getByLabel('Upload project photos')).toBeEnabled();
  const matching=page.getByLabel('Matching Now photo for Stove View Before',{exact:true});
  await matching.selectOption('');
  await expect(page.getByRole('region',{name:'Photo set 4',exact:true})).toBeVisible();
  await expect(matching).toBeEnabled();await matching.selectOption({label:'Stove View Now'});
  await expect(page.getByRole('region',{name:'Photo set 4',exact:true})).toHaveCount(0);
  await page.getByRole('button',{name:'Move photo set 1 down',exact:true}).click();
  await expect.poll(async()=>((await(await admin.get('/api/admin/jobs/'+job.id)).json()).photos[0].label)).toBe('Island View Before');
  const saved=await(await admin.get('/api/admin/jobs/'+job.id)).json();
  expect(saved.photos.map((p:any)=>p.label)).toEqual(['Island View Before','Island View Now','Stove View Before','Stove View Now','Sink View Before','Sink View Now']);
  expect(saved.photos[0].pair_id).toBe(saved.photos[1].pair_id);
  await expect(page.getByRole('region',{name:'Photo set 2',exact:true}).getByRole('button',{name:'Move to bottom',exact:true})).toBeEnabled();
  await page.getByRole('region',{name:'Photo set 2',exact:true}).getByRole('button',{name:'Move to bottom',exact:true}).click();
  await expect.poll(async()=>((await(await admin.get('/api/admin/jobs/'+job.id)).json()).photos.at(-1).label)).toBe('Stove View Now');
  const metadata=await sharp(await(await admin.get('/api/admin/photos/'+saved.photos[0].id)).body()).metadata();expect(metadata.exif).toBeUndefined();expect(metadata.width).toBe(2048);
  const invalid=saved.photos.map((p:any)=>({id:p.id,pair_id:'same-pair'}));expect((await admin.post('/api/admin/photo-layout',{data:{job_id:job.id,photos:invalid}})).status()).toBe(400);
  expect((await request.post('http://127.0.0.1:8787/api/admin/photo-layout',{headers:{Origin:'http://127.0.0.1:5173'},data:{job_id:job.id,photos:invalid}})).status()).toBe(403);
  expect((await patch(admin,saved,'active')).ok()).toBe(true);
  const context=await browser.newContext({viewport:{width:390,height:844}});
  try{
   const customer=await context.newPage();
   await customer.route('**/cleanup',r=>r.fulfill({json:{text:'Our cabinets look good.'}}));
   await customer.goto(site+'?code='+saved.customer_token);await customer.getByRole('button',{name:'Type my review',exact:true}).click();
   await customer.getByLabel('Your review',{exact:true}).fill('Our cabinets look good.');if(await customer.getByRole('checkbox',{name:'Automatically format my review'}).isVisible())await customer.getByRole('checkbox',{name:'Automatically format my review'}).uncheck();
   await customer.getByRole('button',{name:'Next',exact:true}).click();await customer.getByRole('button',{name:'Next',exact:true}).click();
   const rows=customer.locator('.photo-comparisons>.photo-comparison-row');await expect(rows).toHaveCount(3);
   await expect(rows.first()).toContainText('Island View Before');await expect(rows.first()).toContainText('Island View Now');
   await expect(rows.last()).toContainText('Stove View Now');
   const left=await rows.first().locator('figure').nth(0).boundingBox();const right=await rows.first().locator('figure').nth(1).boundingBox();
   expect(Math.abs(left!.y-right!.y)).toBeLessThan(2);expect(right!.x).toBeGreaterThan(left!.x);
   await expect(rows.locator('img')).toHaveCount(6);
   await expect(customer.getByRole('button',{name:'Save and share all photos',exact:true})).toBeEnabled();
   await customer.screenshot({path:info.outputPath('paired-customer-photos.png'),fullPage:true});
  }finally{await context.close();}
 }finally{await admin.delete('/api/admin/jobs/'+job.id);await admin.dispose();}
});

test('failed bulk upload retries only failed files without duplicating successful photos',async({page})=>{
 const {admin,token}=await login();const job=await(await admin.post('/api/admin/jobs',{data:{...fixture,internal_name:'Upload retry QA'}})).json();
 let fail=true;const bytes=await sharp({create:{width:300,height:200,channels:3,background:'white'}}).jpeg().toBuffer();
 try{
  await browserAdmin(page,token);await page.goto(site+'?admin=1');await page.getByLabel('Find a project').fill('Upload retry QA');await page.locator('.project-row').getByRole('button',{name:'Open project',exact:true}).click();
  await page.route('**/api/admin/photos',route=>{if(fail){fail=false;return route.fulfill({status:503,json:{error:'Synthetic upload interruption'}});}return route.continue();});
  await page.getByLabel('Upload project photos').setInputFiles(['first','second','third'].map(name=>({name:name+'.jpg',mimeType:'image/jpeg',buffer:bytes})));
  await expect(page.getByRole('button',{name:'Retry failed uploads'})).toBeEnabled();
  expect((await(await admin.get('/api/admin/jobs/'+job.id)).json()).photos).toHaveLength(2);
  await page.getByRole('button',{name:'Retry failed uploads'}).click();
  await expect.poll(async()=>(await(await admin.get('/api/admin/jobs/'+job.id)).json()).photos.length).toBe(3);
  await expect(page.getByRole('button',{name:'Retry failed uploads'})).toHaveCount(0);
 }finally{await admin.delete('/api/admin/jobs/'+job.id);await admin.dispose();}
});
