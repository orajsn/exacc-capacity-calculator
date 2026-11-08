(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.ExaWorkbook=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
 'use strict';
 // Local, bounded OpenXML table reader. It never evaluates formulas or follows links.
 const LIMITS=Object.freeze({fileBytes:10*1024*1024,xmlBytes:8*1024*1024,textCharacters:8*1024*1024,csvCharacters:17*1024*1024,entries:2048,sheets:32,cells:100000,rows:20000,columns:256,cellCharacters:32767,xmlNodes:500000,xmlDepth:64});
 const utf8=new TextDecoder('utf-8',{fatal:true});
 const badControls=/[\u0000-\u0008\u000b\u000c\u000e-\u001f\ufffe\uffff]/;
 const qname='(?:[A-Za-z_][A-Za-z0-9_.-]*:)?[A-Za-z_][A-Za-z0-9_.-]*';
 const SHEET_NS=new Set(['http://schemas.openxmlformats.org/spreadsheetml/2006/main','http://purl.oclc.org/ooxml/spreadsheetml/main']);
 const REL_NS=new Set(['http://schemas.openxmlformats.org/officeDocument/2006/relationships','http://purl.oclc.org/ooxml/officeDocument/relationships']);
 const PACKAGE_REL_NS='http://schemas.openxmlformats.org/package/2006/relationships',TYPES_NS='http://schemas.openxmlformats.org/package/2006/content-types';
 const isRelType=(type,name)=>[...REL_NS].some(ns=>type===`${ns}/${name}`);
 const localName=name=>name.slice(name.lastIndexOf(':')+1);
 const fail=message=>{throw Error(message);};
 function bytes(input){
  if(input instanceof ArrayBuffer)return new Uint8Array(input);
  if(ArrayBuffer.isView(input))return new Uint8Array(input.buffer,input.byteOffset,input.byteLength);
  return fail('Choose an .xlsx file, or export the worksheet as CSV.');
 }
 function decode(data,label){try{return utf8.decode(data);}catch{return fail(`${label}: unsupported text encoding. Save as .xlsx again or export CSV.`);}}
 const crcTable=Array.from({length:256},(_,n)=>{let c=n;for(let k=0;k<8;k++)c=c&1?0xedb88320^(c>>>1):c>>>1;return c>>>0;});
 function crc32(data){let c=0xffffffff;for(const b of data)c=crcTable[(c^b)&255]^(c>>>8);return(c^0xffffffff)>>>0;}
 function validateExtra(data,start,length){
  const view=new DataView(data.buffer,data.byteOffset,data.byteLength);let p=start,end=start+length;
  while(p<end){if(p+4>end)fail('Malformed XLSX ZIP extra field.');const id=view.getUint16(p,true),size=view.getUint16(p+2,true);p+=4;if(p+size>end)fail('Malformed XLSX ZIP extra field.');if(id===1)fail('ZIP64 workbooks are not supported. Export the worksheet as CSV.');p+=size;}
 }
 function zipIndex(data){
  if(data.length>LIMITS.fileBytes)fail('Workbook is larger than 10 MB. Import a smaller workbook or export CSV.');
  if(data.length<22)fail('This is not a complete .xlsx file.');
  const view=new DataView(data.buffer,data.byteOffset,data.byteLength),u16=p=>view.getUint16(p,true),u32=p=>view.getUint32(p,true);
  if(u32(0)!==0x04034b50)fail('Choose an unencrypted .xlsx file. Older .xls files and password-protected workbooks need a CSV export.');
  let end=-1;for(let p=data.length-22;p>=Math.max(0,data.length-65557);p--)if(u32(p)===0x06054b50&&p+22+u16(p+20)===data.length){end=p;break;}
  if(end<0)fail('The XLSX ZIP directory is missing or truncated.');
  const count=u16(end+10),size=u32(end+12),offset=u32(end+16);
  if(count===0xffff||size===0xffffffff||offset===0xffffffff)fail('ZIP64 workbooks are not supported. Export the worksheet as CSV.');
  if(u16(end)!==0x4b50||u16(end+4)!==0||u16(end+6)!==0||u16(end+8)!==count)fail('Multi-part XLSX archives are not supported.');
  if(count<1||count>LIMITS.entries||offset+size!==end||offset<4)fail('Invalid or oversized XLSX ZIP directory.');
  const entries=new Map(),folded=new Set(),ranges=[];let p=offset,xmlDeclared=0;
  for(let i=0;i<count;i++){
   if(p+46>end||u32(p)!==0x02014b50)fail('Malformed XLSX ZIP directory entry.');
   const flags=u16(p+8),method=u16(p+10),crc=u32(p+16),compressed=u32(p+20),uncompressed=u32(p+24),nameLength=u16(p+28),extraLength=u16(p+30),commentLength=u16(p+32),disk=u16(p+34),local=u32(p+42),next=p+46+nameLength+extraLength+commentLength;
   if(next>end||!nameLength||nameLength>1024)fail('Invalid XLSX ZIP filename.');
   if(flags&0x41)fail('Encrypted workbooks are not supported. Remove the password or export CSV.');
   if(disk||local===0xffffffff||compressed===0xffffffff||uncompressed===0xffffffff)fail('ZIP64 or multi-part workbooks are not supported.');
   if(method!==0&&method!==8)fail('This workbook compression is not supported. Save as .xlsx again or export CSV.');
   if(compressed>LIMITS.fileBytes||uncompressed>128*1024*1024)fail('An XLSX entry exceeds the import size limit.');
   validateExtra(data,p+46+nameLength,extraLength);
   const name=decode(data.subarray(p+46,p+46+nameLength),'ZIP filename');
   if(badControls.test(name)||name.includes('\\')||name.startsWith('/')||name.includes(':')||name.split('/').some(v=>v==='.'||v==='..'||v==='')){
    if(!(name.endsWith('/')&&!name.slice(0,-1).split('/').some(v=>!v||v==='.'||v==='..')&&!/[\\:\u0000-\u001f]/.test(name)&&!name.startsWith('/')))fail('Unsafe or malformed XLSX entry path.');
   }
   if(entries.has(name)||folded.has(name.toLowerCase()))fail('Duplicate XLSX ZIP entry names are not allowed.');
   folded.add(name.toLowerCase());
   if(/\.(?:xml|rels)$/i.test(name)){xmlDeclared+=uncompressed;if(xmlDeclared>LIMITS.xmlBytes)fail('Workbook XML exceeds the 8 MB import limit. Use a smaller workbook or CSV.');}
   if(local+30>offset||u32(local)!==0x04034b50)fail('An XLSX local file header is missing or invalid.');
   const lf=u16(local+6),lm=u16(local+8),ln=u16(local+26),le=u16(local+28),dataStart=local+30+ln+le,dataEnd=dataStart+compressed;
   if(lf!==flags||lm!==method||ln!==nameLength||dataStart>offset||dataEnd>offset||decode(data.subarray(local+30,local+30+ln),'ZIP filename')!==name)fail('XLSX ZIP headers do not agree.');
   validateExtra(data,local+30+ln,le);
   let rangeEnd=dataEnd;
   if(flags&8){
    if(dataEnd+12>offset)fail('An XLSX data descriptor is truncated.');
    let descriptor=dataEnd;
    if(u32(descriptor)===0x08074b50&&descriptor+16<=offset&&u32(descriptor+4)===crc)descriptor+=4;
    if(u32(descriptor)!==crc||u32(descriptor+4)!==compressed||u32(descriptor+8)!==uncompressed)fail('An XLSX data descriptor does not match its directory.');
    for(const [at,want]of [[14,crc],[18,compressed],[22,uncompressed]])if(u32(local+at)!==0&&u32(local+at)!==want)fail('XLSX ZIP headers do not agree.');
    rangeEnd=descriptor+12;
   }else if(u32(local+14)!==crc||u32(local+18)!==compressed||u32(local+22)!==uncompressed)fail('XLSX ZIP headers do not agree.');
   entries.set(name,{name,method,crc,compressed,uncompressed,dataStart,dataEnd});ranges.push([local,rangeEnd]);p=next;
  }
  if(p!==end)fail('Unexpected data in the XLSX ZIP directory.');
  ranges.sort((a,b)=>a[0]-b[0]);for(let i=1;i<ranges.length;i++)if(ranges[i][0]<ranges[i-1][1])fail('Overlapping XLSX ZIP entries are not allowed.');
  if([...entries.keys()].some(n=>/vbaProject\.bin$/i.test(n)))fail('Macro-enabled workbooks are not supported. Save a plain .xlsx copy or CSV.');
  return entries;
 }
 async function extract(data,entry,budget){
  if(!entry)fail('The workbook is missing a required OpenXML part.');
  if(entry.uncompressed>LIMITS.xmlBytes||entry.uncompressed>budget.remaining)fail('Workbook XML exceeds the 8 MB import limit.');
  let result;
  if(entry.method===0){if(entry.compressed!==entry.uncompressed)fail('Invalid stored XLSX entry size.');result=data.slice(entry.dataStart,entry.dataEnd);}
  else{
   let stream;try{stream=new DecompressionStream('deflate-raw');}catch{fail('This browser cannot unpack .xlsx files. Use a current browser or export the worksheet as CSV.');}
   const reader=new Blob([data.subarray(entry.dataStart,entry.dataEnd)]).stream().pipeThrough(stream).getReader(),chunks=[];let total=0;
   try{while(true){const part=await reader.read();if(part.done)break;total+=part.value.byteLength;if(total>entry.uncompressed||total>budget.remaining||total>LIMITS.xmlBytes){await reader.cancel();fail('Expanded workbook data exceeds its size limit.');}chunks.push(part.value);}}
   catch(error){if(/size limit/.test(error.message))throw error;fail('Workbook compression is invalid or truncated. Save it again or export CSV.');}
   finally{reader.releaseLock();}
   result=new Uint8Array(total);let at=0;for(const chunk of chunks){result.set(chunk,at);at+=chunk.length;}
  }
  if(result.length!==entry.uncompressed||crc32(result)!==entry.crc)fail('Workbook data failed its size or checksum check. Save the file again.');
  budget.remaining-=result.length;return decode(result,entry.name);
 }
 function entityText(text){
  return text.replace(/&([^;\s<&]+);|&/g,(whole,entity)=>{
   const known={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"};if(Object.prototype.hasOwnProperty.call(known,entity))return known[entity];
   if(entity&&/^#(?:[0-9]+|x[0-9a-fA-F]+)$/.test(entity)){const value=entity[1]==='x'?parseInt(entity.slice(2),16):Number(entity.slice(1));if(value<=0x10ffff&&value!==0&&(value<0xd800||value>0xdfff)){const s=String.fromCodePoint(value);if(!badControls.test(s))return s;}}
   return fail('Unsupported or invalid XML entity in workbook.');
  });
 }
 function parseXML(text,label){
  text=text.replace(/^\ufeff/,'').replace(/\r\n?/g,'\n');
  if(badControls.test(text)||/<!DOCTYPE|<!ENTITY/i.test(text))fail(`${label}: XML declarations or control characters are not allowed.`);
  const encoding=text.match(/^<\?xml\s[^?]*encoding\s*=\s*['"]([^'"]+)['"]/i);if(encoding&&!/^utf-?8$/i.test(encoding[1]))fail(`${label}: unsupported XML encoding. Export CSV instead.`);
  // Native XML validation supplements the deliberately small parser where available.
  if(typeof DOMParser!=='undefined'){const doc=new DOMParser().parseFromString(text,'application/xml');if(doc.getElementsByTagName('parsererror').length)fail(`${label}: malformed XML.`);}
  const holder={name:'',attrs:Object.create(null),parts:[],namespaces:Object.assign(Object.create(null),{xml:'http://www.w3.org/XML/1998/namespace'})},stack=[holder];let p=0,nodes=0;
  function appendText(value,decodeEntities=true){if(!value)return;if(decodeEntities&&value.includes(']]>'))fail(`${label}: invalid XML text.`);if(stack.length===1){if(value.trim())fail(`${label}: text outside the XML root.`);return;}stack[stack.length-1].parts.push(decodeEntities?entityText(value):value);}
  while(p<text.length){
   const at=text.indexOf('<',p);if(at<0){appendText(text.slice(p));break;}appendText(text.slice(p,at));
   if(text.startsWith('<!--',at)){const end=text.indexOf('-->',at+4);if(end<0||text.slice(at+4,end).includes('--'))fail(`${label}: malformed XML comment.`);p=end+3;continue;}
   if(text.startsWith('<![CDATA[',at)){const end=text.indexOf(']]>',at+9);if(end<0||stack.length===1)fail(`${label}: malformed XML CDATA.`);appendText(text.slice(at+9,end),false);p=end+3;continue;}
   if(text.startsWith('<?',at)){const end=text.indexOf('?>',at+2);if(end<0)fail(`${label}: malformed XML instruction.`);const pi=text.slice(at+2,end),target=pi.match(new RegExp(`^(${qname})(?:\\s|$)`))?.[1];if(!target)fail(`${label}: malformed XML instruction.`);if(target.toLowerCase()==='xml'&&(target!=='xml'||at!==0||!/^xml\s+version\s*=\s*(['"])1\.0\1(?:\s|$)/.test(pi)))fail(`${label}: invalid XML declaration.`);p=end+2;continue;}
   if(text.startsWith('<!',at))fail(`${label}: unsupported XML declaration.`);
   let end=at+1,quote='';for(;end<text.length;end++){const c=text[end];if(quote){if(c===quote)quote='';}else if(c==='"'||c==="'")quote=c;else if(c==='>')break;}
   if(end===text.length||quote)fail(`${label}: truncated XML tag.`);
   let body=text.slice(at+1,end);p=end+1;
   if(body.startsWith('/')){const name=body.slice(1).trim();if(!new RegExp(`^${qname}$`).test(name)||stack.length===1||stack[stack.length-1].name!==name)fail(`${label}: mismatched XML tags.`);stack.pop();continue;}
   const self=/\/\s*$/.test(body);if(self)body=body.replace(/\/\s*$/,'');
   const match=body.match(new RegExp(`^(${qname})`));if(!match)fail(`${label}: invalid XML element.`);
   const node={name:match[1],attrs:Object.create(null),parts:[]};let rest=body.slice(match[0].length);
   while(rest.length){if(!rest.trim())break;const attr=rest.match(new RegExp(`^\\s+(${qname})\\s*=\\s*(["'])([\\s\\S]*?)\\2`));if(!attr||attr[3].includes('<')||Object.prototype.hasOwnProperty.call(node.attrs,attr[1]))fail(`${label}: malformed or duplicate XML attributes.`);node.attrs[attr[1]]=entityText(attr[3]);rest=rest.slice(attr[0].length);}
   node.namespaces=Object.create(stack[stack.length-1].namespaces);
   for(const [key,value]of Object.entries(node.attrs)){if(key==='xmlns')node.namespaces['']=value;else if(key.startsWith('xmlns:')){const prefix=key.slice(6);if(prefix==='xmlns'||(prefix==='xml'&&value!=='http://www.w3.org/XML/1998/namespace')||!value)fail(`${label}: invalid XML namespace.`);node.namespaces[prefix]=value;}}
   const prefix=node.name.includes(':')?node.name.split(':')[0]:'';node.ns=node.namespaces[prefix]||'';if(prefix&&!node.ns)fail(`${label}: undeclared XML namespace.`);
   for(const key of Object.keys(node.attrs))if(key.includes(':')&&!key.startsWith('xmlns:')&&!node.namespaces[key.split(':')[0]])fail(`${label}: undeclared attribute namespace.`);
   if(++nodes>LIMITS.xmlNodes||stack.length>LIMITS.xmlDepth)fail('Workbook XML is too complex. Use a smaller worksheet or CSV.');
   stack[stack.length-1].parts.push(node);if(!self)stack.push(node);
  }
  if(stack.length!==1||holder.parts.length!==1)fail(`${label}: incomplete or multiple XML roots.`);
  return holder.parts[0];
 }
 const children=(node,name)=>node.parts.filter(p=>typeof p!=='string'&&p.ns===node.ns&&(!name||localName(p.name)===name));
 const child=(node,name)=>children(node,name)[0];
 const textOf=node=>node?node.parts.map(p=>typeof p==='string'?p:textOf(p)).join(''):'';
 function wellFormed(text){for(let i=0;i<text.length;i++){const n=text.charCodeAt(i);if(n>=0xd800&&n<=0xdbff){const next=text.charCodeAt(++i);if(!(next>=0xdc00&&next<=0xdfff))return false;}else if(n>=0xdc00&&n<=0xdfff)return false;}return true;}
 function openXMLText(value){const out=value.replace(/_x([0-9a-f]{4})_/gi,(_,n)=>String.fromCharCode(parseInt(n,16)));if(out.length>LIMITS.cellCharacters||badControls.test(out)||!wellFormed(out))fail('A worksheet cell contains too much text or unsupported Unicode/control characters.');return out;}
 function richText(node){return openXMLText(children(node).filter(n=>['t','r'].includes(localName(n.name))).map(n=>localName(n.name)==='t'?textOf(n):children(n,'t').map(textOf).join('')).join(''));}
 function resolvePart(base,target){
  if(typeof target!=='string'||!target||/[\\?#\u0000-\u001f]/.test(target)||/^[a-z][a-z0-9+.-]*:/i.test(target)||target.startsWith('//'))fail('Workbook relationship points outside the file.');
  try{target=decodeURIComponent(target);}catch{fail('Invalid workbook relationship path.');}
  if(/[\\?#\u0000-\u001f:]/.test(target)||target.startsWith('//'))fail('Invalid workbook relationship path.');
  const parts=target.startsWith('/')?[]:base.split('/').slice(0,-1);
  for(const part of target.split('/')){if(!part||part==='.')continue;if(part==='..'){if(!parts.length)fail('Workbook relationship escapes the file.');parts.pop();}else parts.push(part);}
  if(!parts.length)fail('Invalid workbook relationship path.');return parts.join('/');
 }
 const relationshipPath=part=>{const at=part.lastIndexOf('/');return`${at<0?'':part.slice(0,at+1)}_rels/${part.slice(at+1)}.rels`;};
 function relationships(node,label){
  if(localName(node.name)!=='Relationships'||node.ns!==PACKAGE_REL_NS)fail(`${label}: missing OpenXML relationships root.`);
  const map=new Map();for(const rel of children(node,'Relationship')){const a=rel.attrs;if(!a.Id||!a.Type||!a.Target||map.has(a.Id))fail(`${label}: incomplete or duplicate relationship.`);if(a.TargetMode&&a.TargetMode!=='External'&&a.TargetMode!=='Internal')fail(`${label}: invalid relationship mode.`);map.set(a.Id,{type:a.Type,target:a.Target,external:a.TargetMode==='External'});}return map;
 }
 function position(reference){const m=String(reference).match(/^([A-Za-z]+)([1-9][0-9]*)$/);if(!m)fail('A worksheet contains an invalid cell reference.');let col=0;for(const c of m[1].toUpperCase())col=col*26+c.charCodeAt(0)-64;const row=Number(m[2]);if(col>LIMITS.columns||row>LIMITS.rows)fail('Worksheet range exceeds 20,000 rows or 256 columns. Import a smaller range or CSV.');return{row,col};}
 function plainStoredNumber(value){
  // Preserve the stored digits: converting through Number would round numeric
  // identifiers and precision before the user selects the inventory mapping.
  const [mantissa,exponentText]=value.replace(/^\+/,'').split(/[eE]/);if(exponentText===undefined)return mantissa;
  const negative=mantissa.startsWith('-'),unsigned=negative?mantissa.slice(1):mantissa,dot=unsigned.indexOf('.'),digits=unsigned.replace('.','');
  const exponent=Number(exponentText),point=(dot<0?unsigned.length:dot)+exponent;
  const length=(negative?1:0)+(point<=0?2-point+digits.length:Math.max(point,digits.length)+(point<digits.length?1:0));
  if(!Number.isSafeInteger(point)||length>LIMITS.cellCharacters)fail('A worksheet numeric cell exceeds the text limit when written as a plain decimal.');
  return (negative?'-':'')+(point<=0?'0.'+'0'.repeat(-point)+digits:point>=digits.length?digits+'0'.repeat(point-digits.length):digits.slice(0,point)+'.'+digits.slice(point));
 }
 function sheetRows(root,shared,name,remaining){
  if(localName(root.name)!=='worksheet'||!SHEET_NS.has(root.ns))fail(`${name}: not an OpenXML worksheet.`);
  const dataParts=children(root,'sheetData');if(dataParts.length>1)fail(`${name}: duplicate worksheet data.`);
  const data=dataParts[0];if(!data)return{rows:[],warnings:[]};
  const rows=[],seenRows=new Set();let previous=0,formulaCount=0,formulaMissing=0,errorCount=0,explicitDates=0;const errorRefs=[];
  for(const rowNode of children(data,'row')){
   const cells=children(rowNode,'c'),firstRef=cells.find(c=>c.attrs.r)?.attrs.r;
   let rowNo=rowNode.attrs.r===undefined?(firstRef?position(firstRef).row:previous+1):Number(rowNode.attrs.r);
   if(!Number.isInteger(rowNo)||rowNo<1||rowNo>LIMITS.rows||seenRows.has(rowNo))fail(`${name}: invalid or duplicate worksheet row.`);
   seenRows.add(rowNo);previous=rowNo;let column=0;const seenCells=new Set(),values=[];
   for(const c of cells){
    const pos=c.attrs.r?position(c.attrs.r):{row:rowNo,col:column+1};if(pos.row!==rowNo||pos.col>LIMITS.columns||seenCells.has(pos.col))fail(`${name}: duplicate or inconsistent cell reference.`);
    column=pos.col;seenCells.add(column);const added=Math.max(0,column-values.length);remaining.count-=added;if(remaining.count<0)fail('Workbook contains more than 100,000 output cells. Import a smaller range or CSV.');while(values.length<column)values.push('');
    const valueNodes=children(c,'v'),formulaNodes=children(c,'f');if(valueNodes.length>1||formulaNodes.length>1)fail(`${name}: duplicate cell value or formula.`);
    const v=valueNodes[0],raw=textOf(v),type=c.attrs.t||'n';let value='';
    if(formulaNodes.length){formulaCount++;if(!v||raw==='')formulaMissing++;}
    if(type==='inlineStr'){const inline=children(c,'is');if(inline.length>1)fail(`${name}: duplicate inline string.`);value=inline[0]?richText(inline[0]):'';}
    else if(type==='s'){if(raw.trim()){if(!/^[0-9]+$/.test(raw.trim())||!shared||Number(raw.trim())>=shared.length)fail(`${name}: invalid shared-string reference.`);value=shared[Number(raw.trim())];}}
    else if(type==='b'){if(raw.trim()&&!['0','1'].includes(raw.trim()))fail(`${name}: invalid Boolean cell.`);value=raw.trim()==='1'?'TRUE':raw.trim()==='0'?'FALSE':'';}
    else if(type==='e'){errorCount++;if(errorRefs.length<8)errorRefs.push(c.attrs.r||`row ${rowNo}`);}
    else if(type==='str')value=openXMLText(raw);
    else if(type==='d'){value=raw.trim();if(value)explicitDates++;}
    else if(type==='n'){value=raw.trim();if(value&&(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(value)||!Number.isFinite(Number(value))))fail(`${name}: invalid stored number in ${c.attrs.r||`row ${rowNo}`}.`);if(value)value=plainStoredNumber(value);}
    else fail(`${name}: unsupported cell type. Export this worksheet as CSV.`);
    if(value.length>LIMITS.cellCharacters)fail(`${name}: a cell exceeds the text limit.`);remaining.text-=value.length;if(remaining.text<0)fail('Expanded worksheet text exceeds the 8 million character limit. Import a smaller range or CSV.');values[column-1]=value;
   }
   rows[rowNo-1]=values;
  }
  const warnings=[];
  if(formulaCount)warnings.push(`${formulaCount} formula cell${formulaCount===1?'':'s'} use saved results only; formulas are not recalculated.${formulaMissing?` ${formulaMissing} saved result${formulaMissing===1?' is':'s are'} missing and left blank.`:''} Recalculate and save in Excel before importing if needed.`);
  if(errorCount)warnings.push(`${errorCount} Excel error cell${errorCount===1?' was':'s were'} left blank (${errorRefs.join(', ')}${errorCount>errorRefs.length?', …':''}). Review these missing values.`);
  if(explicitDates)warnings.push('Date cells are read as stored values; date formatting is not applied.');
  if(children(root,'mergeCells').length)warnings.push('Merged cells use their stored top-left value only. Other cells stay blank; confirm the header row and mapping.');
  return{rows:Array.from({length:rows.length},(_,i)=>rows[i]||[]),warnings};
 }
 async function read(input){
  const data=bytes(input),entries=zipIndex(data),budget={remaining:LIMITS.xmlBytes},cache=new Map();
  async function xml(path){if(cache.has(path))return cache.get(path);const entry=entries.get(path);if(!entry)fail(`Workbook part ${path} is missing.`);const parsed=parseXML(await extract(data,entry,budget),path);cache.set(path,parsed);return parsed;}
  const types=await xml('[Content_Types].xml');if(localName(types.name)!=='Types'||types.ns!==TYPES_NS)fail('Invalid .xlsx content types.');
  if(children(types).some(n=>/macroenabled|vbaProject/i.test(n.attrs.ContentType||'')))fail('Macro-enabled workbooks are not supported. Save a plain .xlsx copy or CSV.');
  const rootRels=relationships(await xml('_rels/.rels'),'Workbook package'),offices=[...rootRels.values()].filter(r=>isRelType(r.type,'officeDocument'));
  if(offices.length!==1||offices[0].external)fail('The .xlsx workbook relationship is missing or external.');
  const workbookPath=resolvePart('',offices[0].target),workbook=await xml(workbookPath);
  const overrides=new Map();for(const node of children(types,'Override')){const path=resolvePart('',node.attrs.PartName);if(overrides.has(path))fail('Duplicate workbook content type declarations.');overrides.set(path,node.attrs.ContentType);}
  if(overrides.get(workbookPath)!=='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml')fail('This is not a plain .xlsx workbook. Save a plain .xlsx copy or CSV.');
  if(localName(workbook.name)!=='workbook'||!SHEET_NS.has(workbook.ns))fail('The selected file is not an OpenXML .xlsx workbook.');
  const rels=relationships(await xml(relationshipPath(workbookPath)),'Workbook'),sheetContainers=children(workbook,'sheets');
  if(sheetContainers.length!==1)fail('The workbook sheet list is missing or duplicated.');
  const sheetNodes=children(sheetContainers[0],'sheet');if(!sheetNodes.length||sheetNodes.length>LIMITS.sheets)fail('Import a workbook with 1 to 32 worksheets.');
  const stringsRels=[...rels.values()].filter(r=>isRelType(r.type,'sharedStrings'));if(stringsRels.length>1||stringsRels.some(r=>r.external))fail('Invalid shared-string relationship.');
  let shared=null;if(stringsRels.length){const table=await xml(resolvePart(workbookPath,stringsRels[0].target));if(localName(table.name)!=='sst'||!SHEET_NS.has(table.ns))fail('Invalid workbook shared-string table.');const strings=children(table,'si');if(strings.length>LIMITS.cells)fail('Workbook has too many shared strings. Use a smaller workbook or CSV.');shared=strings.map(richText);}
  const warnings=['Stored cell values are imported; Excel display formatting is not applied.'],sheets=[],names=new Set(),remaining={count:LIMITS.cells,text:LIMITS.textCharacters};
  if([...rels.values()].some(r=>r.external||/\/externalLink$/.test(r.type)))warnings.push('External workbook links are not followed or refreshed. Check any saved formula results.');
  for(const node of sheetNodes){
   const name=node.attrs.name,id=Object.entries(node.attrs).find(([key])=>key.includes(':')&&localName(key)==='id'&&REL_NS.has(node.namespaces[key.split(':')[0]]))?.[1];
   if(!name||name.length>128||badControls.test(name)||names.has(name.toLowerCase())||!id||!rels.has(id))fail('The workbook contains a missing, duplicate or invalid worksheet name/link.');names.add(name.toLowerCase());
   const rel=rels.get(id);if(rel.external)fail(`${name}: external worksheet links cannot be imported.`);
   if(!isRelType(rel.type,'worksheet')){warnings.push(`${name}: skipped because it is not a worksheet.`);continue;}
   const result=sheetRows(await xml(resolvePart(workbookPath,rel.target)),shared,name,remaining);
   if(node.attrs.state&&node.attrs.state!=='visible')result.warnings.unshift('This worksheet is hidden in Excel. Confirm that it is the intended input.');
   sheets.push({name,...result});
  }
  if(!sheets.length)fail('No tabular worksheets were found. Export the intended sheet as CSV.');
  return{sheets,warnings};
 }
 function toCSV(rows){
  // Internal preview interchange: preserves literal text, including '='. Not a formula-sanitized spreadsheet export.
  if(!Array.isArray(rows)||rows.length>LIMITS.rows)fail('Invalid or oversized worksheet rows.');let cells=0,text=0,output=Math.max(0,rows.length-1)*2;
  for(const row of rows){if(!Array.isArray(row)||row.length>LIMITS.columns||(cells+=row.length)>LIMITS.cells)fail('Invalid or oversized worksheet row.');output+=Math.max(0,row.length-1);for(const value of row){if(value!==null&&value!==undefined&&!['string','number','boolean'].includes(typeof value))fail('Invalid worksheet cell.');const s=value==null?'':String(value);if(s.length>LIMITS.cellCharacters)fail('Worksheet cell exceeds the text limit.');text+=s.length;output+=s.length+2;for(const c of s)if(c==='"')output++;if(text>LIMITS.textCharacters||output>LIMITS.csvCharacters)fail('Worksheet text exceeds the CSV preview size limit. Import a smaller range.');}}
  return rows.map(row=>row.map(value=>`"${(value==null?'':String(value)).replace(/"/g,'""')}"`).join(',')).join('\r\n');
 }
 return{LIMITS,read,toCSV};
});
