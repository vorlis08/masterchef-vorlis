import {
  createSession, stepCount, currentStep, stepNumber, isFirst, isLast,
  goTo, next, prev, progressPercent, stepLabel, progressLabel, ghostLabel,
  nextLabel, finishText, finishLabel
} from './src/lib/cook-session.js';
import {
  createTimers, addTimer, removeTimer, clearTimers, tick,
  isRunning, hasRunning, isEmpty, timerViews
} from './src/lib/cook-timers.js';

let fail = 0;
const t = (name, got, want) => {
  const g = JSON.stringify(got), w = JSON.stringify(want);
  const ok = g === w;
  console.log((ok ? '  OK   ' : '  FAIL ') + name + (ok ? '' : '\n         cekano: ' + w + '\n         vraceno: ' + g));
  if (!ok) fail++;
};

const STEPS = ['Nakrajej cibuli', 'Osmaz maso', 'Zalij vodou', 'Vari 20 minut'];

console.log('\n--- Krokovani receptem ---');

const s0 = createSession(STEPS);
t('zacina na prvnim kroku', stepNumber(s0), 1);
t('zna pocet kroku', stepCount(s0), 4);
t('vrati text kroku', currentStep(s0), 'Nakrajej cibuli');
t('prvni krok je prvni', isFirst(s0), true);
t('prvni krok neni posledni', isLast(s0), false);

const s1 = next(s0);
t('dalsi krok posune', stepNumber(s1), 2);
t('puvodni stav zustal nedotceny', stepNumber(s0), 1);
t('zpatky se vrati', stepNumber(prev(s1)), 1);

t('zpet z prvniho kroku nikam nevede', stepNumber(prev(s0)), 1);

const posledni = goTo(s0, 3);
t('skok na posledni', stepNumber(posledni), 4);
t('posledni krok se pozna', isLast(posledni), true);
t('dal nez posledni to nepusti', stepNumber(next(posledni)), 4);
t('skok mimo rozsah se ignoruje', stepNumber(goTo(s0, 99)), 1);
t('skok do zaporu se ignoruje', stepNumber(goTo(s0, -5)), 1);

t('postup na prvnim kroku', progressPercent(s0), 25);
t('postup na poslednim kroku', progressPercent(posledni), 100);

console.log('\n--- Popisky ---');

t('popisek basic', stepLabel(s1, false), 'Krok 2 / 4');
t('popisek fancy', stepLabel(s1, true), 'Chod II z IV');
t('hlavicka basic', progressLabel(s1, false), 'Krok 2 z 4');
t('hlavicka fancy', progressLabel(s1, true), 'Chod II z IV');
t('cislo v pozadi basic', ghostLabel(s1, false), '2');
t('cislo v pozadi fancy', ghostLabel(s1, true), 'II');
t('tlacitko uprostred', nextLabel(s1), 'Další →');
t('tlacitko na konci', nextLabel(posledni), 'Hotovo ✓');
t('zaver basic', finishText(false), 'Hotovo. Dobrou chuť!');
t('zaver fancy', finishText(true), 'Servírováno. Dobrou chuť!');
t('zaver popisek fancy', finishLabel(true), 'Dokončeno');

console.log('\n--- Recept bez kroku (nesmi spadnout) ---');

const prazdny = createSession([]);
t('pocet kroku je nula', stepCount(prazdny), 0);
t('text kroku je prazdny', currentStep(prazdny), '');
t('postup je nula', progressPercent(prazdny), 0);
t('popisek je prazdny', stepLabel(prazdny, false), '');
t('dopredu nespadne', stepNumber(next(prazdny)), 1);

console.log('\n--- Casovace ---');

let c = createTimers();
t('na zacatku nic nebezi', isEmpty(c), true);

let r = addTimer(c, 300, 'vari 5 minut', 1);
c = r.state;
t('casovac se pridal', r.added, true);
t('uz neco bezi', hasRunning(c), true);
t('pozna, ze tenhle bezi', isRunning(c, 1, 300), true);
t('jiny krok nebezi', isRunning(c, 2, 300), false);

r = addTimer(c, 300, 'vari 5 minut', 1);
t('stejny casovac podruhe se odmitne', r.added, false);
t('a nepribyl', r.state.items.length, 1);

r = addTimer(c, 600, 'peci 10 minut', 2);
c = r.state;
t('jiny casovac se pridat da', c.items.length, 2);

console.log('\n--- Odpocet (pretoceni casu) ---');

let v = tick(c, 60);
c = v.state;
t('po minute nikdo nedobehl', v.finished.length, 0);
t('prvnimu zbyva 240 s', c.items[0].left, 240);
t('druhemu zbyva 540 s', c.items[1].left, 540);

v = tick(c, 240);
c = v.state;
t('prvni dobehl', v.finished.length, 1);
t('a hlasi spravny krok', v.finished[0].step, 1);
t('je oznaceny jako hotovy', c.items[0].done, true);
t('druhy jeste bezi', c.items[1].done, false);

v = tick(c, 60);
c = v.state;
t('hotovy casovac uz se nehlasi znovu', v.finished.length, 0);
t('a nejde do zaporu', c.items[0].left, 0);

v = tick(c, 9999);
c = v.state;
t('druhy dobehl i pri velkem skoku', v.finished.length, 1);
t('nic uz nebezi', hasRunning(c), false);
t('ale porad jsou videt', isEmpty(c), false);

console.log('\n--- Mazani ---');

const views = timerViews(c);
t('pohled ma dva casovace', views.length, 2);
t('hotovy ukazuje Hotovo', views[0].clock, 'Hotovo');
t('hotovy je na 100 %', views[0].percent, 100);

c = removeTimer(c, views[0].id);
t('smazani ubere jeden', c.items.length, 1);
c = clearTimers(c);
t('uklid smaze vse', isEmpty(c), true);

console.log('\n--- Naplneni ukazatele ---');
let p = createTimers();
p = addTimer(p, 100, 'test', 1).state;
t('na zacatku 0 %', timerViews(p)[0].percent, 0);
p = tick(p, 25).state;
t('po ctvrtine 25 %', timerViews(p)[0].percent, 25);
t('a ukazuje cas', timerViews(p)[0].clock, '1:15');

console.log(fail === 0 ? '\n=== VSE PROSLO ===\n' : '\n=== ' + fail + ' CHYB ===\n');
process.exit(fail === 0 ? 0 : 1);
