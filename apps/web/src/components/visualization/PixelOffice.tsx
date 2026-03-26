'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { WorldState, AgentState } from '@amc/simulation-engine';
import { AgentZone, AgentVisualState } from '@amc/shared';
import type { CanonicalEvent } from '@amc/shared';
import { useSessionStore } from '@/stores/session-store';

// === CONSTANTS ===
const T = 16;
const COLS = 42;
const ROWS = 28;
const W = COLS * T;
const H = ROWS * T;
const S = 2; // render scale — everything draws at 2x
const CW = W * S;
const CH = H * S;

// === PALETTE ===
const P = {
  wall: '#1a1a30', wallLight: '#282844',
  hall: '#363650', hallAlt: '#3e3e58',
  woodA: '#7a5a28', woodB: '#8a6a30', woodLine: '#6a4a1e',
  tileA: '#d0ccc0', tileB: '#c0bcb0', tileGrid: '#aaa89c',
  blueA: '#2a4a6a', blueB: '#324e6e',
  greenA: '#2a5a3a', greenB: '#32604a',
  darkA: '#38384a', darkB: '#404058',
  desk: '#6a4420', deskTop: '#7a5830', deskEdge: '#5a3818',
  mon: '#1a1a2a', scrOn: '#3a6848', scrGlow: '#4a8858',
  chairA: '#4a3828', chairB: '#3a2818',
  shelf: '#4a2a10', shelfEdge: '#3a1a08',
  pot: '#7a5a38', leaf: '#2a8a3a', leafDk: '#1a6a2a',
};

const ZONE_CLR: Record<string, string> = {
  [AgentZone.Coding]: '#3b82f6', [AgentZone.Testing]: '#10b981',
  [AgentZone.Planning]: '#f59e0b', [AgentZone.Review]: '#8b5cf6',
  [AgentZone.Idle]: '#f97316',
};
const STATE_CLR: Record<string, string> = {
  [AgentVisualState.Working]: '#3b82f6', [AgentVisualState.Thinking]: '#8b5cf6',
  [AgentVisualState.Blocked]: '#ef4444', [AgentVisualState.Communicating]: '#10b981',
  [AgentVisualState.Idle]: '#f59e0b',
};
const STATE_LABEL: Record<string, string> = {
  [AgentVisualState.Working]: 'Working', [AgentVisualState.Thinking]: 'Thinking',
  [AgentVisualState.Blocked]: 'Blocked', [AgentVisualState.Communicating]: 'Communicating',
  [AgentVisualState.Idle]: 'Idle',
};

// === ROOMS ===
interface RoomDef { id: string; zone: AgentZone; x: number; y: number; w: number; h: number; floor: string; label: string; desks: {x:number;y:number}[]; }
const ROOMS: RoomDef[] = [
  { id:'coding', zone:AgentZone.Coding, x:1,y:1,w:19,h:12, floor:'wood', label:'DEV AREA',
    desks:[{x:4,y:4},{x:9,y:4},{x:14,y:4},{x:4,y:9},{x:9,y:9},{x:14,y:9}] },
  { id:'coffee', zone:AgentZone.Idle, x:22,y:1,w:19,h:12, floor:'tile', label:'COFFEE SHOP',
    desks:[{x:25,y:5},{x:29,y:5},{x:33,y:5},{x:25,y:9},{x:29,y:9},{x:33,y:9}] },
  { id:'planning', zone:AgentZone.Planning, x:1,y:15,w:12,h:12, floor:'dark', label:'PLANNING',
    desks:[{x:4,y:18},{x:8,y:18},{x:4,y:23},{x:8,y:23}] },
  { id:'testing', zone:AgentZone.Testing, x:15,y:15,w:13,h:12, floor:'green', label:'QA LAB',
    desks:[{x:18,y:18},{x:23,y:18},{x:18,y:23},{x:23,y:23}] },
  { id:'review', zone:AgentZone.Review, x:29,y:15,w:12,h:12, floor:'blue', label:'REVIEW',
    desks:[{x:32,y:18},{x:36,y:18},{x:32,y:23},{x:36,y:23}] },
];
const ZONE_ROOM: Record<string,string> = {
  [AgentZone.Coding]:'coding',[AgentZone.Testing]:'testing',
  [AgentZone.Planning]:'planning',[AgentZone.Review]:'review',[AgentZone.Idle]:'coffee',
};

// === HELPERS ===
const HAIR=['#1c1917','#78350f','#292524','#7c2d12','#1e3a5f','#4a1942'];
const SKIN=['#f0c8a0','#d4a574','#c19a6b','#8d6e46','#e8beac','#a0785c'];
const SHIRT=['#3b82f6','#8b5cf6','#06b6d4','#10b981','#f59e0b','#ec4899','#6366f1','#ef4444'];
function hash(s:string){let h=0;for(let i=0;i<s.length;i++)h=((h<<5)-h+s.charCodeAt(i))|0;return Math.abs(h);}

