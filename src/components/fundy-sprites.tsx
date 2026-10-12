"use client";

import type { ReactNode } from "react";

type Bitmap = string[];

/** Renders a pixel-art bitmap as SVG rects so it scales crisply. */
function PixelArt({
  bitmap,
  color,
  hole = "#111116",
  className,
  label,
  width,
  height,
}: {
  bitmap: Bitmap;
  color: string;
  hole?: string;
  className?: string;
  label?: string;
  width?: number;
  height?: number;
}) {
  const w = Math.max(...bitmap.map((row) => row.length));
  const ink: ReactNode[] = [];
  const holes: ReactNode[] = [];
  bitmap.forEach((row, y) => {
    let x = 0;
    while (x < row.length) {
      const ch = row[x];
      let end = x;
      while (end < row.length && row[end] === ch) end++;
      if (ch === "#") ink.push(<rect key={`${x}-${y}`} x={x} y={y} width={end - x} height={1} />);
      if (ch === "o") holes.push(<rect key={`${x}-${y}`} x={x} y={y} width={end - x} height={1} />);
      x = end;
    }
  });
  return (
    <svg
      viewBox={`0 0 ${w} ${bitmap.length}`}
      width={width}
      height={height}
      className={className}
      role={label ? "img" : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
    >
      <g fill={color}>{ink}</g>
      {holes.length > 0 && <g fill={hole}>{holes}</g>}
    </svg>
  );
}

/* ---------- Dino (T-Rex, 20 × 21) ---------- */

const DINO_HEAD: Bitmap = [
  "...........########.",
  "..........##o#######",
  "..........##########",
  "..........##########",
  "..........##########",
  "..........#####.....",
  "..........########..",
];
const DINO_HEAD_BLINK: Bitmap = DINO_HEAD.map((row) => row.replace("o", "#"));

const DINO_BODY: Bitmap = [
  "#........#####......",
  "#.......######......",
  "##....##########....",
  "###..#########.#....",
  "##############......",
  "##############......",
  ".############.......",
  "..###########.......",
  "...#########........",
  "....#######.........",
];

const DINO_LEGS = {
  stand: [
    ".....###.##.........",
    ".....##...#.........",
    ".....#....#.........",
    ".....##...##........",
  ],
  walkA: [
    ".....###.##.........",
    ".....###..#.........",
    "..........#.........",
    "..........##........",
  ],
  walkB: [
    ".....###.##.........",
    ".....##...##........",
    ".....#..............",
    ".....##.............",
  ],
} as const;

export type DinoPose = keyof typeof DINO_LEGS;

export function DinoSprite({
  scale = 3,
  blink = false,
  pose = "stand",
  color = "#00ff94",
  className,
}: {
  scale?: number;
  blink?: boolean;
  pose?: DinoPose;
  color?: string;
  className?: string;
}) {
  const head = blink ? DINO_HEAD_BLINK : DINO_HEAD;
  const legs = DINO_LEGS[pose];
  const bitmap = [...head, ...DINO_BODY, ...legs];
  return (
    <PixelArt
      bitmap={bitmap}
      color={color}
      hole="#111116"
      className={className}
      label="Fundy"
      width={20 * scale}
      height={21 * scale}
    />
  );
}

/* ---------- Egg (12 × 10) ---------- */

const EGG: Bitmap = [
  "...######...",
  "..##o#####..",
  ".##########.",
  "####o#######",
  "############",
  "############",
  "############",
  ".##########.",
  "..########..",
  "...######...",
];

export function EggSprite({ scale = 3, className }: { scale?: number; className?: string }) {
  return (
    <PixelArt
      bitmap={EGG}
      color="#fbbf24"
      hole="#111116"
      className={className}
      label="Fundy egg"
      width={12 * scale}
      height={10 * scale}
    />
  );
}

/* ---------- Cloud (23 × 7) ---------- */

const CLOUD: Bitmap = [
  "..........######.......",
  "........###....##......",
  "......###.......###....",
  "..#####...........##...",
  ".##................###.",
  "##...................##",
  "#######################",
];

export function CloudSprite({ className }: { className?: string }) {
  return <PixelArt bitmap={CLOUD} color="#2a2a35" className={className} />;
}

/* ---------- Ground ---------- */

export function Ground({ className }: { className?: string }) {
  return (
    <div className={className} aria-hidden="true">
      <div className="h-px bg-white/20" />
      <div
        className="mt-1 h-0.5"
        style={{
          backgroundImage: "linear-gradient(90deg, #3a3a45 10px, transparent 10px)",
          backgroundSize: "24px 2px",
        }}
      />
    </div>
  );
}

/* ---------- Food (apple, 10 × 10) ---------- */

const APPLE: Bitmap = [
  "..........",
  "..........",
  "..........",
  "..##.###..",
  ".########.",
  "##########",
  "##########",
  "##########",
  ".########.",
  "..######..",
];

export function FoodSprite({ className }: { className?: string }) {
  return <PixelArt bitmap={APPLE} color="#ff4d2e" hole="#111116" className={className} />;
}
