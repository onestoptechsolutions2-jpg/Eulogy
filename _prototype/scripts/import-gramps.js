// One-shot importer: load a .gramps file (or plain Gramps XML) into Neon.
// Wipes and reloads the people / families / family_children tables; leaves
// contributions, guestbook, and site untouched. Family-entered dates and
// bios on existing people are preserved across re-imports.
//
//   npm run import:gramps -- "C:/path/to/Family.gramps"
//
import "dotenv/config";
import fs from "node:fs";
import { parseGramps } from "../src/lib/gramps.js";
import { ensureSchema, replaceGenealogy } from "../src/db.js";

const file = process.argv[2];
if (!file) {
  console.error(
    'Usage: npm run import:gramps -- "<path to .gramps or .xml>"\n\n' +
    "The .gramps file is Gramps' own backup format (Export > Gramps XML, or the\n" +
    "timestamped file under a tree's Backup/ folder)."
  );
  process.exit(1);
}
if (!fs.existsSync(file)) {
  console.error(`No such file: ${file}`);
  process.exit(1);
}

const { people, families, children } = parseGramps(fs.readFileSync(file));
console.log(`Parsed ${people.length} people, ${families.length} families, ${children.length} child links.`);

await ensureSchema();
const counts = await replaceGenealogy({ people, families, children });
console.log("Loaded into Neon:", counts);
process.exit(0);
