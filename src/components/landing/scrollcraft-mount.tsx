"use client";

import { useEffect } from "react";

/**
 * Mounts the vendored scroll-craft engine (public/landing/scrollcraft.js) on
 * the landing root once it is in the DOM.
 *
 * The engine is a zero-dependency IIFE that reads `data-sc-*` attributes and
 * publishes each act's progress as `--sc-p`. It is loaded as a plain script
 * rather than bundled so that the file stays byte-identical to the skill's
 * engine: the skill's rule is "never edit the engine per project".
 *
 * The engine has no unmount. Every off-page link on the landing is therefore a
 * full navigation, so its listeners die with the document.
 */
declare global {
  interface Window {
    ScrollCraft?: {
      mount(root: Element | string): { layout(): void; read(): void };
      reduce: boolean;
    };
  }
}

let loading: Promise<void> | null = null;
const mounted = new WeakSet<Element>();

function loadEngine(): Promise<void> {
  if (window.ScrollCraft) return Promise.resolve();
  if (!loading) {
    loading = new Promise((resolve, reject) => {
      const s = document.createElement("script");
      s.src = "/landing/scrollcraft.js";
      s.async = true;
      s.onload = () => resolve();
      s.onerror = () => reject(new Error("scrollcraft engine failed to load"));
      document.head.append(s);
    });
  }
  return loading;
}

export function ScrollCraftMount({ rootId }: { rootId: string }) {
  useEffect(() => {
    const root = document.getElementById(rootId);
    if (!root) return;
    loadEngine()
      .then(() => {
        if (!root.isConnected || mounted.has(root) || !window.ScrollCraft) return;
        mounted.add(root);
        const api = window.ScrollCraft.mount(root);
        root.classList.add("is-engine");
        // Media arriving after mount changes flow-section heights; measure again
        // once everything has loaded.
        const relayout = () => api.layout();
        if (document.readyState === "complete") relayout();
        else window.addEventListener("load", relayout, { once: true });
      })
      .catch(() => {
        // The page is fully readable without the engine: cues stay visible
        // through the html:not(.sc-ready) rule in landing.css.
      });
  }, [rootId]);
  return null;
}
