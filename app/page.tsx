"use client";

import { ChangeEvent, FormEvent, SyntheticEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle, ArrowLeft, BookOpen, Bookmark, Check, ChevronDown, ChevronLeft, ChevronRight, Copy,
  CircleDollarSign, CloudDownload, Compass, ExternalLink, FileArchive, FolderDown, Globe2,
  Heart, HeartOff, Home as HomeIcon, LockKeyhole, LogOut, Search, ShieldCheck,
  Share2, Smartphone, Star, Trophy, UserRound, Wifi, X
} from "lucide-react";

type SourceAccess = "free" | "login" | "paid" | "member";
type SourceKind = "reader" | "catalog";
type ComicSource = { name:string; url:string; access:SourceAccess; kind?:SourceKind };
type PolicyTier = "mainland_direct" | "mainland_member" | "overseas" | "risk";
type DisplayTier = "direct" | "login" | "paid" | "member" | "overseas" | "netdisk" | "catalog" | "risk";
type SourcePolicy = { tier:PolicyTier; mainland:boolean; requiresMember:boolean; risk:boolean; removed:boolean; health:string; checkedAt:string; note:string; evidence?:string; riskReasons?:string[] };
type AccessConfig = { updatedAt:string; policies:Record<string,SourcePolicy> };
type TitleStatus = { sourceUrl?:string };
type BaiduStatus = { configured:boolean; connected:boolean; scope?:string|null; mode?:string; redirectUri?:string };
type BaiduFile = { fs_id:string; path:string; name:string; size:number; isdir:boolean; mtime:number };
type BaiduScanStats = { files:number; folders:number; requests:number; skippedFolders:number; truncated:boolean };
type Comic = {
  id:string; title:string; subtitle:string; author:string; cover:string; genre:string[];
  latest:number|null; color:"blackwhite"|"color"|"unknown"; language:string; region:string;
  sources:ComicSource[]; verifiedCover:boolean; catalogOnly?:boolean; popularityRank?:number|null;
};
type Catalog = { updatedAt:string; count:number; curatedCount?:number; networkCount?:number; comics:Comic[] };
type OfficialSource = { id:number; name:string; url:string; group:string; note:string; mainland:boolean };
type OfflinePack = { id:string; comicId:string; name:string; size:number; type:string; addedAt:number; blob?:Blob };
type Tab = "home" | "favorites" | "sources" | "profile";
type HistoryMap = Record<string,number>;
type WeeklyReadState = { week:string; counts:Record<string,number> };
type WeeklyBoard = { key:string; title:string; subtitle:string; comics:Comic[] };
type Reaction = "favorite" | "neutral" | "disliked";
type DislikeQueue = Record<string,string>;

const displayLabels:Record<DisplayTier,string>={direct:"直接看",login:"登录看",paid:"付费看",member:"会员看",overseas:"域外看",netdisk:"网盘看",catalog:"资料页",risk:"有风险"};
const displayRank:Record<DisplayTier,number>={netdisk:0,direct:1,login:2,paid:3,member:4,overseas:5,catalog:6,risk:7};
const statusFilters=["direct","login","paid","member","overseas","netdisk"] as const;
type StatusFilter=(typeof statusFilters)[number];

function handleCoverLoad(event:SyntheticEvent<HTMLImageElement>){ event.currentTarget.style.visibility="visible"; }
function handleCoverError(event:SyntheticEvent<HTMLImageElement>){ event.currentTarget.alt=""; event.currentTarget.style.visibility="hidden"; }

function sourceStatuses(source:ComicSource,policies:Record<string,SourcePolicy>,memberships:string[]):DisplayTier[]{
  const policy=policies[source.name];
  if(policy?.risk||policy?.removed||policy?.tier==="risk") return ["risk"];
  if(source.kind==="catalog") return ["overseas","catalog"];
  const mainland=/^https:\/\/www\.webtoons\.com\/zh-hant\//i.test(source.url)||policy?.tier==="mainland_direct"||policy?.tier==="mainland_member";
  const signedIn=memberships.includes(source.name);
  const statuses:DisplayTier[]=[];
  if(!mainland) statuses.push("overseas");
  if(!signedIn){
    if(source.access!=="free") statuses.push("login");
    if(source.access==="paid"||source.name==="哔哩哔哩漫画") statuses.push("paid");
    if(source.access==="member") statuses.push("member");
  }
  if(mainland&&(source.access==="free"||signedIn)) statuses.push("direct");
  return statuses.length?statuses:["overseas"];
}

function sourceTier(source:ComicSource,policies:Record<string,SourcePolicy>,memberships:string[]):DisplayTier{
  const statuses=sourceStatuses(source,policies,memberships);
  if(statuses.includes("risk")) return "risk";
  if(statuses.includes("overseas")) return source.kind==="catalog"?"catalog":"overseas";
  return statuses.sort((a,b)=>displayRank[a]-displayRank[b])[0]||"risk";
}

function normalizeTitle(value:string){return value.toLowerCase().replace(/\.(pdf|cbz|zip|rar|7z)$/i,"").replace(/[^\p{L}\p{N}]+/gu,"");}
function matchingBaiduFile(comic:Comic,files:BaiduFile[]){
  const title=normalizeTitle(comic.title);
  const subtitle=normalizeTitle(comic.subtitle);
  return files.find(file=>{
    if(file.isdir) return false;
    const searchable=normalizeTitle(`${file.path} ${file.name}`);
    return (title.length>1&&searchable.includes(title))||(subtitle.length>3&&searchable.includes(subtitle));
  });
}

function orderedSources(comic:Comic,policies:Record<string,SourcePolicy>,memberships:string[]){
  return [...comic.sources].sort((a,b)=>displayRank[sourceTier(a,policies,memberships)]-displayRank[sourceTier(b,policies,memberships)]);
}

function comicStatuses(comic:Comic,policies:Record<string,SourcePolicy>,memberships:string[],hasOffline:boolean,hasBaidu:boolean):DisplayTier[]{
  if(hasOffline) return ["direct"];
  if(hasBaidu) return ["netdisk","direct"];
  const first=orderedSources(comic,policies,memberships)[0];
  return first?sourceStatuses(first,policies,memberships):["risk"];
}

function selectedComicStatuses(comic:Comic,selectedName:string|undefined,policies:Record<string,SourcePolicy>,memberships:string[],hasOffline:boolean,hasBaidu:boolean):DisplayTier[]{
  if(hasOffline) return ["direct"];
  if(hasBaidu) return ["netdisk","direct"];
  const selected=comic.sources.find(source=>source.name===selectedName);
  return selected?sourceStatuses(selected,policies,memberships):comicStatuses(comic,policies,memberships,false,false);
}

function comicTier(comic:Comic,policies:Record<string,SourcePolicy>,memberships:string[],hasOffline:boolean,hasBaidu=false):DisplayTier{
  const statuses=comicStatuses(comic,policies,memberships,hasOffline,hasBaidu);
  if(statuses.includes("overseas")) return statuses.includes("catalog")?"catalog":"overseas";
  return statuses.sort((a,b)=>displayRank[a]-displayRank[b])[0]||"risk";
}

function comicHasStatus(comic:Comic,status:StatusFilter,policies:Record<string,SourcePolicy>,memberships:string[],hasOffline:boolean,hasBaidu:boolean){
  if(comicStatuses(comic,policies,memberships,hasOffline,hasBaidu).includes(status)) return true;
  return comic.sources.some(source=>sourceStatuses(source,policies,memberships).includes(status));
}

function resolvedSourceUrl(comic:Comic,source:ComicSource,titleStatus:Record<string,TitleStatus>){
  if(source.name==="哔哩哔哩漫画") return titleStatus[comic.id]?.sourceUrl||`https://manga.bilibili.com/search?keyword=${encodeURIComponent(comic.title)}`;
  return source.url;
}

const LOGIN_HASH = "dc290ac4c0aee9e0a1d89537c3870a5461db2e859bea457dae495b7ea4f01410";
const LOGIN_FALLBACK_HASH = "67826fc6";
const DB_NAME = "galaxy-x-manga-sea";
const STORE_NAME = "manga-content";
const SESSION_MS = 30*24*60*60*1000;
const categories = ["全部","本周排行","热血","经典","冒险","战斗","奇幻","悬疑","运动","彩漫","日漫","韩漫","美漫"];

function localWeekKey(date=new Date()){
  const monday=new Date(date.getFullYear(),date.getMonth(),date.getDate());
  monday.setDate(monday.getDate()-((monday.getDay()+6)%7));
  return `${monday.getFullYear()}-${String(monday.getMonth()+1).padStart(2,"0")}-${String(monday.getDate()).padStart(2,"0")}`;
}

function localLockHash(value:string){
  let hash=2166136261;
  for(const character of value){ hash^=character.charCodeAt(0); hash=Math.imul(hash,16777619); }
  return (hash>>>0).toString(16).padStart(8,"0");
}

function loadJson<T>(key:string,fallback:T):T{
  if(typeof window==="undefined") return fallback;
  try { const raw=localStorage.getItem(key); return raw?JSON.parse(raw) as T:fallback; } catch { return fallback; }
}

function openDatabase(){
  return new Promise<IDBDatabase>((resolve,reject)=>{
    const request=indexedDB.open(DB_NAME,1);
    request.onupgradeneeded=()=>{ if(!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME,{keyPath:"id"}); };
    request.onsuccess=()=>resolve(request.result);
    request.onerror=()=>reject(request.error);
  });
}

async function listOfflinePacks(){
  const db=await openDatabase();
  return new Promise<OfflinePack[]>((resolve,reject)=>{
    const request=db.transaction(STORE_NAME,"readonly").objectStore(STORE_NAME).getAll();
    request.onsuccess=()=>resolve((request.result as OfflinePack[]).sort((a,b)=>b.addedAt-a.addedAt));
    request.onerror=()=>reject(request.error);
  });
}

