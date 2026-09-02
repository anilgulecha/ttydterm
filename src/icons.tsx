import React from 'react';
import type { SplitAxis } from './types';

const S = { fill:'none', stroke:'currentColor', strokeWidth:1.7, strokeLinecap:'round', strokeLinejoin:'round' };
const svg = (name: string, body: React.ReactNode) => () => <svg viewBox="0 0 24 24" data-icon={name} {...S}>{body}</svg>;

export const Ico = {
  plus:  svg('plus', <path d="M12 5v14M5 12h14" />),


  gear: () => (
    <svg viewBox="0 0 24 24" data-icon="gear" fill="currentColor" fillRule="evenodd" clipRule="evenodd" stroke="none">
      <path d="M10.28 2.56A9.6 9.6 0 0 1 13.72 2.56L13.54 4.86A7.3 7.3 0 0 1 15.96 5.87L17.46 4.10A9.6 9.6 0 0 1 19.90 6.54L18.13 8.04A7.3 7.3 0 0 1 19.14 10.46L21.44 10.28A9.6 9.6 0 0 1 21.44 13.72L19.14 13.54A7.3 7.3 0 0 1 18.13 15.96L19.90 17.46A9.6 9.6 0 0 1 17.46 19.90L15.96 18.13A7.3 7.3 0 0 1 13.54 19.14L13.72 21.44A9.6 9.6 0 0 1 10.28 21.44L10.46 19.14A7.3 7.3 0 0 1 8.04 18.13L6.54 19.90A9.6 9.6 0 0 1 4.10 17.46L5.87 15.96A7.3 7.3 0 0 1 4.86 13.54L2.56 13.72A9.6 9.6 0 0 1 2.56 10.28L4.86 10.46A7.3 7.3 0 0 1 5.87 8.04L4.10 6.54A9.6 9.6 0 0 1 6.54 4.10L8.04 5.87A7.3 7.3 0 0 1 10.46 4.86ZM12 8.5A3.5 3.5 0 1 0 12 15.5A3.5 3.5 0 1 0 12 8.5Z" />
    </svg>
  ),
  close: svg('close', <path d="M6 6l12 12M18 6L6 18" />),
  menu:  svg('menu', <><circle cx="12" cy="5.6" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="12" cy="18.4" r="1.5" /></>),
  export: svg('export', <><path d="M12 3.5v11M7.8 7.8 12 3.5l4.2 4.3" /><path d="M5 12.5v6.2a1.8 1.8 0 0 0 1.8 1.8h10.4a1.8 1.8 0 0 0 1.8-1.8v-6.2" /></>),
  panel: svg('panel', <><rect x="3.5" y="4.5" width="17" height="15" rx="2" /><path d="M9.5 4.5v15" /></>),
  search: svg('search', <><circle cx="11" cy="11" r="6.2" /><path d="m20 20-4.6-4.6" /></>),
  keyboard: svg('keyboard', <><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M6 9h.01M9 9h.01M12 9h.01M15 9h.01M18 9h.01M7 12h.01M10 12h.01M13 12h.01M16 12h.01M7 15h10"/></>),
  paste:svg('paste',<><path d="M9 5h6v3H9z"/><path d="M8 6H6v14h12V6h-2M9 12h6M9 16h5"/></>),
  grip: svg('grip', <><circle cx="9" cy="6" r="1.5"/><circle cx="15" cy="6" r="1.5"/><circle cx="9" cy="12" r="1.5"/><circle cx="15" cy="12" r="1.5"/><circle cx="9" cy="18" r="1.5"/><circle cx="15" cy="18" r="1.5"/></>),
};

export const WS_ICONS: Record<string, React.ReactElement> = {
  terminal: <><rect x="3.5" y="5" width="17" height="14" rx="2" /><path d="m7 10 2.6 2.2L7 14.4M12.8 15h4" /></>,
  code:     <path d="m9 8-4 4 4 4M15 8l4 4-4 4M13.4 5.5l-2.8 13" />,
  folder:   <path d="M4 7.5A1.5 1.5 0 0 1 5.5 6h3.2l1.6 2h8.2A1.5 1.5 0 0 1 20 9.5v8A1.5 1.5 0 0 1 18.5 19h-13A1.5 1.5 0 0 1 4 17.5z" />,
  server:   <><rect x="3.5" y="4.5" width="17" height="6" rx="1.6" /><rect x="3.5" y="13.5" width="17" height="6" rx="1.6" /><path d="M7 7.5h.01M7 16.5h.01" /></>,
  database: <><ellipse cx="12" cy="6.5" rx="7" ry="2.8" /><path d="M5 6.5v11c0 1.55 3.13 2.8 7 2.8s7-1.25 7-2.8v-11M5 12c0 1.55 3.13 2.8 7 2.8s7-1.25 7-2.8" /></>,
  cloud:    <path d="M7.2 18.5h9.3a3.6 3.6 0 0 0 .4-7.18A5.1 5.1 0 0 0 7.4 10.2a4.1 4.1 0 0 0-.2 8.3z" />,
  globe:    <><circle cx="12" cy="12" r="8.2" /><path d="M3.8 12h16.4M12 3.8c2.1 2.3 3.2 5.2 3.2 8.2s-1.1 5.9-3.2 8.2c-2.1-2.3-3.2-5.2-3.2-8.2s1.1-5.9 3.2-8.2z" /></>,
  rocket:   <><path d="M12 3.2c2.9 2.2 4.4 5.2 4.4 8.4L12 15.6l-4.4-4c0-3.2 1.5-6.2 4.4-8.4z" /><path d="M7.6 12.6 5 14.4l1 3.2 2.6-1M16.4 12.6 19 14.4l-1 3.2-2.6-1" /><circle cx="12" cy="9.4" r="1.5" /></>,
  keyboard: <><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M6 9h.01M9 9h.01M12 9h.01M15 9h.01M18 9h.01M7 12h.01M10 12h.01M13 12h.01M16 12h.01M7 15h10"/></>,
  bug:      <><path d="M8.5 9.5a3.5 3.5 0 0 1 7 0v4a3.5 3.5 0 0 1-7 0z" /><path d="M9.4 7.2 8 5.4M14.6 7.2 16 5.4M8.5 11H5M19 11h-3.5M8.5 14.5 5.6 16.4M15.5 14.5l2.9 1.9" /></>,
  flask:    <><path d="M9.6 3.5v5.2L5.3 17a2 2 0 0 0 1.8 3h9.8a2 2 0 0 0 1.8-3l-4.3-8.3V3.5" /><path d="M8.6 3.5h6.8M7.4 14.5h9.2" /></>,
  box:      <><path d="M12 3.6 20 8v8l-8 4.4L4 16V8z" /><path d="M4 8l8 4.4L20 8M12 12.4V20.4" /></>,
  layers:   <><path d="m12 3.5 8 4.2-8 4.2-8-4.2z" /><path d="m4 12.2 8 4.2 8-4.2M4 16.4l8 4.2 8-4.2" /></>,
  branch:   <><circle cx="7" cy="6" r="2.2" /><circle cx="7" cy="18" r="2.2" /><circle cx="17" cy="9" r="2.2" /><path d="M7 8.2v7.6M17 11.2c0 3-3.4 3.4-6.2 4.2" /></>,
  cpu:      <><rect x="7" y="7" width="10" height="10" rx="1.6" /><path d="M10 3.6v3.4M14 3.6v3.4M10 17v3.4M14 17v3.4M3.6 10H7M3.6 14H7M17 10h3.4M17 14h3.4" /></>,
  pulse:    <path d="M3 12h4l3-7 4 14 3-7h4" />,
  shield:   <path d="M12 3.4 19 6v6c0 4-3 7.2-7 8.6-4-1.4-7-4.6-7-8.6V6z" />,
  key:      <><circle cx="8" cy="12" r="3.4" /><path d="M11.4 12H21M18 12v3M15 12v2.4" /></>,
  lock:     <><rect x="5" y="10.5" width="14" height="9.5" rx="2" /><path d="M8.4 10.5V8a3.6 3.6 0 0 1 7.2 0v2.5" /></>,
  bell:     <><path d="M17.6 16.5H6.4c1.1-1.2 1.6-2.4 1.6-4v-2a4 4 0 0 1 8 0v2c0 1.6.5 2.8 1.6 4z" /><path d="M10.4 19.4a1.9 1.9 0 0 0 3.2 0" /></>,
  book:     <><path d="M5 5.4A1.4 1.4 0 0 1 6.4 4H19v13.6H6.4A1.4 1.4 0 0 0 5 19z" /><path d="M5 19a1.4 1.4 0 0 0 1.4 1.4H19v-2.8" /></>,
  file:     <><path d="M7 3.6h6.4L18 8.2v12.2H7z" /><path d="M13.2 3.6v4.8H18M9.6 13h6M9.6 16.4h6" /></>,
  pen:      <><path d="m4 20.2 1.1-4.3L15.8 5.2a2 2 0 0 1 2.9 2.9L8 18.9z" /><path d="m14.4 6.6 3 3" /></>,
  palette:  <><path d="M12 3.6a8.4 8.4 0 0 0 0 16.8c1.2 0 1.9-.8 1.9-1.7 0-.5-.2-.9-.5-1.2a1.7 1.7 0 0 1 1.2-2.9h1.6a4.2 4.2 0 0 0 4.2-4.2c0-4-3.8-6.8-8.4-6.8z" /><circle cx="8.2" cy="10.4" r="1.1" /><circle cx="12" cy="7.8" r="1.1" /><circle cx="15.8" cy="10" r="1.1" /></>,
  camera:   <><path d="M4 8.6h3.4L9 6.2h6l1.6 2.4H20v10.2H4z" /><circle cx="12" cy="13.4" r="3.2" /></>,
  music:    <><path d="M9 18V6.2l10-2V16" /><circle cx="7" cy="18" r="2.2" /><circle cx="17" cy="16" r="2.2" /></>,
  video:    <><rect x="3.5" y="6" width="12" height="12" rx="2" /><path d="m15.5 11 5-3v8l-5-3z" /></>,
  mail:     <><rect x="3.5" y="5.5" width="17" height="13" rx="2" /><path d="m4 8 8 5.4L20 8" /></>,
  chat:     <path d="M4.5 6.6A1.6 1.6 0 0 1 6.1 5h11.8a1.6 1.6 0 0 1 1.6 1.6v7.8a1.6 1.6 0 0 1-1.6 1.6H9.2L4.5 19.6z" />,
  calendar: <><rect x="4" y="5.5" width="16" height="14.5" rx="2" /><path d="M8 3.5v4M16 3.5v4M4 10h16" /></>,
  clock:    <><circle cx="12" cy="12" r="8.2" /><path d="M12 7.4V12l3 2" /></>,
  star:     <path d="m12 3.8 2.6 5.4 5.9.8-4.3 4.1 1 5.9-5.2-2.8-5.2 2.8 1-5.9L3.5 10l5.9-.8z" />,
  heart:    <path d="M12 20.2S3.8 15.4 3.8 9.7A4.2 4.2 0 0 1 12 7.6a4.2 4.2 0 0 1 8.2 2.1c0 5.7-8.2 10.5-8.2 10.5z" />,
  flag:     <><path d="M6 20.4V4.6h11.4l-2 3.6 2 3.6H6" /><path d="M6 4.6v15.8" /></>,
  bolt:     <path d="M13.2 3 5.6 13.6H12l-1.2 7.4 7.6-10.6H12z" />,
  flame:    <path d="M12 3.4c3.4 3.2 5.4 6 5.4 9a5.4 5.4 0 0 1-10.8 0c0-1.6.8-3 2.2-4 .2 1.4.9 2.2 1.8 2.4-.4-2.6.1-5 1.4-7.4z" />,
  leaf:     <><path d="M20.2 3.8C10 3.8 4 8.9 4 15.4c0 2.6 1.6 4.8 4.2 4.8 6.6 0 12-6.2 12-16.4z" /><path d="M4.6 20 14 10.4" /></>,
  moon:     <path d="M20 14.6A8.6 8.6 0 1 1 10.4 4 6.9 6.9 0 0 0 20 14.6z" />,
  compass:  <><circle cx="12" cy="12" r="8.2" /><path d="m15.2 8.8-1.9 4.5-4.5 1.9 1.9-4.5z" /></>,
  pin:      <><path d="M12 20.8s6.4-6.1 6.4-10.4a6.4 6.4 0 1 0-12.8 0C5.6 14.7 12 20.8 12 20.8z" /><circle cx="12" cy="10.2" r="2.4" /></>,
  home:     <><path d="m4 11 8-6.6 8 6.6v8.4a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z" /><path d="M9.6 20.4v-6h4.8v6" /></>,
  wrench:   <path d="M20.2 6.4 17 9.6l-2.6-2.6 3.2-3.2a5.4 5.4 0 0 0-7 6.8L4.4 17.8a2 2 0 0 0 2.8 2.8l7.2-6.2a5.4 5.4 0 0 0 5.8-8z" />,
  gauge:    <><path d="M4.4 16.6a8.6 8.6 0 1 1 15.2 0" /><path d="m12 12.6 4-3.4" /><circle cx="12" cy="13.4" r="1.3" /></>,
  chart:    <><path d="M4 20h16" /><path d="M7 20v-6M12 20V6.5M17 20v-9" /></>,
  users:    <><circle cx="9" cy="8.4" r="3.1" /><path d="M3.6 19.4a5.4 5.4 0 0 1 10.8 0" /><path d="M16 5.6a3.1 3.1 0 0 1 0 5.9M17 14.6a5.4 5.4 0 0 1 3.4 4.8" /></>,
};
export const WS_ICON_KEYS = Object.keys(WS_ICONS);
export const WsIcon = ({ name }: { name: string }) => (
  <svg viewBox="0 0 24 24" data-icon={name} {...S}>{WS_ICONS[name]}</svg>
);

export function CountGlyph({ axis, n }: { axis: SplitAxis; n: number }) {
  const lines: React.ReactElement[] = [];
  for (let i = 1; i < n; i++) {
    const p = 3.5 + (17 * i) / n;
    lines.push(axis === 'columns'
      ? <path key={i} d={'M' + p + ' 4.5v15'} />
      : <path key={i} d={'M3.5 ' + (4.5 + (15 * i) / n) + 'h17'} />);
  }
  return <svg viewBox="0 0 24 24" data-icon={'split-' + axis + '-' + n} {...S}><rect x="3.5" y="4.5" width="17" height="15" rx="2" />{lines}</svg>;
}
