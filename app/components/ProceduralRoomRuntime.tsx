"use client";

import { Html, OrbitControls, useGLTF } from "@react-three/drei";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import type { ComponentProps, ErrorInfo, ReactNode } from "react";
import { Component, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { DoubleSide, Mesh, MeshStandardMaterial } from "three";
import styles from "./ProceduralRoomRuntime.module.css";

const ASSET_URL = "/3d-rooms/fog-lamp-evidence-room/procedural-room-candidate.glb";

type RuntimeStatus = "loading" | "ready" | "fallback";

type RuntimeMetrics = {
  frameCount: number;
  p95FrameMs: number | null;
  loadMs: number | null;
  contextLost: boolean;
};

type ErrorBoundaryProps = {
  children: ReactNode;
  fallback: ReactNode;
  onError: (error: Error) => void;
};

type ErrorBoundaryState = {
  hasError: boolean;
};

class RuntimeErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, _info: ErrorInfo) {
    this.props.onError(error);
  }

  render() {
    return this.state.hasError ? this.props.fallback : this.props.children;
  }
}

function percentile(values: number[], rank: number): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * rank) - 1)] ?? null;
}

function LoadedRoom({ onReady, onFrame }: { onReady: () => void; onFrame: (frameMs: number) => void }) {
  const model = useGLTF(ASSET_URL);

  useEffect(() => {
    model.scene.traverse((object) => {
      if (!(object instanceof Mesh)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      for (const material of materials) {
        if (material instanceof MeshStandardMaterial) {
          material.side = DoubleSide;
          material.envMapIntensity = 0.55;
          material.needsUpdate = true;
        }
      }
    });
  }, [model.scene]);

  useEffect(() => {
    onReady();
  }, [onReady]);

  useFrame((_state, delta) => {
    onFrame(delta * 1000);
  });

  return <primitive object={model.scene} dispose={null} />;
}

function RoomScene({
  reducedMotion,
  onReady,
  onFrame,
  onContextLost
}: {
  reducedMotion: boolean;
  onReady: () => void;
  onFrame: (frameMs: number) => void;
  onContextLost: () => void;
}) {
  const { gl } = useThree();

  useEffect(() => {
    const canvas = gl.domElement;
    const handleContextLost = (event: Event) => {
      event.preventDefault();
      onContextLost();
    };
    canvas.addEventListener("webglcontextlost", handleContextLost, { passive: false });
    return () => canvas.removeEventListener("webglcontextlost", handleContextLost);
  }, [gl, onContextLost]);

  return (
    <>
      <color attach="background" args={["#081217"]} />
      <ambientLight intensity={2.1} />
      <hemisphereLight color="#8ca4ad" groundColor="#111820" intensity={1.35} />
      <directionalLight position={[5, 8, 6]} intensity={3.8} color="#f7dfb0" />
      <directionalLight position={[-6, 4, -4]} intensity={1.15} color="#6f9bad" />
      <pointLight position={[0, 3.2, 2.5]} intensity={18} distance={13} decay={2} color="#f4bd6c" />
      <pointLight position={[0, 2.3, -3.2]} intensity={10} distance={11} decay={2} color="#9cc9d2" />
      <Suspense fallback={<Html center className={styles.loadingLabel}>载入候选 GLB…</Html>}>
        <group rotation-x={-Math.PI / 2}>
          <LoadedRoom onReady={onReady} onFrame={onFrame} />
        </group>
      </Suspense>
      <OrbitControls
        makeDefault
        enablePan={false}
        minDistance={4}
        maxDistance={24}
        maxPolarAngle={Math.PI * 0.49}
        target={[0, 1.35, -0.2]}
        autoRotate={!reducedMotion}
        autoRotateSpeed={0.2}
      />
    </>
  );
}

export type ProceduralRoomRuntimeProps = {
  roomId: string;
  caseId: string;
  children?: ReactNode;
};

export function ProceduralRoomRuntime({ roomId, caseId, children }: ProceduralRoomRuntimeProps) {
  const [status, setStatus] = useState<RuntimeStatus>("loading");
  const [reducedMotion, setReducedMotion] = useState(false);
  const [metrics, setMetrics] = useState<RuntimeMetrics>({ frameCount: 0, p95FrameMs: null, loadMs: null, contextLost: false });
  const startedAt = useRef(Date.now());
  const samples = useRef<number[]>([]);
  const frameCount = useRef(0);
  const lastReportAt = useRef(0);

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReducedMotion(media.matches);
    sync();
    media.addEventListener?.("change", sync);
    return () => media.removeEventListener?.("change", sync);
  }, []);

  const report = useCallback((contextLost = false) => {
    setMetrics({
      frameCount: frameCount.current,
      p95FrameMs: percentile(samples.current, 0.95),
      loadMs: metrics.loadMs,
      contextLost: contextLost || metrics.contextLost
    });
  }, [metrics.contextLost, metrics.loadMs]);

  const handleFrame = useCallback((frameMs: number) => {
    frameCount.current += 1;
    samples.current = [...samples.current.slice(-239), frameMs];
    const now = Date.now();
    if (now - lastReportAt.current >= 500) {
      lastReportAt.current = now;
      setMetrics((current) => ({
        frameCount: frameCount.current,
        p95FrameMs: percentile(samples.current, 0.95),
        loadMs: current.loadMs,
        contextLost: current.contextLost
      }));
    }
  }, []);

  const handleReady = useCallback(() => {
    const loadMs = Math.max(0, Date.now() - startedAt.current);
    setStatus("ready");
    setMetrics((current) => ({ ...current, loadMs }));
  }, []);

  const handleFailure = useCallback(() => {
    setStatus("fallback");
    report();
  }, [report]);

  const handleContextLost = useCallback(() => {
    setStatus("fallback");
    setMetrics((current) => ({ ...current, contextLost: true }));
  }, []);

  const canvasFallback = <div className={styles.canvasFallback}>WebGL 运行时不可用，已切换到程序化预览。</div>;

  return (
    <div
      className={styles.runtime}
      data-testid="procedural-room-runtime"
      data-room-id={roomId}
      data-case-id={caseId}
      data-asset-status="candidate-only"
      data-runtime-status={status}
      data-frame-count={metrics.frameCount}
      data-p95-frame-ms={metrics.p95FrameMs === null ? "" : metrics.p95FrameMs.toFixed(2)}
      data-load-ms={metrics.loadMs === null ? "" : metrics.loadMs}
      data-context-lost={metrics.contextLost ? "true" : "false"}
      data-asset-url={ASSET_URL}
    >
      <div className={`${styles.canvas} ${status === "ready" ? styles.canvasVisible : ""}`} aria-hidden={status !== "ready"}>
        <RuntimeErrorBoundary fallback={canvasFallback} onError={handleFailure}>
          <Canvas
            dpr={[1, 1.5]}
            camera={{ position: [3.2, 2.8, 2.5], fov: 48, near: 0.1, far: 100 }}
            gl={{ antialias: true, powerPreference: "high-performance", alpha: false }}
            fallback={canvasFallback}
          >
            <RoomScene reducedMotion={reducedMotion} onReady={handleReady} onFrame={handleFrame} onContextLost={handleContextLost} />
          </Canvas>
        </RuntimeErrorBoundary>
      </div>
      <div className={`${styles.fallback} ${status === "ready" ? styles.fallbackHidden : ""}`} data-testid="procedural-room-fallback" aria-hidden={status === "ready"}>
        {children}
      </div>
      <div className={styles.status} aria-live="polite">
        {status === "ready" ? "3D 候选运行时" : status === "loading" ? "载入候选空间…" : "3D 回退预览"}
      </div>
      <span className={styles.srOnly}>房间 {roomId} 的候选 GLB 运行时，案件 {caseId}。</span>
    </div>
  );
}

export const proceduralRoomRuntimeAssetUrl = ASSET_URL;

// Keep the loader cache warm when this component is mounted again during a saved-campaign transition.
useGLTF.preload(ASSET_URL);

export type ProceduralRoomCanvasProps = ComponentProps<typeof Canvas>;
