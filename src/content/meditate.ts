import type { Palette, Phase, PresetKey, RangeKey, ToggleKey } from "@/domain/breathing";
import type { PublicLocale } from "@/domain/locale";

/**
 * The breathing guide at /meditate (D-120). Spanish first; the Galician is a
 * translation still to be reviewed by a native speaker, like the home page's.
 * `{n}` in a string is replaced with a number.
 */
export interface MeditateCopy {
  meta: { title: string; description: string };
  title: string;
  intro: string;
  start: string;
  pause: string;
  resume: string;
  restart: string;
  again: string;
  phases: Record<Phase | "ready", string>;
  done: { title: string; body: string };
  timer: { label: string; open: string; minutes: string; remaining: string; elapsed: string };
  breaths: string;
  keys: string;
  home: string;
  language: string;
  fullscreen: { enter: string; exit: string };
  panel: {
    open: string;
    close: string;
    title: string;
    note: string;
    sections: { breath: string; guidance: string; light: string; background: string };
    presets: Record<PresetKey | "custom", string>;
    pattern: string;
    seconds: string;
    toggles: Record<ToggleKey, string>;
    ranges: Record<RangeKey, string>;
    palette: string;
    palettes: Record<Palette, string>;
    copyLink: string;
    copied: string;
    reset: string;
  };
}

