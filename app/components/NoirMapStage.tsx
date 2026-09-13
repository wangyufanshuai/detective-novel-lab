"use client";

import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { BookOpen, Check, Clock3, Compass, MapPin, Minus, Plus, Search, Users, X, Play, Pause } from "lucide-react";
import type { TownMapStageProps } from "./TownMapSurface";
import { CharacterEncounterCard } from "./CharacterEncounterCard";
import { useAppLocale } from "@/app/localization/locale-context";
import { getNoirPortrait } from "@/app/campaign/noir-player-assets";
import { useInvestigationActionExecution } from "./InvestigationActionExecution";
import type { SafeContextActionKind } from "@/app/campaign/context-action-resolver";
import styles from "./NoirMapStage.module.css";

export function NoirMapStage(props: TownMapStageProps) {
  const { locale, text, number } = useAppLocale();
  const words = (zh: string, en: string) => locale === "zh-CN" ? zh : en;
  const [zoom, setZoom] = useState(1);
  const [panel, setPanel] = useState<"locations" | "people" | "timeline" | null>(null);
  const [locationOpen, setLocationOpen] = useState(false);
  const [pendingLocation, setPendingLocation] = useState(false);
  const locationLock = useRef(false);
  const encounterLock = useRef(false);
  const lastTrigger = useRef<HTMLElement | null>(null);
  function rememberFocus() { lastTrigger.current = document.activeElement instanceof HTMLElement ? document.activeElement : null; }
  function closeDetails() { setPanel(null); setLocationOpen(false); props.onEncounterDismiss(); lastTrigger.current?.focus(); }
  useEffect(() => {
    if (!panel && !locationOpen && !props.characterEncounter) return;
    const onKey = (event: KeyboardEvent) => { if(event.key === "Escape") { event.preventDefault(); setPanel(null); setLocationOpen(false); props.onEncounterDismiss(); lastTrigger.current?.focus(); } };
    document.addEventListener("keydown",onKey);
    return () => document.removeEventListener("keydown",onKey);
  }, [panel,locationOpen,props.characterEncounter,props.onEncounterDismiss]);
  const runWithResolution = useInvestigationActionExecution();
  const places = useMemo(() => {
    const grouped = new Map<string, { id: string; name: string; x: number; y: number; count: number; searchable: boolean }>();
    for (const tile of props.snapshot?.tiles || []) {
      if (!tile.locationId) continue;
      const previous = grouped.get(tile.locationId);
      if (previous) { previous.x += tile.x + .5; previous.y += tile.y + .5; previous.count += 1; }
      else grouped.set(tile.locationId, { id: tile.locationId, name: tile.locationName || tile.locationId, x: tile.x + .5, y: tile.y + .5, count: 1, searchable: tile.searchable });
    }
    return [...grouped.values()].map(place => ({ ...place, x: place.x / place.count / (props.snapshot?.width || 28) * 100, y: place.y / place.count / (props.snapshot?.height || 28) * 100 }));
  }, [props.snapshot]);
  const people = props.snapshot?.actors || [];
  const [peopleAt, setPeopleAt] = useState<string | null>(null);
  const peopleGroups = [...props.actorsByTile.values()].filter(group => group.length > 0);
  const selectedPlace = places.find(place => place.id === props.selectedSceneId);
  const activeMarkers = (props.snapshot?.markers || []).filter(marker => marker.locationId === props.selectedSceneId && (marker.discovered || !marker.evidenceId));
  const selectedActor = people.find(actor => actor.id === props.selectedCharacterId);
  const currentPhoto = selectedActor ? getNoirPortrait(selectedActor.name) : null;
  function selectPlace(id: string) {
    rememberFocus(); setZoom(1);
    props.onEncounterDismiss();
    props.onTileClick(id); props.onTileHover(id);
    setPanel(null); setLocationOpen(true);
  }
  function togglePanel(next: typeof panel) {
    rememberFocus();
    setPeopleAt(null);
    props.onEncounterDismiss(); setLocationOpen(false);
    setPanel(current => current === next ? null : next);
  }
  async function locationAction() {
    if (locationLock.current || !props.hoverInfo) return;
    locationLock.current = true; setPendingLocation(true);
    try { await props.onLocationAction(props.hoverInfo.locationId); }
    finally { locationLock.current = false; setPendingLocation(false); }
  }
  async function encounterAction(kind: SafeContextActionKind) {
    const action = props.characterEncounter?.actions.find(item => item.kind === kind);
    if (!action?.enabled || encounterLock.current) return;
    encounterLock.current = true;
    try {
      await runWithResolution(text(action.label), async () => (await props.onEncounterAction(kind)) || { status: "blocked", detail: words("尚未确认行动结果，请查看当前调查。", "No action result confirmed. Check the investigation.") });
    } finally { encounterLock.current = false; }
  }
  const visibleLocation = locationOpen && !props.characterEncounter && !panel && props.hoverInfo;
  return <section className={styles.stage} aria-label={words("城市探索", "City exploration")} data-testid="noir-map-stage">
    <div className={styles.sceneViewport} data-testid="pixel-map" data-campaign-map-ready={props.campaignMapReady ? "true" : "false"}>
      <div className={styles.scene} style={{ "--map-zoom": zoom } as CSSProperties}>
        {props.campaignMapReady && props.campaignMapPath && <img className={styles.art} src={props.campaignMapPath} alt="" fetchPriority="high" draggable={false} />}
        <svg className={styles.network} viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
          {places.slice(1).map((place, index) => {
            const previous = places[index];
            return <line key={`${previous.id}-${place.id}`} x1={previous.x} y1={previous.y} x2={place.x} y2={place.y} />;
          })}
          {places.length > 2 && <line x1={places[places.length - 1].x} y1={places[places.length - 1].y} x2={places[0].x} y2={places[0].y} />}
        </svg>
        <div className={styles.points}>
          {places.map((place, index) => <button key={place.id} type="button" className={`${styles.place} ${place.id === props.selectedSceneId ? styles.selected : ""}`} style={{ left: `${place.x}%`, top: `${place.y}%` }} onClick={() => selectPlace(place.id)} onFocus={() => props.onTileHover(place.id)} aria-label={text(place.name)} title={text(place.name)} aria-pressed={place.id === props.selectedSceneId}>
            <span className={styles.pin}><MapPin size={18} aria-hidden="true" /></span><span className={styles.placeName}><small>{String(index + 1).padStart(2, "0")}</small>{text(place.name)}</span>
          </button>)}
          {peopleGroups.map(group => { const actor=group[0]; return <button type="button" key={`${actor.x}:${actor.y}`} className={styles.personPin} style={{left:`${(actor.x+.5)/(props.snapshot?.width||28)*100}%`,top:`${(actor.y+.5)/(props.snapshot?.height||18)*100}%`}} aria-label={words(`${text(actor.locationName)}的人物：${group.map(person=>text(person.name)).join('、')}`,`People at ${text(actor.locationName)}: ${group.map(person=>text(person.name)).join(', ')}`)} onClick={()=>{rememberFocus(); setPeopleAt(actor.locationId);setPanel('people');setLocationOpen(false);props.onEncounterDismiss();}}><Users size={17}/><small>{group.length}</small></button>; })}
        </div>
      </div>
      <div className={styles.caption} data-goal8-objective="true"><span>{words("当前调查 / 下一步", "CURRENT INVESTIGATION / NEXT STEP")}</span><h2>{words("先选一个地点或人物。", "Choose a place or person.")}</h2><p>{words("地图会记录你看到的变化。", "The town records what you uncover.")}</p></div>
      <div className={styles.mapTools} aria-label={words("地图工具", "Map tools")}>
        <button onClick={() => togglePanel("locations")} aria-pressed={panel === "locations"}><Compass size={17} />{words("地点", "Places")}<small>{number(places.length)}</small></button>
        <button onClick={() => togglePanel("people")} aria-pressed={panel === "people"}><Users size={17} />{words("人物", "People")}<small>{number(people.length)}</small></button>
        <button onClick={() => togglePanel("timeline")} aria-pressed={panel === "timeline"}><Clock3 size={17} />{words("时间线", "Timeline")}</button>
      </div>
      <div className={styles.zoom} aria-label={words("地图缩放", "Map zoom")}>
        <button aria-label={words("缩小地图", "Zoom out")} disabled={zoom <= 1} onClick={() => setZoom(value => Math.max(1, value - .1))}><Minus size={18} /></button>
        <button aria-label={words("重置地图缩放", "Reset map zoom")} onClick={() => setZoom(1)}>{Math.round(zoom * 100)}%</button>
        <button aria-label={words("放大地图", "Zoom in")} disabled={zoom >= 1.5} onClick={() => setZoom(value => Math.min(1.5, value + .1))}><Plus size={18} /></button>
      </div>
      <div className={styles.sceneFooter}><span><span className={styles.liveDot} />{props.currentTime}</span><span>{selectedPlace ? text(selectedPlace.name) : words("雨幕之下，线索仍在。", "The city keeps its secrets.")}</span><span>{words("公开调查地图", "Public investigation map")}</span></div>
      {panel && <aside className={styles.index} aria-label={words("探索目录", "Exploration index")}>
        <header><span>{panel === "locations" ? words("地点索引", "Location index") : panel === "people" ? words("人物档案", "People") : words("城市时间线", "City timeline")}</span><button aria-label={words("关闭探索目录", "Close exploration index")} onClick={closeDetails}><X size={18} /></button></header>
        {panel === "locations" && <div className={styles.indexList}>{places.map((place, index) => <button key={place.id} onClick={() => selectPlace(place.id)}><span>{String(index + 1).padStart(2, "0")}</span><b>{text(place.name)}</b><MapPin size={15} /></button>)}</div>}
        {panel === "people" && <div className={styles.indexList}>{people.filter(actor => !peopleAt || actor.locationId === peopleAt).map(actor => { const photo = getNoirPortrait(actor.name); return <button key={actor.id} onClick={() => { rememberFocus(); setPanel(null); setLocationOpen(false); props.onActorClick(actor); }}>{photo ? <img src={photo.src} alt="" /> : <Users size={20} />}<span><b>{text(actor.name)}</b><small>{text(actor.role)}</small></span></button>; })}</div>}
        {panel === "timeline" && <div className={styles.timePanel}><Clock3 size={28} /><strong>{props.minutesToTime(props.timeValue)}</strong><p>{words("回看公开事件与人物位置。", "Review public events and the positions of people.")}</p><button className={styles.primary} onClick={() => props.setReplaying(value => !value)}>{props.replaying ? <Pause size={16} /> : <Play size={16} />}{props.replaying ? words("暂停回放", "Pause replay") : words("播放回放", "Play replay")}</button><input type="range" aria-label={words("时间线回放控制", "Timeline replay control")} min={props.timeMin} max={props.timeMax} step={10} value={props.timeValue} onChange={event => props.setTimeValue(Number(event.target.value))} /><div className={styles.timeTicks}>{["08:00", "12:00", "16:00", "20:00", "23:00"].map(time => <button key={time} onClick={() => props.setTimeValue(props.timeToMinutes(time))}>{time}</button>)}</div></div>}
      </aside>}
      {visibleLocation && <aside className={styles.locationCard} aria-label={words("当前地点", "Selected place")} data-testid="location-hover-card">
        <header><span>FIELD NOTE / {words("调查地点", "LOCATION")}</span><button aria-label={words("关闭地点详情", "Close location details")} onClick={closeDetails}><X size={18} /></button></header>
        <h3>{text(props.hoverInfo!.name)}</h3><p>{text(props.hoverInfo!.recentEvent || words("仔细观察这里，寻找可以核实的事实。", "Look closely for facts you can verify."))}</p>
        <div className={styles.evidenceCount}><BookOpen size={17} />{words("已发现线索", "Discovered clues")}<strong>{number(props.hoverInfo!.discovered)} / {number(props.hoverInfo!.total)}</strong></div>
        {activeMarkers.length > 0 && <div className={styles.markers}>{activeMarkers.map(marker => <button key={marker.id} onClick={() => props.onMarkerClick(marker)}>{marker.discovered ? <Check size={15} /> : <Search size={15} />}{text(marker.label)}</button>)}</div>}
        <button className={styles.primary} disabled={pendingLocation} onClick={locationAction}><Search size={17} />{pendingLocation ? words("正在调查…", "Investigating…") : props.hoverInfo!.searchable ? words("搜索此处", "Search this place") : words("查看此处", "Inspect this place")}</button>
      </aside>}
      {props.characterEncounter && !panel && <div className={styles.encounter} data-testid="character-encounter-shell">{currentPhoto && <img className={styles.encounterPortrait} src={currentPhoto.src} alt={text(props.characterEncounter.actorName)} />}<CharacterEncounterCard encounter={props.characterEncounter} onAction={encounterAction} onDismiss={closeDetails} /></div>}
    </div>
  </section>;
}
