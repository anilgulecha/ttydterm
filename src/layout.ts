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