// === FLOOR ===
function drawFloor(ctx:CanvasRenderingContext2D, room:RoomDef){
  for(let r=0;r<room.h;r++)for(let c=0;c<room.w;c++){
    const px=(room.x+c)*T,py=(room.y+r)*T;
    switch(room.floor){
      case'wood':ctx.fillStyle=(c+r*2)%3===0?P.woodA:P.woodB;ctx.fillRect(px,py,T,T);
        ctx.fillStyle=P.woodLine;ctx.fillRect(px,py+T-1,T,1);
        if((c+r)%4===0)ctx.fillRect(px+T-1,py,1,T);break;
      case'tile':ctx.fillStyle=(c+r)%2?P.tileA:P.tileB;ctx.fillRect(px,py,T,T);
        ctx.fillStyle=P.tileGrid;ctx.fillRect(px,py,T,1);ctx.fillRect(px,py,1,T);
        if((c+r)%2===0){ctx.fillRect(px+7,py+3,2,2);ctx.fillRect(px+3,py+7,2,2);ctx.fillRect(px+11,py+7,2,2);ctx.fillRect(px+7,py+11,2,2);}break;
      case'blue':ctx.fillStyle=(c+r)%2?P.blueA:P.blueB;ctx.fillRect(px,py,T,T);break;
      case'green':ctx.fillStyle=(c+r)%2?P.greenA:P.greenB;ctx.fillRect(px,py,T,T);break;
      case'dark':ctx.fillStyle=(c+r)%2?P.darkA:P.darkB;ctx.fillRect(px,py,T,T);break;
    }
  }
}
function drawCorridors(ctx:CanvasRenderingContext2D){
  for(let c=1;c<COLS-1;c++)for(let r=13;r<=14;r++){ctx.fillStyle=(c+r)%2?P.hall:P.hallAlt;ctx.fillRect(c*T,r*T,T,T);}
  for(let r=1;r<13;r++)for(let c=20;c<=21;c++){ctx.fillStyle=(c+r)%2?P.hall:P.hallAlt;ctx.fillRect(c*T,r*T,T,T);}
  for(const col of[13,14,27,28])for(let r=15;r<27;r++){ctx.fillStyle=(col+r)%2?P.hall:P.hallAlt;ctx.fillRect(col*T,r*T,T,T);}
}

// === FURNITURE ===
function drawDesk(ctx:CanvasRenderingContext2D,tx:number,ty:number){
  const px=tx*T,py=ty*T;
  ctx.fillStyle=P.deskEdge;ctx.fillRect(px-4,py+2,T+8,T-2);
  ctx.fillStyle=P.deskTop;ctx.fillRect(px-3,py+2,T+6,T-4);
  ctx.fillStyle=P.desk;ctx.fillRect(px-4,py+T-2,T+8,3);
  ctx.fillStyle=P.mon;ctx.fillRect(px+2,py-4,12,8);
  ctx.fillStyle=P.scrOn;ctx.fillRect(px+3,py-3,10,6);
  ctx.fillStyle='#555';ctx.fillRect(px+6,py+3,4,2);
  ctx.fillStyle=P.chairB;ctx.fillRect(px+1,py+T+4,14,8);
  ctx.fillStyle=P.chairA;ctx.fillRect(px+2,py+T+6,12,6);
}
function drawShelf(ctx:CanvasRenderingContext2D,tx:number,ty:number){
  const px=tx*T,py=ty*T;
  ctx.fillStyle=P.shelfEdge;ctx.fillRect(px,py,T,T);
  ctx.fillStyle=P.shelf;ctx.fillRect(px+1,py+1,T-2,3);ctx.fillRect(px+1,py+6,T-2,3);ctx.fillRect(px+1,py+11,T-2,4);
  const bc=['#c44','#44c','#4a4','#c84','#84c','#4cc'];
  for(let i=0;i<4;i++){ctx.fillStyle=bc[(tx+ty+i)%6];ctx.fillRect(px+2+i*3,py+2,2,3);ctx.fillRect(px+2+i*3,py+7,2,3);ctx.fillRect(px+2+i*3,py+12,2,3);}
}
function drawPlant(ctx:CanvasRenderingContext2D,tx:number,ty:number){
  const px=tx*T,py=ty*T;
  ctx.fillStyle=P.pot;ctx.fillRect(px+4,py+10,8,5);ctx.fillRect(px+3,py+9,10,2);
  ctx.fillStyle=P.leaf;ctx.fillRect(px+3,py+2,10,8);
  ctx.fillStyle=P.leafDk;ctx.fillRect(px+5,py+1,6,3);ctx.fillRect(px+2,py+4,4,4);ctx.fillRect(px+9,py+5,4,3);
}
function drawTable(ctx:CanvasRenderingContext2D,tx:number,ty:number){
  const px=tx*T,py=ty*T;
  ctx.fillStyle='#a08060';ctx.fillRect(px+2,py+2,12,12);
  ctx.fillStyle='#b09070';ctx.fillRect(px+4,py+1,8,14);ctx.fillRect(px+1,py+4,14,8);
  ctx.fillStyle='#907050';ctx.fillRect(px+6,py+6,4,4);
}
function drawCoffeeBar(ctx:CanvasRenderingContext2D,tx:number,ty:number,w:number){
  for(let i=0;i<w;i++){const px=(tx+i)*T,py=ty*T;
    ctx.fillStyle='#5a3010';ctx.fillRect(px,py+2,T,T-2);
    ctx.fillStyle='#7a4820';ctx.fillRect(px,py+2,T,3);
    ctx.fillStyle='#8a5828';ctx.fillRect(px,py+T-2,T,3);}
  for(let i=1;i<w;i+=2){const px=(tx+i)*T+4,py=ty*T;
    ctx.fillStyle='#f5f5f0';ctx.fillRect(px,py+4,5,6);
    ctx.fillStyle='#d4d4d0';ctx.fillRect(px,py+4,5,2);}
}

