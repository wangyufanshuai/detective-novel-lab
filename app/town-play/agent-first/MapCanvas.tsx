"use client";
import { useEffect, useRef, type RefObject } from "react";
import type { ExplorationObservation } from "@/packages/engine/src/town/agent-observation";
import { MAP_WIDTH as W, MAP_HEIGHT as H, places, door, movePoint, nearbyPlace, routeTo, type Point } from "./agent-first-map";

type Props = { view: ExplorationObservation | null; paused: boolean; overview: boolean; indoors: string | null;
  keys: RefObject<Set<string>>; restore: number; destination: { id: number; point: Point } | null;
  onPose: (point: Point, near: string | null) => void; onPerson: (id: string) => void };
const palette = ["#a5654c", "#657b70", "#c09e64", "#657387", "#91728b"];
function rect(c: CanvasRenderingContext2D, color: string, x: number, y: number, w: number, h: number) { c.fillStyle = color; c.fillRect(Math.round(x), Math.round(y), w, h); }
function person(c: CanvasRenderingContext2D, x: number, y: number, color: string, player = false, phase = 0) {
  c.fillStyle = "#122c3044"; c.beginPath(); c.ellipse(x, y + 2, 10, 4, 0, 0, Math.PI * 2); c.fill();
  const stride = Math.sin(phase) * 2;
  rect(c, "#25373a", x - 5, y - 6, 4, 8 + stride); rect(c, "#25373a", x + 2, y - 6, 4, 8 - stride);
  rect(c, color, x - 7, y - 22, 14, 17); rect(c, "#e0b18a", x - 5, y - 34, 10, 12);
  rect(c, "#3a3731", x - 6, y - 36, 12, 5);
  if (player) { rect(c, "#3d4540", x - 9, y - 32, 18, 4); rect(c, "#bfa971", x - 2, y - 21, 3, 16); }
}
function background() {
  const canvas = document.createElement("canvas"); canvas.width = W; canvas.height = H;
  const c = canvas.getContext("2d")!;
  rect(c, "#a8b7ad", 0, 0, W, H);
  // Quiet hills and a long winter sky make the roofline readable.
  rect(c, "#cbd1bf", 0, 0, W, 154);
  for (let i = 0; i < 14; i++) { c.fillStyle = i % 2 ? "#9eb2a4" : "#afbeb0"; c.beginPath(); c.moveTo(i*100-100,182); c.lineTo(i*100+40,53+(i*41)%61); c.lineTo(i*100+190,182); c.fill(); }
  rect(c, "#8fa898", 0, 164, W, H-164);
  // Tiny deterministic grass / snow patches, painted once rather than every frame.
  for (let i=0;i<1700;i++) { const x=(i*173+61)%W, y=180+(i*67)%470; rect(c,i%4===0?"#c8d0b7":"#829b89",x,y,3+i%6,2); }
  rect(c,"#d1c8a9",65,335,893,49);rect(c,"#d1c8a9",493,340,73,279);rect(c,"#d1c8a9",128,511,675,55);
  for(const p of places)if(p.w)rect(c,"#d1c8a9",p.x-24,p.y,48,Math.max(20,(p.y<400?360:540)-p.y));
  rect(c,"#5b8584",0,396,W,64);rect(c,"#9db6a4",0,392,W,6);rect(c,"#486e70",0,455,W,7);
  for(let i=0;i<75;i++)rect(c,i%2?"#82a49a":"#719795",(i*129)%W,405+(i*17)%40,12+i%19,2);
  rect(c,"#696e60",480,390,105,77);rect(c,"#c4bea2",490,390,85,77);
  for(let y=398;y<461;y+=13)rect(c,"#999982",490,y,85,2);
  for(let x=480;x<590;x+=98){rect(c,"#535e54",x,386,7,85);for(let y=386;y<480;y+=32)rect(c,"#b5baa2",x-4,y,14,9);}
  // Courtyard fountain and rounded beds.
  c.fillStyle="#a5ab8e";c.beginPath();c.ellipse(650,537,49,27,0,0,Math.PI*2);c.fill();
  c.strokeStyle="#d9d4b7";c.lineWidth=7;c.stroke();rect(c,"#636c5b",643,511,14,28);rect(c,"#b9bba1",638,507,24,6);
  function tree(x:number,y:number,s=1) {rect(c,"#5c5641",x-4*s,y-11*s,8*s,24*s);for(let j=0;j<3;j++){c.fillStyle=["#3e6456","#50725c","#6c896d"][j];c.beginPath();c.moveTo(x-23*s+j*3*s,y-j*18*s);c.lineTo(x,y-55*s-j*13*s);c.lineTo(x+23*s-j*3*s,y-j*18*s);c.fill();}rect(c,"#bfccb3",x-7*s,y-62*s,14*s,3*s);}
  for (const [x,y,s] of [[50,273,1.3],[68,594,1.4],[937,296,1.3],[906,541,1.6],[990,600,1.1],[335,216,.8],[880,219,.9],[352,639,.7],[810,633,1]])tree(x,y,s);
  function building(p: typeof places[number]) {
    const x=p.x-p.w/2,y=p.y-p.h;
    rect(c,"#263f3440",x+12,y+29,p.w+8,p.h-9);rect(c,"#d7c6a0",x,y,p.w,p.h);
    rect(c,"#a59272",x,y+27,p.w,5);rect(c,"#7d765d",x,p.y-8,p.w,8);
    rect(c,p.color,x-9,y-15,p.w+18,42);rect(c,"#393f36",x-12,y+25,p.w+24,6);
    for(let i=0;i<7;i++)rect(c,"#e1d8b640",x-9,y-11+i*6,p.w+18,1);
    for(let dx=20;dx<p.w-10;dx+=39){rect(c,"#5a6657",x+dx,y+42,24,29);rect(c,"#e2bc73",x+dx+3,y+46,18,21);rect(c,"#776e4e",x+dx+11,y+45,3,25);}
    rect(c,"#364b42",p.x-14,p.y-41,28,41);rect(c,"#c29c61",p.x-9,p.y-36,18,21);rect(c,"#d5c8a8",p.x-23,p.y,46,5);
    rect(c,"#eee1b9",x+27,y+10,p.w-54,21);c.font='13px "Songti SC", SimSun, serif';c.fillStyle="#36483d";c.textAlign="center";c.fillText(p.name,p.x,y+25);
    if(p.id==="cafe")for(let i=0;i<9;i++)rect(c,i%2?"#e4dabb":"#62745b",x+i*p.w/9,y+31,p.w/9,12);
    if(p.id==="station"){rect(c,"#7d8174",x-10,y-38,44,24);rect(c,"#ddd8bb",x-15,y-41,54,6);for(let yy=p.y+38;yy<p.y+53;yy+=8){rect(c,"#6f7a6c",65,yy,262,3);}}
  }
  places.filter(p=>p.w).forEach(building);
  // Low stone walls, lamps and seats establish lanes without heavy geometry.
  for(let i=0;i<9;i++){rect(c,"#afb49b",316+i*34,191,29,12);rect(c,"#d4d7b9",316+i*34,189,29,3);}
  for(const [x,y] of [[340,356],[595,365],[299,553],[801,357]]){rect(c,"#435d4c",x,y-39,3,40);rect(c,"#445c4c",x-6,y-46,15,13);rect(c,"#f0cf83",x-3,y-43,9,7);}
  c.font='12px "Songti SC", SimSun, serif';c.fillStyle="#596953";c.textAlign="center";c.fillText("河 湾 广 场",531,604);
  return canvas;
}
export default function MapCanvas(props: Props) {
  const canvas = useRef<HTMLCanvasElement>(null), live=useRef(props); live.current=props;
  const pose=useRef<Point>(door("town-square")), path=useRef<Point[]>([]), transform=useRef({scale:1,x:0,y:0});
  const restore=useRef(-1), destination=useRef(-1);
  useEffect(()=>{
    const el=canvas.current;if(!el)return;const c=el.getContext("2d",{alpha:false})!;const art=background();
    let frame=0,last=performance.now(),notice=0,stepPhase=0,lastNear:string|null|undefined;const durations:number[]=[];
    const click=(e:PointerEvent)=>{
      const state=live.current;if(state.paused||state.indoors)return;
      const b=el.getBoundingClientRect(),t=transform.current;
      const point={x:(e.clientX-b.left-t.x)/t.scale,y:(e.clientY-b.top-t.y)/t.scale};
      for(const person of state.view?.residents??[]){if(person.visibility!=="observed")continue;const anchor=door(person.sceneId??"");const index=state.view!.residents.filter(p=>p.sceneId===person.sceneId).indexOf(person);anchor.x+=36+index*48;if(Math.hypot(point.x-anchor.x,point.y-anchor.y)<18){state.onPerson(person.id);return;}}
      path.current=routeTo(pose.current,point);
    };
    el.addEventListener("pointerdown",click);
    const render=(now:number)=>{
      frame=requestAnimationFrame(render);const s=live.current;const delta=now-last;last=now;const dt=Math.min(delta/1000,.05);
      if(document.hidden)return;
      const b=el.getBoundingClientRect(),dpr=Math.min(devicePixelRatio,2);
      if(el.width!==Math.round(b.width*dpr)||el.height!==Math.round(b.height*dpr)){el.width=Math.round(b.width*dpr);el.height=Math.round(b.height*dpr);}
      if(restore.current!==s.restore){restore.current=s.restore;pose.current=door(s.view?.sceneId??"town-square");path.current=[];}
      if(s.destination&&destination.current!==s.destination.id){destination.current=s.destination.id;path.current=routeTo(pose.current,s.destination.point);}
      let dx=0,dy=0,travel=130*dt;
      if(!s.paused&&!s.indoors){
        dx=Number(s.keys.current.has("KeyD")||s.keys.current.has("ArrowRight"))-Number(s.keys.current.has("KeyA")||s.keys.current.has("ArrowLeft"));
        dy=Number(s.keys.current.has("KeyS")||s.keys.current.has("ArrowDown"))-Number(s.keys.current.has("KeyW")||s.keys.current.has("ArrowUp"));
        if(dx||dy)path.current=[];
        else if(path.current.length){const next=path.current[0],distance=Math.hypot(next.x-pose.current.x,next.y-pose.current.y);if(distance<.1)path.current.shift();else {dx=(next.x-pose.current.x)/distance;dy=(next.y-pose.current.y)/distance;travel=Math.min(travel,distance);}}
        const length=Math.max(1,Math.hypot(dx,dy));pose.current=movePoint(pose.current,dx/length*travel,dy/length*travel);if(dx||dy)stepPhase+=dt*13;
      }
      c.setTransform(dpr,0,0,dpr,0,0);c.imageSmoothingEnabled=false;
      const fit=Math.min(b.width/W,b.height/H);const scale=s.overview?fit:Math.max(fit*1.32,b.width<580?.95:.9);
      const x=b.width>=W*scale?(b.width-W*scale)/2:Math.max(b.width-W*scale,Math.min(0,b.width/2-pose.current.x*scale));
      const y=b.height>=H*scale?(b.height-H*scale)/2:Math.max(b.height-H*scale,Math.min(0,b.height/2-pose.current.y*scale));
      transform.current={scale,x,y};rect(c,"#789582",0,0,b.width,b.height);c.save();c.translate(x,y);c.scale(scale,scale);c.drawImage(art,0,0);
      for(const [i,p]of(s.view?.residents??[]).entries()){
        const anchor=door(p.sceneId??"");if(!places.some(place=>place.id===p.sceneId))continue;
        anchor.x+=36+(s.view?.residents.filter(other=>other.sceneId===p.sceneId).indexOf(p)??0)*48;if(p.visibility!=="observed")c.globalAlpha=.35;
        person(c,anchor.x,anchor.y,palette[i%palette.length]);c.globalAlpha=1;
        if(p.visibility==="observed"){c.fillStyle="#283f34";c.font='11px SimSun,serif';c.textAlign="center";c.fillText(p.name,anchor.x,anchor.y-43);}
      }
      const near=nearbyPlace(pose.current);
      if(near){c.strokeStyle="#f4db99";c.lineWidth=2;c.strokeRect(near.x-20,near.y+12,40,18);}
      if(path.current.length){const end=path.current[path.current.length-1];c.strokeStyle="#fff0bd";c.lineWidth=2;c.beginPath();c.arc(end.x,end.y,8,0,Math.PI*2);c.stroke();}
      person(c,pose.current.x,pose.current.y,"#3b5148",true,stepPhase);c.restore();
      if(s.indoors){
        const iw=Math.min(b.width-32,580),ih=Math.min(b.height-56,330),ix=(b.width-iw)/2,iy=(b.height-ih)/2;
        rect(c,"#152d2be8",0,0,b.width,b.height);rect(c,"#cdbb95",ix,iy,iw,ih);rect(c,"#4b6656",ix+10,iy+10,iw-20,65);
        for(let j=0;j<12;j++)rect(c,"#ad9876",ix+10,iy+82+j*20,iw-20,1);
        for(let j=0;j<3;j++){rect(c,"#635641",ix+35+j*64,iy+28,48,83);for(let k=0;k<5;k++)rect(c,palette[(j+k)%5],ix+39+j*64+k*8,iy+33,6,60);}
        rect(c,"#9c7556",ix+iw/2-55,iy+ih/2,110,60);rect(c,"#e2cc9b",ix+iw/2-19,iy+ih/2+10,35,24);
        person(c,ix+iw/2,iy+ih-47,"#3b5148",true);c.fillStyle="#f2e4b8";c.font='18px SimSun,serif';c.textAlign="right";c.fillText(places.find(p=>p.id===s.indoors)?.name??"",ix+iw-25,iy+48);
      }
      if(!s.paused)durations.push(delta);if(durations.length>600)durations.shift();
      el.dataset.ready="true";el.dataset.position=JSON.stringify(pose.current);el.dataset.near=near?.id??"";
      if(lastNear!==near?.id){lastNear=near?.id;s.onPose({...pose.current},near?.id??null);}
      if(now-notice>180){notice=now;s.onPose({...pose.current},near?.id??null);const sorted=[...durations].sort((a,b)=>a-b);el.dataset.metrics=JSON.stringify({samples:sorted.length,p95FrameMs:sorted[Math.floor(sorted.length*.95)]??0,width:b.width,height:b.height,dpr});}
    };
    frame=requestAnimationFrame(render);
    return()=>{cancelAnimationFrame(frame);el.removeEventListener("pointerdown",click);};
  },[]);
  return <canvas ref={canvas} aria-label="河湾小镇地图。WASD 或方向键移动，点击地面寻路，靠近门口按 E 到访。" tabIndex={0} data-agent-map="true" style={{width:"100%",height:"100%",display:"block",touchAction:"none"}} />;
}
