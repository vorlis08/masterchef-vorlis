// ==========================================================================
// cook-session.js  --  cast "mozku"
//
// Odpovida na jedinou otazku: KDE V RECEPTU PRAVE JSEM.
// Nevi nic o obrazovce, animacich ani o tom, jestli se krokuje tlacitkem
// nebo svihnutim prstu. Diky tomu si stejne krokovani muze vzit
// "Aplikace", "Kniha" i "Kucharka".
//
// Stav se nemeni na miste - kazda funkce vraci NOVY stav. Diky tomu se da
// kterykoli krok zopakovat v testu bez prohlizece.
// ==========================================================================

import { roman } from './recipe-logic.js';

/**
 * Zalozi novou "seanci" vareni.
 *
 * @param {Array<string>} steps  kroky receptu
 * @param {number} [index]       na kterem kroku zacit (vychozi 0)
 */
export function createSession(steps, index) {
  const list = (Array.isArray(steps) ? steps : []).filter(s => s != null);
  return {
    steps: list,
    index: clampIndex(list, index || 0),
  };
}

function clampIndex(steps, i) {
  if (steps.length === 0) return 0;
  if (i < 0) return 0;
  if (i > steps.length - 1) return steps.length - 1;
  return i;
}

/** Kolik kroku recept ma. */
export function stepCount(session) {
  return session.steps.length;
}

/** Text kroku, na kterem prave stojime. */
export function currentStep(session) {
  return session.steps[session.index] || '';
}

/** Cislo kroku tak, jak ho vidi clovek (od 1). */
export function stepNumber(session) {
  return session.index + 1;
}

export function isFirst(session) {
  return session.index === 0;
}

export function isLast(session) {
  return stepCount(session) === 0 || session.index === stepCount(session) - 1;
}

/**
 * Skok na konkretni krok. Mimo rozsah se ignoruje - vrati se puvodni stav,
 * takze volajici nemusi hlidat meze.
 */
export function goTo(session, target) {
  if (target < 0 || target > stepCount(session) - 1) return session;
  if (target === session.index) return session;
  return { steps: session.steps, index: target };
}

/** O krok dal. Na poslednim kroku uz dal nejde - viz isLast. */
export function next(session) {
  return goTo(session, session.index + 1);
}

/** O krok zpet. Na prvnim kroku nedela nic. */
export function prev(session) {
  return goTo(session, session.index - 1);
}

/** Naplneni ukazatele postupu v procentech (0-100). */
export function progressPercent(session) {
  const total = stepCount(session);
  if (total === 0) return 0;
  return Math.round(((session.index + 1) / total) * 100);
}

// -- Popisky -------------------------------------------------------------
// Fancy rezim pocita rimskymi cislicemi a mluvi o "chodech".

/** Kratky popisek nad krokem: "Krok 3 / 8" nebo "Chod III z VIII". */
export function stepLabel(session, fancy) {
  const n = stepNumber(session), total = stepCount(session);
  if (total === 0) return '';
  return fancy
    ? 'Chod ' + roman(n) + ' z ' + roman(total)
    : 'Krok ' + n + ' / ' + total;
}

/** Popisek v hlavicce: "Krok 3 z 8" nebo "Chod III z VIII". */
export function progressLabel(session, fancy) {
  const n = stepNumber(session), total = stepCount(session);
  if (total === 0) return '';
  return fancy
    ? 'Chod ' + roman(n) + ' z ' + roman(total)
    : 'Krok ' + n + ' z ' + total;
}

/** Velke cislo v pozadi kroku. */
export function ghostLabel(session, fancy) {
  const n = stepNumber(session);
  return fancy ? roman(n) : String(n);
}

/** Co ma stat na tlacitku "dopredu". */
export function nextLabel(session) {
  return isLast(session) ? 'Hotovo \u2713' : 'Dal\u0161\u00ed \u2192';
}

/** Hlaska na konci vareni. */
export function finishText(fancy) {
  return fancy ? 'Serv\u00edrov\u00e1no. Dobrou chu\u0165!' : 'Hotovo. Dobrou chu\u0165!';
}

/** Popisek na konci vareni. */
export function finishLabel(fancy) {
  return fancy ? 'Dokon\u010deno' : 'Uva\u0159eno';
}
