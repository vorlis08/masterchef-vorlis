// ==========================================================================
// cas.js  --  cast "mozku"
//
// Prevod mezi UTC a ceskym casem.
//
// Proc to nestaci "+2": Worker bezi v UTC a appka zije v Praze, kde se
// dvakrat rocne meni cas. Pevne dane dve hodiny plati jen od dubna do
// rijna. Pres zimu se s nimi:
//   - denni e-mail odesle v 6:00 misto v 7:00,
//   - hodinovy beh se mezi 21:00 a 22:00 povazuje za noc a NEPOSLE nic,
//     takze na pozdni vecerni vareni pripominka nedorazi,
//   - pripominka pred varenim pipne o hodinu driv.
//
// Pasmo umi spocitat `Intl` a je v kazdem prohlizeci i ve Workeru, takze
// tady nepotrebujeme zadnou knihovnu ani tabulku prechodu.
// ==========================================================================

export const PASMO = 'Europe/Prague';

const FORMAT = new Intl.DateTimeFormat('en-GB', {
  timeZone: PASMO,
  hourCycle: 'h23',
  year: 'numeric', month: '2-digit', day: '2-digit',
  hour: '2-digit', minute: '2-digit', second: '2-digit',
});

/** Rozlozi okamzik na cisla tak, jak ho v tu chvili vidi Praha. */
function casti(datum) {
  const out = {};
  FORMAT.formatToParts(datum).forEach(x => { out[x.type] = Number(x.value); });
  return out;
}

/**
 * O kolik hodin je cesky cas napred pred UTC. V lete 2, v zime 1.
 *
 * @param {Date} [datum]  okamzik, ke kteremu se ptame (vychozi: ted)
 */
export function posunPrahy(datum) {
  const d = datum || new Date();
  const c = casti(d);
  const jakoUtc = Date.UTC(c.year, c.month - 1, c.day, c.hour, c.minute, c.second);
  // Vteriny nize orezavame na cele sekundy - Date.UTC je nezna a rozdil
  // by jinak vysel o zlomek vedle a zaokrouhlil se spatne.
  const presne = Math.floor(d.getTime() / 1000) * 1000;
  return Math.round((jakoUtc - presne) / 3600000);
}

/** Kolik je v Praze hodin (0-23) v danem okamziku. */
export function hodinaVPraze(datum) {
  return casti(datum || new Date()).hour;
}