function drawAllFurniture(ctx:CanvasRenderingContext2D){
  // Coding
  for(let i=0;i<5;i++)drawShelf(ctx,2+i*3,1);
  for(const d of ROOMS[0].desks)drawDesk(ctx,d.x,d.y);
  drawPlant(ctx,1,11);drawPlant(ctx,18,1);drawPlant(ctx,18,11);
  // Coffee - more visible: warm floor tint, bigger bar, more furniture
  drawCoffeeBar(ctx,24,2,10);
  // Coffee sign on wall
  const csx=24*T,csy=1*T;
  ctx.fillStyle='#92400e';ctx.fillRect(csx,csy,10*T,T);
  ctx.fillStyle='#fbbf24';ctx.fillRect(csx+2,csy+2,10*T-4,T-4);
  ctx.font='bold 10px monospace';ctx.fillStyle='#78350f';ctx.textAlign='center';
  ctx.fillText('COFFEE & BREAK',csx+5*T,csy+12);
  // Vending, fridge, clock
  ctx.fillStyle='#4a5568';ctx.fillRect(38*T+1,1*T,14,T);ctx.fillStyle='#68d391';ctx.fillRect(38*T+3,1*T+2,10,5);
  ctx.fillStyle='#cbd5e0';ctx.fillRect(39*T+1,1*T,14,T);ctx.fillStyle='#718096';ctx.fillRect(39*T+12,1*T+3,2,3);
  // Tables
  drawTable(ctx,25,6);drawTable(ctx,30,6);drawTable(ctx,35,6);drawTable(ctx,27,10);drawTable(ctx,33,10);
  drawPlant(ctx,22,1);drawPlant(ctx,40,11);drawPlant(ctx,22,11);drawPlant(ctx,40,1);
  // Planning
  ctx.fillStyle='#94a3b8';ctx.fillRect(3*T,15*T,T*3,T);ctx.fillStyle='#f1f5f9';ctx.fillRect(3*T+2,15*T+2,T*3-4,T-4);
  ctx.fillStyle='#3b82f6';ctx.fillRect(3*T+4,15*T+4,12,2);ctx.fillRect(3*T+4,15*T+8,18,2);
  drawTable(ctx,5,20);drawTable(ctx,8,20);
  for(const d of ROOMS[2].desks){ctx.fillStyle=P.chairA;ctx.fillRect(d.x*T+2,d.y*T+4,12,8);}
  drawPlant(ctx,1,15);drawPlant(ctx,11,25);
  // Testing
  for(const d of ROOMS[3].desks)drawDesk(ctx,d.x,d.y);
  drawShelf(ctx,15,15);drawShelf(ctx,16,15);drawPlant(ctx,26,15);drawPlant(ctx,15,25);
  // Review
  ctx.fillStyle='#92400e';ctx.fillRect(33*T,15*T+1,T*2,T-2);ctx.fillStyle='#bfdbfe';ctx.fillRect(33*T+2,15*T+3,T*2-4,T-6);
  ctx.fillStyle='#4ade80';ctx.fillRect(33*T+2,15*T+8,T*2-4,5);
  drawTable(ctx,33,20);drawTable(ctx,36,20);
  drawShelf(ctx,29,15);drawShelf(ctx,30,15);drawShelf(ctx,38,15);drawShelf(ctx,39,15);
  for(const d of ROOMS[4].desks){ctx.fillStyle='#5a3848';ctx.fillRect(d.x*T+1,d.y*T+3,14,10);ctx.fillStyle='#6a4858';ctx.fillRect(d.x*T+2,d.y*T+4,12,8);}
  drawPlant(ctx,29,25);drawPlant(ctx,40,25);
}

// === LABELS ===
function drawLabels(ctx:CanvasRenderingContext2D){
  for(const room of ROOMS){
    if(room.id==='coffee')continue; // coffee has custom sign
    const cx=(room.x+room.w/2)*T,sy=room.y*T+3;
    const tw=room.label.length*7+20;
    ctx.fillStyle=ZONE_CLR[room.zone]+'cc';
    ctx.fillRect(cx-tw/2,sy-1,tw,14);
    ctx.fillStyle='rgba(0,0,0,0.3)';ctx.fillRect(cx-tw/2,sy+11,tw,2);
    ctx.font='bold 10px monospace';ctx.textAlign='center';
    ctx.fillStyle='#ffffff';ctx.fillText(room.label,cx,sy+10);
  }
}

