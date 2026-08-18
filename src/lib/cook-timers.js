// ==========================================================================
// cook-timers.js  --  cast "mozku"
//
// Drzi prehled o casovacich, ktere behem vareni bezi soubezne.
//
// Klicove rozhodnuti: engine si SAM NESPOUSTI HODINY. Nema v sobe
// setInterval - misto toho ma funkci tick(), kterou zvenku zavola vzhled
// jednou za vterinu. Diky tomu jde v testu "pretocit" pet minut okamzite,
// misto aby test pet minut cekal.
// ==========================================================================

import { fmtClock } from './recipe-logic.js';

/** Zalozi prazdny seznam casovacu. */
export function createTimers() {
  return { items: [], nextId: 1 };
}

/** Bezi uz casovac na tenhle krok a tuhle delku? */
export function isRunning(state, step, secs) {
  return state.items.some(t => t.step === step && t.total === secs && !t.done);
}

/**
 * Prida casovac.
 *
 * Stejny casovac na stejny krok se odmitne - jinak by dvoji tuknuti
 * na tlacitko rozjelo dva soubezne odpocty na tutez vec.
 *
 * @returns {{state: Object, added: boolean}}
 */
export function addTimer(state, secs, label, step) {
  if (!(secs > 0)) return { state: state, added: false };
  if (isRunning(state, step, secs)) return { state: state, added: false };

  const timer = {
    id: String(state.nextId),
    total: secs,
    left: secs,
    label: String(label == null ? '' : label),
    step: step,
    done: false,
  };
  return {
    state: { items: state.items.concat([timer]), nextId: state.nextId + 1 },
    added: true,
  };
}

/** Zrusi casovac podle id. */
export function removeTimer(state, id) {
  return { items: state.items.filter(t => t.id !== id), nextId: state.nextId };
}

/** Zrusi vsechny casovace (napr. pri zavreni rezimu vareni). */
export function clearTimers(state) {
  return { items: [], nextId: state.nextId };
}

/**
 * Posune cas o zadany pocet vterin (vychozi 1).
 *
 * Vrati i seznam casovacu, ktere PRAVE dobehly - vzhled podle nej pipne
 * a posle notifikaci. Uz dobehle casovace se nehlasi znovu.
 *
 * @returns {{state: Object, finished: Array}}
 */
export function tick(state, seconds) {
  const step = seconds == null ? 1 : seconds;
  const finished = [];
  const items = state.items.map(t => {
    if (t.done) return t;
    const left = Math.max(0, t.left - step);
    const next = { id: t.id, total: t.total, left: left, label: t.label, step: t.step, done: left === 0 };
    if (next.done) finished.push(next);
    return next;
  });
  return { state: { items: items, nextId: state.nextId }, finished: finished };
}

/** Bezi jeste neco, co potrebuje tikat? */
export function hasRunning(state) {
  return state.items.some(t => !t.done);
}

/** Je vubec co zobrazovat? */
export function isEmpty(state) {
  return state.items.length === 0;
}

/**
 * Prevede casovace do podoby, kterou vzhled jen vykresli - vcetne
 * hotoveho textu a naplneni v procentech. Zadne pocitani ve vzhledu.
 */
export function timerViews(state) {
  return state.items.map(t => ({
    id: t.id,
    step: t.step,
    label: t.label,
    done: t.done,
    percent: t.total ? Math.round((1 - t.left / t.total) * 100) : 100,
    clock: t.done ? 'Hotovo' : fmtClock(t.left),
  }));
}
