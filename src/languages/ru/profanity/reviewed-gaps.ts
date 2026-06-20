import { russianFamilyDictionary } from "./authoring.js";
import drochProfanity from "./reviewed-gaps/droch.js";
import huyloProfanity from "./reviewed-gaps/huylo.js";
import mandaProfanity from "./reviewed-gaps/manda.js";
import sosProfanity from "./reviewed-gaps/sos.js";
import yoptProfanity from "./reviewed-gaps/yopt.js";
import zhopaProfanity from "./reviewed-gaps/zhopa.js";

export default russianFamilyDictionary([
  ...yoptProfanity.rules,
  ...zhopaProfanity.rules,
  ...mandaProfanity.rules,
  ...huyloProfanity.rules,
  ...drochProfanity.rules,
  ...sosProfanity.rules,
]);
