import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const __filename=fileURLToPath(import.meta.url); const __dirname=path.dirname(__filename); const ROOT=path.resolve(__dirname,'..');
const PORT=Number(process.env.PORT||3000); const DB=path.join(ROOT,'data','animedragon.json');
const SECRET=process.env.JWT_SECRET||'dev-change-this-secret'; const ADMIN_EMAIL=process.env.ADMIN_EMAIL||'admin@animedragon.local'; const ADMIN_PASSWORD=process.env.ADMIN_PASSWORD||'TroqueEstaSenha-Agora!';
const PUBLIC=path.join(ROOT,'public');
const MIME={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.json':'application/json; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.svg':'image/svg+xml','.ico':'image/x-icon'};
const LIMIT={body:2_500_000}; const rate=new Map();
let syncJob={id:null,status:'idle',startedAt:null,finishedAt:null,totalSources:0,currentSource:0,currentPage:0,totalPages:0,discovered:0,updated:0,episodesCreated:0,errors:[],message:'Pronto'};
let syncRunning=false;

const initial={
  settings:{siteName:'AnimeDragon',tagline:'Seu universo de animes.',accent:'#ef1523',secondary:'#ff3b30',heroAutoplay:true,announcement:'Novo: organize seu catálogo inteiro pelo painel administrativo.',navigation:[{id:'home',label:'Início',href:'#/'},{id:'anime',label:'Animes',href:'#/explore'},{id:'movies',label:'Filmes',href:'#/explore?type=Movie'},{id:'calendar',label:'Lançamentos',href:'#/calendar'}]},
  users:[], categories:[{id:1,name:'Ação',slug:'acao',color:'#ef1523'},{id:2,name:'Aventura',slug:'aventura',color:'#22c55e'},{id:3,name:'Comédia',slug:'comedia',color:'#eab308'},{id:4,name:'Fantasia',slug:'fantasia',color:'#8b5cf6'},{id:5,name:'Romance',slug:'romance',color:'#ec4899'},{id:6,name:'Shounen',slug:'shounen',color:'#3b82f6'},{id:7,name:'Isekai',slug:'isekai',color:'#14b8a6'},{id:8,name:'Mistério',slug:'misterio',color:'#64748b'}], anime:[], episodes:[], sections:[], logs:[],comments:[]
};

const initialSections=[
 {id:1,title:'Continuando a jornada',subtitle:'Retome de onde parou',type:'continue',enabled:true,position:1},
 {id:2,title:'Em alta agora',subtitle:'Os mais vistos pela comunidade',type:'trending',enabled:true,position:2},
 {id:3,title:'Novos episódios',subtitle:'Direto do catálogo',type:'latestEpisodes',enabled:true,position:3},
 {id:4,title:'Ação & Shounen',subtitle:'Batalhas, rivalidades e energia',type:'category',categoryId:6,enabled:true,position:4},
 {id:5,title:'Descobertas da semana',subtitle:'Escolhidos pelo algoritmo',type:'featured',enabled:true,position:5}
];

function now(){return new Date().toISOString()}
function slugify(v){return String(v||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,110)}
function read(){try{return JSON.parse(fs.readFileSync(DB,'utf8'))}catch{return structuredClone(initial)}}
function write(d){fs.writeFileSync(DB,JSON.stringify(d,null,2))}
function ensure(){if(!fs.existsSync(path.dirname(DB)))fs.mkdirSync(path.dirname(DB),{recursive:true});if(!fs.existsSync(DB)){const d=structuredClone(initial);d.sections=initialSections;write(d)}const d=read();let changed=false;if(!d.settings)d.settings=structuredClone(initial.settings); if(!Array.isArray(d.settings.externalApis)) { d.settings.externalApis=[]; changed=true; }if(!d.categories?.length){d.categories=structuredClone(initial.categories);changed=true}if(!d.sections?.length){d.sections=initialSections;changed=true}if(!d.users)d.users=[];if(!d.logs)d.logs=[];if(!d.comments)d.comments=[];if(!d.users.some(u=>u.email===ADMIN_EMAIL)){d.users.push({id:1,email:ADMIN_EMAIL,passwordHash:hashPassword(ADMIN_PASSWORD),role:'admin',blocked:false,createdAt:now(),favorites:[],history:[],lastLogin:null});changed=true}if(changed)write(d)}
function hashPassword(password,salt=crypto.randomBytes(16).toString('hex')){const key=crypto.scryptSync(String(password),salt,64);return `scrypt$${salt}$${key.toString('hex')}`}
function verifyPassword(password,stored){try{const [kind,salt,hex]=String(stored).split('$');if(kind!=='scrypt'||!salt||!hex)return false;const key=crypto.scryptSync(String(password),salt,64);return crypto.timingSafeEqual(key,Buffer.from(hex,'hex'))}catch{return false}}
function sign(payload){const body=Buffer.from(JSON.stringify(payload)).toString('base64url');const sig=crypto.createHmac('sha256',SECRET).update(body).digest('base64url');return body+'.'+sig}
function verify(token){try{const [body,sig]=String(token||'').split('.');if(!body||!sig)return null;const good=crypto.createHmac('sha256',SECRET).update(body).digest('base64url');if(Buffer.from(sig).length!==Buffer.from(good).length||!crypto.timingSafeEqual(Buffer.from(sig),Buffer.from(good)))return null;const p=JSON.parse(Buffer.from(body,'base64url').toString());if(p.exp<Date.now())return null;return p}catch{return null}}
function cookies(req){const out={};for(const part of (req.headers.cookie||'').split(';')){const i=part.indexOf('=');if(i>0)out[part.slice(0,i).trim()]=decodeURIComponent(part.slice(i+1).trim())}return out}
function currentUser(req,d){const p=verify(cookies(req).ad_token);if(!p)return null;return d.users.find(u=>u.id===p.sub&&!u.blocked)||null}
function safeUser(u){return {id:u.id,email:u.email,displayName:u.displayName||u.email.split('@')[0],avatar:u.avatar||'',role:u.role,blocked:!!u.blocked,createdAt:u.createdAt,favorites:u.favorites||[],history:u.history||[],lastLogin:u.lastLogin||null}}
function audit(d,admin,action,target,meta={}){d.logs.unshift({id:Date.now(),adminId:admin?.id||null,action,target,meta,createdAt:now()});d.logs=d.logs.slice(0,2000)}
function parseJsonBody(req){return new Promise((resolve,reject)=>{let n=0,buf='';req.on('data',c=>{n+=c.length;if(n>LIMIT.body){reject(Object.assign(new Error('Payload muito grande'),{status:413}));req.destroy();return}buf+=c});req.on('end',()=>{try{resolve(buf?JSON.parse(buf):{})}catch{reject(Object.assign(new Error('JSON inválido'),{status:400}))}});req.on('error',reject)})}
function send(res,status,payload,headers={}){res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store',...headers});res.end(JSON.stringify(payload))}
function ok(res,payload={}){send(res,200,payload)}
function fail(res,status,error){send(res,status,{error})}
function setCookie(name,value,maxAge){return `${name}=${encodeURIComponent(value)}; HttpOnly; SameSite=Lax; Path=/; Max-Age=${maxAge}`}
function rateLimit(req,key,limit=90,windowMs=60000){const addr=req.socket.remoteAddress||'x';const k=addr+':'+key;const t=Date.now();const x=rate.get(k)||{start:t,count:0};if(t-x.start>windowMs){x.start=t;x.count=0}x.count++;rate.set(k,x);return x.count<=limit}
function cleanUrl(v){const s=String(v||'').trim();if(!s)return '';try{const u=new URL(s);if(!['http:','https:'].includes(u.protocol))return '';return u.toString()}catch{return ''}}
function number(v,min=0,max=999999){const n=Number(v);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):min}
function normalizeAnime(b,id){const title=String(b.title||'').trim().slice(0,180);return {id,title,slug:slugify(b.slug||title),synopsis:String(b.synopsis||'').slice(0,3000),cover:cleanUrl(b.cover),banner:cleanUrl(b.banner),logo:cleanUrl(b.logo),year:numberOrNull(b.year,1900,2200),status:String(b.status||'Ongoing').slice(0,30),score:number(b.score,0,10),type:String(b.type||'TV').slice(0,20),episodes:number(b.episodes,0,10000),featured:!!b.featured,categories:Array.isArray(b.categories)?b.categories.map(Number).filter(Number.isInteger):[],views:number(b.views,0,1e12),releaseDay:String(b.releaseDay||'').slice(0,20),releaseTime:String(b.releaseTime||'').slice(0,10),tags:Array.isArray(b.tags)?b.tags.map(x=>String(x).slice(0,40)).slice(0,20):[],createdAt:b.createdAt||now()}}
function numberOrNull(v,min,max){if(v===''||v===null||v===undefined)return null;const n=Number(v);return Number.isFinite(n)?Math.max(min,Math.min(max,n)):null}
function listAnime(d,params={}){let rows=[...d.anime];const q=String(params.q||'').toLowerCase().trim();if(q)rows=rows.filter(a=>(a.title+' '+a.synopsis+' '+(a.tags||[]).join(' ')).toLowerCase().includes(q));if(params.type)rows=rows.filter(a=>a.type===params.type);if(params.status)rows=rows.filter(a=>a.status===params.status);if(params.category){const c=Number(params.category);rows=rows.filter(a=>(a.categories||[]).includes(c))}const sort=params.sort||'popular';if(sort==='newest')rows.sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));else if(sort==='rating')rows.sort((a,b)=>b.score-a.score);else if(sort==='title')rows.sort((a,b)=>a.title.localeCompare(b.title));else rows.sort((a,b)=>b.views-a.views||b.score-a.score);return rows}
function enrichAnime(d,a){return {...a,categories:(a.categories||[]).map(id=>d.categories.find(c=>c.id===id)).filter(Boolean),episodeCount:d.episodes.filter(e=>e.animeId===a.id).length}}
function buildSection(d,s,user){let rows=[];if(s.type==='continue'){const ids=(user?.history||[]).map(x=>x.animeId);rows=ids.map(id=>d.anime.find(a=>a.id===id)).filter(Boolean)}else if(s.type==='trending')rows=listAnime(d,{sort:'popular'}).slice(0,12);else if(s.type==='featured')rows=d.anime.filter(a=>a.featured).sort((a,b)=>b.score-a.score).slice(0,12);else if(s.type==='latestEpisodes'){const ids=[...new Map([...d.episodes].sort((a,b)=>b.id-a.id).map(e=>[e.animeId,e.animeId])).values()];rows=ids.map(id=>d.anime.find(a=>a.id===id)).filter(Boolean).slice(0,12)}else if(s.type==='category')rows=listAnime(d,{category:s.categoryId,sort:'popular'}).slice(0,12);else if(s.type==='manual')rows=(s.animeIds||[]).map(id=>d.anime.find(a=>a.id===id)).filter(Boolean);return {...s,items:rows.map(a=>enrichAnime(d,a))}}


