import clsx from "clsx";

/** Yüzen panel kabuğu (sidebar, palet, oda paneli) */
export function chromePanel(darkCanvas: boolean) {
  return darkCanvas
    ? "rounded-2xl border border-zinc-200 bg-white shadow-[0_12px_48px_rgba(0,0,0,0.12)]"
    : "rounded-2xl border border-zinc-800 bg-black shadow-[0_12px_48px_rgba(0,0,0,0.5)]";
}

export function chromeDivider(darkCanvas: boolean) {
  return darkCanvas ? "bg-zinc-200" : "bg-zinc-800";
}

export function chromeToolButton(darkCanvas: boolean, active: boolean) {
  return clsx(
    "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all",
    active
      ? darkCanvas
        ? "bg-black text-white"
        : "bg-white text-black"
      : darkCanvas
        ? "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
        : "text-zinc-500 hover:bg-zinc-900 hover:text-zinc-200"
  );
}

export function chromeMutedText(darkCanvas: boolean) {
  return darkCanvas ? "text-zinc-500" : "text-stone-500";
}

export function chromeHeading(darkCanvas: boolean) {
  return darkCanvas ? "text-zinc-900" : "text-stone-200";
}

export function chromeBody(darkCanvas: boolean) {
  return darkCanvas ? "text-zinc-700" : "text-stone-300";
}

export function chromeSubtleBg(darkCanvas: boolean) {
  return darkCanvas ? "bg-zinc-100" : "bg-white/5";
}

export function chromeIconButton(darkCanvas: boolean) {
  return darkCanvas
    ? "text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"
    : "text-stone-500 hover:bg-white/10 hover:text-stone-200";
}

export function chromeWidthButton(darkCanvas: boolean, active: boolean) {
  return clsx(
    "flex h-8 min-w-9 items-center justify-center rounded-lg text-xs font-semibold transition-colors",
    active
      ? darkCanvas
        ? "bg-zinc-900/10 text-zinc-900"
        : "bg-brand/20 text-brand-light"
      : darkCanvas
        ? "text-zinc-500 hover:bg-zinc-100"
        : "text-zinc-500 hover:bg-zinc-900"
  );
}

export function chromeColorRing(darkCanvas: boolean, selected: boolean) {
  return selected
    ? "border-brand scale-110 ring-2 ring-brand/40"
    : darkCanvas
      ? "border-zinc-300"
      : "border-zinc-600";
}
