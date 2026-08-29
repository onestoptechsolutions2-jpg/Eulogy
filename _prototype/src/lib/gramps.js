import zlib from "node:zlib";
import { XMLParser } from "fast-xml-parser";

// A .gramps file is a gzipped Gramps XML database. An exported .gramps can
// also be plain XML, so sniff the gzip magic bytes (1f 8b) first.
export function decompressGramps(buffer) {
  if (buffer[0] === 0x1f && buffer[1] === 0x8b) return zlib.gunzipSync(buffer);
  return buffer;
}

const REPEATED = new Set([
  "person", "family", "event", "name", "childref", "eventref", "childof", "parentin",
]);

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  isArray: (name) => REPEATED.has(name),
});

// fast-xml-parser gives `"text"` for a bare element and `{ "#text": "text", ... }`
// for one that also carries attributes. Flatten both to a string.
function text(node) {
  if (node == null) return "";
  if (typeof node === "object") return String(node["#text"] ?? "").trim();
  return String(node).trim();
}

function asArray(x) {
  if (x == null || x === "") return [];
  return Array.isArray(x) ? x : [x];
}

function dateFromEvent(evt) {
  if (!evt) return "";
  if (evt.dateval) return String(evt.dateval["@_val"] || "");
  if (evt.datestr) return String(evt.datestr["@_val"] || "");
  if (evt.daterange) {
    const s = evt.daterange["@_start"] || "";
    const e = evt.daterange["@_stop"] || "";
    return [s, e].filter(Boolean).join(" – ");
  }
  return "";
}

/**
 * Parse a Gramps database buffer into flat rows ready for the `people`,
 * `families`, and `family_children` tables. Handles keep their leading
 * underscore exactly as Gramps writes them, so definitions and hlink
 * references line up without transformation.
 */
export function parseGramps(buffer) {
  const doc = parser.parse(decompressGramps(buffer).toString("utf8"));
  const db = doc.database || {};

  // events, keyed by handle, so a person's eventref can be resolved
  const eventsByHandle = {};
  for (const e of asArray(db.events?.event)) {
    eventsByHandle[e["@_handle"]] = { type: text(e.type), date: dateFromEvent(e) };
  }

  const people = [];
  for (const p of asArray(db.people?.person)) {
    const names = asArray(p.name);
    const primary = names[0] || {};
    const surnameNode = primary.surname;
    const surname =
      typeof surnameNode === "object" ? text(surnameNode) : text(surnameNode);
    const prefix =
      typeof surnameNode === "object" ? String(surnameNode["@_prefix"] || "") : "";

    let birth_date = "";
    let death_date = "";
    for (const ref of asArray(p.eventref)) {
      const evt = eventsByHandle[ref["@_hlink"]];
      if (!evt) continue;
      if (/birth/i.test(evt.type) && !birth_date) birth_date = evt.date;
      if (/death/i.test(evt.type) && !death_date) death_date = evt.date;
    }

    const first_name = text(primary.first);
    people.push({
      handle: p["@_handle"],
      gramps_id: String(p["@_id"] || ""),
      first_name,
      surname,
      prefix,
      suffix: text(primary.suffix),
      title: text(primary.title),
      nick: text(primary.nick),
      gender: (text(p.gender) || "U").toUpperCase().slice(0, 1),
      birth_date,
      death_date,
      sort_key: `${surname} ${first_name}`.toLowerCase().trim(),
    });
  }

  const families = [];
  const children = [];
  for (const f of asArray(db.families?.family)) {
    const handle = f["@_handle"];
    families.push({
      handle,
      gramps_id: String(f["@_id"] || ""),
      father_handle: f.father ? f.father["@_hlink"] : null,
      mother_handle: f.mother ? f.mother["@_hlink"] : null,
      rel_type: f.rel ? String(f.rel["@_type"] || "Unknown") : "Unknown",
    });
    asArray(f.childref).forEach((c, i) => {
      children.push({ family_handle: handle, child_handle: c["@_hlink"], seq: i });
    });
  }

  return { people, families, children };
}