function getPath(obj,path){
  if(path===undefined||path===null||path==='') return obj;
  return String(path).split('.').reduce((v,k)=>v==null?undefined:v[k],obj);
}
function firstValue(obj,paths,def=''){
  for(const p of Array.isArray(paths)?paths:[paths]){const v=getPath(obj,p);if(v!==undefined&&v!==null&&v!=='')return v}
  return def;
}
function normalizeExternalSource(src,i){
  const mapping=src.mapping||{};
  return {id:String(src.id||`api-${i+1}`),name:String(src.name||`API ${i+1}`).slice(0,80),enabled:src.enabled!==false,
    url:cleanUrl(src.url),method:String(src.method||'GET').toUpperCase()==='POST'?'POST':'GET',headers:src.headers&&typeof src.headers==='object'?src.headers:{},
    body:src.body&&typeof src.body==='object'?src.body:null,itemsPath:String(src.itemsPath||'data.items'),nextPath:String(src.nextPath||''),
    pagination:src.pagination&&typeof src.pagination==='object'?src.pagination:{enabled:false,pageParam:'page',limitParam:'limit',pageStart:1,limit:100,maxPages:10},
    episodeUrlTemplate:cleanUrl(String(src.episodeUrlTemplate||'').replace('{id}','000000'))?String(src.episodeUrlTemplate):'',
    episodeItemsPath:String(src.episodeItemsPath||'episodes'),mapping:{title:mapping.title||['title','name'],synopsis:mapping.synopsis||['description','synopsis'],cover:mapping.cover||['cover','coverImage.large','image','poster'],banner:mapping.banner||['banner','bannerImage'],year:mapping.year||['year','seasonYear'],status:mapping.status||['status'],score:mapping.score||['score','averageScore'],type:mapping.type||['type','format'],episodes:mapping.episodes||['episodes','episodeCount'],id:mapping.id||['id'],slug:mapping.slug||['slug'],tags:mapping.tags||['genres','tags'],releaseDay:mapping.releaseDay||['releaseDay'],releaseTime:mapping.releaseTime||['releaseTime'],episodesList:mapping.episodesList||['episodes','episodes.items'],episodeNumber:mapping.episodeNumber||['episode','number','episodeNumber'],season:mapping.season||['season','seasonNumber'],episodeTitle:mapping.episodeTitle||['title','name'],duration:mapping.duration||['duration','runtime'],language:mapping.language||['language','lang'],streamUrl:mapping.streamUrl||['streamUrl','video','url'],watchUrl:mapping.watchUrl||['watchUrl','externalUrl'],episodeThumbnail:mapping.episodeThumbnail||['thumbnail','image','cover']},
    updatedAt:src.updatedAt||now()};
}
function applyTemplate(url,page,limit){return String(url).replaceAll('{page}',String(page)).replaceAll('{limit}',String(limit));}
async function fetchExternalJson(source,page=1){
  const limit=Math.max(1,Math.min(500,Number(source.pagination?.limit)||100));
  const apply=val=>typeof val==='string'?val.replaceAll('{page}',String(page)).replaceAll('{limit}',String(limit)):val;
  const deep=v=>Array.isArray(v)?v.map(deep):(v&&typeof v==='object'?Object.fromEntries(Object.entries(v).map(([k,x])=>[k,deep(x)])):apply(v));
  const url=apply(source.url);
  const headers={'accept':'application/json',...(source.headers||{})};
  const init={method:source.method||'GET',headers};
  if(init.method==='POST'){init.body=JSON.stringify(deep(source.body||{}));headers['content-type']=headers['content-type']||'application/json'}
  const r=await fetch(url,{...init,signal:AbortSignal.timeout(20000)}); const text=await r.text();
  if(!r.ok)throw new Error(source.name+': HTTP '+r.status+(text?` — ${text.slice(0,180)}`:''));
  try{return JSON.parse(text)}catch{throw new Error(source.name+': a resposta não é JSON válido')}
}
async function syncExternalApis(d, progress=()=>{}){
  const sources=(d.settings?.externalApis||[]).map(normalizeExternalSource).filter(x=>x.enabled&&x.url);
  const result={sources:0,discovered:0,updated:0,episodesCreated:0,errors:[],at:now()};
  for(let si=0;si<sources.length;si++){
    const source=sources[si];
    const pages=source.pagination?.enabled?Math.max(1,Math.min(500,Number(source.pagination.maxPages)||50)):1;
    const pageStart=Number(source.pagination?.pageStart)||1;
    progress({currentSource:si+1,totalSources:sources.length,currentPage:0,totalPages:pages,message:'Sincronizando '+source.name});
    result.sources++;
    try{
      for(let pi=0;pi<pages;pi++){
        const page=pageStart+pi;
        progress({currentSource:si+1,totalSources:sources.length,currentPage:pi+1,totalPages:pages,message:source.name+' · página '+(pi+1)+'/'+pages});
        const j=await fetchExternalJson(source,page);
        const raw=getPath(j,source.itemsPath);
        const items=Array.isArray(raw)?raw:(Array.isArray(j)?j:[]);
        if(!items.length && pi===0) throw new Error('A API respondeu, mas o caminho de itens não contém uma lista. Verifique itemsPath.');
        for(const m of items){
          const title=String(firstValue(m,source.mapping.title,'')).trim(); if(!title) continue;
          const externalId=String(firstValue(m,source.mapping.id,''));
          const slug=slugify(firstValue(m,source.mapping.slug,title));
          let a=d.anime.find(x=>(externalId&&x.externalIds?.[source.id]===externalId)||x.slug===slug);
          const scoreRaw=Number(firstValue(m,source.mapping.score,0)); const score=scoreRaw>10?scoreRaw/10:scoreRaw;
          const rawType=String(firstValue(m,source.mapping.type,'TV')); const type=/movie/i.test(rawType)?'Movie':rawType;
          const tagsRaw=firstValue(m,source.mapping.tags,[]);
          const tags=Array.isArray(tagsRaw)?tagsRaw.map(x=>typeof x==='object'?String(x.name||x.title||''):String(x)).filter(Boolean).slice(0,30):String(tagsRaw||'').split(',').map(x=>x.trim()).filter(Boolean).slice(0,30);
          const epCount=Number(firstValue(m,source.mapping.episodes,0))||0;
          const payload={title,slug,synopsis:String(firstValue(m,source.mapping.synopsis,'')||'').replace(/<[^>]+>/g,'').slice(0,3000),cover:cleanUrl(firstValue(m,source.mapping.cover,'')),banner:cleanUrl(firstValue(m,source.mapping.banner,'')),year:numberOrNull(firstValue(m,source.mapping.year,''),1900,2200),status:String(firstValue(m,source.mapping.status,'Ongoing')).slice(0,30),score:Number.isFinite(score)?Math.max(0,Math.min(10,score)):0,type,episodes:epCount,tags,releaseDay:String(firstValue(m,source.mapping.releaseDay,'')||''),releaseTime:String(firstValue(m,source.mapping.releaseTime,'')||'')};
          if(!a){const id=Math.max(0,...d.anime.map(x=>Number(x.id)||0))+1;a={id,...payload,featured:payload.score>=8.5,categories:[],views:0,externalIds:{[source.id]:externalId},createdAt:now(),updatedAt:now()};d.anime.push(a);result.discovered++}
          else {Object.assign(a,payload,{externalIds:{...(a.externalIds||{}),[source.id]:externalId},updatedAt:now()});result.updated++}
          const list=firstValue(m,source.mapping.episodesList,null);
          const episodeItems=Array.isArray(list)?list:[];
          const upsertEpisode=(raw,n)=>{
            const num=Number(firstValue(raw,source.mapping.episodeNumber||['episode','number','episodeNumber'],n))||n;
            if(!num)return;
            const season=Number(firstValue(raw,source.mapping.season||['season','seasonNumber'],1))||1;
            const exists=d.episodes.find(e=>e.animeId===a.id&&e.season===season&&e.episode===num);
            const ep={id:exists?.id||Date.now()+Math.floor(Math.random()*1000000),animeId:a.id,season,episode:num,title:String(firstValue(raw,source.mapping.episodeTitle||['title','name'],'Episódio '+num)),duration:String(firstValue(raw,source.mapping.duration||['duration','runtime'],'')),language:String(firstValue(raw,source.mapping.language||['language','lang'],'')),streamUrl:cleanUrl(firstValue(raw,source.mapping.streamUrl||['streamUrl','video','url'],'')),watchUrl:cleanUrl(firstValue(raw,source.mapping.watchUrl||['watchUrl','externalUrl'],'')),thumbnail:cleanUrl(firstValue(raw,source.mapping.episodeThumbnail||['thumbnail','image','cover'],a.cover)),createdAt:exists?.createdAt||now()};
            if(exists)Object.assign(exists,ep); else {d.episodes.push(ep);result.episodesCreated++}
          };
          episodeItems.forEach((e,i)=>upsertEpisode(e,i+1));
          if(!episodeItems.length&&source.episodeUrlTemplate&&externalId){
            try{
              const epUrl=source.episodeUrlTemplate.replaceAll('{id}',encodeURIComponent(externalId));
              const epSrc={...source,url:epUrl,itemsPath:source.episodeItemsPath,pagination:{enabled:false}};
              const ej=await fetchExternalJson(epSrc,1);
              const eis=getPath(ej,source.episodeItemsPath);
              if(Array.isArray(eis))eis.forEach((e,i)=>upsertEpisode(e,i+1));
            }catch(e){result.errors.push({source:source.name,error:title+': episódios: '+e.message})}
          }
        }
        write(d);
        const hasNext=source.nextPath?Boolean(getPath(j,source.nextPath)):items.length>=Math.max(1,Math.min(500,Number(source.pagination?.limit)||100));
        if(!source.pagination?.enabled||!hasNext)break;
      }
    }catch(e){result.errors.push({source:source.name,error:e.message});}
  }
  return result;
}

