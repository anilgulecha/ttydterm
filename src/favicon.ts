import type { Theme } from './types';

export type FaviconState = 'normal' | 'attention';

const color = (value:string,fallback:string):string => /^#[0-9a-f]{6}$/i.test(value) ? value : fallback;

export const faviconSvg=(theme:Theme,state:FaviconState):string=>{
  const background=color(theme.bg,'#11141c');
  const edge=color(theme.ui.edge,'#7b7e85');
  const foreground=color(theme.fg,'#c8d1e4');
  const accent=color(theme.blue,'#7aa2f7');
  const warning=color(theme.ui.warning,'#e0af68');
  const badge=state==='attention'
    ? `<circle cx="52" cy="12" r="9" fill="${warning}" stroke="${background}" stroke-width="4"/>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" data-state="${state}"><rect x="2" y="2" width="60" height="60" rx="14" fill="${background}" stroke="${edge}" stroke-width="4"/><path d="M16 20l11 10-11 10" fill="none" stroke="${foreground}" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/><path d="M33 40h15" fill="none" stroke="${accent}" stroke-width="5" stroke-linecap="round"/>${badge}</svg>`;
};

export const faviconHref=(theme:Theme,state:FaviconState):string=>
  'data:image/svg+xml,'+encodeURIComponent(faviconSvg(theme,state));

export const updateFavicon=(theme:Theme,state:FaviconState,documentRoot:Document=document):void=>{
  const link=documentRoot.querySelector<HTMLLinkElement>('link[data-ttydterm-favicon]');
  if(!link)return;
  const href=faviconHref(theme,state);
  if(link.getAttribute('href')!==href)link.setAttribute('href',href);
  link.dataset.state=state;
};
