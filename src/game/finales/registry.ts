import { drawLloronaFinale } from "./llorona";
import { drawDudamelFinale } from "./dudamel";
import { drawBolivarFinale } from "./bolivar";
import { drawLorenzoFinale } from "./lorenzo";
import { drawDeynaFinale } from "./deyna";
import { drawDayanaFinale } from "./dayana";
import type { FinaleSequence, FinaleView } from "./types";
import { drawMelanioFinale } from "./melanio";
import { drawAliFinale } from "./ali";
import { drawZavarceFinale } from "./zavarce";
import { drawVallenillaFinale } from "./vallenilla";
import { drawJavierFinale } from "./javier";
import { drawRennyFinale } from "./renny";
import { drawGomezFinale } from "./gomez";
import { drawSimonFinale } from "./simon";
import { drawOscarFinale } from "./oscar";
import { drawPumaFinale } from "./puma";
import { drawMcmFinale } from "./mcm";
import { drawGeorgeFinale } from "./george";
import { drawChataingFinale } from "./chataing";

/** Individually researched, painted and combat-reviewed replacements. */
const sequences: Record<string, FinaleSequence> = {
  llorona: drawLloronaFinale,
  dudamel: drawDudamelFinale,
  bolivar: drawBolivarFinale,
  dayana: drawDayanaFinale,
  deyna: drawDeynaFinale,
  lorenzo: drawLorenzoFinale,
  ali: drawAliFinale,
  melanio: drawMelanioFinale,
  zavarce: drawZavarceFinale,
  vallenilla: drawVallenillaFinale,
  javier: drawJavierFinale,
  renny: drawRennyFinale,
  gomez: drawGomezFinale,
  simon: drawSimonFinale,
  oscar: drawOscarFinale,
  puma: drawPumaFinale,
  chataing: drawChataingFinale,
  george: drawGeorgeFinale,
  mcm: drawMcmFinale,
};
export function drawRevisedFinale(view: FinaleView): boolean {
  const draw = sequences[view.actor];
  if (!draw) return false;
  return draw(view);
}