// === AGENT SPRITE ===
function drawAgent(ctx:CanvasRenderingContext2D,px:number,py:number,hc:string,sc:string,shc:string,frame:number,sit:boolean,stc:string,name:string){
  ctx.fillStyle='rgba(0,0,0,0.12)';ctx.fillRect(px-1,py+17,14,3);
  ctx.fillStyle=hc;ctx.fillRect(px+2,py,8,3);ctx.fillRect(px+1,py+1,10,3);
  ctx.fillStyle=sc;ctx.fillRect(px+2,py+4,8,3);
  ctx.fillStyle='#1a1a2e';ctx.fillRect(px+3,py+5,2,1);ctx.fillRect(px+7,py+5,2,1);
  ctx.fillStyle=sc;ctx.fillRect(px+4,py+7,4,1);
  ctx.fillStyle=shc;ctx.fillRect(px,py+8,12,1);ctx.fillRect(px+1,py+9,10,3);
  if(!sit){ctx.fillStyle='#2d2d3d';ctx.fillRect(px+2,py+12,8,1);
    ctx.fillStyle='#374151';const wo=frame%2;ctx.fillRect(px+2+wo,py+13,3,3);ctx.fillRect(px+7-wo,py+13,3,3);
    ctx.fillStyle='#1f2937';ctx.fillRect(px+2+wo,py+16,3,1);ctx.fillRect(px+7-wo,py+16,3,1);}
  // Status dot
  ctx.fillStyle=stc;ctx.fillRect(px+3,py-4,6,4);
  ctx.fillStyle=stc+'55';ctx.fillRect(px+2,py-5,8,6);
  // Name
  ctx.font='bold 7px monospace';ctx.textAlign='center';
  const nw=name.length*5+8;
  ctx.fillStyle='rgba(0,0,0,0.7)';ctx.fillRect(px+6-nw/2,py-14,nw,9);
  ctx.fillStyle='#fff';ctx.fillText(name,px+6,py-7);
}

// === POSITIONS ===
interface APos{x:number;y:number;tx:number;ty:number;di:number;rm:string;}
function getTarget(agent:AgentState,positions:Map<string,APos>){
  const rid=ZONE_ROOM[agent.zone]??'coffee';const room=ROOMS.find(r=>r.id===rid)!;
  const taken=new Set<number>();
  for(const[id,p]of positions)if(p.rm===rid&&id!==agent.id)taken.add(p.di);
  let di=0;for(let i=0;i<room.desks.length;i++)if(!taken.has(i)){di=i;break;}
  const d=room.desks[di]??room.desks[0];
  return{x:d.x*T+2,y:d.y*T+T+2,di,rm:rid};
}

// === BACKGROUND ===
function drawBG(ctx:CanvasRenderingContext2D){
  ctx.fillStyle=P.wall;ctx.fillRect(0,0,W,H);
  for(const r of ROOMS)drawFloor(ctx,r);
  drawCorridors(ctx);
  for(const room of ROOMS){
    const rx=room.x*T,ry=room.y*T,rw=room.w*T,rh=room.h*T;
    const zc=ZONE_CLR[room.zone]??'#888';
    ctx.fillStyle=zc+'66';
    ctx.fillRect(rx,ry,rw,3);ctx.fillRect(rx,ry+rh-3,rw,3);
    ctx.fillRect(rx,ry,3,rh);ctx.fillRect(rx+rw-3,ry,3,rh);
  }
  drawAllFurniture(ctx);
  drawLabels(ctx);
}

// === MONITOR FLICKER ===
function drawFlicker(ctx:CanvasRenderingContext2D,f:number){
  for(const room of ROOMS){
    if(room.floor!=='wood'&&room.floor!=='green')continue;
    for(const d of room.desks){
      const px=d.x*T,py=d.y*T;
      const on=Math.sin(f*0.05+d.x*3+d.y*7)>0.3;
      ctx.fillStyle=on?P.scrGlow:P.scrOn;ctx.fillRect(px+3,py-3,10,6);
      if(on){ctx.fillStyle='#5aaa68';for(let l=0;l<3;l++){ctx.fillRect(px+4,py-2+l*2,4+((f+d.x+l*3)%5),1);}}
    }
  }
}

