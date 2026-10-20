/**
 * A value kept in this browser's local storage, for `useSyncExternalStore`
 * (D-120): the facilitator panel's mode and their saved settings. Conveniences
 * for whoever runs sessions on this device, not study data, and never needed
 * for the page to work: where storage is blocked (a private window, say) the
 * value lives for the visit only.
 */
export function localStore<T>(key: string, fallback: T, valid: (v: unknown) => v is T) {
  const listeners = new Set<() => void>();
  let cache: { raw: string | null; value: T } | null = null;
  /** Used when storage is unavailable, so a change still holds for this visit. */
  let memory: T | undefined;

  const get = (): T => {
    let raw: string | null;
    try {
      raw = window.localStorage.getItem(key);
    } catch {
      return memory ?? fallback;
    }
    if (cache && cache.raw === raw) return cache.value;
    let value = fallback;
    if (raw !== null) {
      try {
        const parsed: unknown = JSON.parse(raw);
        if (valid(parsed)) value = parsed;
      } catch {}
    }
    cache = { raw, value };
    return value;
  };

  return {
    get,
    server: () => fallback,
    subscribe(onChange: () => void) {
      listeners.add(onChange);
      // Another tab saving a preset shows here too.
      const onStorage = (e: StorageEvent) => {
        if (e.key === key) onChange();
      };
      window.addEventListener("storage", onStorage);
      return () => {
        listeners.delete(onChange);
        window.removeEventListener("storage", onStorage);
      };
    },
    set(value: T) {
      try {
        window.localStorage.setItem(key, JSON.stringify(value));
      } catch {
        memory = value;
      }
      cache = null;
      listeners.forEach((l) => l());
    },
  };
}
