const fs=require('fs'),path=require('path');
const TR=process.env.I18N_DIR, KEYS=process.env.KEYS_FILE;
const K=require(path.join(TR,'keys_v1.json')).keys;
const D={}; const seen=new Set(); let bad=0;
for(const f of fs.readdirSync(TR).filter(f=>/^b\d+\.json$/.test(f)).sort()){
  for(const [i,en,ru] of JSON.parse(fs.readFileSync(path.join(TR,f),'utf8'))){
    const k=K[i].k; seen.add(i);
    const ph=(s)=>(s.match(/\{\d+\}/g)||[]).sort().join(',');
    const tags=(s)=>(s.match(/<\/?[a-zA-Z][^>]*>/g)||[]).map(t=>t.replace(/\s.*$/,'').replace(/>$/,'')).join('');
    for(const [lang,v] of [['en',en],['ru',ru]]){
      if(typeof v!=='string'||!v){ console.log('EMPTY',i,lang); bad++; continue; }
      if(ph(v)!==ph(k)){ console.log('PH',i,lang,JSON.stringify(k).slice(0,80),'|',v.slice(0,80)); bad++; }
      if(tags(v)!==tags(k)){ console.log('TAG',i,lang,tags(k),'|',tags(v)); bad++; }
      if(/^\s/.test(k)!==/^\s/.test(v) || /\s$/.test(k)!==/\s$/.test(v)){ console.log('WS',i,lang,JSON.stringify(k).slice(0,60),'|',JSON.stringify(v).slice(0,60)); }
    }
    D[k]=[en,ru];
  }
}
for(const f of fs.readdirSync(TR).filter(f=>/^k\d+\.json$/.test(f)).sort()){
  for(const [k,en,ru] of JSON.parse(fs.readFileSync(path.join(TR,f),'utf8'))){
    const ph=(s)=>(s.match(/\{\d+\}/g)||[]).sort().join(',');
    for(const v of [en,ru]) if(ph(v)!==ph(k)){ console.log('PH',JSON.stringify(k),v); bad++; }
    D[k]=[en,ru];
  }
}
const cur=require(KEYS).keys.map(x=>x.k).filter(k=>!D[k]);
console.log('current keys without translation:', cur.length, JSON.stringify(cur).slice(0,1500));
const missing=K.map((x,i)=>i).filter(i=>!seen.has(i));
console.log('dict',Object.keys(D).length,'missing',missing.length,'bad',bad);
console.log(missing.map(i=>i+':'+JSON.stringify(K[i].k).slice(0,70)).join('\n'));
fs.writeFileSync(path.join(TR,'dict.json'),JSON.stringify(D));
fs.writeFileSync(path.join(path.dirname(KEYS),'untranslated.json'),JSON.stringify(cur,null,1));