export const MEDITATE_COPY: Record<PublicLocale, MeditateCopy> = {
  es: {
    meta: {
      title: "Numadelic · Respira con la luz",
      description: "Una guía de respiración: la luz crece al inhalar y se recoge al exhalar.",
    },
    title: "Respira con la luz",
    intro: "Inhala mientras la luz crece y exhala mientras se recoge. No hace falta nada más.",
    start: "Empezar",
    pause: "Pausar",
    resume: "Continuar",
    restart: "Volver a empezar",
    again: "Otra vez",
    phases: { ready: "Prepárate", inhale: "Inhala", holdIn: "Mantén", exhale: "Exhala", holdOut: "Descansa" },
    done: { title: "Sesión completada", body: "Quédate un momento con lo que sientes." },
    timer: { label: "Duración", open: "Sin límite", minutes: "{n} min", remaining: "Tiempo restante", elapsed: "Tiempo" },
    breaths: "Respiraciones",
    keys: "Espacio: empezar o pausar · F: pantalla completa",
    home: "Volver al inicio",
    language: "Idioma",
    fullscreen: { enter: "Pantalla completa", exit: "Salir de pantalla completa" },
    panel: {
      open: "Facilitador",
      close: "Cerrar ajustes",
      title: "Ajustes del facilitador",
      note: "Los cambios se aplican al momento y se guardan en el enlace, no en este dispositivo.",
      sections: { breath: "Respiración", guidance: "Guía", light: "Luz", background: "Fondo" },
      presets: {
        calm: "Calma · 4-1-4-1",
        box: "Cuadrada · 4-4-4-4",
        coherent: "Coherente · 5,5-5,5",
        relax: "Relajación · 4-7-8",
        longExhale: "Exhalación larga · 4-6",
        custom: "Personalizada",
      },
      pattern: "Ritmo",
      seconds: "{n} s",
      toggles: {
        guidance: "Palabras de guía",
        countdown: "Cuenta atrás",
        ring: "Anillo de progreso",
        cycles: "Contar respiraciones",
        countIn: "Preparación de 3 segundos",
        tones: "Tonos suaves",
        voice: "Voz",
        stars: "Estrellas",
      },
      ranges: {
        volume: "Volumen",
        size: "Tamaño",
        depth: "Amplitud",
        drift: "Movimiento de la nube",
        glow: "Resplandor",
        ambient: "Luz de fondo",
      },
      palette: "Color",
      palettes: { numadelic: "Numadelic", aurora: "Aurora", dawn: "Amanecer", lavender: "Lavanda", moon: "Luna" },
      copyLink: "Copiar enlace",
      copied: "Enlace copiado",
      reset: "Restablecer",
    },
  },
  en: {
    meta: {
      title: "Numadelic · Breathe with the light",
      description: "A breathing guide: the light grows as you breathe in and settles as you breathe out.",
    },
    title: "Breathe with the light",
    intro: "Breathe in as the light grows and out as it settles. Nothing else is needed.",
    start: "Begin",
    pause: "Pause",
    resume: "Continue",
    restart: "Start over",
    again: "Again",
    phases: { ready: "Get ready", inhale: "Breathe in", holdIn: "Hold", exhale: "Breathe out", holdOut: "Rest" },
    done: { title: "Session complete", body: "Stay a moment with how you feel." },
    timer: { label: "Length", open: "No limit", minutes: "{n} min", remaining: "Time left", elapsed: "Time" },
    breaths: "Breaths",
    keys: "Space: begin or pause · F: full screen",
    home: "Back to home",
    language: "Language",
    fullscreen: { enter: "Full screen", exit: "Exit full screen" },
    panel: {
      open: "Facilitator",
      close: "Close settings",
      title: "Facilitator settings",
      note: "Changes apply at once and are kept in the link, not on this device.",
      sections: { breath: "Breathing", guidance: "Guidance", light: "Light", background: "Background" },
      presets: {
        calm: "Calm · 4-1-4-1",
        box: "Box · 4-4-4-4",
        coherent: "Coherent · 5.5-5.5",
        relax: "Relaxing · 4-7-8",
        longExhale: "Long exhale · 4-6",
        custom: "Custom",
      },
      pattern: "Rhythm",
      seconds: "{n} s",
      toggles: {
        guidance: "Guidance words",
        countdown: "Countdown",
        ring: "Progress ring",
        cycles: "Count breaths",
        countIn: "3-second count-in",
        tones: "Soft tones",
        voice: "Voice",
        stars: "Stars",
      },
      ranges: {
        volume: "Volume",
        size: "Size",
        depth: "Range",
        drift: "Cloud movement",
        glow: "Glow",
        ambient: "Background light",
      },
      palette: "Colour",
      palettes: { numadelic: "Numadelic", aurora: "Aurora", dawn: "Dawn", lavender: "Lavender", moon: "Moon" },
      copyLink: "Copy link",
      copied: "Link copied",
      reset: "Reset",
    },
  },
  gl: {
    meta: {
      title: "Numadelic · Respira coa luz",
      description: "Unha guía de respiración: a luz medra ao inspirar e recóllese ao expirar.",
    },
    title: "Respira coa luz",
    intro: "Inspira mentres a luz medra e expira mentres se recolle. Non fai falta nada máis.",
    start: "Comezar",
    pause: "Pausar",
    resume: "Continuar",
    restart: "Volver comezar",
    again: "Outra vez",
    phases: { ready: "Prepárate", inhale: "Inspira", holdIn: "Mantén", exhale: "Expira", holdOut: "Descansa" },
    done: { title: "Sesión completada", body: "Quédate un momento co que sentes." },
    timer: { label: "Duración", open: "Sen límite", minutes: "{n} min", remaining: "Tempo restante", elapsed: "Tempo" },
    breaths: "Respiracións",
    keys: "Espazo: comezar ou pausar · F: pantalla completa",
    home: "Volver ao inicio",
    language: "Idioma",
    fullscreen: { enter: "Pantalla completa", exit: "Saír da pantalla completa" },
    panel: {
      open: "Facilitador",
      close: "Pechar axustes",
      title: "Axustes do facilitador",
      note: "Os cambios aplícanse ao momento e gárdanse na ligazón, non neste dispositivo.",
      sections: { breath: "Respiración", guidance: "Guía", light: "Luz", background: "Fondo" },
      presets: {
        calm: "Calma · 4-1-4-1",
        box: "Cadrada · 4-4-4-4",
        coherent: "Coherente · 5,5-5,5",
        relax: "Relaxación · 4-7-8",
        longExhale: "Expiración longa · 4-6",
        custom: "Personalizada",
      },
      pattern: "Ritmo",
      seconds: "{n} s",
      toggles: {
        guidance: "Palabras de guía",
        countdown: "Conta atrás",
        ring: "Anel de progreso",
        cycles: "Contar respiracións",
        countIn: "Preparación de 3 segundos",
        tones: "Tons suaves",
        voice: "Voz",
        stars: "Estrelas",
      },
      ranges: {
        volume: "Volume",
        size: "Tamaño",
        depth: "Amplitude",
        drift: "Movemento da nube",
        glow: "Resplandor",
        ambient: "Luz de fondo",
      },
      palette: "Cor",
      palettes: { numadelic: "Numadelic", aurora: "Aurora", dawn: "Amencer", lavender: "Lavanda", moon: "Lúa" },
      copyLink: "Copiar ligazón",
      copied: "Ligazón copiada",
      reset: "Restablecer",
    },
  },
};

export const fill = (template: string, n: number | string) => template.replace("{n}", String(n));
