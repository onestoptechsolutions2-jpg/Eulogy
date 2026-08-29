import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { parseGramps } from "../lib/gramps.ts";
import { buildGraph } from "../lib/kinship.ts";
import { fullName } from "../lib/names.ts";

// The real family export lives outside this repo.
const REAL =
  "C:/Users/Billions/source/repos/Gramps-Compass/Backup/Gramps\u2019 Compass_2024-12-13.gramps";

test("parses the real Gramps export", { skip: !existsSync(REAL) }, () => {
  const g = parseGramps(readFileSync(REAL));

  assert.equal(g.people.length, 44);
  assert.equal(g.families.length, 16);
  assert.ok(g.children.length >= 30);

  const kate = g.people.find((p) => p.nick === "Kate");
  assert.ok(kate, "Catherine 'Kate' present");
  assert.equal(kate!.surname, "Dindi");
  assert.equal(kate!.gender, "F");

  const billy = g.people.find((p) => p.grampsId === "I0003");
  assert.equal(billy!.birthDate, "1994-06-30");

  // graph sanity: Kate has a partner and children
  const graph = buildGraph(
    g.people.map((p) => ({ id: p.handle, given: p.given, surname: p.surname, gender: p.gender })),
    g.families.map((f) => ({
      id: f.handle,
      partner1Id: f.partner1,
      partner2Id: f.partner2,
      children: g.children.filter((c) => c.familyHandle === f.handle).map((c) => c.childHandle),
    })),
  );
  assert.ok((graph.partnersOf.get(kate!.handle)?.size ?? 0) >= 1);
  assert.ok((graph.childrenOf.get(kate!.handle)?.size ?? 0) >= 1);
});

test("handles plain (non-gzipped) XML too", () => {
  const xml = `<?xml version="1.0"?><database xmlns="x">
    <people>
      <person handle="_a" id="I1"><gender>F</gender>
        <name type="Birth Name"><first>Amina</first><surname>Odhiambo</surname></name>
        <parentin hlink="_f"/></person>
      <person handle="_b" id="I2"><gender>M</gender>
        <name type="Birth Name"><first>Otieno</first><surname>Odhiambo</surname></name>
        <childof hlink="_f"/></person>
    </people>
    <families>
      <family handle="_f" id="F1"><rel type="Married"/>
        <mother hlink="_a"/><childref hlink="_b"/></family>
    </families>
  </database>`;
  const g = parseGramps(Buffer.from(xml, "utf8"));
  assert.equal(g.people.length, 2);
  assert.equal(g.families.length, 1);
  assert.equal(fullName(g.people[0]), "Amina Odhiambo");
  assert.equal(g.children[0].childHandle, "_b");
});
