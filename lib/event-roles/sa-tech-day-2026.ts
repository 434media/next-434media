/**
 * Role overlay for SA Tech Day 2026 (techday named DB).
 *
 * Why a TS const file vs a Firestore collection:
 *   Read-time overlay joined onto registrations as `mapTechdayDoc` reads them.
 *   Source DB stays untouched (architectural commitment: child sites own their
 *   own data; admin app reads + normalizes). Lists are short, version-controlled
 *   in git, no Firestore round-trip per row.
 *
 * To update:
 *   - Add or remove emails in the arrays below
 *   - Lowercase + trim happens automatically at read time, so paste verbatim
 *   - Re-deploy; next Submissions page load picks up the change
 *
 * Scope:
 *   These overlays apply ONLY to registrations with `_dbSource: "techday"`
 *   (event slug `sa-tech-day-2026`). Other events use their own overlay file.
 *
 * Auto-detected roles (no entry needed here):
 *   - `role:tech-day-attendee` — every techday registrant by default
 *   - `role:tech-fuel-attendee` — registrants whose `events[]` array contains
 *     any tech-fuel variant ("tech-fuel", "Tech Fuel", "techfuel", etc.)
 */

export interface SaTechDay2026Roles {
  /** Speakers at the main Tech Day event. Adds `role:tech-day-speaker`. */
  speakers: string[]
  /** Companies pitching in Tech Fuel. Adds `role:tech-fuel-pitch-company`. */
  pitchCompanies: string[]
  /** Semi-final round judges for Tech Fuel. Adds `role:tech-fuel-semifinal-judge`. */
  semifinalJudges: string[]
}

export const SA_TECH_DAY_2026_ROLES: SaTechDay2026Roles = {
  speakers: [
    "trunty@gmail.com",
    "rtietzsch@gmail.com",
    "alex@modtechlabs.com",
    "dirk@r26d.com",
    "will.k.conway@gmail.com",
    "jrodom@gmail.com",
    "brhodes@knightaerospace.com",
    "aclark@knightaerospace.com",
    "kathy@therxngroup.com",
    "sebastian@alamoangels.com",
    "scollier@darkhive.com",
    "ashley.mitchell@darkhive.com",
    "g.niederauer@freyya.com",
    "gvela@neuscience.co",
    "matthew.reat@sanantonio.gov",
    "beto@bfinstitute.org",
    "brian.dillard@viainfo.net",
    "ponchog@gmail.com",
    "charles@geekdom.com",
    "caramand@trinity.edu",
    "jeremy@velocitytx.org",
    "ssalgueiro@skygrid.com",
  ],
  pitchCompanies: [
    "lance@ectropysolutions.com",
    "chris@adaptassist-tech.com",
    "tamika@aegisapp.io",
    "manuel@aindez.com",
    "cobus@airstormpowertrains.com",
    "george@approvethis.com",
    "gonzalezabisai3@gmail.com",
    "katia@bitesizeskills.com",
    "saulbrauns@gmail.com",
    "bryanm@bronkobikes.com",
    "john@bytewhispersecurity.com",
    "vangoj428@gmail.com",
    "colin@cerebrallabs.io",
    "ryan@chaincraft.games",
    "brian@changebot.ai",
    "hudsonlocke@civicstream.tv",
    "mario.soave@cleverfi.com",
    "ceo@comebackmobility.com",
    "carlos.maiguel@corello.ai",
    "m.dhaouafi@curebionics.com",
    "edduardo@derimed.pro",
    "dev@dhi-tech.com",
    "founder@bookwithdobi.com",
    "robb@dui911.org",
    "vanessa@chooseparity.com",
    "evansantos.tx@gmail.com",
    "kkwarteng.a@gmail.com",
    "delagarzalarralde@gmail.com",
    "g.niederauer@freyya.com",
    "info@galeproject.com",
    "zac@givekit.org",
    "llyas@grantappli.com",
    "terry@gridnetai.com",
    "alan@groe.solutions",
    "yosh@gohadley.com",
    "handidoor@handidoor.com",
    "danny@incenti.co",
    "hello@keeptabz.ai",
    "shane@kortexdigitallabs.com",
    "steven.ortega426@gmail.com",
    "jose@legalmente.ai",
    "rehan@uselumora.co",
    "alejandro@luyoa.com",
    "claus@medvise.io",
    "saenz@mezintenz.com",
    "jrb@mintlocke.com",
    "rmotaa@mitogenixtherapeuticsllc.com",
    "alec@mosaiccollaborative.com",
    "eric.cj@nxhealthsolutions.org",
    "luis.hernandez@obseqia.co",
    "luis.hernandez@obseqia.com",
    "mitch@onebison.us",
    "lruelas1214@gmail.com",
    "kwaters@theopenlane.io",
    "vasquezaldo.011@gmail.com",
    "aldo.tig011@gmail.com",
    "tim@provenance.guru",
    "timothy.lefkowitz@gmail.com",
    "brandon@quantum-mechanix.net",
    "corrina@theaicowboys.com",
    "jacob@reflektlegal.ai",
    "matthew@rentbamboo.com",
    "jodi@rezme.app",
    "jesseovr@gmail.com",
    "antonio@scoutzapp.com",
    "info@service-hero.ai",
    "ray@simmie.ai",
    "steve@smileflow.ai",
    "jacqueline@magentrust.ai",
    "m_pendleton@theaicowboys.com",
    "roger@theaicowboys.com",
    "jon@cokerhouseproductions.com",
    "victor@treatwalk.com",
    "fela@trotta.io",
    "hmogbo@gmail.com",
    "alma.duffey@veloquix.com",
  ],
  semifinalJudges: [
    "alfred.breuer@sanantonio.gov",
    "amie@frictionlessinc.com",
    "andreacasillasf@gmail.com",
    "bethany@activecapital.com",
    "beto@irystechnologies.com",
    "caramand@trinity.edu",
    "charles@geekdom.com",
    "cjp.colburn@gmail.com",
    "cliff.zintgraff@samsat.org",
    "dan.karam@utsa.edu",
    "eduardo@irystechnologies.com",
    "enrique@checkups.us",
    "francisco@alamoangels.com",
    "gabrielsenior@gmail.com",
    "hajarchi@gmail.com",
    "jeremy@velocitytx.org",
    "lara@robotcreative.com",
    "luismartinez@capitalfactory.com",
    "lpgongar@gmail.com",
    "malissa.runty@gmail.com",
    "corona@frictionlessinc.com",
    "melissa@inventures.team",
    "raul@welcome.tech",
    "sara@wearetribu.com",
    "walter.g.ugalde@nasa.gov",
  ],
}

/**
 * Returns the role tags that should be merged onto a registration based on
 * the registrant's email. Returns an empty array if the email matches no
 * overlay role.
 */
export function getSaTechDay2026RoleTags(email: string | undefined | null): string[] {
  if (!email) return []
  const e = email.trim().toLowerCase()
  if (!e) return []

  const tags: string[] = []
  if (SA_TECH_DAY_2026_ROLES.speakers.some((x) => x.toLowerCase() === e)) {
    tags.push("role:tech-day-speaker")
  }
  if (SA_TECH_DAY_2026_ROLES.pitchCompanies.some((x) => x.toLowerCase() === e)) {
    tags.push("role:tech-fuel-pitch-company")
  }
  if (SA_TECH_DAY_2026_ROLES.semifinalJudges.some((x) => x.toLowerCase() === e)) {
    tags.push("role:tech-fuel-semifinal-judge")
  }
  return tags
}
