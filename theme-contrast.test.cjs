const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const css=fs.readFileSync(path.join(__dirname,'ui.css'),'utf8');
function tokens(body){return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*(#[\da-f]+)/gi)].map(m=>[m[1],m[2]]));}
const light=tokens(css.match(/:root\s*\{([^}]+)/)[1]);
const dark={...light,...tokens(css.match(/:root\[data-theme=dark\]\s*\{([^}]+)/)[1])};
function luminance(hex){const h=hex.slice(1),s=h.length===3?[...h].map(c=>c+c).join(''):h;return [0,2,4].map(i=>parseInt(s.slice(i,i+2),16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((sum,v,i)=>sum+v*[.2126,.7152,.0722][i],0);}
function contrast(a,b){const x=luminance(a),y=luminance(b);return (Math.max(x,y)+.05)/(Math.min(x,y)+.05);}
for(const [name,t]of Object.entries({light,dark})){
 test(`${name}: text, hints and links meet 4.5:1 on supported surfaces`,()=>{
  for(const foreground of ['ink','muted','accent','placeholder'])for(const background of ['canvas','surface','surface-soft','surface-tint'])assert.ok(contrast(t[foreground],t[background])>=4.5,`${foreground} on ${background}: ${contrast(t[foreground],t[background]).toFixed(2)}`);
  for(const pair of [['button-ink','accent'],['button-ink','accent-hover'],['success','success-soft'],['warning','warning-soft'],['red','error-soft'],['accent','accent-soft']])assert.ok(contrast(t[pair[0]],t[pair[1]])>=4.5,pair.join(' on '));
 });
 test(`${name}: focus and control boundaries meet 3:1 on control surfaces`,()=>{
  for(const foreground of ['focus','line-strong'])for(const background of ['surface','surface-soft','surface-tint'])assert.ok(contrast(t[foreground],t[background])>=3,`${foreground} on ${background}`);
 });
}
