'use strict';
const X=window.ExaScenarios;
let csvSource=null,csvPreview=null,csvCandidate=null,csvSignature=null,csvWorkbook=null,csvSourceWarnings=[],csvWorksheetRows=null,csvReadGeneration=0;
let scenarioProjectGeneration=null,scenarioCompareIds=[],scenarioCompareInitialized=false;
const scenarioValue=(id,fallback='')=>$(id)?$(id).value:fallback;
function scenarioNumber(id,label){const value=scenarioValue(id);if(value==='')throw Error(`Enter ${label}.`);return Number(value);}
function scenarioTopology(){return window.ExaTopology;}
function scenarioForSnapshot(){const rules=window.ExaRules;return rules?{...state,ruleSet:{version:rules.VERSION,checked:rules.CHECKED,scope:rules.SCOPE}}:state;}
function scenarioSetState(next){state=next;active=Math.min(active,state.sites.length-1);if(typeof activeAVMCEditor!=='undefined')activeAVMCEditor=0;if(typeof cancelPreview==='function')cancelPreview();}
function ensureScenarioControls(){
 const container=$('scenario-tools');if(!container||container.dataset.ready==='true')return;
 container.dataset.ready='true';
 container.innerHTML=`<h2>Compare saved options</h2><p class="hint">Keep complete plans for an option, a future year or temporary migration overlap. Saving an option here keeps it in this tab; download JSON to retain it.</p>
 <div class="fields"><label>Project name<input id="project-name" maxlength="120" placeholder="Optional"></label><label>Project assumptions<textarea id="project-notes" rows="2" maxlength="6000" placeholder="Scope, dates and assumptions"></textarea></label></div>
 <div class="fields"><label>Option name<input id="alternative-name" maxlength="100" placeholder="For example: current design or Year 2"></label><label>Option type<select id="alternative-kind"><option value="option">Design option</option><option value="year">Year / growth stage</option><option value="migration">Migration stage</option></select></label></div><button type="button" data-scenario-action="capture">Save working plan as an option</button>
 <details><summary>Create a growth option</summary><p class="hint">Scale known CPU/RAM needs in a separate saved option. Unknown values stay unknown, and affected machines need hardware comparison again.</p><div class="fields growth-fields"><label>Growth option name<input id="growth-name" maxlength="100" placeholder="For example: Year 2"></label><label>Workload ECPU growth (%)<input id="growth-cpu" type="number" min="0" max="1000" value="20"></label><label>Workload RAM growth (%)<input id="growth-ram" type="number" min="0" max="1000" value="20"></label></div><button type="button" data-scenario-action="growth">Create growth option</button></details>
 <details><summary>Model migration overlap</summary><p class="hint">Copy selected AVMC allocations on the active machine into a separate saved option. Both allocations consume capacity during overlap. Copied ACDs have no DR links.</p><label>Overlap option name<input id="migration-name" maxlength="100" placeholder="For example: migration overlap"></label><div id="migration-choices"></div><button type="button" data-scenario-action="migration">Create overlap option</button></details>
 <div id="saved-options"></div><div id="scenario-comparison" aria-live="polite"></div>`;
 for(const [field,key]of [['project-name','name'],['project-notes','notes']]){
  const update=()=>safeUpdate(()=>{state.project={...state.project,[key]:scenarioValue(field)};X.validateExtras(state,M);});
  $(field).addEventListener('input',update);$(field).addEventListener('change',update);
 }
 container.addEventListener('click',event=>{
  const button=event.target.closest('[data-scenario-action]');if(!button)return;
  const action=button.dataset.scenarioAction;
  if(action==='compare'){scenarioCompareIds=[button.dataset.altId];renderScenarios();return;}
  safeUpdate(()=>{
   if(action==='capture')state.alternatives=[...(state.alternatives||[]),X.capture(scenarioForSnapshot(),scenarioValue('alternative-name'),scenarioValue('alternative-kind','option'),M)];
   if(action==='growth')state.alternatives=[...(state.alternatives||[]),X.growth(scenarioForSnapshot(),{name:scenarioValue('growth-name'),ecpuPercent:scenarioNumber('growth-cpu','ECPU growth (%)'),ramPercent:scenarioNumber('growth-ram','RAM growth (%)')},M,scenarioTopology())];
   if(action==='migration'){
    const selected=[...$('migration-choices').querySelectorAll('input[data-overlap-cluster]:checked')].map(el=>Number(el.dataset.overlapCluster));
    state.alternatives=[...(state.alternatives||[]),X.migration(scenarioForSnapshot(),{name:scenarioValue('migration-name'),siteIndex:active,clusterIndexes:selected},M,scenarioTopology())];
   }
   if(action==='restore'){scenarioSetState(X.restore(state,button.dataset.altId,M));if(typeof guideStep!=='undefined')guideStep=1;}
   if(action==='remove')state.alternatives=(state.alternatives||[]).filter(a=>a.id!==button.dataset.altId);
  },true);
 });
}
function renderScenarios(){
 ensureScenarioControls();if(!$('scenario-tools'))return;
 const project=state.project||{};
 const generation=typeof libraryGeneration==='number'?libraryGeneration:project.id,changed=generation!==scenarioProjectGeneration;
 for(const [id,value]of [['project-name',project.name||''],['project-notes',project.notes||'']])if($(id)&&(changed||document.activeElement!==$(id)))$(id).value=value;
 scenarioProjectGeneration=generation;
 const choices=$('migration-choices');if(choices)choices.innerHTML=site().clusters.length?site().clusters.map((c,i)=>`<label class="check"><input type="checkbox" data-overlap-cluster="${i}">${escapeHTML(c.name)} · ${c.nodes.length} VMs · ${c.slots} max ACDs</label>`).join(''):'<p class="hint">Add an AVMC to the active machine first.</p>';
 const target=$('saved-options');if(!target)return;
 const alternatives=state.alternatives||[];if(changed){scenarioCompareIds=[];scenarioCompareInitialized=false;}scenarioCompareIds=scenarioCompareIds.filter(id=>alternatives.some(a=>a.id===id));if(!scenarioCompareInitialized&&alternatives.length){scenarioCompareIds=alternatives.slice(0,2).map(a=>a.id);scenarioCompareInitialized=true;}
 if(!alternatives.length){scenarioCompareInitialized=false;scenarioCompareIds=[];target.innerHTML='<p class="hint">No saved options yet. Save the working plan above to compare changes later.</p>';$('scenario-comparison').innerHTML='';return;}
 target.innerHTML=`<div class="table-wrap"><table><thead><tr><th>Saved option</th><th>Type</th><th>Machines</th><th>Actions</th></tr></thead><tbody>${alternatives.map(a=>`<tr><td>${escapeHTML(a.name)}</td><td>${escapeHTML(a.kind)}</td><td>${a.sites.length}</td><td><div class="actions"><button type="button" data-scenario-action="compare" data-alt-id="${escapeHTML(a.id)}">Compare</button><button type="button" data-scenario-action="restore" data-alt-id="${escapeHTML(a.id)}">Load into working plan</button><button type="button" class="remove" data-scenario-action="remove" data-alt-id="${escapeHTML(a.id)}">Remove option</button></div></td></tr>`).join('')}</tbody></table></div>${comparisonSelectors(alternatives)}<p class="hint">Loading changes the working plan. Undo restores the previous state. Saved options stay in this JSON file.</p>`;
 for(const checkbox of target.querySelectorAll('[data-compare-option]'))checkbox.addEventListener('change',()=>{
  const id=checkbox.dataset.compareOption;
  if(checkbox.checked&&scenarioCompareIds.length>=2){checkbox.checked=false;message('Choose at most two saved options alongside the working plan.');return;}
  scenarioCompareIds=checkbox.checked?[...scenarioCompareIds,id]:scenarioCompareIds.filter(value=>value!==id);
  renderScenarioComparison();
 });
 renderScenarioComparison();
}
function initScenarios(){ensureScenarioControls();}

