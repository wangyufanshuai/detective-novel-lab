"use client";

import { useEffect, useMemo, useRef } from "react";
import type { NovelGameSceneState, NovelGameVisualProfile } from "@/lib/engine";

type NovelGameSelection =
  | { type: "actor"; id: string }
  | { type: "location"; id: string }
  | { type: "event"; id: string; stepId: string };

type PhaserLikeGame = {
  destroy(removeCanvas?: boolean): void;
  scene: { getScene(key: string): { updateSceneState?: (state: NovelGameSceneState, visualProfile: NovelGameVisualProfile) => void } | undefined };
};

type Props = {
  state: NovelGameSceneState;
  visualProfile: NovelGameVisualProfile;
  onSelect: (selection: NovelGameSelection) => void;
};

const sceneKey = "NovelObserverScene";

export default function NovelGameCanvas({ state, visualProfile, onSelect }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const gameRef = useRef<PhaserLikeGame | null>(null);
  const selectRef = useRef(onSelect);
  const stateRef = useRef(state);
  const profileRef = useRef(visualProfile);

  selectRef.current = onSelect;
  stateRef.current = state;
  profileRef.current = visualProfile;

  const stateKey = useMemo(() => JSON.stringify({
    id: state.id,
    stepIndex: state.stepIndex,
    selected: state.selected,
    actors: state.actors.map((actor) => [actor.id, actor.x, actor.y, actor.selected]),
    events: state.events.map((event) => [event.id, event.x, event.y, event.active, event.provenance]),
    locations: state.locations.map((location) => [location.id, location.x, location.y, location.active]),
    profile: {
      id: visualProfile.id,
      preferences: visualProfile.preferences,
      sprites: visualProfile.sprites.map((sprite) => [sprite.actorId, sprite.textureKey, sprite.palette.primary, sprite.pressureBand]),
      locations: visualProfile.locations.map((location) => [location.locationId, location.textureKey, location.palette.ground, location.tensionBand]),
      effects: visualProfile.effects.map((effect) => [effect.id, effect.kind, effect.targetId, effect.intensity])
    }
  }), [state, visualProfile]);

  useEffect(() => {
    let disposed = false;
    async function mount() {
      if (!containerRef.current || gameRef.current) return;
      const Phaser = await import("phaser");
      if (disposed || !containerRef.current) return;

      class NovelObserverScene extends Phaser.Scene {
        private currentState!: NovelGameSceneState;
        private currentProfile!: NovelGameVisualProfile;
        private generatedTextures = new Set<string>();

        constructor() {
          super(sceneKey);
        }

        init(data?: { state?: NovelGameSceneState; visualProfile?: NovelGameVisualProfile }) {
          this.currentState = data?.state || stateRef.current;
          this.currentProfile = data?.visualProfile || profileRef.current;
        }

        create() {
          this.cameras.main.setBackgroundColor("#071019");
          this.renderScene();
        }

        updateSceneState(nextState: NovelGameSceneState, nextProfile: NovelGameVisualProfile) {
          this.currentState = nextState;
          this.currentProfile = nextProfile;
          this.renderScene();
        }

        private color(value: string) {
          return Number.parseInt(value.replace("#", ""), 16);
        }

        private ensureTextures() {
          for (const tile of this.currentProfile.locations) {
            if (this.generatedTextures.has(tile.textureKey)) continue;
            const graphics = this.add.graphics();
            graphics.fillStyle(this.color(tile.palette.ground), 1);
            graphics.fillRect(0, 0, 128, 64);
            graphics.lineStyle(2, this.color(tile.palette.wall), 1);
            for (let x = 0; x <= 128; x += 16) graphics.lineBetween(x, 0, x, 64);
            for (let y = 0; y <= 64; y += 16) graphics.lineBetween(0, y, 128, y);
            graphics.fillStyle(this.color(tile.palette.wall), 0.85);
            graphics.fillRect(8, 8, 22, 12);
            graphics.fillRect(84, 12, 28, 12);
            graphics.fillRect(46, 36, 36, 14);
            graphics.fillStyle(this.color(tile.palette.accent), 0.92);
            graphics.fillRect(8, 52, 112, 4);
            graphics.fillStyle(this.color(tile.palette.heat), tile.tensionBand === "high" ? 0.75 : 0.36);
            graphics.fillRect(0, 0, 128, 5);
            graphics.generateTexture(tile.textureKey, 128, 64);
            graphics.destroy();
            this.generatedTextures.add(tile.textureKey);
          }
          for (const sprite of this.currentProfile.sprites) {
            if (this.generatedTextures.has(sprite.textureKey)) continue;
            const graphics = this.add.graphics();
            graphics.fillStyle(0x000000, 0);
            graphics.fillRect(0, 0, 32, 40);
            graphics.fillStyle(this.color(sprite.palette.outline), 1);
            graphics.fillRect(9, 4, 14, 12);
            graphics.fillRect(7, 15, 18, 17);
            graphics.fillRect(8, 31, 6, 6);
            graphics.fillRect(18, 31, 6, 6);
            graphics.fillStyle(this.color(sprite.palette.accent), 1);
            graphics.fillRect(11, 6, 10, 8);
            graphics.fillStyle(this.color(sprite.palette.primary), 1);
            graphics.fillRect(9, 16, 14, 15);
            graphics.fillStyle(this.color(sprite.palette.secondary), 1);
            graphics.fillRect(6, 18, 4, 10);
            graphics.fillRect(22, 18, 4, 10);
            graphics.fillStyle(sprite.pressureBand === "critical" ? 0xff6f74 : sprite.pressureBand === "strained" ? 0xffe06a : 0x65ffc4, 1);
            graphics.fillRect(12, 34, 8, 3);
            if (sprite.bodyCapabilityBand === "strong") {
              graphics.fillStyle(0xffffff, 0.8);
              graphics.fillRect(13, 16, 6, 3);
            }
            graphics.generateTexture(sprite.textureKey, 32, 40);
            graphics.destroy();
            this.generatedTextures.add(sprite.textureKey);
          }
        }

        private label(text: string, x: number, y: number, size = "11px") {
          return this.add.text(x, y, text, {
            fontFamily: "monospace",
            fontSize: size,
            color: "#d8e9f6",
            align: "center",
            wordWrap: { width: 110 }
          }).setOrigin(0.5);
        }

        private renderScene() {
          this.children.removeAll(true);
          this.ensureTextures();
          const width = this.scale.width;
          const height = this.scale.height;
          const scaleX = width / 1000;
          const scaleY = height / 600;
          const sx = (value: number) => value * scaleX;
          const sy = (value: number) => value * scaleY;
          const locationMap = new Map(this.currentState.locations.map((location) => [location.id, location]));
          const tileMap = new Map(this.currentProfile.locations.map((location) => [location.locationId, location]));
          const spriteMap = new Map(this.currentProfile.sprites.map((sprite) => [sprite.actorId, sprite]));
          const effectMap = new Map(this.currentProfile.effects.map((effect) => [`${effect.targetType}:${effect.targetId}:${effect.kind}`, effect]));
          const showLabel = (kind: "actor" | "location" | "event", active: boolean) => this.currentProfile.preferences.labels === "all" || (this.currentProfile.preferences.labels === "focus" && active) || (kind === "event" && active);
          const pixelScale = this.currentProfile.preferences.pixelScale;

          const grid = this.add.graphics();
          grid.lineStyle(1, 0x1a2a36, 0.65);
          for (let x = 0; x <= width; x += 32) grid.lineBetween(x, 0, x, height);
          for (let y = 0; y <= height; y += 32) grid.lineBetween(0, y, width, y);

          for (const path of this.currentState.paths) {
            const from = locationMap.get(path.fromLocationId);
            const to = locationMap.get(path.toLocationId);
            if (!from || !to) continue;
            const graphics = this.add.graphics();
            graphics.lineStyle(path.active ? 4 : 2, path.active ? 0x65ffc4 : 0x42647d, path.active ? 0.8 : 0.45);
            graphics.lineBetween(sx(from.x), sy(from.y), sx(to.x), sy(to.y));
          }

          for (const location of this.currentState.locations) {
            const active = location.active || this.currentState.selected?.type === "location" && this.currentState.selected.id === location.id;
            const x = sx(location.x);
            const y = sy(location.y);
            const tile = tileMap.get(location.id);
            const heat = effectMap.get(`location:${location.id}:evidence-heat`);
            if (heat) {
              const glow = this.add.rectangle(x, y, 142 * pixelScale, 78 * pixelScale, this.color(heat.color), 0.08 + heat.intensity * 0.18);
              glow.setStrokeStyle(2, this.color(heat.color), 0.35);
            }
            const image = tile ? this.add.image(x, y, tile.textureKey) : this.add.rectangle(x, y, 116, 54, active ? 0x103729 : 0x0c131b, 0.94);
            image.setDisplaySize(118 * pixelScale, 58 * pixelScale);
            image.setInteractive({ useHandCursor: true });
            image.on("pointerdown", () => selectRef.current({ type: "location", id: location.id }));
            if (active) this.add.rectangle(x, y, 128 * pixelScale, 68 * pixelScale).setStrokeStyle(3, 0x65ffc4, 0.88);
            if (showLabel("location", active)) this.label(location.label, x, y - 6 * pixelScale, "11px");
            this.add.text(x - 52 * pixelScale, y + 18 * pixelScale, `${location.tension}`, { fontFamily: "monospace", fontSize: "9px", color: tile?.palette.heat || "#ffe06a" }).setOrigin(0, 0.5);
          }

          for (const event of this.currentState.events) {
            const effect = this.currentProfile.effects.find((item) => item.targetType === "event" && item.targetId === event.id);
            const color = this.color(effect?.color || (event.provenance === "counterfactual" ? "#ff9f6a" : event.provenance === "gap" ? "#ffe06a" : "#8cc7ff"));
            const x = sx(event.x);
            const y = sy(event.y);
            const radius = (event.active ? 15 : 11) * pixelScale;
            if (effect?.kind === "branch-glitch") {
              this.add.rectangle(x - 5, y - 5, radius * 2.4, 4, 0xff9f6a, 0.62).setAngle(-9);
              this.add.rectangle(x + 7, y + 7, radius * 2.1, 3, 0xff6f74, 0.54).setAngle(7);
            }
            if (effect?.kind === "evidence-gap") this.add.circle(x, y, radius + 8, 0xffe06a, 0.18).setStrokeStyle(2, 0xffe06a, 0.6);
            if (effect?.kind === "source-pulse") this.add.circle(x, y, radius + 6, 0x8cc7ff, event.active ? 0.2 : 0.08);
            const bubble = this.add.circle(x, y, radius, color, event.active ? 0.95 : 0.72);
            bubble.setStrokeStyle(2, 0x071019, 0.95);
            bubble.setInteractive({ useHandCursor: true });
            bubble.on("pointerdown", () => selectRef.current({ type: "event", id: event.id, stepId: event.stepId }));
            this.add.text(x, y, event.provenance === "counterfactual" ? "B" : event.provenance === "gap" ? "!" : "E", {
              fontFamily: "monospace",
              fontSize: "10px",
              color: "#071019",
              fontStyle: "bold"
            }).setOrigin(0.5);
            if (showLabel("event", event.active)) this.label(event.label, x, y + radius + 14, "9px");
          }

          for (const actor of this.currentState.actors) {
            const x = sx(actor.x);
            const y = sy(actor.y);
            const sprite = spriteMap.get(actor.id);
            const trail = effectMap.get(`actor:${actor.id}:motion-trail`);
            if (trail) {
              for (let index = 1; index <= 3; index += 1) this.add.rectangle(x - index * 9, y + index * 2, 18 * pixelScale, 8, this.color(trail.color), trail.intensity / (index * 4));
            }
            const shadow = this.add.rectangle(x + 3, y + 12, 24 * pixelScale, 8, 0x000000, 0.35);
            shadow.setOrigin(0.5);
            const actorSprite = sprite ? this.add.image(x, y, sprite.textureKey) : this.add.rectangle(x, y, 24, 30, actor.selected ? 0xffe06a : 0x65ffc4, 0.96);
            actorSprite.setDisplaySize(32 * pixelScale, 40 * pixelScale);
            actorSprite.setInteractive({ useHandCursor: true });
            actorSprite.on("pointerdown", () => selectRef.current({ type: "actor", id: actor.id }));
            if (actor.selected) this.add.rectangle(x, y, 39 * pixelScale, 47 * pixelScale).setStrokeStyle(3, 0xffe06a, 0.96);
            this.add.text(x, y - 2 * pixelScale, actor.label.slice(0, 1), {
              fontFamily: "monospace",
              fontSize: "13px",
              color: "#071019",
              fontStyle: "bold"
            }).setOrigin(0.5);
            if (showLabel("actor", actor.selected)) this.label(actor.label, x, y + 31 * pixelScale, "9px");
          }

          const hud = this.add.text(12, 10, `${this.currentState.mode} / ${this.currentState.status} / step ${this.currentState.stepIndex}`, {
            fontFamily: "monospace",
            fontSize: "12px",
            color: "#65ffc4",
            backgroundColor: "#071019",
            padding: { left: 6, right: 6, top: 4, bottom: 4 }
          });
          hud.setDepth(20);
        }
      }

      gameRef.current = new Phaser.Game({
        type: Phaser.AUTO,
        parent: containerRef.current,
        width: containerRef.current.clientWidth || 720,
        height: containerRef.current.clientHeight || 430,
        backgroundColor: "#071019",
        pixelArt: true,
        scene: NovelObserverScene,
        scale: {
          mode: Phaser.Scale.RESIZE,
          autoCenter: Phaser.Scale.CENTER_BOTH
        },
        callbacks: {
          postBoot: (game) => {
            const scene = game.scene.getScene(sceneKey) as unknown as { updateSceneState?: (state: NovelGameSceneState, visualProfile: NovelGameVisualProfile) => void };
            scene.updateSceneState?.(stateRef.current, profileRef.current);
          }
        }
      }) as unknown as PhaserLikeGame;
    }
    void mount();
    return () => {
      disposed = true;
      gameRef.current?.destroy(true);
      gameRef.current = null;
    };
  }, []);

  useEffect(() => {
    const scene = gameRef.current?.scene.getScene(sceneKey);
    scene?.updateSceneState?.(state, visualProfile);
  }, [state, stateKey]);

  return (
    <div ref={containerRef} className="novelGameCanvas" data-testid="novel-game-canvas">
      <div className="novelGameOverlay" aria-label="Game selection layer">
        {state.locations.map((location) => (
          <button
            key={`location-${location.id}`}
            type="button"
            className={`gameHit gameHitLocation${location.active ? " active" : ""}`}
            style={{ left: `${location.x / 10}%`, top: `${location.y / 6}%` }}
            title={`Location: ${location.label}`}
            data-testid={`game-location-${location.id}`}
            onClick={() => onSelect({ type: "location", id: location.id })}
          >
            <span>{location.label}</span>
          </button>
        ))}
        {state.events.map((event) => (
          <button
            key={`event-${event.id}`}
            type="button"
            className={`gameHit gameHitEvent ${event.provenance}${event.active ? " active" : ""}`}
            style={{ left: `${event.x / 10}%`, top: `${event.y / 6}%` }}
            title={`${event.provenance}: ${event.summary}`}
            data-testid={`game-event-${event.stepId}`}
            onClick={() => onSelect({ type: "event", id: event.id, stepId: event.stepId })}
          >
            <span>{event.provenance}</span>
          </button>
        ))}
        {state.actors.map((actor) => (
          <button
            key={`actor-${actor.id}`}
            type="button"
            className={`gameHit gameHitActor${actor.selected ? " active" : ""}`}
            style={{ left: `${actor.x / 10}%`, top: `${actor.y / 6}%` }}
            title={`Actor: ${actor.label}`}
            data-testid={`game-actor-${actor.id}`}
            onClick={() => onSelect({ type: "actor", id: actor.id })}
          >
            <span>{actor.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