async function syncAniList(d, progress=()=>{}){
  const q=`query ($page:Int!,$perPage:Int!,$year:Int){
    Page(page:$page,perPage:$perPage){
      pageInfo{hasNextPage}
      media(type:ANIME,isAdult:false,sort:[POPULARITY_DESC,SCORE_DESC],seasonYear:$year){
        id idMal title{romaji english native} description(asHtml:false)
        coverImage{extraLarge large medium} bannerImage siteUrl
        seasonYear startDate{year month day} status averageScore genres tags{name rank}
        episodes duration format nextAiringEpisode{episode airingAt}
        streamingEpisodes{title thumbnail url}
      }
    }
  }`;
  const perPage=50;
  const maxPages=Math.max(1,Math.min(100,Number(d.settings?.anilistMaxPages)||100));
  const currentYear=new Date().getUTCFullYear();
  const years=[]; for(let y=currentYear;y>=1960;y--) years.push(y);
  let discovered=0,updated=0,episodesCreated=0,pages=0;
  const seen=new Set(); const totalPages=years.length*maxPages;
  progress({currentSource:1,totalSources:1,currentPage:0,totalPages,message:'AniList: iniciando catálogo real…'});
  const fetchPage=async(year,page)=>{
    const r=await fetch('https://graphql.anilist.co',{method:'POST',headers:{'content-type':'application/json','accept':'application/json'},body:JSON.stringify({query:q,variables:{page,perPage,year}}),signal:AbortSignal.timeout(20000)});
    if(!r.ok) throw new Error('AniList HTTP '+r.status);
    const j=await r.json(); if(j.errors?.length) throw new Error(j.errors.map(e=>e.message).join('; '));
    return j.data?.Page;
  };
  for(const year of years){
    for(let page=1;page<=maxPages;page++){
      pages++; progress({currentSource:1,totalSources:1,currentPage:pages,totalPages,message:'AniList · '+year+' · página '+page+'/'+maxPages});
      let pg; try{pg=await fetchPage(year,page)}catch(e){d.settings.anilistLastError={year,page,error:e.message,at:now()};if(year===currentYear&&page===1)throw e;if(page===1)break;continue;}
      const media=pg?.media||[];
      for(const m of media){
        if(!m?.id||seen.has(m.id))continue; seen.add(m.id);
        const title=m.title?.english||m.title?.romaji||m.title?.native; if(!title)continue;
        let a=d.anime.find(x=>x.anilistId===m.id);
        const tags=[...(m.genres||[]),...((m.tags||[]).filter(t=>Number(t.rank||0)>=60).map(t=>t.name))].map(String).filter(Boolean).slice(0,30);
        const type=m.format==='MOVIE'?'Movie':(m.format||'TV').replace('SPECIAL','OVA');
        const statusMap={RELEASING:'Ongoing',FINISHED:'Finished',NOT_YET_RELEASED:'Upcoming',CANCELLED:'Cancelled',HIATUS:'Hiatus'};
        const status=statusMap[m.status]||m.status||'Ongoing'; const score=Math.max(0,Math.min(10,Number(m.averageScore||0)/10));
        const next=m.nextAiringEpisode?.airingAt?new Date(m.nextAiringEpisode.airingAt*1000).toISOString():null;
        const cover=cleanUrl(m.coverImage?.extraLarge||m.coverImage?.large||m.coverImage?.medium); const banner=cleanUrl(m.bannerImage);
        const synopsis=String(m.description||'').replace(/<[^>]+>/g,'').slice(0,3000);
        const payload={title,slug:slugify(title),synopsis,cover,banner,year:m.seasonYear||m.startDate?.year||null,status,score,type,episodes:Number(m.episodes||0),featured:score>=8.5,categories:[],views:a?.views||0,tags,anilistId:m.id,malId:m.idMal||null,anilistUrl:cleanUrl(m.siteUrl),nextAiring:next,duration:Number(m.duration||0),createdAt:a?.createdAt||now(),updatedAt:now()};
        payload.categories=d.categories.filter(c=>tags.some(t=>slugify(t)===c.slug)).map(c=>c.id);
        if(!a){a={id:Math.max(0,...d.anime.map(x=>Number(x.id)||0))+1,...payload};d.anime.push(a);discovered++;}else{Object.assign(a,payload);updated++;}
        const streams=Array.isArray(m.streamingEpisodes)?m.streamingEpisodes:[];
        streams.forEach((st,i)=>{
          const text=String(st.title||''); const match=text.match(/(?:episode|ep\.?|epis[oó]dio)\s*[-#: ]*([0-9]+)/i); const num=Number(match?.[1])||i+1;
          const existing=d.episodes.find(e=>e.animeId===a.id&&e.season===1&&e.episode===num);
          const ep={id:existing?.id||Date.now()+Math.floor(Math.random()*1000000),animeId:a.id,season:1,episode:num,title:text||('Episódio '+num),duration:a.duration?`${a.duration} min`:'',language:'',streamUrl:'',watchUrl:cleanUrl(st.url),thumbnail:cleanUrl(st.thumbnail||a.cover),createdAt:existing?.createdAt||now(),updatedAt:now()};
          if(existing)Object.assign(existing,ep);else{d.episodes.push(ep);episodesCreated++;}
        });
      }
      write(d); if(!pg?.pageInfo?.hasNextPage||!media.length)break;
    }
  }
  d.settings.anilistSyncedAt=now(); d.settings.anilistLastResult={discovered,updated,episodesCreated,pages,at:now()}; write(d);
  return {source:'AniList',discovered,updated,episodesCreated,pages,at:now()};
}

async function startCatalogSync(d){
  if(syncRunning)return {job:syncJob,alreadyRunning:true};
  syncRunning=true;
  const ext=(d.settings?.externalApis||[]).filter(x=>x.enabled!==false&&x.url).length;
  syncJob={id:crypto.randomUUID(),status:'running',startedAt:now(),finishedAt:null,totalSources:1+ext,currentSource:0,currentPage:0,totalPages:0,discovered:0,updated:0,episodesCreated:0,errors:[],message:'Preparando sincronização…'};
  const jobId=syncJob.id;
  setImmediate(async()=>{
    try{
      const r1=await syncAniList(d,p=>{if(syncJob.id===jobId)Object.assign(syncJob,p);});
      let discovered=r1.discovered,updated=r1.updated,episodesCreated=r1.episodesCreated;
      const r2=await syncExternalApis(d,p=>{if(syncJob.id===jobId)Object.assign(syncJob,{...p,currentSource:(p.currentSource||0)+1,totalSources:1+ext,discovered,updated,episodesCreated});});
      discovered+=r2.discovered; updated+=r2.updated; episodesCreated+=r2.episodesCreated;
      const errors=[...(r1.errors||[]),...(r2.errors||[])];
      d.settings.externalApisSyncedAt=now(); d.settings.externalApisLastResult={...r2,discovered,updated,episodesCreated,at:now()}; write(d);
      Object.assign(syncJob,{status:'completed',finishedAt:now(),currentSource:1+ext,discovered,updated,episodesCreated,errors,message:errors.length?'Concluído com avisos':'Sincronização concluída'});
    }catch(e){Object.assign(syncJob,{status:'failed',finishedAt:now(),errors:[...syncJob.errors,{source:'sistema',error:e.message}],message:e.message||'Falha na sincronização'});}finally{syncRunning=false;}
  });
  return {job:syncJob};
}

async function startExternalSync(d){return startCatalogSync(d);}
const server=http.createServer(async(req,res)=>{
  try{
    res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','SAMEORIGIN');res.setHeader('Referrer-Policy','strict-origin-when-cross-origin');res.setHeader('Permissions-Policy','camera=(),microphone=(),geolocation=()');res.setHeader('X-XSS-Protection','0');
    if(!rateLimit(req,'all',180,60000))return fail(res,429,'Muitas requisições.');
    const url=new URL(req.url,`http://${req.headers.host}`); const p=url.pathname; const method=req.method; const d=read();
    if(p.startsWith('/api/')){
      if(!rateLimit(req,p,90,60000))return fail(res,429,'Limite temporário atingido.');
      if(p==='/api/config'&&method==='GET')return ok(res,{settings:d.settings,categories:d.categories.map(({id,name,slug,color})=>({id,name,slug,color}))});
      if(p==='/api/admin/external-apis'&&method==='GET'){const u=currentUser(req,d);if(!u||u.role!=='admin')return fail(res,403,'Acesso negado');return ok(res,{items:d.settings.externalApis||[],lastResult:d.settings.externalApisLastResult||null,syncedAt:d.settings.externalApisSyncedAt||null})}
      if(p==='/api/admin/external-apis'&&method==='PUT'){const u=currentUser(req,d);if(!u||u.role!=='admin')return fail(res,403,'Acesso negado');const b=await parseJsonBody(req);d.settings.externalApis=Array.isArray(b.items)?b.items.slice(0,30).map(normalizeExternalSource):[];write(d);audit(d,u,'UPDATE_EXTERNAL_APIS','external-apis',{count:d.settings.externalApis.length});return ok(res,{items:d.settings.externalApis})}
      if((p==='/api/admin/external-apis/sync'||p==='/api/admin/catalog/sync')&&method==='POST'){const u=currentUser(req,d);if(!u||u.role!=='admin')return fail(res,403,'Acesso negado');const r=await startCatalogSync(d);audit(d,u,'START_CATALOG_SYNC','catalog',{jobId:r.job?.id,alreadyRunning:!!r.alreadyRunning});return ok(res,r)}
      if(p==='/api/admin/external-apis/sync/status'&&method==='GET'){const u=currentUser(req,d);if(!u||u.role!=='admin')return fail(res,403,'Acesso negado');return ok(res,{job:syncJob,lastResult:d.settings.externalApisLastResult||null,syncedAt:d.settings.externalApisSyncedAt||null})}
      if(p==='/api/home'&&method==='GET'){const user=currentUser(req,d);const sections=d.sections.filter(s=>s.enabled).sort((a,b)=>a.position-b.position).map(s=>buildSection(d,s,user));const hero=d.anime.filter(a=>a.featured).sort((a,b)=>b.score-a.score).slice(0,6).map(a=>enrichAnime(d,a));return ok(res,{settings:d.settings,hero,sections,user:user?safeUser(user):null});}
      if(p==='/api/anime'&&method==='GET'){const rows=listAnime(d,Object.fromEntries(url.searchParams));return ok(res,{items:rows.map(a=>enrichAnime(d,a)),total:rows.length,categories:d.categories});}
      const mAnime=p.match(/^\/api\/anime\/([^/]+)$/); if(mAnime&&method==='GET'){const a=d.anime.find(x=>x.slug===decodeURIComponent(mAnime[1]));if(!a)return fail(res,404,'Anime não encontrado');return ok(res,{anime:enrichAnime(d,a),episodes:d.episodes.filter(e=>e.animeId===a.id).sort((x,y)=>x.season-y.season||x.episode-y.episode),related:d.anime.filter(x=>x.id!==a.id&&x.categories?.some(c=>a.categories?.includes(c))).sort((x,y)=>y.score-x.score).slice(0,8).map(x=>enrichAnime(d,x))});}
      if(p==='/api/calendar'&&method==='GET'){const days=['Segunda-feira','Terça-feira','Quarta-feira','Quinta-feira','Sexta-feira','Sábado','Domingo'];const groups=days.map(day=>({day,items:d.anime.filter(a=>a.releaseDay===day).map(a=>enrichAnime(d,a))}));return ok(res,{groups});}
      if(p==='/api/auth/register'&&method==='POST'){const b=await parseJsonBody(req);const email=String(b.email||'').trim().toLowerCase();const password=String(b.password||'');if(!/^\S+@\S+\.\S+$/.test(email)||password.length<8)return fail(res,400,'Informe um e-mail válido e senha com pelo menos 8 caracteres.');if(d.users.some(u=>u.email===email))return fail(res,409,'E-mail já cadastrado.');const id=Math.max(0,...d.users.map(u=>u.id||0))+1;const user={id,email,passwordHash:hashPassword(password),displayName:String(b.displayName||email.split('@')[0]).trim().slice(0,40),avatar:cleanUrl(b.avatar),role:'user',blocked:false,createdAt:now(),favorites:[],history:[],lastLogin:now()};d.users.push(user);write(d);const token=sign({sub:id,exp:Date.now()+14*24*3600*1000});return send(res,200,{user:safeUser(user)},{'Set-Cookie':setCookie('ad_token',token,14*24*3600)});}
      if(p==='/api/auth/login'&&method==='POST'){const b=await parseJsonBody(req),email=String(b.email||'').trim().toLowerCase();const u=d.users.find(x=>x.email===email);if(!u||!verifyPassword(String(b.password||''),u.passwordHash)||u.blocked)return fail(res,401,'E-mail ou senha inválidos.');u.lastLogin=now();write(d);const token=sign({sub:u.id,exp:Date.now()+14*24*3600*1000});return send(res,200,{user:safeUser(u)},{'Set-Cookie':setCookie('ad_token',token,14*24*3600)});}
      if(p==='/api/auth/logout'&&method==='POST')return send(res,200,{ok:true},{'Set-Cookie':setCookie('ad_token','',0)});
      if(p==='/api/auth/me'&&method==='GET'){const u=currentUser(req,d);if(!u)return fail(res,401,'Não autenticado');return ok(res,{user:safeUser(u)});}
      if(p==='/api/me/profile'&&method==='GET'){const u=currentUser(req,d);if(!u)return fail(res,401,'Não autenticado');return ok(res,{user:safeUser(u)});}
      if(p==='/api/me/profile'&&method==='PUT'){const u=currentUser(req,d);if(!u)return fail(res,401,'Não autenticado');const b=await parseJsonBody(req);u.displayName=String((b.displayName??u.displayName??'')).trim().slice(0,40)||u.email.split('@')[0];u.avatar=cleanUrl(b.avatar);write(d);return ok(res,{user:safeUser(u)});}
      if(p==='/api/me/library'&&method==='GET'){const u=currentUser(req,d);if(!u)return fail(res,401,'Não autenticado');return ok(res,{user:safeUser(u),favorites:(u.favorites||[]).map(id=>d.anime.find(a=>a.id===id)).filter(Boolean).map(a=>enrichAnime(d,a)),history:(u.history||[]).map(h=>({...h,anime:enrichAnime(d,d.anime.find(a=>a.id===h.animeId)||{} )})).filter(h=>h.anime.id)});}
            const commentsPath=p.match(/^\/api\/anime\/([^/]+)\/comments$/); if(commentsPath&&method==='GET'){const a=d.anime.find(x=>x.slug===decodeURIComponent(commentsPath[1]));if(!a)return fail(res,404,'Anime não encontrado');const items=(d.comments||[]).filter(c=>c.animeId===a.id&&!c.hidden).sort((x,y)=>y.id-x.id).slice(0,100).map(c=>({...c,user:{id:c.userId,displayName:d.users.find(u=>u.id===c.userId)?.displayName||'Usuário'}}));return ok(res,{items});}
      if(p==='/api/comments'&&method==='POST'){const u=currentUser(req,d);if(!u)return fail(res,401,'Você precisa estar logado para comentar.');const b=await parseJsonBody(req);const animeId=Number(b.animeId);const body=String(b.body||'').trim().slice(0,1200);if(!body)return fail(res,400,'Comentário vazio.');if(!d.anime.some(a=>a.id===animeId))return fail(res,404,'Anime não encontrado');d.comments=d.comments||[];const c={id:Date.now()+Math.floor(Math.random()*10000),userId:u.id,animeId,parentId:null,body,hidden:false,createdAt:now()};d.comments.push(c);write(d);return ok(res,{comment:{...c,user:{id:u.id,displayName:u.displayName||u.email.split('@')[0]}}});}
      const commentDel=p.match(/^\/api\/comments\/(\d+)$/);if(commentDel&&method==='DELETE'){const u=currentUser(req,d);if(!u)return fail(res,401,'Não autenticado');const id=Number(commentDel[1]);const c=(d.comments||[]).find(x=>x.id===id);if(!c)return fail(res,404,'Comentário não encontrado');if(c.userId!==u.id&&u.role!=='admin')return fail(res,403,'Sem permissão');c.hidden=true;write(d);if(u.role==='admin')audit(d,u,'HIDE_COMMENT',String(id));return ok(res,{ok:true});}
      const meLib=p.match(/^\/api\/me\/(favorite|history)$/);if(meLib&&(method==='POST'||method==='DELETE')){const u=currentUser(req,d);if(!u)return fail(res,401,'Não autenticado');const b=await parseJsonBody(req);const animeId=Number(b.animeId);if(!d.anime.some(a=>a.id===animeId))return fail(res,404,'Anime não encontrado');if(meLib[1]==='favorite'){u.favorites=u.favorites||[];if(method==='POST'&&!u.favorites.includes(animeId))u.favorites.push(animeId);if(method==='DELETE')u.favorites=u.favorites.filter(x=>x!==animeId)}else{u.history=u.history||[];u.history=u.history.filter(x=>x.animeId!==animeId);if(method==='POST')u.history.unshift({animeId,episodeId:Number(b.episodeId)||null,progress:number(b.progress,0,1),updatedAt:now()});u.history=u.history.slice(0,30)}write(d);return ok(res,{user:safeUser(u)});}

      const u=currentUser(req,d); if(!u)return fail(res,401,'Não autenticado'); if(u.role!=='admin')return fail(res,403,'Acesso administrativo necessário.');
      if(p==='/api/admin/comments'&&method==='GET'){return ok(res,{items:(d.comments||[]).slice().sort((a,b)=>b.id-a.id).slice(0,500).map(c=>({...c,user:{id:c.userId,displayName:d.users.find(x=>x.id===c.userId)?.displayName||'Usuário'},animeTitle:d.anime.find(a=>a.id===c.animeId)?.title||String(c.animeId)}))});}
      const commentAdmin=p.match(/^\/api\/admin\/comments\/(\d+)$/);if(commentAdmin&&method==='DELETE'){const id=Number(commentAdmin[1]);const c=(d.comments||[]).find(x=>x.id===id);if(!c)return fail(res,404,'Comentário não encontrado');c.hidden=true;audit(d,u,'HIDE_COMMENT',String(id));write(d);return ok(res,{ok:true});}
      if(p==='/api/admin/anilist/sync'&&method==='POST'){const r=await startCatalogSync(d);audit(d,u,'START_CATALOG_SYNC','anilist',{jobId:r.job?.id,alreadyRunning:!!r.alreadyRunning});return ok(res,r);}
      if(p==='/api/admin/stats'&&method==='GET'){return ok(res,{users:d.users.length,admins:d.users.filter(x=>x.role==='admin').length,blocked:d.users.filter(x=>x.blocked).length,anime:d.anime.length,categories:d.categories.length,episodes:d.episodes.length,sections:d.sections.length,views:d.anime.reduce((n,a)=>n+a.views,0),lastLogs:d.logs.slice(0,8)});}
      if(p==='/api/admin/settings'&&method==='PUT'){const b=await parseJsonBody(req);d.settings={...d.settings,siteName:String(b.siteName||d.settings.siteName).slice(0,80),tagline:String(b.tagline??d.settings.tagline).slice(0,180),accent:/^#[0-9a-f]{6}$/i.test(String(b.accent))?b.accent:d.settings.accent,secondary:/^#[0-9a-f]{6}$/i.test(String(b.secondary))?b.secondary:d.settings.secondary,heroAutoplay:b.heroAutoplay!==false,announcement:String(b.announcement??'').slice(0,240),navigation:Array.isArray(b.navigation)?b.navigation.slice(0,12).map(x=>({id:String(x.id),label:String(x.label).slice(0,40),href:String(x.href).slice(0,100)})):d.settings.navigation};audit(d,u,'UPDATE_SETTINGS','site');write(d);return ok(res,{settings:d.settings});}
      if(p==='/api/admin/users'&&method==='GET')return ok(res,{items:d.users.map(safeUser)});
      const userM=p.match(/^\/api\/admin\/users\/(\d+)\/(block|role)$/); if(userM&&(method==='PATCH')){const target=d.users.find(x=>x.id===Number(userM[1]));if(!target)return fail(res,404,'Usuário não encontrado');if(target.id===u.id&&userM[2]==='role')return fail(res,400,'Você não pode remover seu próprio admin.');const b=await parseJsonBody(req);if(userM[2]==='block'){target.blocked=!!b.blocked}else{if(!['user','admin'].includes(b.role))return fail(res,400,'Permissão inválida');target.role=b.role}audit(d,u,userM[2]==='block'?(target.blocked?'BLOCK_USER':'UNBLOCK_USER'):'CHANGE_ROLE',String(target.id),{role:target.role,blocked:target.blocked});write(d);return ok(res,{user:safeUser(target)});}
      const userDel=p.match(/^\/api\/admin\/users\/(\d+)$/); if(userDel&&method==='DELETE'){const id=Number(userDel[1]);if(id===u.id)return fail(res,400,'Você não pode remover a própria conta.');d.users=d.users.filter(x=>x.id!==id);audit(d,u,'DELETE_USER',String(id));write(d);return ok(res,{ok:true});}

      if(p==='/api/admin/categories'&&method==='GET')return ok(res,{items:d.categories});
      if(p==='/api/admin/categories'&&(method==='POST'||method==='PUT')){const b=await parseJsonBody(req);const name=String(b.name||'').trim().slice(0,80);if(!name)return fail(res,400,'Nome obrigatório');const slug=slugify(b.slug||name);if(method==='POST'){if(d.categories.some(c=>c.slug===slug))return fail(res,409,'Categoria já existe');const x={id:Math.max(0,...d.categories.map(c=>c.id))+1,name,slug,color:/^#[0-9a-f]{6}$/i.test(String(b.color))?b.color:'#ef1523'};d.categories.push(x);audit(d,u,'CREATE_CATEGORY',name);write(d);return ok(res,{category:x});}const id=Number(b.id),x=d.categories.find(c=>c.id===id);if(!x)return fail(res,404,'Categoria não encontrada');x.name=name;x.slug=slug;x.color=/^#[0-9a-f]{6}$/i.test(String(b.color))?b.color:x.color;audit(d,u,'UPDATE_CATEGORY',String(id));write(d);return ok(res,{category:x});}
      const catDel=p.match(/^\/api\/admin\/categories\/(\d+)$/);if(catDel&&method==='DELETE'){const id=Number(catDel[1]);d.categories=d.categories.filter(c=>c.id!==id);for(const a of d.anime)a.categories=(a.categories||[]).filter(x=>x!==id);audit(d,u,'DELETE_CATEGORY',String(id));write(d);return ok(res,{ok:true});}

      if(p==='/api/admin/anime'&&method==='GET')return ok(res,{items:d.anime.map(a=>enrichAnime(d,a)),categories:d.categories});
      if(p==='/api/admin/anime'&&(method==='POST'||method==='PUT')){const b=await parseJsonBody(req);const title=String(b.title||'').trim();if(!title)return fail(res,400,'Título obrigatório');if(method==='POST'&&d.anime.some(a=>a.slug===slugify(b.slug||title)))return fail(res,409,'Anime já existe');const id=method==='POST'?Math.max(0,...d.anime.map(a=>a.id))+1:Number(b.id);if(method==='PUT'&&!d.anime.some(a=>a.id===id))return fail(res,404,'Anime não encontrado');const x=normalizeAnime(b,id);if(!x.slug)x.slug=slugify(x.title);if(method==='POST')d.anime.unshift(x);else Object.assign(d.anime.find(a=>a.id===id),x);audit(d,u,method==='POST'?'CREATE_ANIME':'UPDATE_ANIME',String(id),{title});write(d);return ok(res,{anime:enrichAnime(d,x)});}
      const animeDel=p.match(/^\/api\/admin\/anime\/(\d+)$/);if(animeDel&&method==='DELETE'){const id=Number(animeDel[1]);d.anime=d.anime.filter(a=>a.id!==id);d.episodes=d.episodes.filter(e=>e.animeId!==id);for(const s of d.sections){s.animeIds=(s.animeIds||[]).filter(x=>x!==id)}audit(d,u,'DELETE_ANIME',String(id));write(d);return ok(res,{ok:true});}
      if(p==='/api/admin/anime/bulk'&&method==='POST'){const b=await parseJsonBody(req);if(!Array.isArray(b.items)||b.items.length>500)return fail(res,400,'Envie entre 1 e 500 animes.');const created=[];for(const raw of b.items){const title=String(raw.title||'').trim();if(!title)continue;const slug=slugify(raw.slug||title);if(d.anime.some(a=>a.slug===slug))continue;const x=normalizeAnime(raw,Math.max(0,...d.anime.map(a=>a.id))+1);d.anime.unshift(x);created.push(x)}audit(d,u,'BULK_CREATE_ANIME',String(created.length));write(d);return ok(res,{created:created.length});}

      if(p==='/api/admin/episodes'&&method==='GET'){const animeId=Number(url.searchParams.get('animeId')||0);return ok(res,{items:d.episodes.filter(e=>!animeId||e.animeId===animeId).sort((a,b)=>a.animeId-b.animeId||a.season-b.season||a.episode-b.episode)});}
      if(p==='/api/admin/episodes/bulk'&&method==='POST'){const b=await parseJsonBody(req);if(!Array.isArray(b.items)||b.items.length>1000)return fail(res,400,'Envie até 1000 episódios por lote.');const out=[];for(const raw of b.items){const animeId=Number(raw.animeId),ep=Number(raw.episode);if(!d.anime.some(a=>a.id===animeId)||!ep)continue;const item={id:Date.now()+Math.floor(Math.random()*1000000),animeId,season:number(raw.season,1,99),episode:ep,title:String(raw.title||`Episódio ${ep}`).slice(0,180),duration:String(raw.duration||'24 min').slice(0,30),language:String(raw.language||'Legendado').slice(0,30),streamUrl:cleanUrl(raw.streamUrl),downloadUrl:cleanUrl(raw.downloadUrl),thumbnail:cleanUrl(raw.thumbnail)};const ix=d.episodes.findIndex(x=>x.animeId===animeId&&x.season===item.season&&x.episode===item.episode);if(ix>=0)d.episodes[ix]=item;else d.episodes.push(item);out.push(item)}audit(d,u,'BULK_UPSERT_EPISODES',String(out.length));write(d);return ok(res,{created:out.length});}
      const epDel=p.match(/^\/api\/admin\/episodes\/(\d+)$/);if(epDel&&method==='DELETE'){d.episodes=d.episodes.filter(e=>e.id!==Number(epDel[1]));audit(d,u,'DELETE_EPISODE',epDel[1]);write(d);return ok(res,{ok:true});}

      if(p==='/api/admin/sections'&&method==='GET')return ok(res,{items:[...d.sections].sort((a,b)=>a.position-b.position),anime:d.anime.map(a=>({id:a.id,title:a.title}))});
      if(p==='/api/admin/sections'&&(method==='POST'||method==='PUT')){const b=await parseJsonBody(req);const title=String(b.title||'Nova seção').slice(0,100);const x={id:method==='POST'?Math.max(0,...d.sections.map(s=>s.id))+1:Number(b.id),title,subtitle:String(b.subtitle||'').slice(0,160),type:String(b.type||'manual'),categoryId:Number(b.categoryId)||null,animeIds:Array.isArray(b.animeIds)?b.animeIds.map(Number).slice(0,100):[],enabled:b.enabled!==false,position:Number(b.position)||d.sections.length+1};if(method==='POST')d.sections.push(x);else Object.assign(d.sections.find(s=>s.id===x.id),x);audit(d,u,method==='POST'?'CREATE_SECTION':'UPDATE_SECTION',String(x.id));write(d);return ok(res,{section:x});}
      const secDel=p.match(/^\/api\/admin\/sections\/(\d+)$/);if(secDel&&method==='DELETE'){d.sections=d.sections.filter(s=>s.id!==Number(secDel[1]));audit(d,u,'DELETE_SECTION',secDel[1]);write(d);return ok(res,{ok:true});}

      if(p==='/api/admin/export'&&method==='GET'){audit(d,u,'EXPORT_DATA','database');write(d);return send(res,200,d,{'Content-Disposition':'attachment; filename="animedragon-backup.json"'});}
      if(p==='/api/admin/import'&&method==='POST'){const b=await parseJsonBody(req);if(!b||typeof b!=='object'||!Array.isArray(b.anime)||!Array.isArray(b.categories))return fail(res,400,'Backup inválido.');const imported={...d,...b,settings:{...d.settings,...(b.settings||{})}};write(imported);audit(imported,u,'IMPORT_DATA','database');write(imported);return ok(res,{ok:true});}
      if(p==='/api/admin/logs'&&method==='GET')return ok(res,{items:d.logs.slice(0,500)});
      return fail(res,404,'Endpoint não encontrado');
    }
    let file=p==='/'?'/index.html':p; const safe=path.normalize(file).replace(/^\.{2}(\/|\\)/,''); const fp=path.join(PUBLIC,safe); if(!fp.startsWith(PUBLIC))return fail(res,403,'Acesso negado'); if(fs.existsSync(fp)&&fs.statSync(fp).isFile()){res.writeHead(200,{'Content-Type':MIME[path.extname(fp).toLowerCase()]||'application/octet-stream','Cache-Control':file.endsWith('index.html')?'no-cache':'public, max-age=86400'});fs.createReadStream(fp).pipe(res);return}res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('404');
  }catch(e){console.error(e);if(!res.headersSent)fail(res,e.status||500,e.message||'Erro interno')}
});
ensure();
server.listen(PORT,()=>{
  console.log(`AnimeDragon em http://localhost:${PORT}`);
  if(process.env.AUTO_SYNC !== 'false') setInterval(()=>{const d=read(); if(!syncRunning) startCatalogSync(d).catch(e=>console.error('auto sync',e));},6*60*60*1000);
});
