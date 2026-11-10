"use client";

import { useActionState, useState, useTransition } from "react";
import { Search } from "lucide-react";
import { useCloseOnSuccess } from "@/components/team/closing-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { LOCATION_LABEL_MAX_LENGTH, type Place } from "@/domain/logistics";
import { searchLocationAction, setDeviceLocationAction, type LogisticsState } from "./actions";
import { LocationPicker } from "./device-map";

const initial: LogisticsState = { error: null };

/** Where a headset is: a place in words, and a pin placed by hand. */
export function DeviceLocationForm({
  deviceId,
  location,
  labels,
}: {
  deviceId: string;
  location: { label: string | null; lat: number | null; lng: number | null };
  labels: {
    location: string;
    help: string;
    mapHint: string;
    search: string;
    searchHelp: string;
    searchNone: string;
    searchFailed: string;
    searchShort: string;
    searchPick: string;
    clearPin: string;
    save: string;
    saving: string;
    errors: Record<string, string>;
  };
}) {
  const [state, action, pending] = useActionState(setDeviceLocationAction, initial);
  useCloseOnSuccess(state);
  // Controlled: the saved label changes under this field once the action lands.
  const [label, setLabel] = useState(location.label ?? "");
  const [pin, setPin] = useState(
    location.lat !== null && location.lng !== null ? { lat: location.lat, lng: location.lng } : null,
  );
  const [focus, setFocus] = useState<Place | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [searchMessage, setSearchMessage] = useState<string | null>(null);
  const [searching, startSearch] = useTransition();

  function choose(place: Place) {
    setPin({ lat: place.lat, lng: place.lng });
    setFocus(place);
    setPlaces([]);
  }

  // On a button, not as staff type: each search sends this text to OpenStreetMap.
  function search() {
    setSearchMessage(null);
    startSearch(async () => {
      const result = await searchLocationAction(label);
      setPlaces(result.places.length > 1 ? result.places : []);
      if (result.places.length === 1) choose(result.places[0]);
      if (result.error === "invalid") setSearchMessage(labels.searchShort);
      else if (result.error === "forbidden") setSearchMessage(labels.errors.forbidden);
      else if (result.error) setSearchMessage(labels.searchFailed);
      else if (result.places.length === 0) setSearchMessage(labels.searchNone);
    });
  }

  return (
    <form action={action} className="space-y-2">
      <input type="hidden" name="deviceId" value={deviceId} />
      <input type="hidden" name="lat" value={pin?.lat ?? ""} />
      <input type="hidden" name="lng" value={pin?.lng ?? ""} />
      <div className="space-y-1.5">
        <Label htmlFor={`location-${deviceId}`}>{labels.location}</Label>
        <div className="flex gap-2">
          <Input
            id={`location-${deviceId}`}
            name="label"
            maxLength={LOCATION_LABEL_MAX_LENGTH}
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            aria-describedby={`location-help-${deviceId}`}
            className="min-w-0 flex-1"
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-9 gap-1.5 rounded-lg"
            disabled={searching || label.trim().length === 0}
            onClick={search}
          >
            <Search className="size-3.5" aria-hidden />
            {searching ? labels.saving : labels.search}
          </Button>
        </div>
        <p id={`location-help-${deviceId}`} className="text-xs text-muted-foreground">
          {labels.help} {labels.searchHelp}
        </p>
      </div>
      {searchMessage ? (
        <p role="status" className="text-xs text-destructive">
          {searchMessage}
        </p>
      ) : null}
      {places.length > 0 ? (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground">{labels.searchPick}</p>
          <ul className="space-y-1">
            {places.map((place) => (
              <li key={`${place.lat},${place.lng}`}>
                <button
                  type="button"
                  onClick={() => choose(place)}
                  className="w-full rounded-lg bg-muted/60 px-2.5 py-1.5 text-left text-xs transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
                >
                  {place.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      <LocationPicker pin={pin} focus={focus} onPick={setPin} label={labels.mapHint} />
      <p className="text-xs text-muted-foreground">{labels.mapHint}</p>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {labels.errors[state.error] ?? labels.errors.failed}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Button type="submit" size="sm" variant="outline" className="rounded-lg" disabled={pending}>
          {pending ? labels.saving : labels.save}
        </Button>
        {pin ? (
          <Button type="button" size="sm" variant="ghost" className="rounded-lg" onClick={() => setPin(null)}>
            {labels.clearPin}
          </Button>
        ) : null}
      </div>
    </form>
  );
}
