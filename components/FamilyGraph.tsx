"use client";

import { useRef, useState } from "react";
import type { GraphLayout } from "@/lib/graph";

// Person + union-node graph. Wheel to zoom, drag to pan, click a person to
// open their page.
export function FamilyGraph({ layout }: { layout: GraphLayout }) {
  const { nodes, edges, width, height } = layout;
  const pad = 80;
  const [view, setView] = useState({ x: -pad, y: -pad, k: 1 });
  const drag = useRef<{ x: number; y: number; vx: number; vy: number } | null>(null);
  const pos = new Map(nodes.map((n) => [n.id, n]));

  const vw = (width + pad * 2) / view.k;
  const vh = (height + pad * 2) / view.k;

  return (
    <div className="overflow-hidden rounded border border-[color:var(--rule)] bg-[color:var(--surface)]">
      <svg
        role="img"
        aria-label="Family graph"
        className="block h-[70vh] w-full touch-none select-none"
        viewBox={`${view.x} ${view.y} ${vw} ${vh}`}
        onWheel={(e) => {
          const k = Math.min(3, Math.max(0.15, view.k * (e.deltaY < 0 ? 1.12 : 0.9)));
          setView((v) => ({ ...v, k }));
        }}
        onPointerDown={(e) => {
          (e.target as Element).setPointerCapture?.(e.pointerId);
          drag.current = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
        }}
        onPointerMove={(e) => {
          if (!drag.current) return;
          const scale = vw / (e.currentTarget.clientWidth || 1);
          setView((v) => ({
            ...v,
            x: drag.current!.vx - (e.clientX - drag.current!.x) * scale,
            y: drag.current!.vy - (e.clientY - drag.current!.y) * scale,
          }));
        }}
        onPointerUp={() => (drag.current = null)}
      >
        {edges.map((ed, i) => {
          const a = pos.get(ed.from);
          const b = pos.get(ed.to);
          if (!a || !b) return null;
          return (
            <path
              key={i}
              d={`M ${a.x} ${a.y} C ${a.x} ${(a.y + b.y) / 2}, ${b.x} ${(a.y + b.y) / 2}, ${b.x} ${b.y}`}
              fill="none"
              stroke="var(--indigo-soft)"
              strokeWidth={ed.kind === "child" ? 1.5 : 2}
              opacity={0.6}
            />
          );
        })}

        {nodes.map((n) =>
          n.kind === "union" ? (
            <g key={n.id} transform={`translate(${n.x} ${n.y})`}>
              <circle
                r={6}
                fill={n.rel === "Married" ? "var(--earth)" : "var(--indigo)"}
                stroke="var(--surface)"
                strokeWidth={2}
              />
            </g>
          ) : (
            <a key={n.id} href={`/person/${n.id}`}>
              <g transform={`translate(${n.x} ${n.y})`}>
                <rect
                  x={-64}
                  y={-15}
                  width={128}
                  height={30}
                  rx={5}
                  fill="var(--surface)"
                  stroke={
                    n.gender === "F"
                      ? "var(--earth)"
                      : n.gender === "M"
                        ? "var(--indigo)"
                        : "var(--rule)"
                  }
                  strokeWidth={1.5}
                  opacity={n.dead ? 0.55 : 1}
                />
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={11}
                  fill="var(--ink)"
                  style={{ pointerEvents: "none" }}
                >
                  {n.label.length > 20 ? n.label.slice(0, 19) + "…" : n.label}
                </text>
              </g>
            </a>
          ),
        )}
      </svg>
      <div className="flex items-center justify-between border-t border-[color:var(--rule)] px-3 py-1.5 text-xs text-[color:var(--ink-soft)]">
        <span>drag to pan · scroll to zoom · click a name to open</span>
        <button
          type="button"
          className="hover:underline"
          onClick={() => setView({ x: -pad, y: -pad, k: 1 })}
        >
          reset view
        </button>
      </div>
    </div>
  );
}
