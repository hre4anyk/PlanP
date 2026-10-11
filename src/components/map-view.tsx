"use client";

import "leaflet/dist/leaflet.css";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, useMapEvents } from "react-leaflet";
import { formatClearance, SF_CENTER, type LatLng, type Lot } from "@/data/lots";
import type { ChainItem } from "@/logic/chain";

type Props = {
  lots: Lot[];
  chain: ChainItem[];
  currentIndex: number;
  destination: LatLng;
  start: LatLng;
  onPickDestination: (point: LatLng) => void;
};

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

function TapToChoose({ onPick }: { onPick: (point: LatLng) => void }) {
  useMapEvents({ click: (e) => onPick({ lat: e.latlng.lat, lng: e.latlng.lng }) });
  return null;
}

export default function MapView({ lots, chain, currentIndex, destination, start, onPickDestination }: Props) {
  return (
    <MapContainer
      center={[SF_CENTER.lat, SF_CENTER.lng]}
      zoom={14}
      className="h-full w-full"
      zoomControl={false}
      attributionControl
    >
      <TileLayer
        url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        maxZoom={19}
      />
      <TapToChoose onPick={onPickDestination} />

      {lots.map((lot) => {
        const index = chain.findIndex((c) => c.lotId === lot.id);
        const item = index >= 0 ? chain[index] : undefined;
        return (
          <Marker key={lot.id} position={[lot.lat, lot.lng]} icon={lotIcon(lot, item, index === currentIndex)} zIndexOffset={item ? 500 : 0}>
            <Popup>
              <div className="lot-popup">
                <strong>{item ? `Plan ${item.label}: ` : ""}{lot.name}</strong>
                <span>${lot.pricePerHour}/hr · {lot.hours} · clearance {formatClearance(lot.clearanceInches)}</span>
                {lot.rule && <span>{lot.rule}</span>}
                <span className={lot.status === "full" ? "lot-full" : "lot-open"}>{lot.status === "full" ? "Full" : "Open"}</span>
              </div>
            </Popup>
          </Marker>
        );
      })}

      <Marker position={[destination.lat, destination.lng]} icon={FLAG} zIndexOffset={1000}>
        <Popup>Your meeting</Popup>
      </Marker>
      <Marker position={[start.lat, start.lng]} icon={CAR} zIndexOffset={1000}>
        <Popup>You start here</Popup>
      </Marker>
    </MapContainer>
  );
}
