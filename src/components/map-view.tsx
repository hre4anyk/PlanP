"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { useEffect, useId } from "react";
import { MapContainer, Marker, Polyline, Popup, TileLayer, useMap, useMapEvents } from "react-leaflet";
import { formatClearance, SF_CENTER, type LatLng, type Lot } from "@/data/lots";
import type { ChainItem } from "@/logic/chain";
import type { Route } from "@/logic/route";
import { walkDistanceText } from "@/logic/geo";

type Props = {
  lots: Lot[];
  chain: ChainItem[];
  currentIndex: number;
  destination: LatLng | null;
  start: LatLng;
  route: Route | null;
  onPickDestination: (point: LatLng) => void;
  /** The Street View photo being shown: marked and kept in view (minimap). */
  focus?: LatLng | null;
};

const DRIVEN = { color: "#3a3a44", weight: 7, opacity: 1 };
const CURRENT = { color: "#ff4d2e", weight: 9, opacity: 1 };
const FLOW = { color: "#0a0a0f", weight: 3, opacity: 0.55, dashArray: "6 12", className: "route-flow" };
const BACKUP = { color: "#ff4d2e", weight: 7, opacity: 0.25 };

// Pins are plain HTML (styled in globals.css) so we don't depend on Leaflet's image markers.
const pin = (className: string, html = "", size = 28) =>
  L.divIcon({ className: "", html: `<div class="pin ${className}">${html}</div>`, iconSize: [size, size], iconAnchor: [size / 2, size / 2] });

const FLAG = pin("pin-flag", "⚑", 34);
const CAR = pin("pin-car", "●", 22);

function lotIcon(lot: Lot, item: ChainItem | undefined, isCurrent: boolean) {
  if (lot.status === "full") return pin("pin-full", "✕", 22);
  if (!item) return pin("pin-lot", "P", 22);
  return pin(isCurrent ? "pin-plan pin-current" : "pin-plan", item.label, 32);
}

/** Keep the whole snake in view whenever a new route arrives; before that, frame you and the meeting. */
function FitRoute({ route, start, destination }: { route: Route | null; start: LatLng; destination: LatLng | null }) {
  const map = useMap();
  useEffect(() => {
    const routePoints = route?.legs.flatMap((leg) => leg.path) ?? [];
    const points = routePoints.length > 1 ? routePoints : destination ? [start, destination] : [start];
    if (points.length > 1) map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng])), { padding: [40, 40], maxZoom: 16, animate: false });
    else map.setView([start.lat, start.lng], 15, { animate: false });
  }, [map, route, start, destination]);
  return null;
}

/** Driven legs grey, the current leg bright with a flowing dash, backups faded (PRD F9). */
function Snake({ route, currentIndex }: { route: Route; currentIndex: number }) {
  return (
    <>
      {route.legs.map((leg, i) => {
        const positions = leg.path.map((p) => [p.lat, p.lng] as [number, number]);
        if (i === currentIndex) {
          return [
            <Polyline key={`${i}-current`} positions={positions} pathOptions={CURRENT} />,
            <Polyline key={`${i}-flow`} positions={positions} pathOptions={FLOW} />,
          ];
        }
        return <Polyline key={i} positions={positions} pathOptions={i < currentIndex ? DRIVEN : BACKUP} />;
      })}
    </>
  );
}

function TapToChoose({ onPick }: { onPick: (point: LatLng) => void }) {
  useMapEvents({ click: (e) => onPick({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

/** Follow the Street View photo being shown. */
function FollowFocus({ focus }: { focus: LatLng | null | undefined }) {
  const map = useMap();
  useEffect(() => {
    if (focus) map.setView([focus.lat, focus.lng], 17, { animate: false });
  }, [map, focus]);
  return null;
}

const FOCUS = pin("pin-current", "", 18);

export default function MapView({ lots, chain, currentIndex, destination, start, route, onPickDestination, focus }: Props) {
  // Stable unique key per instance: prevents "Map container is being reused" when two MapViews
  // coexist (main map + minimap), and avoids unnecessary remounts during Fast Refresh.
  const id = useId();
  return (
    <MapContainer
      key={id}
      center={[SF_CENTER.lat, SF_CENTER.lng]}
      zoom={14}
      className="h-full w-full"
      zoomControl={false}
      zoomAnimation={false}
      attributionControl
    >
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        maxZoom={19}
      />
      <TapToChoose onPick={onPickDestination} />
      {focus ? <FollowFocus focus={focus} /> : <FitRoute route={route} start={start} destination={destination} />}
      {focus && <Marker position={[focus.lat, focus.lng]} icon={FOCUS} zIndexOffset={2000} />}
      {route && <Snake route={route} currentIndex={currentIndex} />}

      {lots.map((lot) => {
        const index = chain.findIndex((c) => c.id === lot.id);
        const item = index >= 0 ? chain[index] : undefined;
        return (
          <Marker key={lot.id} position={[lot.lat, lot.lng]} icon={lotIcon(lot, item, index === currentIndex)} zIndexOffset={item ? 500 : 0}>
            <Popup>
              <div className="lot-popup">
                <strong>{item ? `Plan ${item.label}: ` : ""}{lot.name}</strong>
                <span>${lot.pricePerHour}/hr · {lot.hours} · clearance {formatClearance(lot.clearanceInches)}</span>
                {lot.rule && <span>{lot.rule}</span>}
                <span className={lot.status === "full" ? "lot-full" : "lot-open"}>{lot.status === "full" ? "Full" : "Open"}</span>
                {lot.status === "open" && destination && (
                  <span>{walkDistanceText(lot, destination)} (straight-line estimate)</span>
                )}
              </div>
            </Popup>
          </Marker>
        );
      })}

      {destination && (
      <Marker position={[destination.lat, destination.lng]} icon={FLAG} zIndexOffset={1000}>
        <Popup>Your meeting</Popup>
      </Marker>
      )}
      <Marker position={[start.lat, start.lng]} icon={CAR} zIndexOffset={1000}>
        <Popup>You are here</Popup>
      </Marker>
    </MapContainer>
  );
}
