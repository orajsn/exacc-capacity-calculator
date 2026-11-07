const test=require('node:test'),assert=require('node:assert/strict'),zlib=require('node:zlib');
const W=require('./workbook-import.js');
const crcTable=Array.from({length:256},(_,n)=>{let c=n;for(let i=0;i<8;i++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
function crc32(data){let c=0xffffffff;for(const b of data)c=crcTable[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
function zip(parts,options={}){
 const locals=[],central=[];let offset=0;
 for(const [name,text,per={}]of Array.isArray(parts)?parts:Object.entries(parts)){
  const opts={...options,...per},body=Buffer.from(text),filename=Buffer.from(name),method=opts.method??8,compressed=method===0?body:zlib.deflateRawSync(body),crc=crc32(body),expanded=opts.expanded??body.length,flags=0x800|(opts.descriptor?8:0)|(opts.encrypted?1:0),extra=opts.extra||Buffer.alloc(0);
  const lh=Buffer.alloc(30);lh.writeUInt32LE(0x04034b50);lh.writeUInt16LE(20,4);lh.writeUInt16LE(flags,6);lh.writeUInt16LE(method,8);if(!opts.descriptor){lh.writeUInt32LE(crc,14);lh.writeUInt32LE(compressed.length,18);lh.writeUInt32LE(expanded,22);}lh.writeUInt16LE(filename.length,26);lh.writeUInt16LE(extra.length,28);
  const descriptor=opts.descriptor?Buffer.alloc(opts.signed===false?12:16):Buffer.alloc(0);if(opts.descriptor){let p=0;if(opts.signed!==false){descriptor.writeUInt32LE(0x08074b50);p=4;}descriptor.writeUInt32LE(crc,p);descriptor.writeUInt32LE(compressed.length,p+4);descriptor.writeUInt32LE(expanded,p+8);}
  const entry=Buffer.concat([lh,filename,extra,compressed,descriptor]);locals.push(entry);
  const ch=Buffer.alloc(46);ch.writeUInt32LE(0x02014b50);ch.writeUInt16LE(20,4);ch.writeUInt16LE(20,6);ch.writeUInt16LE(flags,8);ch.writeUInt16LE(method,10);ch.writeUInt32LE(crc,16);ch.writeUInt32LE(compressed.length,20);ch.writeUInt32LE(expanded,24);ch.writeUInt16LE(filename.length,28);ch.writeUInt16LE(extra.length,30);ch.writeUInt32LE(offset,42);central.push(Buffer.concat([ch,filename,extra]));offset+=entry.length;
 }
 const c=Buffer.concat(central),end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50);end.writeUInt16LE(central.length,8);end.writeUInt16LE(central.length,10);end.writeUInt32LE(c.length,12);end.writeUInt32LE(offset,16);return Buffer.concat([...locals,c,end]);
}
const ns='http://schemas.openxmlformats.org/spreadsheetml/2006/main',relsNs='http://schemas.openxmlformats.org/package/2006/relationships',relBase='http://schemas.openxmlformats.org/officeDocument/2006/relationships';
function worksheet(rows,tail=''){return`<?xml version="1.0" encoding="UTF-8"?><worksheet xmlns="${ns}"><sheetData>${rows}</sheetData>${tail}</worksheet>`;}
const cell=(r,value,type='inlineStr')=>type==='inlineStr'?`<c r="${r}" t="inlineStr"><is><t>${value}</t></is></c>`:`<c r="${r}" t="${type}"><v>${value}</v></c>`;
function parts(sheet=worksheet(`<row r="1">${cell('A1','site')}${cell('B1','ecpu')}</row><row r="2">${cell('A2','DC')}${cell('B2','200','n')}</row>`)){
 return{
  '[Content_Types].xml':'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/></Types>',
  '_rels/.rels':`<Relationships xmlns="${relsNs}"><Relationship Id="root" Type="${relBase}/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
  'xl/workbook.xml':`<workbook xmlns="${ns}" xmlns:r="${relBase}"><sheets><sheet name="Workloads" sheetId="1" r:id="rId1"/></sheets></workbook>`,
  'xl/_rels/workbook.xml.rels':`<Relationships xmlns="${relsNs}"><Relationship Id="rId1" Type="${relBase}/worksheet" Target="worksheets/sheet1.xml"/></Relationships>`,
  'xl/worksheets/sheet1.xml':sheet
 };
}

test('reads real minimal stored and deflated XLSX ZIPs without network or dependency',async()=>{
 for(const method of [0,8]){const result=await W.read(zip(parts(),{method}));assert.deepEqual(result.sheets[0].rows,[['site','ecpu'],['DC','200']]);assert.equal(result.sheets[0].name,'Workloads');assert.match(result.warnings.join(' '),/display formatting/);}
});
test('signed and unsigned data descriptors work and remain checksum-checked',async()=>{
 for(const signed of [true,false]){const data=zip(parts(),{descriptor:true,signed});assert.equal((await W.read(data)).sheets[0].rows[1][1],'200');}
});
test('preserves sparse cells, string whitespace, rich text, boolean and raw numeric values',async()=>{
 const sheet=worksheet('<row r="2"><c r="A2" t="s"><v>0</v></c><c r="C2" t="inlineStr"><is><r><t>Core </t></r><r><t>&amp; data</t></r><rPh><t>ignored</t></rPh></is></c><c r="D2" t="b"><v>1</v></c><c r="E2"><v>0.01</v></c><c r="F2"><v>2e2</v></c></row>');
 const p=parts(sheet);p['xl/_rels/workbook.xml.rels']=p['xl/_rels/workbook.xml.rels'].replace('</Relationships>',`<Relationship Id="strings" Type="${relBase}/sharedStrings" Target="sharedStrings.xml"/></Relationships>`);p['xl/sharedStrings.xml']=`<sst xmlns="${ns}"><si><t xml:space="preserve"> DC &amp; North </t></si></sst>`;
 const result=await W.read(zip(p));assert.deepEqual(result.sheets[0].rows,[[],[' DC & North ','','Core & data','TRUE','0.01','2e2']]);
});
test('does not execute or recalculate formulas; missing and error results remain unknown',async()=>{
 const sheet=worksheet('<row r="1"><c r="A1"><f>1+1</f><v>2</v></c><c r="B1"><f>ExternalBook!A1</f></c><c r="C1" t="e"><f>1/0</f><v>#DIV/0!</v></c><c r="D1" t="str"><v>=HYPERLINK("https://example.invalid")</v></c></row>');
 const result=await W.read(zip(parts(sheet))),s=result.sheets[0];assert.deepEqual(s.rows,[['2','','','=HYPERLINK("https://example.invalid")']]);assert.match(s.warnings.join(' '),/3 formula cells/);assert.match(s.warnings.join(' '),/1 saved result is missing/);assert.match(s.warnings.join(' '),/Excel error cell/);
});
test('multiple sheets, hidden status, merged headers and external link limitations are explicit',async()=>{
 const p=parts(worksheet(`<row r="1">${cell('A1','Header')}</row>`,'<mergeCells><mergeCell ref="A1:B1"/></mergeCells>'));
 p['xl/workbook.xml']=p['xl/workbook.xml'].replace('</sheets>','<sheet name="DR" sheetId="2" r:id="rId2" state="hidden"/></sheets>');
 p['xl/_rels/workbook.xml.rels']=p['xl/_rels/workbook.xml.rels'].replace('</Relationships>',`<Relationship Id="rId2" Type="${relBase}/worksheet" Target="/xl/worksheets/sheet2.xml"/><Relationship Id="external" Type="${relBase}/externalLink" Target="externalLinks/externalLink1.xml"/></Relationships>`);p['xl/worksheets/sheet2.xml']=worksheet(`<row r="1">${cell('A1','Recovery')}</row>`);
 const result=await W.read(zip(p));assert.equal(result.sheets.length,2);assert.match(result.sheets[0].warnings.join(' '),/Merged/);assert.match(result.sheets[1].warnings.join(' '),/hidden/);assert.match(result.warnings.join(' '),/not followed or refreshed/);
});
test('CSV preview conversion quotes newlines/quotes and preserves blank or formula-like strings as data',()=>{
 assert.equal(W.toCSV([['a,b','say "hi"','a\nb',null,'=literal',0,false],[]]),'"a,b","say ""hi""","a\nb","","=literal","0","false"\r\n');
 assert.throws(()=>W.toCSV([[{}]]),/Invalid worksheet cell/);
});
test('rejects encryption, wrong archive types, unsupported methods, ZIP64 and truncation',async()=>{
 await assert.rejects(W.read(Buffer.from('not an xlsx document')),/complete|unencrypted/);
 await assert.rejects(W.read(zip(parts(),{encrypted:true})),/Encrypted/);
 await assert.rejects(W.read(zip(parts(),{method:12})),/compression is not supported/);
 const extra=Buffer.from([1,0,0,0]);await assert.rejects(W.read(zip(parts(),{extra})),/ZIP64/);
 const archive=zip(parts());await assert.rejects(W.read(archive.subarray(0,archive.length-1)),/missing or truncated/);
 const split=Buffer.from(archive);split.writeUInt16LE(1,split.length-18);await assert.rejects(W.read(split),/Multi-part/);
});
test('rejects duplicate, unsafe and disagreeing ZIP entries',async()=>{
 await assert.rejects(W.read(zip([...Object.entries(parts()),['xl/workbook.xml','<workbook/>']])),/Duplicate/);
 await assert.rejects(W.read(zip([...Object.entries(parts()),['../evil.xml','<a/>']])),/Unsafe/);
 const archive=zip(parts(),{method:0});archive[30]=120;await assert.rejects(W.read(archive),/headers do not agree/);
});
test('checks CRC and bounds actual inflation, not just the declared size',async()=>{
 const p=parts(),bad=zip(p,{method:0});const firstData=30+Buffer.byteLength('[Content_Types].xml');bad[firstData+10]^=1;await assert.rejects(W.read(bad),/checksum/);
 const entries=Object.entries(parts());entries[entries.length-1].push({expanded:20});await assert.rejects(W.read(zip(entries)),/Expanded workbook data exceeds/);
 await assert.rejects(W.read(new Uint8Array(W.LIMITS.fileBytes+1)),/larger than 10 MB/);
 const oversized=Object.entries(parts());oversized[0].push({expanded:W.LIMITS.xmlBytes+1});await assert.rejects(W.read(zip(oversized)),/XML exceeds/);
});
test('rejects external worksheet targets and path traversal; no external data is read',async()=>{
 for(const target of ['https://example.invalid/sheet.xml','../../outside.xml','%2e%2e/%2e%2e/outside.xml','//example.invalid/a','worksheets/sheet1.xml?x=1']){const p=parts();p['xl/_rels/workbook.xml.rels']=p['xl/_rels/workbook.xml.rels'].replace('worksheets/sheet1.xml',target);await assert.rejects(W.read(zip(p)),/outside|escapes|relationship path/);}
 const p=parts();p['xl/_rels/workbook.xml.rels']=p['xl/_rels/workbook.xml.rels'].replace('Target="worksheets/sheet1.xml"','Target="worksheets/sheet1.xml" TargetMode="External"');await assert.rejects(W.read(zip(p)),/external worksheet/);
});
test('rejects XML declarations, unknown entities, invalid code points and malformed structures',async()=>{
 const invalid=['<!DOCTYPE x [<!ENTITY a "unsafe">]><worksheet/>',worksheet(`<row r="1">${cell('A1','&unknown;')}</row>`),worksheet(`<row r="1">${cell('A1','&#0;')}</row>`),worksheet(`<row r="1">${cell('A1','&#xD800;')}</row>`),worksheet(`<row r="1">${cell('A1','&#1114112;')}</row>`),worksheet('<row r="1" r="2"/>'),'<worksheet><sheetData></worksheet>','<worksheet/><worksheet/>'];
 for(const xml of invalid)await assert.rejects(W.read(zip(parts(xml))),/XML|entity/);
});
test('rejects invalid shared-string indices, duplicate cells and inconsistent rows',async()=>{
 for(const data of ['<row r="1"><c r="A1" t="s"><v>0</v></c></row>','<row r="1"><c r="A1"/><c r="A1"/></row>','<row r="1"><c r="A2"/></row>','<row r="1"/><row r="1"/>'])await assert.rejects(W.read(zip(parts(worksheet(data)))),/reference|duplicate|inconsistent/);
});
test('bounds sparse coordinates and output slots before allocating large grids',async()=>{
 await assert.rejects(W.read(zip(parts(worksheet('<row r="1048576"><c r="XFD1048576"/></row>')))),/row|range/);
 const many=Array.from({length:400},(_,i)=>`<row r="${i+1}"><c r="IV${i+1}"/></row>`).join('');await assert.rejects(W.read(zip(parts(worksheet(many)))),/100,000 output cells/);
});
test('rejects macros and ambiguous sheet relationships',async()=>{
 const macro=parts();macro['xl/vbaProject.bin']='binary';await assert.rejects(W.read(zip(macro)),/Macro-enabled/);
 const macroType=parts();macroType['[Content_Types].xml']=macroType['[Content_Types].xml'].replace('spreadsheetml.sheet.main+xml','ms-excel.sheet.macroEnabled.main+xml');await assert.rejects(W.read(zip(macroType)),/Macro-enabled/);
 const dup=parts();dup['xl/workbook.xml']=dup['xl/workbook.xml'].replace('</sheets>','<sheet name="workloads" sheetId="2" r:id="rId1"/></sheets>');await assert.rejects(W.read(zip(dup)),/duplicate/);
});
test('OpenXML escaped literals are decoded once and rich strings exclude phonetic hints',async()=>{
 const result=await W.read(zip(parts(worksheet(`<row r="1">${cell('A1','_x005F_x0041_')}${cell('B1','_x0041_')}</row>`))));assert.deepEqual(result.sheets[0].rows,[['_x0041_','A']]);
});
test('rejects non-OpenXML namespaces, wrong content types, ambiguous IDs and lone escaped surrogates',async()=>{
 const cases=[];
 const badTypes=parts();badTypes['[Content_Types].xml']='<Types xmlns="urn:wrong"/>';cases.push(badTypes);
 const badWorkbook=parts();badWorkbook['xl/workbook.xml']=badWorkbook['xl/workbook.xml'].replace(ns,'urn:wrong');cases.push(badWorkbook);
 const badWorksheet=parts();badWorksheet['xl/worksheets/sheet1.xml']=badWorksheet['xl/worksheets/sheet1.xml'].replace(ns,'urn:wrong');cases.push(badWorksheet);
 const wrongRel=parts();wrongRel['_rels/.rels']=wrongRel['_rels/.rels'].replace(`${relBase}/officeDocument`,'urn:any/officeDocument');cases.push(wrongRel);
 const missingType=parts();missingType['[Content_Types].xml']=`<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"/>`;cases.push(missingType);
 const unqualified=parts();unqualified['xl/workbook.xml']=unqualified['xl/workbook.xml'].replace('r:id=','id=');cases.push(unqualified);
 cases.push(parts(worksheet(`<row r="1">${cell('A1','_xD800_')}</row>`)));
 for(const p of cases)await assert.rejects(W.read(zip(p)),/OpenXML|content type|relationship|plain .xlsx|worksheet name|Unicode/);
 const valid=await W.read(zip(parts(worksheet(`<row r="1">${cell('A1','_xD83D__xDE00_')}</row>`))));assert.equal(valid.sheets[0].rows[0][0],'😀');
});
test('bounds repeated shared strings and independent CSV expansion before building a huge string',async()=>{
 const text='x'.repeat(32767),p=parts(worksheet(Array.from({length:300},(_,i)=>`<row r="${i+1}"><c r="A${i+1}" t="s"><v>0</v></c></row>`).join('')));
 p['xl/_rels/workbook.xml.rels']=p['xl/_rels/workbook.xml.rels'].replace('</Relationships>',`<Relationship Id="strings" Type="${relBase}/sharedStrings" Target="sharedStrings.xml"/></Relationships>`);p['xl/sharedStrings.xml']=`<sst xmlns="${ns}"><si><t>${text}</t></si></sst>`;
 await assert.rejects(W.read(zip(p)),/Expanded worksheet text/);
 assert.throws(()=>W.toCSV(Array.from({length:300},()=>[text])),/CSV preview size limit/);
 assert.equal(W.toCSV([[text],[text]]).length,text.length*2+6);
});
test('source remains browser-only and never evaluates workbook data',()=>{
 const source=require('node:fs').readFileSync(require.resolve('./workbook-import.js'),'utf8');assert.doesNotMatch(source,/\bfetch\s*\(|XMLHttpRequest|eval\s*\(|new Function|import\s*\(/);
});
