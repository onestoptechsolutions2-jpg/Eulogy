import zlib from "node:zlib";
import { XMLParser } from "fast-xml-parser";

export type ParsedPerson = {
  handle: string;
  grampsId: string;
  given: string;
  surname: string;
  prefix: string;
  suffix: string;
  title: string;
  nick: string;
  gender: "M" | "F" | "U";
  birthDate: string;
  deathDate: string;
};

export type ParsedFamily = {
  handle: string;
  grampsId: string;
  partner1: string | null;
  partner2: string | null;
  relType: string;
};

export type ParsedChild = { familyHandle: string; childHandle: string; seq: number };

export type ParsedGramps = {
  people: ParsedPerson[];
  families: ParsedFamily[];
  children: ParsedChild[];
};

// A .gramps file is gzipped Gramps XML; an exported one can be plain XML.
export function decompressGramps(buffer: Buffer): Buffer {
  if (buffer[0] === 0x1f && buffer[1] === 0x8b) return zlib.gunzipSync(buffer);
  return buffer;
}

const REPEATED = new Set([
  "person",
  "family",
  "event",
  "name",
  "childref",
  "eventref",
  "childof",
  "parentin",
]);

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  isArray: (name) => REPEATED.has(name),
});

// fast-xml-parser returns "text" for a bare element and { "#text": "text", ... }
// when the element also carries attributes.
function text(node: unknown): string {
  if (node == null) return "";
  if (typeof node === "object") {
    const rec = node as Record<string, unknown>;
    return String(rec["#text"] ?? "").trim();
  }
  return String(node).trim();
}

function asArray<T>(x: T | T[] | undefined | null | ""): T[] {
  if (x == null || x === "") return [];
  return Array.isArray(x) ? x : [x];
}

function dateFromEvent(evt: Record<string, unknown> | undefined): string {
  if (!evt) return "";
  const dateval = evt.dateval as Record<string, unknown> | undefined;
  if (dateval) return String(dateval["@_val"] || "");
  const datestr = evt.datestr as Record<string, unknown> | undefined;
  if (datestr) return String(datestr["@_val"] || "");
  const daterange = evt.daterange as Record<string, unknown> | undefined;
  if (daterange) {
    return [daterange["@_start"], daterange["@_stop"]].filter(Boolean).join(" – ");
  }
  return "";
}

export function parseGramps(buffer: Buffer): ParsedGramps {
  const doc = parser.parse(decompressGramps(buffer).toString("utf8"));
  const database = (doc.database ?? {}) as Record<string, any>;

  const eventsByHandle: Record<string, { type: string; date: string }> = {};
  for (const e of asArray<Record<string, any>>(database.events?.event)) {
    eventsByHandle[e["@_handle"]] = { type: text(e.type), date: dateFromEvent(e) };
  }

  const people: ParsedPerson[] = [];
  for (const p of asArray<Record<string, any>>(database.people?.person)) {
    const names = asArray<Record<string, any>>(p.name);
    const primary = names[0] ?? {};
    const surnameNode = primary.surname;
    const surname = text(surnameNode);
    const prefix =
      surnameNode && typeof surnameNode === "object"
        ? String((surnameNode as Record<string, unknown>)["@_prefix"] || "")
        : "";

    let birthDate = "";
    let deathDate = "";
    for (const ref of asArray<Record<string, any>>(p.eventref)) {
      const evt = eventsByHandle[ref["@_hlink"]];
      if (!evt) continue;
      if (/birth/i.test(evt.type) && !birthDate) birthDate = evt.date;
      if (/death/i.test(evt.type) && !deathDate) deathDate = evt.date;
    }

    const g = (text(p.gender) || "U").toUpperCase().slice(0, 1);
    people.push({
      handle: p["@_handle"],
      grampsId: String(p["@_id"] || ""),
      given: text(primary.first),
      surname,
      prefix,
      suffix: text(primary.suffix),
      title: text(primary.title),
      nick: text(primary.nick),
      gender: g === "M" || g === "F" ? g : "U",
      birthDate,
      deathDate,
    });
  }

  const families: ParsedFamily[] = [];
  const children: ParsedChild[] = [];
  for (const f of asArray<Record<string, any>>(database.families?.family)) {
    const handle = f["@_handle"];
    families.push({
      handle,
      grampsId: String(f["@_id"] || ""),
      partner1: f.father ? f.father["@_hlink"] : null,
      partner2: f.mother ? f.mother["@_hlink"] : null,
      relType: f.rel ? String(f.rel["@_type"] || "Unknown") : "Unknown",
    });
    asArray<Record<string, any>>(f.childref).forEach((c, i) => {
      children.push({ familyHandle: handle, childHandle: c["@_hlink"], seq: i });
    });
  }

  return { people, families, children };
}