async function saveOfflinePack(comicId:string,file:File){
  const db=await openDatabase();
  const record:OfflinePack={id:`${comicId}:${Date.now()}:${file.name}`,comicId,name:file.name,size:file.size,type:file.type,addedAt:Date.now(),blob:file};
  await new Promise<void>((resolve,reject)=>{
    const request=db.transaction(STORE_NAME,"readwrite").objectStore(STORE_NAME).put(record);
    request.onsuccess=()=>resolve();
    request.onerror=()=>reject(request.error);
  });
  return record;
}

async function removeOfflinePack(id:string){
  const db=await openDatabase();
  await new Promise<void>((resolve,reject)=>{
    const request=db.transaction(STORE_NAME,"readwrite").objectStore(STORE_NAME).delete(id);
    request.onsuccess=()=>resolve();
    request.onerror=()=>reject(request.error);
  });
}

async function openOfflinePack(id:string){
  const db=await openDatabase();
  const record=await new Promise<OfflinePack|undefined>((resolve,reject)=>{
    const request=db.transaction(STORE_NAME,"readonly").objectStore(STORE_NAME).get(id);
    request.onsuccess=()=>resolve(request.result as OfflinePack|undefined);
    request.onerror=()=>reject(request.error);
  });
  if(!record?.blob) return;
  const url=URL.createObjectURL(record.blob);
  const viewable=record.type.startsWith("image/")||record.type==="application/pdf";
  const anchor=document.createElement("a");
  anchor.href=url;
  if(viewable){ anchor.target="_blank"; anchor.rel="noopener"; }
  else anchor.download=record.name;
  anchor.click();
  window.setTimeout(()=>URL.revokeObjectURL(url),60000);
}

function formatSize(bytes:number){
  if(bytes<1024*1024) return `${(bytes/1024).toFixed(0)} KB`;
  return `${(bytes/1024/1024).toFixed(1)} MB`;
}

