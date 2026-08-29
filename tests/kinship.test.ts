import { test } from "node:test";
import assert from "node:assert/strict";
import { buildGraph, kinship, shortestPath, ancestorDistances } from "../lib/kinship.ts";
import type { GraphPerson, GraphFamily } from "../lib/kinship.ts";

// Ann═Bob
//   ├── Cal═Dee ── Gus ── Ivy
//   └── Eve═Fry ── Hal
const people: GraphPerson[] = [
  { id: "ann", given: "Ann", gender: "F" },
  { id: "bob", given: "Bob", gender: "M" },
  { id: "cal", given: "Cal", gender: "M" },
  { id: "dee", given: "Dee", gender: "F" },
  { id: "eve", given: "Eve", gender: "F" },
  { id: "fry", given: "Fry", gender: "M" },
  { id: "gus", given: "Gus", gender: "M" },
  { id: "hal", given: "Hal", gender: "M" },
  { id: "ivy", given: "Ivy", gender: "F" },
];
const families: GraphFamily[] = [
  { id: "f1", partner1Id: "bob", partner2Id: "ann", children: ["cal", "eve"] },
  { id: "f2", partner1Id: "cal", partner2Id: "dee", children: ["gus"] },
  { id: "f3", partner1Id: "fry", partner2Id: "eve", children: ["hal"] },
  { id: "f4", partner1Id: "gus", partner2Id: null, children: ["ivy"] },
];
const g = buildGraph(people, families);

test("spouses", () => {
  assert.equal(kinship(g, "ann", "bob").label, "husband");
  assert.equal(kinship(g, "ann", "bob").reverse, "wife");
});

test("parent / child", () => {
  assert.equal(kinship(g, "ann", "cal").label, "son");
  assert.equal(kinship(g, "ann", "cal").reverse, "mother");
});

test("siblings", () => {
  assert.equal(kinship(g, "cal", "eve").label, "sister");
  assert.equal(kinship(g, "cal", "eve").reverse, "brother");
});

test("grandparent / grandchild", () => {
  assert.equal(kinship(g, "ann", "gus").label, "grandson");
  assert.equal(kinship(g, "gus", "ann").label, "grandmother");
});

test("aunt-uncle / niece-nephew", () => {
  assert.equal(kinship(g, "cal", "hal").label, "nephew");
  assert.equal(kinship(g, "cal", "hal").reverse, "uncle");
});

test("first cousins", () => {
  assert.equal(kinship(g, "gus", "hal").label, "first cousin");
});

test("first cousin once removed", () => {
  assert.equal(kinship(g, "hal", "ivy").label, "first cousin once removed");
});

test("common ancestors reported", () => {
  const k = kinship(g, "gus", "hal");
  assert.deepEqual(new Set(k.commonAncestorIds), new Set(["ann", "bob"]));
});

test("no relationship", () => {
  const loneG = buildGraph(
    [{ id: "x" }, { id: "y" }],
    [],
  );
  assert.equal(kinship(loneG, "x", "y").label, "no known relationship");
});

test("ancestorDistances", () => {
  const d = ancestorDistances(g, "ivy");
  assert.equal(d.get("ivy"), 0);
  assert.equal(d.get("gus"), 1);
  assert.equal(d.get("cal"), 2);
  assert.equal(d.get("ann"), 3);
});

test("shortestPath chain", () => {
  const path = shortestPath(g, "cal", "hal");
  assert.ok(path);
  assert.deepEqual(
    path!.map((s) => s.id),
    ["cal", "ann", "eve", "hal"],
  );
  assert.deepEqual(
    path!.map((s) => s.relToPrev),
    ["", "parent", "child", "child"],
  );
});
