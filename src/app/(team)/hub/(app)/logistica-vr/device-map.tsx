"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import type { CircleMarker, LayerGroup, Map as LeafletMap } from "leaflet";
import "leaflet/dist/leaflet.css";

type Leaflet = typeof import("leaflet");

/** Where an empty map opens: the country, near enough to place a first pin. */
const DEFAULT_VIEW: { center: [number, number]; zoom: number } = { center: [40.2, -3.7], zoom: 5 };

const PIN_STYLE = { radius: 8, color: "var(--chart-1)", fillColor: "var(--chart-1)", fillOpacity: 0.7, weight: 2 };

/**
 * A Leaflet map on `container`. Leaflet touches `window` when it loads, so it is
 * imported here rather than at the top of the module, and the page renders on
 * the server without it.
 *
 * Map tiles come from outside (openstreetmap.org), and those ask for an area,
 * not a person. The location search is the form's, and runs on the server (D-145).
 */
function useLeaflet(container: RefObject<HTMLDivElement | null>) {
  const [ready, setReady] = useState<{ L: Leaflet; map: LeafletMap } | null>(null);

  useEffect(() => {
    let cancelled = false;
    let map: LeafletMap | null = null;
    let observer: ResizeObserver | null = null;

    void import("leaflet").then(({ default: L }) => {
      if (cancelled || !container.current) return;
      map = L.map(container.current).setView(DEFAULT_VIEW.center, DEFAULT_VIEW.zoom);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);
      // A map opened in a dialog is measured before the dialog has its size.
      const opened = map;
      observer = new ResizeObserver(() => opened.invalidateSize());
      observer.observe(container.current);
      setReady({ L, map });
    });

    return () => {
      cancelled = true;
      observer?.disconnect();
      map?.remove();
    };
  }, [container]);

  return ready;
}

export interface DevicePin {
  id: string;
  lat: number;
  lng: number;
  /** Plain text: set as text content, never as HTML, since staff type it. */
  title: string;
  subtitle: string | null;
}

/** Every headset with a pin. */
export function DeviceMap({ pins, label }: { pins: DevicePin[]; label: string }) {
  const container = useRef<HTMLDivElement>(null);
  const ready = useLeaflet(container);
  // By value: the server sends a new array after every action.
  const pinsKey = JSON.stringify(pins);

  useEffect(() => {
    if (!ready) return;
    const { L, map } = ready;
    const current = JSON.parse(pinsKey) as DevicePin[];
    const layer: LayerGroup = L.layerGroup().addTo(map);

    for (const pin of current) {
      const marker = L.circleMarker([pin.lat, pin.lng], PIN_STYLE).addTo(layer);
      marker.bindTooltip(pinContent(pin));
    }
    if (current.length > 0) {
      map.fitBounds(L.latLngBounds(current.map((p) => [p.lat, p.lng])), { padding: [40, 40], maxZoom: 13 });
    }

    return () => {
      layer.remove();
    };
  }, [ready, pinsKey]);

  return (
    <div
      ref={container}
      role="region"
      aria-label={label}
      // `isolate`: Leaflet's panes run up to z-index 1000, above the app's header.
      className="isolate h-[60vh] min-h-80 w-full overflow-hidden rounded-2xl ring-1 ring-foreground/10"
    />
  );
}

function pinContent(pin: DevicePin): HTMLElement {
  const root = document.createElement("div");
  const title = document.createElement("strong");
  title.textContent = pin.title;
  root.append(title);
  if (pin.subtitle) {
    const subtitle = document.createElement("div");
    subtitle.textContent = pin.subtitle;
    root.append(subtitle);
  }
  return root;
}

/** Click to drop the pin; click elsewhere to move it. */
export function LocationPicker({
  pin,
  focus,
  onPick,
  label,
}: {
  pin: { lat: number; lng: number } | null;
  /** A place to fly to, set when a search finds one. */
  focus: { lat: number; lng: number } | null;
  onPick: (pin: { lat: number; lng: number }) => void;
  label: string;
}) {
  const container = useRef<HTMLDivElement>(null);
  const ready = useLeaflet(container);
  const onPickRef = useRef(onPick);
  const marker = useRef<CircleMarker | null>(null);
  const opened = useRef(false);

  useEffect(() => {
    onPickRef.current = onPick;
  }, [onPick]);

  useEffect(() => {
    if (!ready) return;
    const pick = (e: { latlng: { lat: number; lng: number } }) =>
      onPickRef.current({ lat: e.latlng.lat, lng: e.latlng.lng });
    ready.map.on("click", pick);
    return () => {
      ready.map.off("click", pick);
    };
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    marker.current?.remove();
    marker.current = pin ? ready.L.circleMarker([pin.lat, pin.lng], PIN_STYLE).addTo(ready.map) : null;
    // Only the first time: a pin being placed should not pull the map around.
    if (pin && !opened.current) ready.map.setView([pin.lat, pin.lng], 13);
    opened.current = true;
  }, [ready, pin]);

  useEffect(() => {
    if (ready && focus) ready.map.setView([focus.lat, focus.lng], 14);
  }, [ready, focus]);

  return (
    <div
      ref={container}
      role="application"
      aria-label={label}
      className="isolate h-56 w-full cursor-crosshair overflow-hidden rounded-xl ring-1 ring-foreground/10"
    />
  );
}
