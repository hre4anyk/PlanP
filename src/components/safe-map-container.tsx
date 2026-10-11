"use client";

import { LeafletContext, createLeafletContext } from "@react-leaflet/core";
import { Map as LeafletMap } from "leaflet";
import { useEffect, useRef, useState, type ReactNode } from "react";

type Props = {
  center: [number, number];
  zoom: number;
  className?: string;
  zoomControl?: boolean;
  zoomAnimation?: boolean;
  attributionControl?: boolean;
  children: ReactNode;
};

/**
 * A Strict-Mode-safe replacement for react-leaflet's <MapContainer>.
 *
 * react-leaflet v5 creates the Leaflet map in a ref callback (runs once) but
 * removes it in a useEffect cleanup (runs during Strict Mode double-invoke).
 * After cleanup the map is gone but the ref callback never re-runs, so children
 * try to use a removed map → "appendChild" / "container reused" errors.
 *
 * This version creates the map inside useEffect so it is properly re-created
 * after Strict Mode cleanup.
 */
export function SafeMapContainer({ center, zoom, className, children, ...options }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ctx, setCtx] = useState<ReturnType<typeof createLeafletContext> | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Clear any stale Leaflet id from a previous (removed) instance.
    const elAny = el as unknown as { _leaflet_id?: number };
    if (elAny._leaflet_id) delete elAny._leaflet_id;

    const map = new LeafletMap(el, options);
    map.setView(center, zoom);

    // Defer rendering children until the next frame so the map's DOM is laid
    // out before TileLayer tries to append tiles.  In Strict Mode the first
    // effect is cleaned up before the frame fires — the rAF is cancelled so
    // children never render against a map that is about to be removed.
    const rafId = requestAnimationFrame(() => {
      map.invalidateSize();
      setCtx(createLeafletContext(map));
    });

    return () => {
      cancelAnimationFrame(rafId);
      map.remove();
      setCtx(null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div ref={containerRef} className={className}>
      {ctx ? <LeafletContext value={ctx}>{children}</LeafletContext> : null}
    </div>
  );
}
