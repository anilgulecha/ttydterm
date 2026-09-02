import type { LayoutNode, PaneNode, SplitAxis } from './types';

export const MIN_PANE_WIDTH=260;
export const MIN_PANE_HEIGHT=140;

export const uid=(prefix:string)=>prefix+Math.random().toString(36).slice(2,9);
export const pane=(command:string,persist=false):PaneNode=>({type:'pane',id:uid('p-'),command,persist});
export const equal=(count:number)=>Array.from({length:count},()=>1/count);

export const normalize=(sizes:number[]):number[]=>{
  const clean=sizes.map((size)=>Number.isFinite(size)&&size>0?size:0.0001);
  const sum=clean.reduce((total,size)=>total+size,0);
  return clean.map((size)=>size/sum);
};

export function nodeMin(node:LayoutNode|null,gap:number):{w:number;h:number}{
  if(!node||node.type==='pane')return {w:MIN_PANE_WIDTH,h:MIN_PANE_HEIGHT};
  const children=node.children.map((child)=>nodeMin(child,gap));
  const gaps=(node.children.length-1)*gap;
  if(node.axis==='columns')return {
    w:Math.max(...children.map((child,index)=>child.w/Math.max(node.sizes[index],1e-4)))+gaps,
    h:Math.max(...children.map((child)=>child.h)),
  };
  return {
    w:Math.max(...children.map((child)=>child.w)),
    h:Math.max(...children.map((child,index)=>child.h/Math.max(node.sizes[index],1e-4)))+gaps,
  };
}

export const mapTree=(node:LayoutNode|null,fn:(node:LayoutNode)=>LayoutNode):LayoutNode|null=>{
  if(!node)return null;
  const next=fn(node);
  if(next!==node)return next;
  if(node.type!=='split')return node;
  const children=node.children.map((child)=>mapTree(child,fn)).filter((child):child is LayoutNode=>!!child);
  return children.some((child,index)=>child!==node.children[index])?{...node,children}:node;
};

export const splitPane=(root:LayoutNode|null,paneId:string,axis:SplitAxis,count:number,persist=false):LayoutNode|null=>
  mapTree(root,(node)=>{
    if(node.type!=='pane'||node.id!==paneId)return node;
    const extra=Array.from({length:count-1},()=>pane('bash',persist));
    return {type:'split',axis,sizes:equal(count),children:[node,...extra]};
  });

export function removePane(node:LayoutNode|null,paneId:string):LayoutNode|null{
  if(!node)return null;
  if(node.type==='pane')return node.id===paneId?null:node;
  const children:LayoutNode[]=[],sizes:number[]=[];
  node.children.forEach((child,index)=>{const next=removePane(child,paneId);if(next){children.push(next);sizes.push(node.sizes[index])}});
  if(!children.length)return null;
  if(children.length===1)return children[0];
  return {...node,children,sizes:normalize(sizes)};
}

export const eachPane=(node:LayoutNode|null,visit:(pane:PaneNode)=>void):void=>{
  if(!node)return;
  if(node.type==='pane')visit(node);
  else node.children.forEach((child)=>eachPane(child,visit));
};

export const findPane=(node:LayoutNode|null,id:string|undefined):PaneNode|null=>{
  let found:PaneNode|null=null;
  eachPane(node,(candidate)=>{if(candidate.id===id)found=candidate});
  return found;
};

export const countPanes=(node:LayoutNode|null):number=>{let count=0;eachPane(node,()=>count++);return count};
export const listPanes=(node:LayoutNode|null):PaneNode[]=>{const panes:PaneNode[]=[];eachPane(node,(item)=>panes.push(item));return panes};

/* Exchange two panes in place. Split axes and sizes never move, so only the two
   leaves trade positions and every other branch keeps its identity. */
export function swapPanes(node:LayoutNode|null,a:string,b:string):LayoutNode|null{
  if(!node||a===b)return node;
  const first=findPane(node,a),second=findPane(node,b);
  if(!first||!second)return node;
  return mapTree(node,(current)=>{
    if(current.type!=='pane')return current;
    if(current.id===a)return second;
    if(current.id===b)return first;
    return current;
  });
}

export interface Frame { x:number; y:number; w:number; h:number }
export interface PaneFrame extends Frame { pane:PaneNode }
export interface DividerFrame extends Frame {
  key:string;
  axis:SplitAxis;
  path:number[];
  index:number;
  /* Drawable span excluding this split's gutters, used by resize math. */
  available:number;
  /* Share of the split consumed before this divider, for aria-valuenow. */
  before:number;
}
export interface LayoutFrames { panes:PaneFrame[]; dividers:DividerFrame[] }

/* Flatten the layout tree into absolute boxes. Rendering panes from this list
   keeps every pane a direct, stably keyed child, so exchanging panes across
   branches cannot unmount a live terminal. */
export function layoutFrames(node:LayoutNode|null,box:Frame,gap:number,path:number[]=[]):LayoutFrames{
  if(!node)return {panes:[],dividers:[]};
  if(node.type==='pane')return {panes:[{pane:node,...box}],dividers:[]};
  const panes:PaneFrame[]=[],dividers:DividerFrame[]=[];
  const columns=node.axis==='columns';
  const total=(columns?box.w:box.h)-(node.children.length-1)*gap;
  let offset=columns?box.x:box.y,before=0;
  node.children.forEach((child,index)=>{
    const span=total*node.sizes[index];
    const childBox:Frame=columns
      ? {x:offset,y:box.y,w:span,h:box.h}
      : {x:box.x,y:offset,w:box.w,h:span};
    const nested=layoutFrames(child,childBox,gap,path.concat(index));
    panes.push(...nested.panes);dividers.push(...nested.dividers);
    offset+=span;
    if(index<node.children.length-1){
      before+=node.sizes[index];
      dividers.push({
        key:path.join('-')+':'+index,
        axis:node.axis,path,index,available:total,before,
        ...(columns
          ? {x:offset,y:box.y,w:gap,h:box.h}
          : {x:box.x,y:offset,w:box.w,h:gap}),
      });
      offset+=gap;
    }
  });
  return {panes,dividers};
}

export type Direction='left'|'right'|'up'|'down';

/* Pick the nearest pane in one direction from rendered geometry. Keyboard
   exchange uses this so arrow keys follow what the user sees. */
export function neighborPane(frames:PaneFrame[],fromId:string,direction:Direction):PaneNode|null{
  const from=frames.find((frame)=>frame.pane.id===fromId);
  if(!from)return null;
  const fromCx=from.x+from.w/2,fromCy=from.y+from.h/2;
  let best:PaneFrame|null=null,bestScore=Infinity;
  for(const frame of frames){
    if(frame.pane.id===fromId)continue;
    const cx=frame.x+frame.w/2,cy=frame.y+frame.h/2;
    const dx=cx-fromCx,dy=cy-fromCy;
    const along=direction==='left'?-dx:direction==='right'?dx:direction==='up'?-dy:dy;
    if(along<=0.5)continue;
    const across=direction==='left'||direction==='right'?Math.abs(dy):Math.abs(dx);
    const overlap=direction==='left'||direction==='right'
      ? Math.min(from.y+from.h,frame.y+frame.h)-Math.max(from.y,frame.y)
      : Math.min(from.x+from.w,frame.x+frame.w)-Math.max(from.x,frame.x);
    /* Prefer panes that share an edge band, then the closest one. */
    const score=along+across*(overlap>0?0.35:4);
    if(score<bestScore){bestScore=score;best=frame}
  }
  return best?best.pane:null;
}
