"use client";
import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { BookOpen, Compass, Eye, Footprints, Map, MessageCircle, NotebookPen, Pause, Play, RotateCcw, Snowflake, Users, X, ChevronRight } from "lucide-react";
import { useAgentFirst } from "./useAgentFirst";
import { places, door, placeById, type Point } from "./agent-first-map";
import styles from "./agent-first.module.css";

const Canvas = dynamic(()=>import("./MapCanvas"),{ssr:false});
const tools = [{id:"observe",label:"观察",icon:Eye},{id:"ask",label:"询问",icon:MessageCircle},
  {id:"follow",label:"跟随",icon:Footprints},{id:"record",label:"记录",icon:NotebookPen},
  {id:"map",label:"地图",icon:Map},{id:"notebook",label:"案件本",icon:BookOpen}] as const;
type Note = {id:string;text:string};
export default function AgentFirstTown() {
  const town=useAgentFirst(),keys=useRef(new Set<string>());
  const [near,setNear]=useState<string|null>(null),[pose,setPose]=useState<Point>(door("town-square"));
  const [panel,setPanel]=useState<"people"|"notebook"|"map"|null>(null),[tool,setTool]=useState("observe");
  const [indoors,setIndoors]=useState<string|null>(null),[selected,setSelected]=useState<string|null>(null);
  const [running,setRunning]=useState(false),[toast,setToast]=useState(""),[notes,setNotes]=useState<Note[]>([]);
  const [destination,setDestination]=useState<{id:number;point:Point}|null>(null),[following,setFollowing]=useState<string|null>(null);
  const drawer=useRef<HTMLElement>(null),close=useRef<HTMLButtonElement>(null);
  const current=useRef({town,near,indoors,panel,selected,tool});current.current={town,near,indoors,panel,selected,tool};
  const people=town.view?.residents??[],person=people.find(p=>p.id===selected);
  const visible=people.filter(p=>p.visibility==="observed");
  useEffect(()=>{
    if(!town.view)return;
    try{const saved=JSON.parse(localStorage.getItem(`agent-first-notes:${town.view.sessionId}`)??"[]");setNotes(Array.isArray(saved)?saved.filter(n=>n&&typeof n.id==="string"&&typeof n.text==="string").slice(0,50):[]);}catch{setNotes([]);}
  },[town.view?.sessionId]);
  const record=()=>{
    if(!town.view)return;
    const text=person?`${person.name} · ${person.visibility==="observed"?"亲眼见于":"上次见于"}${person.locationName}，第 ${person.day} 日 ${person.time}。`:`第 ${town.view.day} 日 ${town.view.time}，到访${placeById(town.view.sceneId)?.name??"街区"}。`;
    const next=[{id:crypto.randomUUID(),text},...notes].slice(0,50);setNotes(next);
    try{localStorage.setItem(`agent-first-notes:${town.view.sessionId}`,JSON.stringify(next));}catch{/* Device notes remain in memory */}
    setToast("已记入随身笔记");
  };
  const enter=async()=>{
    const c=current.current;
    if(c.panel||c.town.busy||!c.town.view)return;
    if(c.indoors){setIndoors(null);return;}
    if(!c.near)return;
    const target=placeById(c.near);if(!target)return;
    if(await c.town.commit({kind:"arrive",sceneId:target.id})){
      if(target.id!=="town-square")setIndoors(target.id);
      setToast(`已到访${target.name}，手记已保存。`);
    }
  };
  const selectTool=(id:string)=>{
    setTool(id);keys.current.clear();
    if(id==="map"||id==="notebook"){setPanel(id);return;}
    if(id==="record"){record();return;}
    setPanel("people");
    if(!selected&&visible.length)setSelected(visible[0].id);
  };
  const actions=useRef({enter,selectTool});actions.current={enter,selectTool};
  useEffect(()=>{
    const down=(e:KeyboardEvent)=>{
      if(e.altKey||e.ctrlKey||e.metaKey||e.target instanceof HTMLInputElement||e.target instanceof HTMLTextAreaElement)return;
      if(e.code==="Escape"){setPanel(null);keys.current.clear();return;}
      const state=current.current;if(state.panel||!state.town.view)return;
      if(["KeyW","KeyA","KeyS","KeyD","ArrowUp","ArrowDown","ArrowLeft","ArrowRight"].includes(e.code)){e.preventDefault();keys.current.add(e.code);}
      if(e.repeat)return;
      if(e.code==="KeyE")void actions.current.enter();
      const index=Number(e.code.replace("Digit",""))-1;if(index>=0&&index<6)actions.current.selectTool(tools[index].id);
      if(e.code==="KeyM")setPanel("map");if(e.code==="KeyJ")setPanel("notebook");
    };
    const up=(e:KeyboardEvent)=>keys.current.delete(e.code),clear=()=>keys.current.clear();
    window.addEventListener("keydown",down);window.addEventListener("keyup",up);window.addEventListener("blur",clear);document.addEventListener("visibilitychange",clear);
    return()=>{window.removeEventListener("keydown",down);window.removeEventListener("keyup",up);window.removeEventListener("blur",clear);document.removeEventListener("visibilitychange",clear);};
  },[]);
  useEffect(()=>{
    if(!panel)return;keys.current.clear();const before=document.activeElement as HTMLElement|null;close.current?.focus();
    const trap=(e:KeyboardEvent)=>{if(e.key!=="Tab")return;const controls=drawer.current?.querySelectorAll<HTMLElement>("button,a[href]");if(!controls?.length)return;const first=controls[0],last=controls[controls.length-1];if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus();}};
    window.addEventListener("keydown",trap);return()=>{window.removeEventListener("keydown",trap);before?.focus();};
  },[panel]);
  useEffect(()=>{if(!toast)return;const timer=setTimeout(()=>setToast(""),4500);return()=>clearTimeout(timer);},[toast]);
  useEffect(()=>{
    if(!running||panel||indoors||town.busy||town.error||!town.view)return;
    let timer:ReturnType<typeof setTimeout>|undefined;
    const schedule=()=>{clearTimeout(timer);if(!document.hidden)timer=setTimeout(()=>{if(!document.hidden)void current.current.town.commit({kind:"wait",minutes:15});},8000);};
    schedule();document.addEventListener("visibilitychange",schedule);
    return()=>{clearTimeout(timer);document.removeEventListener("visibilitychange",schedule);};
  },[running,panel,indoors,town.busy,town.error,town.view]);
  useEffect(()=>{
    if(!following)return;const p=people.find(p=>p.id===following);
    if(!p||p.visibility!=="observed"){setFollowing(null);setToast("他已离开视野。地图保留最后一次目击。");return;}
    if(placeById(p.sceneId??""))setDestination({id:Date.now(),point:{x:door(p.sceneId!).x+36,y:door(p.sceneId!).y}});
  },[town.view?.worldRevision,following]);
  const jump=(id:string)=>{setDestination({id:Date.now(),point:door(id)});setPanel(null);setIndoors(null);setToast("路线已标好，到门前按 E 到访。");};
  return <main id="detective-town-main" className={styles.shell} lang="zh-CN" data-agent-first="true" data-world-revision={town.view?.worldRevision} data-source-ref={town.view?.sourceRef}>
    <header className={styles.header}>
      <a href="/" className={styles.wordmark}><Compass size={23}/><span>河湾手记<small>THE RIVERBEND CHRONICLE</small></span></a>
      <div className={styles.clock}><span>第 {town.view?.day??1} 日</span><strong>{town.view?.time??"08:00"}</strong><i/><Snowflake size={15}/><span>初冬</span></div>
      <div className={styles.headerActions}><button onClick={()=>setPanel("people")} aria-label="人物观察"><Users size={18}/><span>街坊</span></button><button onClick={()=>setPanel("notebook")} aria-label="打开案件本"><BookOpen size={18}/><span>手记</span></button></div>
    </header>
    <section className={styles.stage} aria-label="小镇探索">
      <Canvas view={town.view} paused={!!panel||town.busy||!!town.error||!town.view} overview={panel==="map"} indoors={indoors} keys={keys} restore={town.restore} destination={destination}
        onPose={(p,n)=>{setPose(p);setNear(n);}} onPerson={id=>{setSelected(id);setPanel("people");}}/>
      <div className={styles.chapter}><span>第一册 / 河桥的早晨</span><h1>小镇有自己的日常。</h1><p>{indoors?placeById(indoors)?.hint:"沿街走走，到旧书店看看今日的来客。"}</p></div>
      <div className={styles.location}><i/>{indoors?placeById(indoors)?.name:placeById(town.view?.sceneId??"")?.name??"河湾广场"}<span>{indoors?"室内":"街区探索"}</span></div>
      <div className={styles.worldControl}><button onClick={()=>setRunning(v=>!v)} aria-label={running?"暂停世界":"继续世界"}>{running?<Pause size={15}/>:<Play size={15}/>}<span>{running?"日常运行中":"世界已暂停"}</span></button><button disabled={town.busy||!town.view||!!panel||!!town.error} onClick={()=>void town.commit({kind:"wait",minutes:15})}>等一刻钟</button></div>
      {town.view&&<div className={styles.context}>
        <p>{indoors?"物件与人物的观察会留在手记里。":near?placeById(near)?.hint:"点击地面寻路 · WASD 移动"}</p>
        {(near||indoors)&&<button disabled={town.busy||!!town.error||!!panel} onClick={()=>void enter()} data-enter-place={near}><kbd>E</kbd>{indoors?"回到街道":near==="town-square"?"观察广场":`到访${placeById(near??"")?.name}`}<ChevronRight size={16}/></button>}
      </div>}
      {town.busy&&town.view&&<span className={styles.saving} role="status">正在确认行动…</span>}
      {toast&&<div className={styles.toast} role="status">{toast}</div>}
      {!town.view&&<div className={styles.start}><span>一座小镇，一段尚未写完的故事</span><h2>早安，侦探。</h2><p>居民照着自己的日程生活。<br/>先认识这里的人，再听他们讲述这个早晨。</p><button onClick={()=>void town.start()} disabled={!town.loaded||town.busy}>{town.busy||!town.loaded?"正在打开手记…":"开始河湾手记"}<ChevronRight size={17}/></button><small>随时离开，下次从上次到访处继续。</small></div>}
      {town.error&&<div className={styles.error} role="alert"><span>{town.error}</span><button onClick={()=>{setRunning(false);void town.reload();}}><RotateCcw size={14}/>{town.pending?"重连并确认行动":"重新连接"}</button></div>}
      {panel&&<div className={styles.scrim} onClick={e=>{if(e.target===e.currentTarget)setPanel(null);}}>
        <aside ref={drawer} className={styles.drawer} role="dialog" aria-modal="true" aria-labelledby="agent-drawer-title">
          <button ref={close} className={styles.close} onClick={()=>setPanel(null)} aria-label="返回小镇"><X size={19}/></button>
          <span className={styles.eyebrow}>THE FIELD NOTES</span><h2 id="agent-drawer-title">{panel==="map"?"河湾街区":panel==="people"?"街坊与目击":"侦探的手记"}</h2>
          {panel==="map"?<><p>选一处地点，沿路走到门前。到访与等待会推进世界时间。</p>{places.map(place=><button className={styles.place} onClick={()=>jump(place.id)} key={place.id}><span><strong>{place.name}</strong><small>{place.hint}</small></span><ChevronRight size={16}/></button>)}</>:
          panel==="people"?<><p>{visible.length} 位居民在你面前。其他记录仅代表上次目击。</p>
            {!people.length&&<p>到咖啡馆或旅馆走走，认识第一位街坊。</p>}
            <div className={styles.people}>{people.map((p,i)=><button key={p.id} onClick={()=>setSelected(p.id)} aria-pressed={p.id===selected}><i style={{background: ["#936650","#657f6f","#81809a"][i%3]}}>{p.name.slice(-1)}</i><span><strong>{p.name}</strong><small>{p.role}</small></span><b>{p.visibility==="observed"?"在场":"曾见"}</b></button>)}</div>
            {person&&<article className={styles.person}><span>{person.visibility==="observed"?"亲眼所见":"最后目击"}</span><h3>{person.name}</h3><p>{person.locationName} · 第 {person.day} 日 {person.time}</p><p>{person.activity??(person.visibility==="observed"?"此刻与你在同一地点。":"当前位置未知。")}</p>
              {tool==="ask"&&<p>已知身份：{person.role}。案情询问将在案件阶段开放。</p>}
              <div><button onClick={record}>记入笔记</button><button disabled={person.visibility!=="observed"||!placeById(person.sceneId??"")} onClick={()=>{setFollowing(person.id);setPanel(null);setToast("只跟随当前可见的居民。离开视野即停止。");}}>跟随目击</button></div></article>}
          </>:<><p>观察先于结论。随身笔记保存在本机；案件证据需要经过调查确认。</p><div className={styles.caseEmpty}><BookOpen size={26}/><h3>尚未立案</h3><p>这一阶段先认识街区与居民。<br/>完整搜证、证词与推理将在后续接入。</p></div><h3>随身笔记 <small>{notes.length}</small></h3>{notes.length?notes.map(note=><p className={styles.note} key={note.id}>{note.text}</p>):<p>走近人物，或按 4 记录一次到访。</p>}<button onClick={()=>{record();}}>记录当前观察</button></>}
          <section aria-label="居民生活"><h3>小镇的日常</h3>{town.view?.life?<><p>三日生活已启用 · 已经过 {Math.floor(town.view.life.elapsedMinutes/60)} 小时。<br/>居民会吃饭、休息、工作和交谈；最近保留 {town.view.life.proposalCount} 条有来源候选，由规则裁决。</p><div className={styles.planningMode} role="group" aria-label="生活安排"><button aria-pressed={town.view.life.plannerMode==="rules"} disabled={town.busy||!!town.error} onClick={()=>void town.commit({kind:"life-mode",mode:"rules"})}>按日程生活</button><button aria-pressed={town.view.life.plannerMode==="offline-agent"} disabled={town.busy||!!town.error} onClick={()=>void town.commit({kind:"life-mode",mode:"offline-agent"})}>按目标安排</button></div><p>{town.view.life.plannerMode==="offline-agent"?"街坊会参考近期经历和每日目标，也会约街坊再见面。失约后可能当面核对，说法仍需查证。吃饭、睡觉和赶路仍有保障。":"街坊遵循原有日程。可以切换到目标安排，看看不同的生活节奏。"}<br/>生活安排在本机计算，不调用付费模型。</p></>:<><p>启用后，当前手记将开放接下来 72 小时的居民生活。原来的目击与笔记会保留。</p><button disabled={town.busy||!!town.error||!town.view} onClick={()=>void town.commit({kind:"life-enable"})}>启用三日生活</button></>}</section>
          <footer>居民日程与到访来自现有世界引擎 · {town.view?.life?.plannerMode==="offline-agent"?"按目标安排日常":"按原有日程生活"}</footer>
        </aside>
      </div>}
    </section>
    <footer className={styles.bottom}>
      <div className={styles.hint}><kbd>W A S D</kbd><span>移动</span><kbd>E</kbd><span>交互</span></div>
      <nav className={styles.toolbar} aria-label="侦探工具">{tools.map(({id,label,icon:Icon},i)=><button key={id} disabled={!town.view} aria-pressed={tool===id} onClick={()=>selectTool(id)} aria-label={`${i+1} ${label}`}><small>{i+1}</small><Icon size={22}/><span>{label}</span></button>)}</nav>
      <div className={styles.saved}><i/>{town.pending?"待确认保存":town.view?"到访已保存":"准备出发"}<small>AGENT TOWN / 01</small></div>
    </footer>
    <div className={styles.touch} aria-label="移动控制">{[["KeyW","向上","↑"],["KeyA","向左","←"],["KeyS","向下","↓"],["KeyD","向右","→"]].map(([code,name,label])=><button key={code} aria-label={name} onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);keys.current.add(code);}} onPointerUp={()=>keys.current.delete(code)} onPointerCancel={()=>keys.current.delete(code)} onLostPointerCapture={()=>keys.current.delete(code)}>{label}</button>)}</div>
    <span hidden data-player-position={JSON.stringify(pose)} data-following={following??""}/>
  </main>;
}