// === HUD ===
function drawHUD(ctx:CanvasRenderingContext2D,agents:AgentState[],f:number){
  // Bottom bar
  ctx.fillStyle='rgba(0,0,0,0.75)';ctx.fillRect(0,H-20,W,20);
  ctx.font='bold 8px monospace';ctx.textAlign='left';
  ctx.fillStyle='#fff';
  ctx.fillText(`AGENTS: ${agents.length}`,6,H-8);
  const active=agents.filter(a=>a.visualState==='working'||a.visualState==='thinking').length;
  const blocked=agents.filter(a=>a.visualState==='blocked').length;
  ctx.fillStyle='#3b82f6';ctx.fillText(`ACTIVE: ${active}`,100,H-8);
  if(blocked>0){ctx.fillStyle='#ef4444';ctx.fillText(`BLOCKED: ${blocked}`,200,H-8);}
  // Live dot
  if(agents.length>0&&f%40<25){ctx.fillStyle='#22c55e';ctx.fillRect(350,H-15,6,6);}
  // Per-room counts
  for(const room of ROOMS){
    const ra=agents.filter(a=>(ZONE_ROOM[a.zone]??'coffee')===room.id);
    if(!ra.length)continue;
    const cx=(room.x+room.w/2)*T,by=(room.y+room.h)*T-4;
    ctx.fillStyle='rgba(0,0,0,0.6)';ctx.fillRect(cx-16,by-6,32,11);
    ctx.fillStyle=ZONE_CLR[room.zone]??'#fff';ctx.font='bold 7px monospace';ctx.textAlign='center';
    ctx.fillText(`${ra.length} here`,cx,by+3);
  }
}

// === TOOLTIP DATA ===
interface TooltipData {
  agent: AgentState;
  recentEvents: CanonicalEvent[];
  screenX: number;
  screenY: number;
}