export default function Home(){
  const [tab,setTab]=useState<Tab>("home");
  const [catalog,setCatalog]=useState<Comic[]>([]);
  const [catalogMeta,setCatalogMeta]=useState({count:0,curatedCount:0,networkCount:0});
  const [catalogUpdatedAt,setCatalogUpdatedAt]=useState("");
  const [visibleLimit,setVisibleLimit]=useState(60);
  const [sources,setSources]=useState<OfficialSource[]>([]);
  const [activeCategory,setActiveCategory]=useState("全部");
  const [categoryMotion,setCategoryMotion]=useState<"forward"|"backward">("forward");
  const [categoryMotionKey,setCategoryMotionKey]=useState(0);
  const [activeStatus,setActiveStatus]=useState<StatusFilter|null>(null);
  const [query,setQuery]=useState("");
  const [searchOpen,setSearchOpen]=useState(false);
  const [selected,setSelected]=useState<Comic|null>(null);
  const [reader,setReader]=useState<Comic|null>(null);
  const [favorites,setFavorites]=useState<string[]>([]);
  const [blocked,setBlocked]=useState<string[]>([]);
  const [reactions,setReactions]=useState<Record<string,Reaction>>({});
  const [selectedSources,setSelectedSources]=useState<Record<string,string>>({});
  const [history,setHistory]=useState<HistoryMap>({});
  const [weeklyReads,setWeeklyReads]=useState<Record<string,number>>({});
  const [offlinePacks,setOfflinePacks]=useState<OfflinePack[]>([]);
  const [accessPolicies,setAccessPolicies]=useState<Record<string,SourcePolicy>>({});
  const [titleStatus,setTitleStatus]=useState<Record<string,TitleStatus>>({});
  const [memberships,setMemberships]=useState<string[]>([]);
  const [baiduStatus,setBaiduStatus]=useState<BaiduStatus>({configured:false,connected:false});
  const [baiduFiles,setBaiduFiles]=useState<BaiduFile[]>([]);
  const [locked,setLocked]=useState(true);
  const [toast,setToast]=useState("");
  const [syncMessage,setSyncMessage]=useState("每天 01:00 检查目录");
  const categoryNav=useRef<HTMLElement|null>(null);

  useEffect(()=>{
    const savedFavorites=loadJson("galaxy:favorites",["one-piece","dragon-ball"]);
    const savedBlocked=loadJson<string[]>("galaxy:blocked",[]);
    const savedReactions=loadJson<Record<string,Reaction|"blocked">>("galaxy:reactions",{});
    const savedDislikes=loadJson<DislikeQueue>("galaxy:dislike-queue",{});
    const savedSources=loadJson<Record<string,string>>("galaxy:selected-sources",{});
    const savedBaiduFiles=loadJson<BaiduFile[]>("galaxy:baidu-files",[]);
    const savedHistory=loadJson<HistoryMap>("galaxy:history",{});
    const savedMemberships=loadJson<string[]>("galaxy:memberships",[]);
    const savedWeekly=loadJson<WeeklyReadState>("galaxy:weekly-reads",{week:localWeekKey(),counts:{}});
    const currentWeekly=savedWeekly.week===localWeekKey()?savedWeekly.counts:{};
    const expiry=Number(localStorage.getItem("galaxy:session-expiry")||0);
    const sessionLocked=localStorage.getItem("galaxy:session")==="active"?expiry<Date.now():true;
    const initialReactions=Object.fromEntries(Object.entries(savedReactions).map(([id,reaction])=>[id,reaction==="blocked"?"disliked":reaction])) as Record<string,Reaction>;
    savedFavorites.forEach(id=>{ if(!initialReactions[id]) initialReactions[id]="favorite"; });
    savedBlocked.forEach(id=>{ delete initialReactions[id]; });
    queueMicrotask(()=>{ setFavorites(savedFavorites); setBlocked(savedBlocked); setReactions(initialReactions); setSelectedSources(savedSources); setHistory(savedHistory); setWeeklyReads(currentWeekly); setMemberships(savedMemberships); setBaiduFiles(savedBaiduFiles); setLocked(sessionLocked); });
    fetch("/comic-catalog.json").then(r=>r.json()).then((data:Catalog)=>{
      const comics=Array.isArray(data.comics)?data.comics:[];
      const matured=Object.entries(savedDislikes).filter(([,queuedAt])=>Boolean(data.updatedAt&&queuedAt&&new Date(data.updatedAt)>new Date(queuedAt))).map(([id])=>id);
      const remaining=Object.fromEntries(Object.entries(savedDislikes).filter(([id])=>!matured.includes(id)));
      if(matured.length){
        const nextBlocked=[...new Set([...matured,...savedBlocked])];
        const nextReactions={...initialReactions}; matured.forEach(id=>delete nextReactions[id]);
        setBlocked(nextBlocked); setReactions(nextReactions);
        localStorage.setItem("galaxy:blocked",JSON.stringify(nextBlocked));
        localStorage.setItem("galaxy:reactions",JSON.stringify(nextReactions));
        localStorage.setItem("galaxy:dislike-queue",JSON.stringify(remaining));
      }
      setCatalog(comics); setCatalogUpdatedAt(data.updatedAt||"");
      setCatalogMeta({count:data.count||comics.length,curatedCount:data.curatedCount||Math.min(54,comics.length),networkCount:data.networkCount||Math.max(0,comics.length-54)});
    }).catch(()=>setToast("目录加载失败，请稍后刷新"));
    fetch("/official-sources.json").then(r=>r.json()).then(data=>setSources(Array.isArray(data.sources)?data.sources:[])).catch(()=>undefined);
    fetch("/source-access.json").then(r=>r.json()).then((data:AccessConfig)=>setAccessPolicies(data.policies||{})).catch(()=>undefined);
    fetch("/source-status.json").then(r=>r.json()).then(data=>setTitleStatus(data.titles||{})).catch(()=>undefined);
    fetch("/sync-status.json").then(r=>r.json()).then(data=>data.lastRun&&setSyncMessage(`${data.message||"目录已同步"} · 每天 01:00`)).catch(()=>undefined);
    listOfflinePacks().then(setOfflinePacks).catch(()=>undefined);
    fetch(`/api/baidu/status?t=${Date.now()}`,{cache:"no-store"}).then(r=>r.json()).then((status:BaiduStatus)=>setBaiduStatus(status)).catch(()=>undefined);
    const baiduResult=new URLSearchParams(window.location.search).get("baidu");
    if(baiduResult){
      queueMicrotask(()=>{
        setTab("profile");
        setToast(baiduResult==="connected"?"百度网盘连接成功":"百度授权未完成，请重试");
      });
      window.history.replaceState({},"",window.location.pathname);
    }
    if("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(()=>undefined);
  },[]);

  useEffect(()=>{ if(!toast)return; const timer=window.setTimeout(()=>setToast(""),2400); return()=>window.clearTimeout(timer); },[toast]);
  useEffect(()=>{
    const active=categoryNav.current?.querySelector<HTMLButtonElement>("button.active");
    active?.scrollIntoView({behavior:"smooth",block:"nearest",inline:"center"});
  },[activeCategory]);
  const selectCategory=(category:string)=>{
    const currentIndex=categories.indexOf(activeCategory);
    const nextIndex=categories.indexOf(category);
    if(nextIndex!==currentIndex){
      setCategoryMotion(nextIndex>currentIndex?"forward":"backward");
      setCategoryMotionKey(key=>key+1);
    }
    setActiveCategory(category);
    setActiveStatus(null);
    setVisibleLimit(category==="本周排行"?20:60);
  };
  const persistList=(key:string,next:string[],setter:(value:string[])=>void)=>{ setter(next); localStorage.setItem(key,JSON.stringify(next)); };
  const updateHistory=(comicId:string,chapter:number)=>{
    const next={...history,[comicId]:Math.max(1,Math.round(chapter||1))};
    setHistory(next); localStorage.setItem("galaxy:history",JSON.stringify(next));
  };
  const recordWeeklyRead=(comicId:string)=>{
    setWeeklyReads(previous=>{
      const next={...previous,[comicId]:(previous[comicId]||0)+1};
      localStorage.setItem("galaxy:weekly-reads",JSON.stringify({week:localWeekKey(),counts:next} satisfies WeeklyReadState));
      return next;
    });
  };
  const setComicReaction=(comic:Comic,reaction:Reaction)=>{
    const next={...reactions,[comic.id]:reaction};
    const nextFavorites=reaction==="favorite"?[comic.id,...favorites.filter(id=>id!==comic.id)]:favorites.filter(id=>id!==comic.id);
    const dislikeQueue=loadJson<DislikeQueue>("galaxy:dislike-queue",{});
    if(reaction==="disliked") dislikeQueue[comic.id]=catalogUpdatedAt||new Date().toISOString();
    else delete dislikeQueue[comic.id];
    setReactions(next); setFavorites(nextFavorites);
    localStorage.setItem("galaxy:reactions",JSON.stringify(next));
    localStorage.setItem("galaxy:favorites",JSON.stringify(nextFavorites));
    localStorage.setItem("galaxy:dislike-queue",JSON.stringify(dislikeQueue));
    setToast(reaction==="favorite"?"已收藏，将优先检查更新":reaction==="disliked"?"已标记讨厌，今晚更新后移出推荐":"已恢复为不收藏");
  };
  const restoreComic=(id:string)=>persistList("galaxy:blocked",blocked.filter(item=>item!==id),setBlocked);
  const toggleMembership=(sourceName:string)=>{
    const next=memberships.includes(sourceName)?memberships.filter(name=>name!==sourceName):[sourceName,...memberships];
    persistList("galaxy:memberships",next,setMemberships);
    setToast(next.includes(sourceName)?`${sourceName} 登录或购买状态已记住`:`${sourceName} 状态已恢复为未登录`);
  };
  const importFiles=async(comicId:string,files:File[])=>{
    if(!files.length) return;
    try{
      const saved=await Promise.all(files.map(file=>saveOfflinePack(comicId,file)));
      setOfflinePacks(previous=>[...saved,...previous]);
      setToast(`已缓存 ${saved.length} 个正文文件到本机`);
    }catch{ setToast("本机存储空间不足或浏览器不支持"); }
  };
  const deletePack=async(id:string)=>{
    await removeOfflinePack(id); setOfflinePacks(items=>items.filter(item=>item.id!==id)); setToast("已删除本地正文");
  };
  const refreshBaiduStatus=async()=>{
    const response=await fetch(`/api/baidu/status?t=${Date.now()}`,{cache:"no-store"}); const status=await response.json(); setBaiduStatus(status); return status as BaiduStatus;
  };
  const loadBaiduFiles=async(directory:string)=>{
    const dir=directory.trim()||"/"; localStorage.setItem("galaxy:baidu-dir",dir);
    const response=await fetch(`/api/baidu/files?dir=${encodeURIComponent(dir)}&t=${Date.now()}`,{cache:"no-store"}); const data=await response.json();
    if(!response.ok){setToast(data.error||"读取百度网盘失败");return undefined;}
    setBaiduFiles(data.items||[]); localStorage.setItem("galaxy:baidu-files",JSON.stringify(data.items||[]));
    const stats=data.stats as BaiduScanStats|undefined;
    if(stats){
      const suffix=stats.truncated?"，已到扫描上限":"";
      setToast(`已递归扫描 ${stats.files} 个漫画文件、${stats.folders} 个子文件夹${suffix}`);
    }else setToast(`已读取 ${(data.items||[]).filter((item:BaiduFile)=>!item.isdir).length} 个漫画文件`);
    return stats;
  };
  const openPack=async(pack:OfflinePack)=>{
    await openOfflinePack(pack.id);
    if(pack.comicId!=="unassigned"){updateHistory(pack.comicId,history[pack.comicId]||1);recordWeeklyRead(pack.comicId);}
  };
  const selectComicSource=(comic:Comic,sourceName:string)=>{
    const next={...selectedSources,[comic.id]:sourceName};
    setSelectedSources(next); localStorage.setItem("galaxy:selected-sources",JSON.stringify(next));
    setToast(`${comic.title} 已切换到 ${sourceName}`);
  };
  const openPreferred=(comic:Comic,sourceOverride?:ComicSource)=>{
    const offline=offlinePacks.find(pack=>pack.comicId===comic.id);
    if(offline){ void openPack(offline); return; }
    const cloud=matchingBaiduFile(comic,baiduFiles);
    if(cloud){updateHistory(comic.id,history[comic.id]||1);recordWeeklyRead(comic.id);window.open(`/api/baidu/download?fs_id=${encodeURIComponent(cloud.fs_id)}`,"_blank","noopener,noreferrer");return;}
    const preferred=sourceOverride||comic.sources.find(source=>source.name===selectedSources[comic.id])||orderedSources(comic,accessPolicies,memberships).find(source=>sourceTier(source,accessPolicies,memberships)!=="risk");
    if(!preferred){ setToast("没有通过安全检查的可用来源"); return; }
    if(!comic.catalogOnly){updateHistory(comic.id,history[comic.id]||1);recordWeeklyRead(comic.id);}
    else setToast("该作品尚未核验到正版正文，先打开真实资料页");
    window.open(resolvedSourceUrl(comic,preferred,titleStatus),"_blank","noopener,noreferrer");
  };
  const enter=()=>{ localStorage.setItem("galaxy:session","active"); localStorage.setItem("galaxy:session-expiry",String(Date.now()+SESSION_MS)); setLocked(false); };
  const lock=()=>{ localStorage.removeItem("galaxy:session"); localStorage.removeItem("galaxy:session-expiry"); setLocked(true); };

  const visibleComics=useMemo(()=>catalog.filter(comic=>{
    if(blocked.includes(comic.id)) return false;
    const q=query.trim().toLowerCase();
    if(q&&!([comic.title,comic.subtitle,comic.author,...comic.genre].join(" ").toLowerCase().includes(q))) return false;
    if(tab==="favorites"&&!favorites.includes(comic.id)) return false;
    if(activeStatus&&!comicHasStatus(comic,activeStatus,accessPolicies,memberships,offlinePacks.some(pack=>pack.comicId===comic.id),Boolean(matchingBaiduFile(comic,baiduFiles)))) return false;
    if(activeCategory==="全部"||activeCategory==="本周排行") return true;
    if(activeCategory==="彩漫") return comic.color==="color";
    if(["日漫","韩漫","美漫"].includes(activeCategory)) return comic.region===activeCategory;
    return comic.genre.includes(activeCategory);
  }).sort((a,b)=>{
    const aTier=comicTier(a,accessPolicies,memberships,offlinePacks.some(pack=>pack.comicId===a.id),Boolean(matchingBaiduFile(a,baiduFiles)));
    const bTier=comicTier(b,accessPolicies,memberships,offlinePacks.some(pack=>pack.comicId===b.id),Boolean(matchingBaiduFile(b,baiduFiles)));
    if(activeCategory==="本周排行"||activeStatus){
      const reads=(weeklyReads[b.id]||0)-(weeklyReads[a.id]||0);
      if(reads) return reads;
    }
    if(activeCategory==="本周排行"){
      const readable=displayRank[aTier]-displayRank[bTier];
      if(readable) return readable;
      return (a.popularityRank||Number.MAX_SAFE_INTEGER)-(b.popularityRank||Number.MAX_SAFE_INTEGER);
    }
    return displayRank[aTier]-displayRank[bTier];
  }),[accessPolicies,activeCategory,activeStatus,baiduFiles,blocked,catalog,favorites,memberships,offlinePacks,query,tab,weeklyReads]);
  const weeklyBoards=useMemo<WeeklyBoard[]>(()=>{
    const base=catalog.filter(comic=>{
      if(blocked.includes(comic.id)) return false;
      const q=query.trim().toLowerCase();
      if(q&&!([comic.title,comic.subtitle,comic.author,...comic.genre].join(" ").toLowerCase().includes(q))) return false;
      if(tab==="favorites"&&!favorites.includes(comic.id)) return false;
      return true;
    });
    const compare=(a:Comic,b:Comic)=>{
      const reads=(weeklyReads[b.id]||0)-(weeklyReads[a.id]||0);
      if(reads) return reads;
      const aTier=comicTier(a,accessPolicies,memberships,offlinePacks.some(pack=>pack.comicId===a.id),Boolean(matchingBaiduFile(a,baiduFiles)));
      const bTier=comicTier(b,accessPolicies,memberships,offlinePacks.some(pack=>pack.comicId===b.id),Boolean(matchingBaiduFile(b,baiduFiles)));
      const readability=displayRank[aTier]-displayRank[bTier];
      if(readability) return readability;
      return (a.popularityRank||Number.MAX_SAFE_INTEGER)-(b.popularityRank||Number.MAX_SAFE_INTEGER);
    };
    const top=(status?:StatusFilter)=>base
      .filter(comic=>!status||comicHasStatus(comic,status,accessPolicies,memberships,offlinePacks.some(pack=>pack.comicId===comic.id),Boolean(matchingBaiduFile(comic,baiduFiles))))
      .sort(compare)
      .slice(0,20);
    return [
      {key:"overall",title:"总榜",subtitle:"全部观看方式 · TOP 20",comics:top()},
      ...statusFilters.map(status=>({key:status,title:`${displayLabels[status]}榜`,subtitle:`${displayLabels[status]} · TOP 20`,comics:top(status)}))
    ];
  },[accessPolicies,baiduFiles,blocked,catalog,favorites,memberships,offlinePacks,query,tab,weeklyReads]);
  const shownComics=visibleComics.slice(0,visibleLimit);
  const sectionTitle=activeStatus?displayLabels[activeStatus]:tab==="favorites"?"我的收藏":query?`“${query}”`:"漫游推荐";

  const heroComic=useMemo(()=>{
    const lastRead=Object.entries(history).sort((a,b)=>b[1]-a[1]).map(([id])=>catalog.find(item=>item.id===id)).find(Boolean);
    return lastRead||catalog[0]||null;
  },[catalog,history]);

  if(locked) return <LockScreen onEnter={enter}/>;

  return <main className="app-shell">
    <div className="sky-orb sky-orb-a"/><div className="sky-orb sky-orb-b"/>
    <header className="topbar">
      <button className="brand-button" onClick={()=>setTab("home")}><span className="brand-mark"><img src="/app-icon-192.png" alt="" aria-hidden="true"/></span><span><small>GALAXY MANGA SEA</small><strong>银河X漫海</strong></span></button>
      <div className="top-actions"><button className="glass-icon" aria-label="搜索" onClick={()=>setSearchOpen(value=>!value)}><Search size={19}/></button><button className="avatar" aria-label="账户" onClick={()=>setTab("profile")}>L</button></div>
    </header>
    {searchOpen&&<label className="searchbar"><Search size={17}/><input autoFocus value={query} onChange={event=>setQuery(event.target.value)} placeholder="搜作品、作者或题材"/>{query&&<button onClick={()=>setQuery("")} aria-label="清空"><X size={16}/></button>}</label>}

    {tab==="profile"
      ? <Profile favorites={favorites.length} blocked={blocked} catalog={catalog} sources={sources.length} packs={offlinePacks} policies={accessPolicies} memberships={memberships} baiduStatus={baiduStatus} baiduFiles={baiduFiles} onRefreshBaidu={refreshBaiduStatus} onLoadBaidu={loadBaiduFiles} onBaiduFilesChange={files=>{setBaiduFiles(files);localStorage.setItem("galaxy:baidu-files",JSON.stringify(files));}} onToggleMembership={toggleMembership} onImport={files=>importFiles("unassigned",files)} onDelete={deletePack} onOpen={openPack} onRestore={restoreComic} onLock={lock}/>
      : tab==="sources"
        ? <SourceDirectory sources={sources} policies={accessPolicies} memberships={memberships}/>
        : <>
          <section className="trust-strip"><span><ShieldCheck size={17}/></span><div><strong>真实封面 · 正文不伪造</strong><small>{catalogMeta.curatedCount} 部人工核验来源 · {catalogMeta.networkCount} 部真实网络目录 · {syncMessage}</small></div><em>{catalogMeta.count||catalog.length} 部</em></section>
          <div className="status-legend" aria-label="按观看状态筛选">{statusFilters.map(status=><button className={`status-chip ${status} ${activeStatus===status?"active":""}`} key={status} aria-pressed={activeStatus===status} onClick={()=>{setActiveStatus(current=>current===status?null:status);setActiveCategory("全部");setVisibleLimit(60);}}><StatusIcon status={status}/><span>{displayLabels[status]}</span></button>)}</div>
          {tab==="home"&&heroComic&&!query&&!activeStatus&&activeCategory!=="本周排行"&&<HeroPoster comic={heroComic} chapter={history[heroComic.id]||1} hasHistory={Boolean(history[heroComic.id])} statuses={comicStatuses(heroComic,accessPolicies,memberships,offlinePacks.some(pack=>pack.comicId===heroComic.id),Boolean(matchingBaiduFile(heroComic,baiduFiles)))} onOpen={()=>setSelected(heroComic)} onRead={()=>openPreferred(heroComic)}/>} 
          <div className="category-swipe-surface">
          <nav ref={categoryNav} className="category-scroller" aria-label="漫画分类">{categories.map(category=><button key={category} className={activeCategory===category&&!activeStatus?"active":""} onClick={()=>selectCategory(category)}>{category==="本周排行"&&<Trophy size={13}/>} {category}</button>)}</nav>
          <div key={categoryMotionKey} className={`category-page ${categoryMotion}`}>
          {activeCategory==="本周排行"?<>
            <div className="section-heading weekly-heading"><div><p>WEEKLY READING</p><h2>本周排行</h2></div><span>本机实际阅读 · 每周一重置</span></div>
            {catalog.length===0?<section className="loading-grid">{Array.from({length:8}).map((_,index)=><i key={index}/>)}</section>:<WeeklyRankings boards={weeklyBoards} weeklyReads={weeklyReads} reactions={reactions} history={history} policies={accessPolicies} memberships={memberships} selectedSources={selectedSources} getStatuses={comic=>selectedComicStatuses(comic,selectedSources[comic.id],accessPolicies,memberships,offlinePacks.some(pack=>pack.comicId===comic.id),Boolean(matchingBaiduFile(comic,baiduFiles)))} onOpen={openPreferred} onSelectSource={selectComicSource} onDetails={setSelected} onReaction={setComicReaction}/>} 
          </>:<>
            <div className="section-heading"><div><p>{activeStatus?"ACCESS COLLECTION":tab==="favorites"?"MY COLLECTION":query?"SEARCH RESULTS":"POSTER GALLERY"}</p><h2>{sectionTitle}</h2></div><span>{visibleComics.length} 部</span></div>
            {catalog.length===0?<section className="loading-grid">{Array.from({length:8}).map((_,index)=><i key={index}/>)}</section>:<section className="cover-grid">{shownComics.map((comic,index)=><ComicCard key={comic.id} comic={comic} reaction={reactions[comic.id]||"neutral"} chapter={history[comic.id]} statuses={selectedComicStatuses(comic,selectedSources[comic.id],accessPolicies,memberships,offlinePacks.some(pack=>pack.comicId===comic.id),Boolean(matchingBaiduFile(comic,baiduFiles)))} policies={accessPolicies} memberships={memberships} sources={orderedSources(comic,accessPolicies,memberships)} selectedSource={selectedSources[comic.id]} weeklyReads={weeklyReads[comic.id]||0} priority={index<4} onOpen={source=>openPreferred(comic,source)} onSelectSource={source=>selectComicSource(comic,source.name)} onDetails={()=>setSelected(comic)} onFavorite={()=>setComicReaction(comic,reactions[comic.id]==="favorite"?"neutral":"favorite")} onBlock={()=>setComicReaction(comic,reactions[comic.id]==="disliked"?"neutral":"disliked")}/>)}{tab==="home"?<InstallPrompt compact/>:<aside className="sky-route" data-count={visibleComics.length} aria-label="今日漫游信息"><span className="sky-route-star"><Star size={15}/></span><p>TODAY&apos;S ROUTE</p><strong>{activeStatus?displayLabels[activeStatus]:activeCategory==="全部"?"随心漫游":activeCategory}</strong><small>01:00 更新</small></aside>}</section>}
            {shownComics.length<visibleComics.length&&<button className="load-more" onClick={()=>setVisibleLimit(limit=>limit+60)}>继续漫游 <small>再显示 60 部 · 共 {visibleComics.length} 部</small></button>}
            {shownComics.length===visibleComics.length&&visibleComics.length>0&&<div className="bottom-rebound" aria-label="已到当前目录末尾"><span>已到当前目录末尾</span><small>页面会自然回弹 · 目录共 {catalogMeta.count||catalog.length} 部</small></div>}
          </>}
          {catalog.length>0&&!visibleComics.length&&<section className="empty-state"><Compass size={38}/><h2>换个方向漫游</h2><p>当前分类没有可展示的作品。</p></section>}
          </div>
          </div>
        </>}

    <nav className="bottom-nav" aria-label="主导航">
      <NavButton active={tab==="home"} label="首页" onClick={()=>setTab("home")}><HomeIcon/></NavButton>
      <NavButton active={tab==="sources"} label="来源" onClick={()=>setTab("sources")}><Compass/></NavButton>
      <NavButton active={tab==="favorites"} label="收藏" onClick={()=>setTab("favorites")}><Heart/></NavButton>
      <NavButton active={tab==="profile"} label="我的" onClick={()=>setTab("profile")}><UserRound/></NavButton>
    </nav>

    {selected&&<DetailSheet comic={selected} allComics={catalog} favorite={favorites.includes(selected.id)} historyChapter={history[selected.id]} packs={offlinePacks.filter(pack=>pack.comicId===selected.id)} baiduFile={matchingBaiduFile(selected,baiduFiles)} policies={accessPolicies} memberships={memberships} titleStatus={titleStatus} onClose={()=>setSelected(null)} onRead={()=>openPreferred(selected)} onChapters={()=>{setReader(selected);setSelected(null);}} onFavorite={()=>setComicReaction(selected,reactions[selected.id]==="favorite"?"neutral":"favorite")} onBlock={()=>setComicReaction(selected,reactions[selected.id]==="disliked"?"neutral":"disliked")} onImport={files=>importFiles(selected.id,files)} onOpenPack={openPack} onToggleMembership={toggleMembership} onSelect={setSelected}/>} 
    {reader&&<ChapterPicker comic={reader} historyChapter={history[reader.id]} packs={offlinePacks.filter(pack=>pack.comicId===reader.id)} policies={accessPolicies} memberships={memberships} titleStatus={titleStatus} onClose={()=>setReader(null)} onSaveChapter={chapter=>updateHistory(reader.id,chapter)} onOpenPack={openPack}/>} 
    {toast&&<div className="toast" role="status"><Check size={15}/>{toast}</div>}
  </main>;
}

function LockScreen({onEnter}:{onEnter:()=>void}){
  const [username,setUsername]=useState("");
  const [password,setPassword]=useState("");
  const [error,setError]=useState("");
  const [submitting,setSubmitting]=useState(false);
  const submit=async(event:FormEvent)=>{
    event.preventDefault(); setSubmitting(true);
    const salted="mangaverse:v1:"+password;
    let matches=false;
    if(globalThis.crypto?.subtle){
      const digest=await globalThis.crypto.subtle.digest("SHA-256",new TextEncoder().encode(salted));
      const hash=Array.from(new Uint8Array(digest)).map(value=>value.toString(16).padStart(2,"0")).join("");
      matches=hash===LOGIN_HASH;
    }else matches=localLockHash(salted)===LOGIN_FALLBACK_HASH;
    if(username==="admin"&&matches){ setError(""); onEnter(); } else { setError("账号或密码错误"); setPassword(""); }
    setSubmitting(false);
  };
  return <main className="lock-screen">
    <div className="cloud cloud-a"/><div className="cloud cloud-b"/>
    <div className="lock-logo"><img src="/app-icon-512.png" alt="银河X漫海图标"/></div>
    <p className="eyebrow">PRIVATE MOBILE LIBRARY</p><h1>清爽地，进入漫画世界</h1><p className="lock-note">为手机优化 · 登录状态保留 30 天</p>
    <form className="login-form" onSubmit={submit}>
      <label><span>账号</span><input value={username} onChange={event=>setUsername(event.target.value)} autoComplete="username" enterKeyHint="next" placeholder="请输入账号"/></label>
      <label><span>密码</span><input value={password} onChange={event=>setPassword(event.target.value)} autoComplete="current-password" type="password" enterKeyHint="go" placeholder="请输入密码"/></label>
      {error&&<p role="alert">{error}</p>}<button className="primary-button" disabled={submitting}><LockKeyhole size={17}/>{submitting?"验证中…":"进入银河X漫海"}</button>
    </form><small className="security-note"><ShieldCheck size={13}/>仅允许指定管理员账号登录</small>
  </main>;
}

function NavButton({active,label,onClick,children}:{active:boolean;label:string;onClick:()=>void;children:React.ReactNode}){
  return <button className={active?"active":""} onClick={onClick}>{children}<small>{label}</small></button>;
}

function InstallPrompt({compact=false}:{compact?:boolean}){
  const [showSteps,setShowSteps]=useState(false);
  return <section className={`install-prompt ${compact?"compact":""}`}>
    <span className="install-icon"><img src="/app-icon-192.png" alt="" aria-hidden="true"/></span>
    <div><p>MOBILE APP</p><strong>安装到手机</strong><small>全屏打开 · 保留登录与阅读记录</small></div>
    {!compact&&<button aria-label={showSteps?"收起安装方法":"查看安装方法"} title={showSteps?"收起":"安装方法"} onClick={()=>setShowSteps(value=>!value)}><Smartphone size={15}/><span>{showSteps?"收起":"安装方法"}</span></button>}
    {!compact&&showSteps&&<ol><li><Share2 size={14}/><span>在 Safari 底部点“分享”</span></li><li><span className="install-plus">＋</span><span>选择“添加到主屏幕”</span></li><li><Check size={14}/><span>右上角点“添加”即可</span></li></ol>}
  </section>;
}

function StatusIcon({status}:{status:DisplayTier}){
  if(status==="risk") return <AlertTriangle size={12}/>;
  if(status==="direct") return <Check size={12}/>;
  if(status==="login") return <UserRound size={12}/>;
  if(status==="paid") return <LockKeyhole size={12}/>;
  if(status==="member") return <Bookmark size={12}/>;
  if(status==="netdisk") return <CloudDownload size={12}/>;
  if(status==="catalog") return <BookOpen size={12}/>;
  return <Compass size={12}/>;
}

function StatusBadges({statuses,compact=false}:{statuses:DisplayTier[];compact?:boolean}){
  return <span className={compact?"status-badges compact":"status-badges"}>{statuses.slice(0,3).map(status=><span className={`access-badge ${status}`} key={status}><StatusIcon status={status}/>{displayLabels[status]}</span>)}</span>;
}

function HeroPoster({comic,chapter,hasHistory,statuses,onOpen,onRead}:{comic:Comic;chapter:number;hasHistory:boolean;statuses:DisplayTier[];onOpen:()=>void;onRead:()=>void}){
  return <section className="hero-poster" onClick={onOpen}>
    <img src={comic.cover} alt={comic.title+"真实出版封面"} referrerPolicy="no-referrer" onLoad={handleCoverLoad} onError={handleCoverError}/><span className="hero-wash"/>
    <div className="hero-copy"><p>{hasHistory?"CONTINUE READING":comic.catalogOnly?"REAL CATALOG":"START HERE"}</p><h2>{comic.title}</h2><span>{comic.catalogOnly?"真实作品资料":hasHistory?`继续第 ${chapter} 话`:"从第 1 话开始"}</span><span className="hero-statuses">{statuses.map(status=><em className={`access-pill ${status}`} key={status}>{displayLabels[status]}</em>)}</span></div>
    <button onClick={event=>{event.stopPropagation();onRead();}}><BookOpen size={18}/></button>
  </section>;
}

function SourcePicker({comic,sources,policies,memberships,selectedSource,onSelect}:{comic:Comic;sources:ComicSource[];policies:Record<string,SourcePolicy>;memberships:string[];selectedSource?:string;onSelect:(source:ComicSource)=>void}){
  const [open,setOpen]=useState(false);
  const pickerRef=useRef<HTMLDivElement>(null);
  const selected=sources.find(source=>source.name===selectedSource)||sources[0];
  useEffect(()=>{
    if(!open)return;
    const close=(event:PointerEvent)=>{if(!pickerRef.current?.contains(event.target as Node))setOpen(false);};
    const closeWithEscape=(event:KeyboardEvent)=>{if(event.key==="Escape")setOpen(false);};
    document.addEventListener("pointerdown",close);
    document.addEventListener("keydown",closeWithEscape);
    return()=>{document.removeEventListener("pointerdown",close);document.removeEventListener("keydown",closeWithEscape);};
  },[open]);
  if(!selected) return null;
  return <div ref={pickerRef} className={`source-picker ${open?"open":""}`} title="切换阅读平台" onClick={event=>event.stopPropagation()}>
    <button className="source-picker-trigger" type="button" aria-label={`${comic.title}阅读平台`} aria-haspopup="listbox" aria-expanded={open} onClick={()=>setOpen(value=>!value)}>
      <span className="source-site-name">{selected.name}</span><ChevronDown className="source-picker-chevron" size={13}/>
    </button>
    {open&&<div className="source-picker-menu" role="listbox" aria-label={`${comic.title}可用阅读平台`}>
      {sources.map(source=>{const active=source.name===selected.name;return <button type="button" role="option" aria-selected={active} className={active?"active":""} key={source.name} onClick={()=>{onSelect(source);setOpen(false);}}><strong>{source.name}</strong></button>;})}
    </div>}
  </div>;
}

function ReactionButtons({reaction,onFavorite,onBlock}:{reaction:Reaction;onFavorite:()=>void;onBlock:()=>void}){
  return <span className="reaction-buttons" aria-label="调整推荐偏好">
    <button className={reaction==="favorite"?"active favorite":""} onClick={onFavorite} aria-label="收藏" title="收藏"><Heart size={17} fill={reaction==="favorite"?"currentColor":"none"}/></button>
    <button className={reaction==="disliked"?"active disliked":""} onClick={onBlock} aria-label="讨厌，今晚更新后删除" title="讨厌，今晚更新后删除"><HeartOff size={17} fill={reaction==="disliked"?"currentColor":"none"}/></button>
  </span>;
}

function ComicCard({comic,reaction,chapter,statuses,policies={},memberships=[],sources,selectedSource,rank,weeklyReads,priority,onOpen,onSelectSource,onDetails,onFavorite,onBlock}:{comic:Comic;reaction:Reaction;chapter?:number;statuses:DisplayTier[];policies?:Record<string,SourcePolicy>;memberships?:string[];sources:ComicSource[];selectedSource?:string;rank?:number;weeklyReads:number;priority:boolean;onOpen:(source?:ComicSource)=>void;onSelectSource:(source:ComicSource)=>void;onDetails:()=>void;onFavorite:()=>void;onBlock:()=>void}){
  return <article className="comic-card">
    <div className="poster-stage"><button className="poster-card" onClick={()=>onOpen(sources.find(source=>source.name===selectedSource)||sources[0])} aria-label={`打开${comic.title}`}>
      <img src={comic.cover} alt={comic.title+"真实漫画封面"} loading={priority?"eager":"lazy"} referrerPolicy="no-referrer" onLoad={handleCoverLoad} onError={handleCoverError}/>
      <span className="poster-gloss"/><span className="poster-bottom"/>
      <span className="chapter-badge">{comic.catalogOnly?"真实资料":chapter?`续读 ${chapter} 话`:"第 1 话"}</span>
    </button><SourcePicker comic={comic} sources={sources} policies={policies} memberships={memberships} selectedSource={selectedSource} onSelect={onSelectSource}/></div>
    <span className="card-status-row">{rank&&<span className={`rank-badge rank-${rank}`}>{rank<=3?<Trophy size={11}/>:null}<b>#{rank}</b></span>}<StatusBadges statuses={statuses} compact/></span>
    <div className="card-caption"><button className="caption-details" onClick={onDetails}><strong>{comic.title}</strong><small>{rank?`本周打开阅读 ${weeklyReads} 次`:comic.catalogOnly?"真实网络目录 · 正文待核验":comic.latest?`更新至 ${comic.latest} 话`:"章节以官方目录为准"}</small></button><ReactionButtons reaction={reaction} onFavorite={onFavorite} onBlock={onBlock}/></div>
  </article>;
}

function WeeklyRankings({boards,weeklyReads,reactions,history,policies,memberships,selectedSources,getStatuses,onOpen,onSelectSource,onDetails,onReaction}:{boards:WeeklyBoard[];weeklyReads:Record<string,number>;reactions:Record<string,Reaction>;history:HistoryMap;policies:Record<string,SourcePolicy>;memberships:string[];selectedSources:Record<string,string>;getStatuses:(comic:Comic)=>DisplayTier[];onOpen:(comic:Comic,source?:ComicSource)=>void;onSelectSource:(comic:Comic,sourceName:string)=>void;onDetails:(comic:Comic)=>void;onReaction:(comic:Comic,reaction:Reaction)=>void}){
  return <section className="weekly-rankings">{boards.map((board,boardIndex)=><section className="weekly-board" key={board.key}>
    <header><div><p>{board.subtitle}</p><h3>{board.title}</h3></div><span>{board.comics.length?"左右滑动查看":"暂无真实记录"}</span></header>
    {board.comics.length?<div className="weekly-rail">{board.comics.map((comic,index)=><ComicCard key={`${board.key}-${comic.id}`} comic={comic} reaction={reactions[comic.id]||"neutral"} chapter={history[comic.id]} statuses={getStatuses(comic)} policies={policies} memberships={memberships} sources={orderedSources(comic,policies,memberships)} selectedSource={selectedSources[comic.id]} rank={index+1} weeklyReads={weeklyReads[comic.id]||0} priority={boardIndex===0&&index<4} onOpen={source=>onOpen(comic,source)} onSelectSource={source=>onSelectSource(comic,source.name)} onDetails={()=>onDetails(comic)} onFavorite={()=>onReaction(comic,reactions[comic.id]==="favorite"?"neutral":"favorite")} onBlock={()=>onReaction(comic,reactions[comic.id]==="disliked"?"neutral":"disliked")}/>)}</div>:<div className="weekly-empty"><CloudDownload size={18}/><span>{board.key==="netdisk"?"连接百度网盘并匹配漫画文件后生成网盘榜":"本周还没有符合条件的实际阅读记录"}</span></div>}
  </section>)}</section>;
}

function DetailSheet({comic,allComics,favorite,historyChapter,packs,baiduFile,policies,memberships,titleStatus,onClose,onRead,onChapters,onFavorite,onBlock,onImport,onOpenPack,onToggleMembership,onSelect}:{comic:Comic;allComics:Comic[];favorite:boolean;historyChapter?:number;packs:OfflinePack[];baiduFile?:BaiduFile;policies:Record<string,SourcePolicy>;memberships:string[];titleStatus:Record<string,TitleStatus>;onClose:()=>void;onRead:()=>void;onChapters:()=>void;onFavorite:()=>void;onBlock:()=>void;onImport:(files:File[])=>void;onOpenPack:(pack:OfflinePack)=>void;onToggleMembership:(name:string)=>void;onSelect:(comic:Comic)=>void}){
  const inputRef=useRef<HTMLInputElement>(null);
  const similar=allComics.filter(item=>item.id!==comic.id&&item.genre.some(genre=>comic.genre.includes(genre))).slice(0,4);
  const statuses=comicStatuses(comic,policies,memberships,packs.length>0,Boolean(baiduFile));
  const access=comicTier(comic,policies,memberships,packs.length>0,Boolean(baiduFile));
  const sourceGroups:[DisplayTier,string,string][]=[
    ["direct","大陆直接看","可在大陆网络直接打开；已确认会员的平台也归到这里"],
    ["login","登录后看","免费账号登录一次后，软件会记住状态"],
    ["paid","付费后看","需要单章购买或整本购买"],
    ["member","会员看","需要平台订阅或会员权益"],
    ["overseas","域外来源","官方服务区不含中国大陆，最后展示"],
    ["catalog","真实资料页","书名和封面真实，但尚未核验到正版正文入口"],
    ["risk","风险来源","已隔离，不允许作为默认入口"]
  ];
  return <div className="sheet-backdrop" onClick={onClose}><section className="detail-sheet" onClick={event=>event.stopPropagation()}>
    <div className="sheet-handle"/><button className="sheet-close" onClick={onClose}><X size={18}/></button>
    <div className="detail-head"><div className="detail-cover"><img src={comic.cover} alt={comic.title+"真实封面"} referrerPolicy="no-referrer" onLoad={handleCoverLoad} onError={handleCoverError}/></div><div><p>{comic.subtitle}</p><h2>{comic.title}</h2><span>{comic.author}</span><div className="tag-row">{comic.genre.slice(0,3).map(item=><em key={item}>{item}</em>)}</div></div></div>
    <div className="detail-actions"><button className={favorite?"active":""} onClick={onFavorite}><Heart size={17} fill={favorite?"currentColor":"none"}/>{favorite?"已收藏":"收藏"}</button><button onClick={()=>inputRef.current?.click()}><CloudDownload size={17}/>缓存正文</button><button className="danger" onClick={onBlock}><HeartOff size={17}/>今晚移除</button></div>
    <input ref={inputRef} className="hidden-input" type="file" multiple accept=".pdf,.cbz,.zip,image/*" onChange={event=>{onImport(Array.from(event.target.files||[]));event.target.value="";}}/>
    <button className={`read-button access-${access}`} onClick={onRead}><span><BookOpen size={20}/><b>{comic.catalogOnly?"查看真实作品资料":`${statuses.map(item=>displayLabels[item]).join(" · ")} · ${historyChapter?`继续第 ${historyChapter} 话`:"从第 1 话开始"}`}</b></span><ChevronRight size={20}/></button>
    {!comic.catalogOnly&&<button className="chapter-button" onClick={onChapters}>先选择章节 <ChevronRight size={17}/></button>}

    <div className="priority-title"><div><p>READING PRIORITY</p><h3>阅读来源</h3></div><small>自动按可用性排序</small></div>
    <div className="priority-list">
      <div className="priority-group offline"><span className="priority-rank">0</span><div><strong>本机离线正文 · 直接看</strong><small>{packs.length?`${packs.length} 个文件，将作为最高优先级`:"尚未导入 PDF、图片或 CBZ"}</small></div><FolderDown size={18}/></div>
      {packs.map(pack=><button className="pack-inline" key={pack.id} onClick={()=>onOpenPack(pack)}><FileArchive size={16}/><span>{pack.name}<small>{formatSize(pack.size)}</small></span><ChevronRight size={16}/></button>)}
      {baiduFile&&<a className="source-inline baidu-inline" href={`/api/baidu/download?fs_id=${encodeURIComponent(baiduFile.fs_id)}`} target="_blank" rel="noopener noreferrer"><CloudDownload size={16}/><span>百度网盘 · {baiduFile.name}<small>{formatSize(baiduFile.size)} · 已匹配当前作品</small></span><span className="inline-tags"><em className="netdisk">网盘看</em><em className="direct">直接看</em></span><ExternalLink size={16}/></a>}
      {sourceGroups.map(([tier,title,note],groupIndex)=>{
        const groupSources=orderedSources(comic,policies,memberships).filter(source=>sourceTier(source,policies,memberships)===tier);
        if(!groupSources.length)return null;
        return <div className="source-tier-block" key={tier}><div className={`priority-group ${tier}`}><span className="priority-rank">{groupIndex+1}</span><div><strong>{title}</strong><small>{note}</small></div><StatusIcon status={tier}/></div>
          {groupSources.map(source=>{const policy=policies[source.name]; const risky=tier==="risk";const sourceTags=sourceStatuses(source,policies,memberships);const stateful=["login","paid","member"].includes(source.access);return <div className={`source-inline-row ${tier}`} key={source.name}>{risky?<button className="source-inline" disabled><span>{source.name}<small>{policy?.riskReasons?.join("；")||"安全检查未通过"}</small></span><AlertTriangle size={16}/></button>:<a className="source-inline" href={resolvedSourceUrl(comic,source,titleStatus)} target="_blank" rel="noopener noreferrer"><span>{source.name}<small>{source.kind==="catalog"?"真实书名与封面资料；不是漫画正文":policy?.note||"正版平台"}</small></span><span className="inline-tags">{sourceTags.map(tag=><em className={tag} key={tag}>{displayLabels[tag]}</em>)}</span><ExternalLink size={16}/></a>}{stateful&&<button className={`membership-chip ${memberships.includes(source.name)?"active":""}`} onClick={()=>onToggleMembership(source.name)}>{memberships.includes(source.name)?"状态已记住":source.access==="login"?"我已登录":source.access==="paid"?"我已购买":"我有会员"}</button>}</div>})}
        </div>;
      })}
    </div>

    <div className="priority-title"><div><p>YOU MAY ALSO LIKE</p><h3>相似推荐</h3></div><small>优先展示真实封面</small></div>
    <div className="similar-row">{similar.map(item=><button key={item.id} onClick={()=>onSelect(item)}><span className="mini-poster"><img src={item.cover} alt={item.title+"封面"} referrerPolicy="no-referrer" onLoad={handleCoverLoad} onError={handleCoverError}/></span><strong>{item.title}</strong><small>{item.latest?`更新至 ${item.latest} 话`:"官方目录"}</small></button>)}</div>
  </section></div>;
}

function ChapterPicker({comic,historyChapter,packs,policies,memberships,titleStatus,onClose,onSaveChapter,onOpenPack}:{comic:Comic;historyChapter?:number;packs:OfflinePack[];policies:Record<string,SourcePolicy>;memberships:string[];titleStatus:Record<string,TitleStatus>;onClose:()=>void;onSaveChapter:(chapter:number)=>void;onOpenPack:(pack:OfflinePack)=>void}){
  const max=comic.latest||9999;
  const [chapter,setChapter]=useState(historyChapter||1);
  const setSafe=(value:number)=>setChapter(Math.max(1,Math.min(max,Math.round(value||1))));
  const rankedSources=orderedSources(comic,policies,memberships);
  const openSource=(source:ComicSource)=>{ onSaveChapter(chapter); window.open(resolvedSourceUrl(comic,source,titleStatus),"_blank","noopener,noreferrer"); };
  const ranges=useMemo(()=>{
    if(!comic.latest) return [1,Math.max(1,chapter-10),chapter];
    return Array.from(new Set([1,Math.max(1,chapter-20),chapter,Math.max(1,comic.latest-20),comic.latest]));
  },[chapter,comic.latest]);
  return <section className="chapter-picker">
    <header className="reader-bar"><button onClick={onClose}><ArrowLeft size={20}/></button><div><strong>{comic.title}</strong><small>{historyChapter?`上次看到第 ${historyChapter} 话`:"首次阅读默认第 1 话"}</small></div><span><ShieldCheck size={14}/>真实来源</span></header>
    <div className="picker-body">
      <div className="picker-poster"><img src={comic.cover} alt={comic.title+"封面"} referrerPolicy="no-referrer" onLoad={handleCoverLoad} onError={handleCoverError}/><div><p>CHAPTER NAVIGATOR</p><h2>选第几话？</h2><span>{comic.latest?`官方目录标记更新至 ${comic.latest} 话`:"最新话数以官方目录为准"}</span></div></div>
      <div className="chapter-shortcuts">
        <button className={chapter===1?"active":""} onClick={()=>setChapter(1)}>第一话</button>
        {historyChapter&&<button className={chapter===historyChapter?"active":""} onClick={()=>setChapter(historyChapter)}>上次 · {historyChapter}</button>}
        {comic.latest&&<button className={chapter===comic.latest?"active":""} onClick={()=>setChapter(comic.latest||1)}>最新 · {comic.latest}</button>}
      </div>
      <div className="chapter-stepper"><button onClick={()=>setSafe(chapter-1)} disabled={chapter===1}><ChevronLeft size={17}/>上一话</button><label><span>第</span><input type="number" min="1" max={max} value={chapter} onChange={event=>setSafe(Number(event.target.value))}/><span>话</span></label><button onClick={()=>setSafe(chapter+1)} disabled={Boolean(comic.latest&&chapter===comic.latest)}>下一话<ChevronRight size={17}/></button></div>
      <div className="chapter-range">{ranges.map(value=><button className={value===chapter?"active":""} key={value} onClick={()=>setChapter(value)}>第 {value} 话</button>)}</div>
      <button className="remember-button" onClick={()=>{onSaveChapter(chapter);}}><Bookmark size={17}/>记住看到第 {chapter} 话</button>

      <div className="open-order"><div><span>0</span><strong>本机离线正文</strong><small>最高优先</small></div>
        {packs.map(pack=><button key={pack.id} onClick={()=>{onSaveChapter(chapter);onOpenPack(pack);}}><FileArchive size={17}/><span>{pack.name}<small>{formatSize(pack.size)}</small></span><ChevronRight size={17}/></button>)}
        {!packs.length&&<p>暂无正文缓存，可在作品详情中导入。</p>}
      </div>
      {(["direct","login","paid","member","overseas","catalog","risk"] as DisplayTier[]).map((tier,index)=>{const entries=rankedSources.filter(source=>sourceTier(source,policies,memberships)===tier);if(!entries.length)return null;return <div className={`open-order ${tier}`} key={tier}><div><span>{index+1}</span><strong>{displayLabels[tier]}</strong><small>{tier==="risk"?"已隔离":index===0?"默认":"备用"}</small></div>
        {entries.map(source=><button key={source.name} disabled={tier==="risk"} onClick={()=>openSource(source)}><StatusIcon status={tier}/><span>{source.name}<small>{tier==="risk"?"安全检查未通过":`${sourceStatuses(source,policies,memberships).map(status=>displayLabels[status]).join(" · ")} · 选择第 ${chapter} 话`}</small></span>{tier!=="risk"&&<ExternalLink size={17}/>}</button>)}
      </div>})}
      <p className="truth-note">本站不伪造漫画页。官方入口会打开平台目录；实际可读章节、会员状态及地区限制由对应平台决定。</p>
    </div>
  </section>;
}

const recommendedSources=new Set(["WEBTOON","MANGA Plus","GlobalComix","Tapas","BOOK☆WALKER Global","VIZ Shonen Jump","Marvel Unlimited","DC Universe Infinite","Hoopla Digital Comics","Libby / OverDrive"]);

function officialSourceFacts(source:OfficialSource,policy:SourcePolicy|undefined,memberships:string[]){
  const description=`${source.name} ${source.note}`;
  const mainland=source.mainland||policy?.mainland||policy?.tier==="mainland_direct"||policy?.tier==="mainland_member";
  const risk=Boolean(policy?.risk||policy?.removed||policy?.tier==="risk");
  const member=Boolean(policy?.requiresMember||/会员|订阅制|订阅阅读|会员制/.test(description));
  const paid=member||/付费|购买|租阅|商店|漫币|单章|数字版/.test(description);
  const library=/图书馆|借书证|学校/.test(description);
  const free=/免费|公版|自主发布|作者发布|大量免费/.test(description)||library;
  const login=library||/登录|注册/.test(description)||(paid&&!memberships.includes(source.name));
  const remembered=memberships.includes(source.name);
  const reputation=risk?"风险复检中":recommendedSources.has(source.name)?"公开口碑 · 重点推荐":"网络评级 · 未统一";
  const tags=[
    {label:mainland?"大陆直达":"域外网络",kind:mainland?"mainland":"overseas",icon:Wifi},
    ...(remembered?[{label:"状态已记住",kind:"remembered",icon:Check}]:[
      ...(login?[{label:"需登录",kind:"login",icon:UserRound}]:[]),
      ...(member?[{label:"需会员",kind:"member",icon:Bookmark}]:[]),
      ...(paid&&!member?[{label:"需付费",kind:"paid",icon:CircleDollarSign}]:[]),
      ...(!login&&!member&&!paid?[{label:free?"免费内容":"部分免费",kind:"free",icon:Check}]:[])
    ]),
    ...(risk?[{label:"有风险",kind:"risk",icon:AlertTriangle}]:[])
  ];
  return {reputation,tags};
}

function SourceDirectory({sources,policies,memberships}:{sources:OfficialSource[];policies:Record<string,SourcePolicy>;memberships:string[]}){
  const [sourceQuery,setSourceQuery]=useState("");
  const [group,setGroup]=useState("全部");
  const groups=["全部","大陆优先","国际综合","日本漫画","韩国/中国","欧美漫画","欧洲/图书馆"];
  const visible=sources.filter(source=>{
    if(group==="大陆优先"&&!source.mainland) return false;
    if(group!=="全部"&&group!=="大陆优先"&&source.group!==group) return false;
    const q=sourceQuery.trim().toLowerCase();
    return !q||`${source.name}${source.note}`.toLowerCase().includes(q);
  });
  return <section className="source-page"><div className="source-hero"><div><Compass size={24}/><span>OFFICIAL SOURCES</span></div><h2>正版来源导航</h2><p>直观看懂网络、登录、会员、付费要求与公开口碑。网络和风险状态每晚更新，不伪造跨平台分数。</p><strong>{sources.length||100}<small> 个来源</small></strong></div>
    <label className="source-search"><Search size={17}/><input value={sourceQuery} onChange={event=>setSourceQuery(event.target.value)} placeholder="搜索平台名称或类型"/></label>
    <nav className="source-filters">{groups.map(item=><button key={item} className={group===item?"active":""} onClick={()=>setGroup(item)}>{item}</button>)}</nav>
    <div className="source-list">{visible.map(source=>{const facts=officialSourceFacts(source,policies[source.name],memberships);return <a key={source.id} href={source.url} target="_blank" rel="noopener noreferrer"><span className="source-index"><Globe2 size={18}/></span><div className="source-copy"><span className="source-title-row"><strong>{source.name}</strong><span className="source-rating"><Star size={13} fill={recommendedSources.has(source.name)?"currentColor":"none"}/>{facts.reputation}</span></span><small>{source.note}</small><span className="source-feature-row">{facts.tags.map(({label,kind,icon:Icon})=><em className={kind} key={`${source.id}-${kind}`}><Icon size={12}/>{label}</em>)}</span></div><ExternalLink className="source-external" size={18}/></a>})}</div>
    <p className="source-rating-note">“重点推荐”沿用已提供的覆盖面推荐名单；其余来源没有可比较的统一公开分数，因此明确标为“未统一”。实际价格、章节和地区限制以来源网站当日说明为准。</p>
  </section>;
}

function Profile({favorites,blocked,catalog,sources,packs,policies,memberships,baiduStatus,baiduFiles,onRefreshBaidu,onLoadBaidu,onBaiduFilesChange,onToggleMembership,onImport,onDelete,onOpen,onRestore,onLock}:{favorites:number;blocked:string[];catalog:Comic[];sources:number;packs:OfflinePack[];policies:Record<string,SourcePolicy>;memberships:string[];baiduStatus:BaiduStatus;baiduFiles:BaiduFile[];onRefreshBaidu:()=>Promise<BaiduStatus>;onLoadBaidu:(directory:string)=>Promise<BaiduScanStats|undefined>;onBaiduFilesChange:(files:BaiduFile[])=>void;onToggleMembership:(name:string)=>void;onImport:(files:File[])=>void;onDelete:(id:string)=>void;onOpen:(pack:OfflinePack)=>void;onRestore:(id:string)=>void;onLock:()=>void}){
  const inputRef=useRef<HTMLInputElement>(null);
  const accountSources=[...new Map(catalog.flatMap(comic=>comic.sources).filter(source=>["login","paid","member"].includes(source.access)&&!policies[source.name]?.risk).map(source=>[source.name,source])).values()];
  return <section className="profile-page">
    <div className="profile-card"><div className="profile-avatar">L</div><div><p>ADMIN ACCOUNT</p><h2>银河漫游者</h2><span>本机登录有效期 30 天</span></div><ShieldCheck size={20}/></div>
    <div className="profile-stats"><div><strong>{favorites}</strong><span>收藏</span></div><div><strong>{packs.length}</strong><span>正文缓存</span></div><div><strong>{sources}</strong><span>正版来源</span></div></div>
    <BaiduPanel status={baiduStatus} files={baiduFiles} onRefresh={onRefreshBaidu} onLoadFiles={onLoadBaidu} onFilesChange={onBaiduFilesChange}/>
    <div className="profile-heading"><div><p>ACCOUNT & ENTITLEMENT</p><h3>平台登录与购买状态</h3></div><small>一次确认 · 本机记住</small></div>
    <div className="membership-list">{accountSources.map(source=><button key={source.name} className={memberships.includes(source.name)?"active":""} onClick={()=>onToggleMembership(source.name)}><span><strong>{source.name}</strong><small>{memberships.includes(source.name)?"状态已记住，下次点击将直接进入":source.access==="login"?"需要先登录免费账号":source.access==="paid"?"需要购买对应章节或单行本":"需要有效会员"}</small></span><em>{memberships.includes(source.name)?"已记住":displayLabels[source.access==="free"?"direct":source.access]}</em></button>)}</div>
    <p className="membership-note">受浏览器隐私限制，本站不能读取其他平台的登录 Cookie。你成功登录、购买或开通后，在这里确认一次即可保存在本机；下次优先打开该来源。平台自身登录有效期仍由平台决定，网络和风险状态每天 01:00 复检。</p>
    <div className="profile-heading"><div><p>OFFLINE LIBRARY</p><h3>本机漫画正文</h3></div><button onClick={()=>inputRef.current?.click()}><CloudDownload size={15}/>导入</button></div>
    <input className="hidden-input" ref={inputRef} type="file" multiple accept=".pdf,.cbz,.zip,image/*" onChange={(event:ChangeEvent<HTMLInputElement>)=>{onImport(Array.from(event.target.files||[]));event.target.value="";}}/>
    <label className="import-card" onClick={()=>inputRef.current?.click()}><FolderDown size={25}/><span><strong>导入正文文件</strong><small>PDF、CBZ、ZIP 或漫画图片；文件保存在当前设备</small></span><ChevronRight size={18}/></label>
    <div className="offline-list">{packs.map(pack=><div key={pack.id}><button onClick={()=>onOpen(pack)}><FileArchive size={19}/><span><strong>{pack.name}</strong><small>{formatSize(pack.size)} · {pack.comicId==="unassigned"?"未关联作品":catalog.find(item=>item.id===pack.comicId)?.title||"漫画正文"}</small></span></button><button className="delete-pack" onClick={()=>onDelete(pack.id)}><X size={15}/></button></div>)}</div>
    {!packs.length&&<p className="soft-empty">还没有正文缓存。封面会随网页加载，但不会被计为漫画缓存。</p>}
    {blocked.length>0&&<><div className="profile-heading"><div><p>HIDDEN TITLES</p><h3>已屏蔽作品</h3></div></div><div className="blocked-list">{blocked.map(id=><button key={id} onClick={()=>onRestore(id)}><span>{catalog.find(item=>item.id===id)?.title||id}</span><small>恢复展示</small></button>)}</div></>}
    <div className="settings-card"><div><span>真实漫画目录</span><strong>{catalog.length} 部</strong></div><div><span>目录与风险</span><strong>每天 01:00 检查</strong></div><div><span>网络优先级</span><strong>直接 → 登录 → 付费/会员 → 域外</strong></div><div><span>风险来源</span><strong>自动隔离，不作为入口</strong></div></div>
    <button className="logout-button" onClick={onLock}><LogOut size={17}/>退出登录</button>
  </section>;
}

function BaiduPanel({status,files,onRefresh,onLoadFiles,onFilesChange}:{status:BaiduStatus;files:BaiduFile[];onRefresh:()=>Promise<BaiduStatus>;onLoadFiles:(directory:string)=>Promise<BaiduScanStats|undefined>;onFilesChange:(files:BaiduFile[])=>void}){
  const [appKey,setAppKey]=useState("");
  const [appSecret,setAppSecret]=useState("");
  const [directory,setDirectory]=useState("/");
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const fileRailRef=useRef<HTMLDivElement>(null);
  const post=async(url:string,body:Record<string,string>)=>{
    const response=await fetch(url,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)});
    const data=await response.json().catch(()=>({}));
    if(!response.ok)throw new Error(data.error||"操作失败");
    return data;
  };
  const configure=async()=>{
    setBusy(true);setMessage("");
    try{await post("/api/baidu/setup",{appKey,appSecret});setAppSecret("");setMessage("配置已保存，正在前往百度授权");window.location.assign("/api/baidu/start");}catch(error){setMessage(error instanceof Error?error.message:"保存失败");setBusy(false);}
  };
  const disconnect=async()=>{
    setBusy(true);await post("/api/baidu/disconnect",{}).catch(()=>undefined);onFilesChange([]);await onRefresh();setMessage("已断开并清除本机授权");setBusy(false);
  };
  const scanDirectory=async(dir:string)=>{
    const target=dir.trim()||"/";
    setDirectory(target);setBusy(true);setMessage("正在扫描当前目录和全部子文件夹…");
    try{
      const stats=await onLoadFiles(target);
      if(stats){
        const skipped=stats.skippedFolders?`，${stats.skippedFolders} 个目录无法读取`:"";
        const limited=stats.truncated?"；目录较大，本次已到扫描上限":"";
        setMessage(`扫描完成：${stats.files} 个漫画文件，${stats.folders} 个子文件夹${skipped}${limited}`);
      }
    }finally{setBusy(false);}
  };
  const parentDirectory=()=>{
    const current=(directory.trim()||"/").replace(/\/+$/g,"")||"/";
    if(current==="/") return "/";
    const separator=current.lastIndexOf("/");
    return separator<=0?"/":current.slice(0,separator);
  };
  const scrollFiles=(direction:-1|1)=>{
    const rail=fileRailRef.current;
    if(rail) rail.scrollBy({left:direction*Math.max(220,rail.clientWidth*.82),behavior:"smooth"});
  };
  return <section className="baidu-panel">
    <div className="baidu-head"><span className="baidu-logo">度</span><div><p>BAIDU NETDISK</p><h3>百度网盘漫画库</h3><small>{status.connected?`登录状态已记住 · 已找到 ${files.filter(file=>!file.isdir).length} 个漫画文件`:status.configured?"等待百度授权":"尚未配置官方授权"}</small></div><em className={status.connected?"connected":""}>{status.connected?"网盘看":"未连接"}</em></div>
    {!status.connected&&status.redirectUri&&<div className="baidu-callback"><span>OAuth 授权回调地址<small>在百度开放平台填写，必须逐字一致</small></span><code>{status.redirectUri}</code><button aria-label="复制回调地址" title="复制" onClick={()=>navigator.clipboard.writeText(status.redirectUri||"").then(()=>setMessage("回调地址已复制")).catch(()=>setMessage("复制失败，请长按地址复制"))}><Copy size={14}/></button></div>}
    {!status.configured&&<div className="baidu-setup"><p>先在百度网盘开放平台创建个人应用。SecretKey 不写入网页代码，也不要发到聊天中。</p><a href="https://pan.baidu.com/union" target="_blank" rel="noopener noreferrer">打开百度网盘开放平台 <ExternalLink size={14}/></a><label><span>AppKey</span><input value={appKey} onChange={event=>setAppKey(event.target.value)} autoComplete="off" placeholder="在这里输入 AppKey"/></label><label><span>SecretKey</span><input type="password" value={appSecret} onChange={event=>setAppSecret(event.target.value)} autoComplete="off" placeholder="仅保存为安全 Cookie"/></label><button disabled={busy||!appKey||!appSecret} onClick={configure}><ShieldCheck size={16}/>保存安全配置</button></div>}
    {status.configured&&!status.connected&&<div className="baidu-setup"><p>点击后进入百度官方确认页；同意授权后会自动返回本站，不需要复制授权码。</p><button onClick={()=>window.location.assign("/api/baidu/start")}><ExternalLink size={16}/>前往百度官方授权</button><button className="baidu-muted" onClick={disconnect}>清除配置</button></div>}
    {status.connected&&<div className="baidu-browser"><div className="baidu-directory-bar"><button className="baidu-parent" aria-label="返回上一级目录" title="返回上一级" disabled={busy||(directory.trim()||"/")==="/"} onClick={()=>void scanDirectory(parentDirectory())}><ArrowLeft size={16}/></button><span>漫画目录</span><input value={directory} onChange={event=>setDirectory(event.target.value)} placeholder="/漫画" disabled={busy}/><button className="baidu-scan" disabled={busy} onClick={()=>void scanDirectory(directory)}><Search size={15}/>{busy?"扫描中":"扫描"}</button></div><div className="baidu-file-toolbar"><span>{directory.trim()||"/"}<small>{files.length?`显示前 ${Math.min(files.length,60)} 项 · 可左右滑动`:"扫描后在这里显示目录内容"}</small></span><div><button aria-label="向左翻页" title="向左翻页" disabled={!files.length} onClick={()=>scrollFiles(-1)}><ChevronLeft size={16}/></button><button aria-label="向右翻页" title="向右翻页" disabled={!files.length} onClick={()=>scrollFiles(1)}><ChevronRight size={16}/></button></div></div><div className="baidu-file-rail" ref={fileRailRef}>{files.slice(0,60).map(file=>file.isdir?<button className="baidu-file" key={file.fs_id} disabled={busy} onClick={()=>void scanDirectory(file.path)}><FolderDown size={17}/><span>{file.name}<small>打开并扫描全部子文件夹</small></span><ChevronRight size={15}/></button>:<a className="baidu-file" key={file.fs_id} href={"/api/baidu/download?fs_id="+encodeURIComponent(file.fs_id)} target="_blank" rel="noopener noreferrer"><FileArchive size={17}/><span>{file.name}<small>{formatSize(file.size)}</small></span><ExternalLink size={15}/></a>)}</div><button className="baidu-muted" disabled={busy} onClick={disconnect}>断开百度网盘</button><p>横向滑动浏览文件，纵向滑动继续浏览页面；左上角箭头返回上一级。扫描会包含当前目录下的全部子文件夹。</p></div>}
    {message&&<div className="baidu-message">{message}</div>}
  </section>;
}
