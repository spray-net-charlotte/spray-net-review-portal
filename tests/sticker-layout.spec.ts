import {test,expect} from './test';
import {stickerPDF} from '../lib/sticker-pdf';
import {avery5360Layout} from '../lib/sticker-layouts';
import {PDFDocument,PDFRawStream} from 'pdf-lib';
import {inflateSync} from 'node:zlib';
import {writeFile} from 'node:fs/promises';

test('Avery 5360 fits 21 complete codes and identifiers per sheet without spilling across labels',async({},info)=>{
 const origin='https://spray-net-charlotte.github.io/spray-net-review-portal/';
 const codes=Array.from({length:22},(_,i)=>({token:(String(i).padStart(2,'0')+'a'.repeat(30)),label:`SN-${341+i}`}));
 const bytes=await stickerPDF(codes,{...avery5360Layout,origin,test:true});
 await writeFile(info.outputPath('avery-5360-sheet.pdf'),bytes);
 const doc=await PDFDocument.load(bytes);
 expect(doc.getPageCount()).toBe(2);
 const stream=doc.context.lookup(doc.getPage(0).node.Contents()) as any;
 const objects=stream.asArray?stream.asArray().map((ref:any)=>doc.context.lookup(ref)):[stream];
 const content=objects.map((o:PDFRawStream)=>inflateSync(o.getContents()).toString()).join('\n');
 // QR white backgrounds are exactly 96 pt square, 12 pt from each cell's left.
 const backgrounds=[...content.matchAll(/1 0 0 1 ([\d.]+) ([\d.]+) cm\n1 0 0 1 0 0 cm\n1 0 0 1 0 0 cm\n0 0 m\n0 96 l\n96 96 l\n96 0 l/g)];
 expect(backgrounds.length).toBe(21);
 for(let i=0;i<21;i++){
  expect(+backgrounds[i][1]).toBeCloseTo(14.25+(i%3)*202.5);
  expect(+backgrounds[i][2]).toBeCloseTo(672-Math.floor(i/3)*108);
  expect(content).toContain(Buffer.from(codes[i].label).toString('hex').toUpperCase());
 }
 await writeFile(info.outputPath('avery-5360-sheet.pdf'),bytes);
});