// === MAIN COMPONENT ===
export function PixelOffice({ worldState }: { worldState: WorldState }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const bgRef = useRef<HTMLCanvasElement|null>(null);
  const posRef = useRef<Map<string,APos>>(new Map());
  const wsRef = useRef(worldState);
  wsRef.current = worldState;
  const fRef = useRef(0);
  const [tooltip, setTooltip] = useState<TooltipData|null>(null);
  const tooltipTimer = useRef<ReturnType<typeof setTimeout>|null>(null);
  const events = useSessionStore(s => s.events);

  // Close tooltip on scroll or after timeout
  useEffect(() => {
    if (!tooltip) return;
    const close = () => setTooltip(null);
    window.addEventListener('scroll', close, true);
    tooltipTimer.current = setTimeout(close, 6000);
    return () => {
      window.removeEventListener('scroll', close, true);
      if (tooltipTimer.current) clearTimeout(tooltipTimer.current);
    };
  }, [tooltip]);
  const activeSessionId = useSessionStore(s => s.activeSessionId);
  const sessions = useSessionStore(s => s.sessions);
  const loadEvents = useSessionStore(s => s.loadEvents);
  const eventsRef = useRef(events);
  eventsRef.current = events;
  const [isReplaying, setIsReplaying] = useState(false);

  const activeSession = sessions.find(s => s.id === activeSessionId);
  const isEnded = activeSession?.ended_at != null;

  const handleReplay = useCallback(async () => {
    if (!activeSessionId || isReplaying) return;
    setIsReplaying(true);
    try {
      const allEvents = await (await fetch(`http://localhost:4700/api/events?session_id=${activeSessionId}&limit=5000`)).json() as CanonicalEvent[];
      if (!allEvents.length) { setIsReplaying(false); return; }
      loadEvents([]);
      const total = allEvents.length;
      const batchSize = Math.max(1, Math.floor(total / 60)); // ~60 frames over ~3 seconds
      let i = 0;
      const step = () => {
        i = Math.min(i + batchSize, total);
        loadEvents(allEvents.slice(0, i));
        if (i < total) setTimeout(step, 50);
        else setIsReplaying(false);
      };
      setTimeout(step, 100);
    } catch { setIsReplaying(false); }
  }, [activeSessionId, isReplaying, loadEvents]);

  // Build background
  useEffect(()=>{
    const bg=document.createElement('canvas');bg.width=CW;bg.height=CH;
    const ctx=bg.getContext('2d')!;ctx.imageSmoothingEnabled=false;
    ctx.scale(S,S);
    drawBG(ctx);
    bgRef.current=bg;
  },[]);

  // Click handler — proper coordinate mapping for object-fit: contain
  const handleClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>)=>{
    const canvas=canvasRef.current;if(!canvas)return;
    const rect=canvas.getBoundingClientRect();
    // Account for object-fit: contain letterboxing
    const canvasAspect=CW/CH;
    const containerAspect=rect.width/rect.height;
    let renderW:number,renderH:number,offX:number,offY:number;
    if(containerAspect>canvasAspect){
      renderH=rect.height;renderW=renderH*canvasAspect;offX=(rect.width-renderW)/2;offY=0;
    }else{
      renderW=rect.width;renderH=renderW/canvasAspect;offX=0;offY=(rect.height-renderH)/2;
    }
    const cssX=e.clientX-rect.left-offX;
    const cssY=e.clientY-rect.top-offY;
    if(cssX<0||cssY<0||cssX>renderW||cssY>renderH){setTooltip(null);return;}
    const mx=(cssX/renderW)*W;
    const my=(cssY/renderH)*H;
    const ws=wsRef.current;
    // Wider hit area for easier clicking
    for(const[id,pos]of posRef.current){
      if(Math.abs(pos.x+6-mx)<16&&Math.abs(pos.y+8-my)<20){
        const agent=ws.agents.get(id);
        if(!agent)continue;
        const agentEvents=events.filter(ev=>ev.agent_id===id).slice(-15).reverse();
        setTooltip({agent,recentEvents:agentEvents,screenX:e.clientX,screenY:e.clientY});
        return;
      }
    }
    setTooltip(null);
  },[events]);

  // Animation loop
  useEffect(()=>{
    let id:number;
    const animate=()=>{
      const canvas=canvasRef.current;const bg=bgRef.current;
      if(!canvas||!bg){id=requestAnimationFrame(animate);return;}
      const ctx=canvas.getContext('2d')!;ctx.imageSmoothingEnabled=false;
      const ws=wsRef.current;const agents=Array.from(ws.agents.values());
      const positions=posRef.current;const f=fRef.current;

      // Update positions
      for(const a of agents){
        const t=getTarget(a,positions);let p=positions.get(a.id);
        if(!p){p={x:t.x,y:t.y,tx:t.x,ty:t.y,di:t.di,rm:t.rm};positions.set(a.id,p);}
        p.tx=t.x;p.ty=t.y;p.di=t.di;p.rm=t.rm;
      }
      for(const[aid]of positions)if(!ws.agents.has(aid))positions.delete(aid);
      for(const[,p]of positions){
        const dx=p.tx-p.x,dy=p.ty-p.y,d=Math.sqrt(dx*dx+dy*dy);
        if(d>1){const s=Math.min(2.5,d*0.08);p.x+=dx/d*s;p.y+=dy/d*s;}
        else{p.x=p.tx;p.y=p.ty;}
      }

      // Draw at 2x scale
      ctx.drawImage(bg,0,0);
      ctx.save();ctx.scale(S,S);

      drawFlicker(ctx,f);

      // Build per-agent status text and speech bubbles from recent events
      const agentStatus = new Map<string, string>();
      const agentBubble = new Map<string, {text:string; age:number}>();
      const now = Date.now();
      for (let ei = eventsRef.current.length - 1; ei >= Math.max(0, eventsRef.current.length - 200); ei--) {
        const ev = eventsRef.current[ei];
        const aid = ev.agent_id ?? '';
        // Status subtitle: last tool call
        if (!agentStatus.has(aid) && ev.event_type === 'tool_called') {
          const pl = ev.payload as Record<string,unknown>|undefined;
          const tn = (pl?.tool_name as string) ?? '';
          const fp = (pl?.file_path as string) ?? '';
          const fname = fp ? fp.split(/[/\\]/).pop() ?? '' : '';
          agentStatus.set(aid, fname ? `${tn} ${fname}` : tn);
        }
        // Speech bubble: last message, tool call, or result (within 30s)
        if (!agentBubble.has(aid)) {
          const pl = ev.payload as Record<string,unknown>|undefined;
          const evTime = new Date(ev.timestamp).getTime();
          const age = (now - evTime) / 1000;
          if (age < 30) {
            let content = '';
            if (ev.event_type === 'agent_message_sent') {
              content = (pl?.content as string) ?? '';
            } else if (ev.event_type === 'tool_called') {
              const tn = (pl?.tool_name as string) ?? '';
              const fp = (pl?.file_path as string) ?? '';
              const fname = fp ? fp.split(/[/\\]/).pop() ?? '' : '';
              content = fname ? `${tn}: ${fname}` : tn;
            } else if (ev.event_type === 'tool_result') {
              const tn = (pl?.tool_name as string) ?? '';
              const ok = pl?.success !== false;
              content = ok ? `${tn} done` : `${tn} failed!`;
            }
            if (content) {
              agentBubble.set(aid, { text: content.slice(0, 40), age });
            }
          }
        }
      }

      for(const a of agents){
        const p=positions.get(a.id);if(!p)continue;
        const h=hash(a.id);
        const px=Math.round(p.x), py=Math.round(p.y);
        drawAgent(ctx,px,py,
          HAIR[h%HAIR.length],SKIN[(h>>3)%SKIN.length],SHIRT[(h>>6)%SHIRT.length],
          Math.abs(p.x-p.tx)>2?Math.floor(f/12):0,
          Math.abs(p.x-p.tx)<=2&&Math.abs(p.y-p.ty)<=2,
          STATE_CLR[a.visualState]??'#f59e0b',a.name);

        // Status subtitle under name — BIG and readable
        const status = agentStatus.get(a.id);
        if(status){
          ctx.font='bold 6px monospace';ctx.textAlign='center';
          const statusText = status.slice(0,24);
          const sw=statusText.length*4+10;
          ctx.fillStyle='rgba(0,0,0,0.7)';
          ctx.fillRect(px+6-sw/2,py-4,sw,9);
          ctx.fillStyle='#a5b4fc';
          ctx.fillText(statusText,px+6,py+3);
        }

        // Speech bubble — BIG, clear, white background
        const bubble = agentBubble.get(a.id);
        if(bubble && bubble.age < 25){
          const opacity = Math.max(0.3, 1 - bubble.age / 25);
          const bubbleText = bubble.text.slice(0,35);
          const bw=Math.max(bubbleText.length*4.5+14, 50);
          const bh=16;
          const bx=px-bw/2+6, by=py-34-Math.sin(f*0.02)*2;
          // Shadow
          ctx.fillStyle=`rgba(0,0,0,${opacity*0.3})`;
          ctx.fillRect(bx+2,by+2,bw,bh);
          // Bubble body
          ctx.fillStyle=`rgba(255,255,255,${opacity*0.95})`;
          ctx.fillRect(bx,by,bw,bh);
          // Bubble tail (triangle)
          ctx.fillRect(bx+bw/2-3,by+bh,6,4);
          // Border
          ctx.strokeStyle=`rgba(59,130,246,${opacity*0.6})`;ctx.lineWidth=1;
          ctx.strokeRect(bx,by,bw,bh);
          // Text — BIGGER
          ctx.font='bold 7px monospace';ctx.textAlign='left';
          ctx.fillStyle=`rgba(15,23,42,${opacity})`;
          ctx.fillText(bubbleText,bx+5,by+11);
        }

        // Human interaction needed indicator
        const needsHuman = agentBubble.get(a.id)?.text.match(/blocked|need human|waiting|permission|help/i);
        if(needsHuman){
          const qx=px+14, qy=py-16;
          ctx.fillStyle='#f59e0b';
          ctx.fillRect(qx,qy,10,12);
          ctx.font='bold 8px monospace';ctx.fillStyle='#000';ctx.textAlign='center';
          ctx.fillText('?',qx+5,qy+9);
        }
      }

      // Blocked indicators
      for(const a of agents){
        if(a.visualState!==AgentVisualState.Blocked)continue;
        const p=positions.get(a.id);if(!p)continue;
        ctx.fillStyle='#ef4444';ctx.fillRect(Math.round(p.x)+4,Math.round(p.y)-10,4,5);
        ctx.fillRect(Math.round(p.x)+4,Math.round(p.y)-4,4,2);
      }

      // Connection beams
      for(const c of ws.connections){
        if(c.decay<0.05)continue;
        const fp=positions.get(c.fromAgentId),tp=positions.get(c.toAgentId);
        if(!fp||!tp)continue;
        ctx.strokeStyle=`rgba(16,185,129,${c.decay*0.6})`;ctx.lineWidth=1;ctx.setLineDash([3,3]);
        ctx.beginPath();ctx.moveTo(fp.x+6,fp.y+6);ctx.lineTo(tp.x+6,tp.y+6);ctx.stroke();ctx.setLineDash([]);
        const t=(f*0.03)%1;
        ctx.fillStyle=`rgba(52,211,153,${c.decay})`;
        ctx.fillRect(fp.x+(tp.x-fp.x)*t+4,fp.y+(tp.y-fp.y)*t+4,4,4);
      }

      // Detect fired agents and parent-child relationships from events
      const firedIds=new Set<string>();
      const parentMap=new Map<string,string>(); // child → parent
      for(const ev of eventsRef.current){
        if(ev.event_type==='agent_completed'){
          const p=ev.payload as Record<string,unknown>|undefined;
          if(p&&p.success===false)firedIds.add(ev.agent_id??'');
        }
        if(ev.event_type==='agent_registered'){
          const p=ev.payload as Record<string,unknown>|undefined;
          if(p?.parent_agent_id)parentMap.set(ev.agent_id??'',p.parent_agent_id as string);
        }
      }

      // Draw parent→child connection lines (subagent hierarchy)
      for(const[childId,parentId]of parentMap){
        const cp=positions.get(childId),pp=positions.get(parentId);
        if(!cp||!pp)continue;
        ctx.strokeStyle='rgba(139,92,246,0.3)';ctx.lineWidth=1;ctx.setLineDash([2,2]);
        ctx.beginPath();ctx.moveTo(pp.x+6,pp.y+6);ctx.lineTo(cp.x+6,cp.y+6);ctx.stroke();ctx.setLineDash([]);
        // Small diamond at child end
        ctx.fillStyle='#8b5cf6';
        ctx.fillRect(cp.x+4,cp.y-2,4,4);
      }

      // Fired agents: float up to "heaven" strip at top with halo + fall animation
      let firedIdx=0;
      for(const a of agents){
        if(!firedIds.has(a.id))continue;
        const targetY=-10+Math.sin(f*0.015+firedIdx*1.5)*4;
        const fx=60+firedIdx*55;
        // Animate falling up (using frame counter for timing)
        const p=positions.get(a.id);
        let fy=targetY;
        if(p){
          // Smoothly rise from last position to heaven
          const rise=Math.min(1,(f%600)/120);
          fy=p.y*(1-rise)+targetY*rise;
        }
        // Ghost agent
        ctx.globalAlpha=0.45;
        drawAgent(ctx,fx,fy,HAIR[hash(a.id)%HAIR.length],SKIN[(hash(a.id)>>3)%SKIN.length],
          '#666',0,false,'#ef4444',a.name);
        ctx.globalAlpha=1;
        // Halo
        ctx.strokeStyle='#fbbf24';ctx.lineWidth=1;
        ctx.beginPath();ctx.ellipse(fx+6,fy-8,9,3,0,0,Math.PI*2);ctx.stroke();
        // Angel wings
        ctx.fillStyle='rgba(254,243,199,0.4)';
        ctx.beginPath();ctx.moveTo(fx-2,fy+6);ctx.lineTo(fx-8,fy+2);ctx.lineTo(fx-6,fy+10);ctx.fill();
        ctx.beginPath();ctx.moveTo(fx+14,fy+6);ctx.lineTo(fx+20,fy+2);ctx.lineTo(fx+18,fy+10);ctx.fill();
        // FIRED banner
        ctx.fillStyle='rgba(0,0,0,0.7)';ctx.fillRect(fx-4,fy+20,22,8);
        ctx.font='bold 5px monospace';ctx.fillStyle='#ef4444';ctx.textAlign='center';
        ctx.fillText('FIRED!',fx+6,fy+26);
        firedIdx++;
      }

      // If there are fired agents, draw "heaven" strip background
      if(firedIds.size>0){
        ctx.fillStyle='rgba(254,243,199,0.08)';
        ctx.fillRect(0,0,W,20);
        ctx.font='bold 6px monospace';ctx.fillStyle='rgba(251,191,36,0.3)';ctx.textAlign='left';
        ctx.fillText('AGENT HEAVEN',4,8);
      }

      drawHUD(ctx,agents,f);
      ctx.restore();

      fRef.current++;
      id=requestAnimationFrame(animate);
    };
    id=requestAnimationFrame(animate);
    return()=>cancelAnimationFrame(id);
  },[]);

  return(
    <div className="w-full h-full rounded-xl overflow-hidden shadow-md border border-slate-700 bg-[#1a1a30] relative">
      <canvas ref={canvasRef} width={CW} height={CH} onClick={handleClick}
        className="cursor-pointer"
        style={{width:'100%',height:'100%',imageRendering:'pixelated',objectFit:'contain'}} />
      {/* Replay button overlay */}
      {isEnded && !isReplaying && (
        <button onClick={handleReplay}
          className="absolute top-3 right-3 bg-slate-900/80 hover:bg-blue-600 text-white text-xs font-bold px-3 py-2 rounded-lg border border-slate-600 hover:border-blue-400 transition-all flex items-center gap-2 backdrop-blur-sm">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          Replay
        </button>
      )}
      {isReplaying && (
        <div className="absolute top-3 right-3 bg-amber-600/90 text-white text-xs font-bold px-3 py-2 rounded-lg border border-amber-400 flex items-center gap-2 animate-pulse">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
          Replaying...
        </div>
      )}
      {/* Agent Tooltip — closes on scroll, timeout, or X button */}
      {tooltip&&(
        <div className="fixed z-50" style={{left:Math.min(tooltip.screenX+12, window.innerWidth-360),top:Math.min(tooltip.screenY-20, window.innerHeight-300)}}>
          <div className="bg-slate-900 border-2 rounded-lg p-3 shadow-2xl text-xs min-w-[240px] max-w-[340px]"
            style={{borderColor:STATE_CLR[tooltip.agent.visualState]??'#888'}}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-3 h-3 rounded-full" style={{background:STATE_CLR[tooltip.agent.visualState]}} />
              <span className="font-bold text-white text-sm">{tooltip.agent.name}</span>
              <span className="ml-auto text-slate-400 font-mono text-[10px]">{tooltip.agent.id.slice(0,12)}</span>
              <button onClick={(e)=>{e.stopPropagation();setTooltip(null);}} className="text-slate-500 hover:text-white ml-1 text-sm leading-none">&times;</button>
            </div>
            <div className="grid grid-cols-2 gap-1 text-slate-300 mb-2">
              <div>Status: <span className="font-semibold" style={{color:STATE_CLR[tooltip.agent.visualState]}}>{STATE_LABEL[tooltip.agent.visualState]}</span></div>
              <div>Zone: <span className="text-white capitalize">{tooltip.agent.zone}</span></div>
            </div>
            {tooltip.agent.currentTask&&(
              <div className="text-slate-400 mb-2 bg-slate-800 rounded px-2 py-1">
                Task: <span className="text-slate-200">{tooltip.agent.currentTask.slice(0,80)}</span>
              </div>
            )}
            <div className="text-[10px] text-slate-500 font-semibold mb-1 uppercase">Recent Activity</div>
            <div className="space-y-0.5 max-h-[120px] overflow-y-auto">
              {tooltip.recentEvents.length===0?<div className="text-slate-500 italic">No events</div>:
                tooltip.recentEvents.map((ev,i)=>(
                  <div key={i} className="text-[10px] text-slate-400 flex gap-1">
                    <span className="text-slate-600 font-mono">{new Date(ev.timestamp).toLocaleTimeString()}</span>
                    <span className="text-slate-300 font-mono">{ev.event_type}</span>
                  </div>
                ))}
            </div>
            <div className="text-[10px] text-slate-600 mt-1 text-center">auto-closes in 6s</div>
          </div>
        </div>
      )}
    </div>
  );
}