function invalidateCSVPreview(note='Inputs changed. Preview again before applying.'){
 csvPreview=null;csvCandidate=null;csvSignature=null;inventoryReview=null;
 if($('csv-apply'))$('csv-apply').disabled=true;
 if($('csv-preview-results'))$('csv-preview-results').innerHTML=`<p class="hint">${escapeHTML(note)}</p>`;
}
function invalidateCSVSource(note='Source changed. Read the selected input again.',options={}){
 if(options.cancelRead!==false)csvReadGeneration++;
 csvSource=null;csvSourceWarnings=[];csvWorksheetRows=null;
 if($('csv-mapping'))$('csv-mapping').innerHTML='';
 if($('csv-preview'))$('csv-preview').disabled=true;
 if(options.clearText&&$('csv-text'))$('csv-text').value='';
 if(options.clearWorkbook){csvWorkbook=null;if($('csv-workbook-controls'))$('csv-workbook-controls').hidden=true;if($('csv-sheet'))$('csv-sheet').innerHTML='';}
 invalidateCSVPreview(note);
}
function setCSVSource(text,warnings=[],worksheetRows=null,options={}){
 const generation=options.generation??++csvReadGeneration;if(generation!==csvReadGeneration)return false;
 invalidateCSVSource('Read the columns, check the mapping, then preview the import.',{cancelRead:false});
 $('csv-text').value=text;csvSourceWarnings=warnings;csvWorksheetRows=worksheetRows;
 readCSVColumns({preserveGeneration:true});return !!csvSource;
}
function readCSVColumns(options={}){
 if(!options.preserveGeneration)csvReadGeneration++;
 csvSource=null;$('csv-mapping').innerHTML='';$('csv-preview').disabled=true;invalidateCSVPreview('Reading columns.');
 try{
  csvSource=X.parseCSV(scenarioValue('csv-text'));
  if(csvWorksheetRows){csvSource.headerLine=csvWorksheetRows[0];csvSource.rows.forEach((row,i)=>{row.line=csvWorksheetRows[i+1];});}
  const mapping=X.defaultMapping(csvSource.headers);
  $('csv-mapping').innerHTML=`<div class="table-wrap"><table><thead><tr><th>Calculator field</th><th>Source column</th></tr></thead><tbody>${X.FIELDS.map(f=>`<tr><td>${escapeHTML(f.label)}${f.required?' *':''}</td><td><select aria-label="Map ${escapeHTML(f.label)}" data-csv-map="${f.key}"><option value="">${f.required?'Select a column':'Not supplied'}</option>${csvSource.headers.map((h,i)=>`<option value="${i}" ${mapping[f.key]===i?'selected':''}>${escapeHTML(h)}</option>`).join('')}</select></td></tr>`).join('')}</tbody></table></div><p class="hint">* Required. CPU values are ECPUs, RAM is GB and database storage is TB. No unit conversion is performed.</p>`;
  $('csv-mapping').onchange=()=>invalidateCSVPreview();$('csv-preview').disabled=false;invalidateCSVPreview(`${csvSource.rows.length} data row(s) read. Review the column mapping, then preview.`);
 }catch(error){invalidateCSVSource(error.message,{cancelRead:false});}
}
function useWorkbookSheet(options={}){
 const generation=options.generation??++csvReadGeneration;if(generation!==csvReadGeneration)return;
 invalidateCSVSource('Reading the selected worksheet.',{cancelRead:false,clearText:true});
 try{
  if(!csvWorkbook)throw Error('Choose a workbook first.');
  const sheet=csvWorkbook.sheets[Number(scenarioValue('csv-sheet'))],row=Number(scenarioValue('csv-header-row','1'));
  if(!sheet||!Number.isInteger(row)||row<1||row>sheet.rows.length)throw Error('Choose a sheet and a header row within that sheet.');
  const prepared=X.prepareWorksheetRows(sheet.rows,row);
  setCSVSource(window.ExaWorkbook.toCSV(prepared.rows),[...(csvWorkbook.warnings||[]),...(sheet.warnings||[]),...prepared.warnings,`Imported worksheet ${sheet.name}; row ${row} is the header. Preview row numbers refer to this worksheet. Formula results, where present, are cached values and may be stale.`],prepared.sourceRows,{generation});
 }catch(error){invalidateCSVSource(error.message,{cancelRead:false,clearText:true});}
}
function ensureImportControls(){
 const container=$('workload-import');if(!container||container.dataset.ready==='true')return;
 container.dataset.ready='true';
 container.innerHTML=`<p class="hint">Import one row per database from CSV or an .xlsx worksheet. Read the columns, review the mapping and preview before applying. Rows belong to the current customer plan. Use separate plans for different customers. Names do not establish DR peer links or hardware capacity.</p>
 <div class="actions"><button type="button" id="csv-template">Download CSV template</button><label id="csv-open-file" class="button" for="csv-file" role="button" tabindex="0">Choose CSV / XLSX<input id="csv-file" type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden></label></div>
 <div id="csv-workbook-controls" hidden><div class="fields"><label>Worksheet<select id="csv-sheet"></select></label><label>Header row (starts at 1)<input id="csv-header-row" type="number" min="1" step="1" value="1"></label></div><button type="button" id="csv-use-sheet">Read selected worksheet</button><p class="hint">Only .xlsx is supported. For legacy, encrypted or unsupported workbooks, export the relevant sheet as UTF-8 CSV. Cached formula values need verification against the workbook.</p></div>
 <label>CSV text<textarea id="csv-text" rows="5" spellcheck="false" placeholder="Paste CSV here, or choose a file above."></textarea></label><button type="button" id="csv-read">Read columns</button><div id="csv-mapping"></div>
 <label>How should this inventory be applied?<select id="csv-mode"><option value="add">Add databases to matching machines / AVMCs</option><option value="replace-active">Replace named database inventory on the active machine</option></select></label><p id="csv-target" class="hint"></p>
 <div class="actions"><button type="button" id="csv-preview" disabled>Preview import</button><button type="button" id="csv-apply" class="primary" disabled>Apply previewed inventory</button></div><div id="csv-preview-results" aria-live="polite"></div>`;
 $('csv-template').onclick=()=>download('exacc-workload-template.csv',X.template(),'text/csv;charset=utf-8');
 $('csv-text').addEventListener('input',()=>invalidateCSVSource('CSV text changed. Read the columns again.',{clearWorkbook:true}));
 $('csv-open-file').addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();$('csv-file').click();}});
 $('csv-read').onclick=readCSVColumns;
 $('csv-mode').onchange=()=>invalidateCSVPreview();
 $('csv-use-sheet').onclick=useWorkbookSheet;
 $('csv-sheet').onchange=()=>invalidateCSVSource('Worksheet changed. Read the selected worksheet again.',{clearText:true});
 $('csv-header-row').addEventListener('input',()=>invalidateCSVSource('Header row changed. Read the selected worksheet again.',{clearText:true}));
 $('csv-file').onchange=async event=>{
  const file=event.target.files?.[0];if(!file)return;
  const generation=++csvReadGeneration;
  invalidateCSVSource('Reading the selected file.',{cancelRead:false,clearText:true,clearWorkbook:true});
  try{
   if(file.size>10000000)throw Error('Use a file of at most 10 MB, or export a smaller CSV.');
   if(/\.xlsx$/i.test(file.name)){
    if(!window.ExaWorkbook)throw Error('Workbook import is unavailable. Export this sheet as UTF-8 CSV.');
    const buffer=await file.arrayBuffer();if(generation!==csvReadGeneration)return;
    const workbook=await window.ExaWorkbook.read(buffer);if(generation!==csvReadGeneration)return;
    if(!workbook.sheets.length)throw Error('The workbook contains no readable worksheets.');csvWorkbook=workbook;
    $('csv-workbook-controls').hidden=false;$('csv-sheet').innerHTML=csvWorkbook.sheets.map((sheet,i)=>`<option value="${i}">${escapeHTML(sheet.name)}</option>`).join('');$('csv-sheet').value='0';$('csv-header-row').value='1';useWorkbookSheet({generation});
   }else if(/\.csv$/i.test(file.name)||file.type==='text/csv'){
    const source=await file.text();if(generation!==csvReadGeneration)return;setCSVSource(source,[],null,{generation});
   }else throw Error('Choose a .csv or .xlsx file.');
  }catch(error){if(generation===csvReadGeneration)invalidateCSVSource(error.message,{cancelRead:false,clearText:true,clearWorkbook:true});}
  finally{if(generation===csvReadGeneration)event.target.value='';}
 };
 $('csv-preview').onclick=()=>{
  try{
   if(!csvSource)throw Error('Read the columns first.');
   const mapping={};for(const el of $('csv-mapping').querySelectorAll('[data-csv-map]'))mapping[el.dataset.csvMap]=el.value===''?null:Number(el.value);
   csvPreview=X.previewCSV(csvSource,mapping);
   if(csvPreview.errors.length){csvCandidate=null;csvSignature=null;$('csv-apply').disabled=true;$('csv-preview-results').innerHTML=`<div class="issues error"><strong>Resolve these rows before importing</strong><ul>${csvPreview.errors.slice(0,100).map(e=>`<li>Line ${e.line}: ${escapeHTML(e.message)}</li>`).join('')}</ul>${csvPreview.errors.length>100?'<p>Only the first 100 errors are shown.</p>':''}</div>`;return;}
   const result=X.buildCSVImport(state,csvPreview,{mode:scenarioValue('csv-mode'),siteIndex:active},M,scenarioTopology());
   const diff=window.ExaReview.inventoryDiff(state,result.candidate,{mode:scenarioValue('csv-mode'),siteIndex:active},scenarioTopology());
   csvCandidate=result.candidate;csvSignature=JSON.stringify({state,active});$('csv-apply').disabled=false;
   const warnings=[...new Set([...csvSourceWarnings,...result.warnings])];
   $('csv-preview-results').innerHTML=`<p><strong>${csvPreview.summary.adbs} incoming database row(s).</strong> ${scenarioValue('csv-mode')==='replace-active'?'The active machine’s named inventory will be replaced.':'Existing inventory is retained; imported rows are added.'}</p><p class="hint">New machine entries: ${result.report.machinesAdded}. New AVMC entries: ${result.report.avmcsAdded}.${result.report.startingEntryReplaced?' The unused starting machine is replaced.':''}</p>${inventoryReviewHTML(diff)}${warnings.length?`<details class="import-notes"><summary>Import notes (${warnings.length})</summary><ul>${warnings.map(w=>`<li>${escapeHTML(w)}</li>`).join('')}</ul></details>`:''}`;
   bindInventoryReview();
  }catch(error){invalidateCSVPreview(error.message);}
 };
 $('csv-apply').onclick=()=>{
  if(!csvCandidate||csvSignature!==JSON.stringify({state,active})){invalidateCSVPreview('The working plan changed. Preview this inventory again.');return;}
  const next=csvCandidate;safeUpdate(()=>{scenarioSetState(next);},true);invalidateCSVPreview('Inventory applied. Review names and DR links, then use database totals explicitly if you want to resize from these workloads.');
  if(state===next){if($('panel-import'))$('panel-import').open=false;const panel=$('panel-topology');if(panel&&!panel.hidden){if(panel.tagName==='DETAILS')panel.open=true;panel.scrollIntoView({behavior:'smooth',block:'start'});}}
 };
}
function renderWorkloadImport(){
 ensureImportControls();if(!$('workload-import'))return;
 if($('csv-target'))$('csv-target').textContent=`Active machine: ${site().siteName?site().siteName+' / ':''}${site().name}. Replacement accepts only rows matching this site and machine name. Other machines and saved options remain unchanged.`;
 if(csvCandidate&&csvSignature!==JSON.stringify({state,active}))invalidateCSVPreview('The working plan changed. Preview the import again.');
}
function initWorkloadImport(){ensureImportControls();}
