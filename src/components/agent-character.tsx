"use client";

import { useEffect, useRef, useState } from "react";
import type { AnimationAction, AnimationMixer } from "three";
import { cn } from "@/lib/utils";

export type AgentState = "idle" | "listening" | "speaking" | "congratz";

const CLIPS: Record<AgentState, string> = {
  idle: "Stay",
  listening: "listening_0",
  speaking: "speaking_0",
  congratz: "congratz_1",
};

const MODEL_URL = "/agent.glb";
const FRAME_MS = 1000 / 30; // 30fps is plenty for an idle mascot and saves battery
const FADE_S = 0.35;

type Rig = {
  mixer: AnimationMixer;
  actions: Partial<Record<AgentState, AnimationAction>>;
  current: AgentState;
};

function webglAvailable() {
  try {
    const c = document.createElement("canvas");
    return Boolean(window.WebGLRenderingContext && (c.getContext("webgl2") || c.getContext("webgl")));
  } catch {
    return false;
  }
}

export function AgentCharacter({
  state = "idle",
  className,
  interactive = false,
  label = "Your ACDC agent",
}: {
  state?: AgentState;
  className?: string;
  interactive?: boolean;
  label?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const rigRef = useRef<Rig | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [unsupported, setUnsupported] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    // No WebGL: stay an invisible, empty box rather than showing a broken canvas.
    if (!webglAvailable()) return;

    let disposed = false;
    let raf = 0;
    let visible = true;
    const cleanups: (() => void)[] = [];

    (async () => {
      const THREE = await import("three");
      const { GLTFLoader } = await import("three/examples/jsm/loaders/GLTFLoader.js");
      if (disposed) return;

      const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      container.appendChild(renderer.domElement);
      renderer.domElement.style.width = "100%";
      renderer.domElement.style.height = "100%";

      const scene = new THREE.Scene();
      scene.add(new THREE.HemisphereLight(0xffffff, 0x2a2a33, 2.2));
      const key = new THREE.DirectionalLight(0xffffff, 2);
      key.position.set(2, 3, 4);
      scene.add(key);
      const camera = new THREE.PerspectiveCamera(30, 1, 0.01, 1000);

      let bounds: { size: import("three").Vector3; center: import("three").Vector3 } | null = null;
      // Fit the whole character in both directions: tall-narrow canvases would otherwise clip the arms.
      const frame = () => {
        if (!bounds) return;
        const { size, center } = bounds;
        const halfFov = THREE.MathUtils.degToRad(camera.fov / 2);
        const fitH = size.y / 2 / Math.tan(halfFov);
        const fitW = size.x / 2 / (Math.tan(halfFov) * camera.aspect);
        const dist = Math.max(fitH, fitW) * 1.15 + size.z / 2;
        camera.position.set(center.x, center.y, center.z + dist);
        camera.lookAt(center);
        camera.far = dist * 10;
        camera.updateProjectionMatrix();
      };
      const resize = () => {
        const { width, height } = container.getBoundingClientRect();
        if (!width || !height) return;
        renderer.setSize(width, height, false);
        camera.aspect = width / height;
        camera.updateProjectionMatrix();
        frame();
      };
      const ro = new ResizeObserver(resize);
      ro.observe(container);
      resize();

      const gltf = await new GLTFLoader().loadAsync(MODEL_URL);
      if (disposed) return;
      const model = gltf.scene;
      scene.add(model);

      const mixer = new THREE.AnimationMixer(model);
      const actions: Rig["actions"] = {};
      for (const [s, name] of Object.entries(CLIPS) as [AgentState, string][]) {
        const clip = gltf.animations.find((a) => a.name === name);
        if (!clip) continue;
        const action = mixer.clipAction(clip);
        if (s === "congratz") {
          action.setLoop(THREE.LoopOnce, 1);
          action.clampWhenFinished = true;
        }
        actions[s] = action;
      }
      actions.idle?.play();
      rigRef.current = { mixer, actions, current: "idle" };

      // Frame the character from its posed bounds (the rest pose is offset from the animated one).
      mixer.update(0.5);
      model.updateMatrixWorld(true);
      const box = new THREE.Box3().setFromObject(model, true);
      bounds = { size: box.getSize(new THREE.Vector3()), center: box.getCenter(new THREE.Vector3()) };
      frame();

      mixer.addEventListener("finished", (e) => {
        const rig = rigRef.current;
        if (!rig || e.action !== rig.actions.congratz) return;
        const idle = rig.actions.idle;
        if (idle) {
          idle.reset().fadeIn(FADE_S).play();
          rig.actions.congratz?.fadeOut(FADE_S);
        }
        rig.current = "idle";
      });

      const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const clock = new THREE.Clock();
      let last = 0;
      const loop = (t: number) => {
        raf = requestAnimationFrame(loop);
        if (!visible || t - last < FRAME_MS) return;
        last = t;
        mixer.update(clock.getDelta());
        renderer.render(scene, camera);
      };
      renderer.render(scene, camera);
      if (!reduceMotion) raf = requestAnimationFrame(loop);

      const io = new IntersectionObserver(([entry]) => {
        visible = entry.isIntersecting && document.visibilityState === "visible";
        clock.getDelta();
      });
      io.observe(container);

      setLoaded(true);

      cleanups.push(() => {
        io.disconnect();
        ro.disconnect();
        mixer.stopAllAction();
        model.traverse((o) => {
          const mesh = o as import("three").Mesh;
          mesh.geometry?.dispose();
          const mats = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : [];
          mats.forEach((m) => m.dispose());
        });
        renderer.dispose();
        renderer.domElement.remove();
      });
    })().catch((e) => {
      console.error("AgentCharacter failed to load", e);
      setUnsupported(true);
    });

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      cleanups.forEach((fn) => fn());
      rigRef.current = null;
    };
  }, []);

  const playState = (next: AgentState) => {
    const rig = rigRef.current;
    if (!rig) return;
    if (next === rig.current && next !== "congratz") return;
    const from = rig.actions[rig.current];
    const to = rig.actions[next];
    if (!to) return;
    to.reset().fadeIn(FADE_S).play();
    if (from && from !== to) from.fadeOut(FADE_S);
    rig.current = next;
  };

  // Cross-fade whenever the parent changes the requested state.
  useEffect(() => {
    if (loaded) playState(state);
  }, [state, loaded]);

  if (unsupported) return null;

  return (
    <div
      ref={containerRef}
      role="img"
      aria-label={label}
      onClick={interactive ? () => playState("congratz") : undefined}
      className={cn(
        "relative transition-opacity duration-700",
        loaded ? "opacity-100" : "opacity-0",
        interactive && "cursor-pointer",
        className,
      )}
    />
  );
}
