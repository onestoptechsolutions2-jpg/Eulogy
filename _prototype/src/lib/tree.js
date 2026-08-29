// Pure helpers over the { people, families } payload from getGenealogy().
// No database access here.

export function fullName(p) {
  if (!p) return "Unknown";
  const surname = [p.prefix, p.surname].filter(Boolean).join(" ");
  const core = [p.first_name, surname].filter(Boolean).join(" ").trim();
  const withTitle = p.title ? `${p.title} ${core}` : core;
  return (withTitle || "Unknown") + (p.suffix ? ` ${p.suffix}` : "");
}

export function shortName(p) {
  if (!p) return "Unknown";
  return [p.first_name || p.nick, p.surname].filter(Boolean).join(" ").trim() || "Unknown";
}

export function lifespan(p) {
  if (!p) return "";
  const b = p.birth_date || "";
  const d = p.death_date || "";
  if (!b && !d) return "";
  return `${b || "?"} – ${d || ""}`.trim();
}

export function indexPeople(people) {
  const byHandle = {};
  for (const p of people) byHandle[p.handle] = p;
  return byHandle;
}

/**
 * Immediate relatives of one person:
 *   parents  – the couple(s) this person is a child of
 *   siblings – other children of those same families
 *   partners – the other parent in families this person is a parent of
 *   children – children of those families
 */
export function relativesOf(handle, { people, families }) {
  const byHandle = indexPeople(people);
  const parentFamilies = families.filter((f) => f.children.includes(handle));
  const ownFamilies = families.filter(
    (f) => f.father_handle === handle || f.mother_handle === handle
  );

  const parents = [];
  const siblings = [];
  for (const f of parentFamilies) {
    for (const h of [f.father_handle, f.mother_handle]) {
      if (h && byHandle[h]) parents.push(byHandle[h]);
    }
    for (const c of f.children) {
      if (c !== handle && byHandle[c]) siblings.push(byHandle[c]);
    }
  }

  const partners = [];
  const children = [];
  for (const f of ownFamilies) {
    const other = f.father_handle === handle ? f.mother_handle : f.father_handle;
    if (other && byHandle[other]) partners.push(byHandle[other]);
    for (const c of f.children) if (byHandle[c]) children.push(byHandle[c]);
  }

  return { parents, siblings, partners, children, parentFamilies, ownFamilies };
}

/**
 * Family units for a flat, legible whole-tree view: each row is a couple
 * (or single parent) and their children, sorted so rooted branches read
 * top-down-ish. Not a drawn pedigree — a clear list, Gramps "Families"
 * style.
 */
export function familyUnits({ people, families }) {
  const byHandle = indexPeople(people);
  return families
    .map((f) => ({
      id: f.gramps_id,
      handle: f.handle,
      rel_type: f.rel_type,
      father: byHandle[f.father_handle] || null,
      mother: byHandle[f.mother_handle] || null,
      children: f.children.map((h) => byHandle[h]).filter(Boolean),
    }))
    .sort((a, b) => {
      const an = (a.father || a.mother)?.sort_key || "";
      const bn = (b.father || b.mother)?.sort_key || "";
      return an.localeCompare(bn);
    });
}

// People who are never listed as anyone's child — the top of the tree.
export function rootPeople({ people, families }) {
  const childHandles = new Set();
  for (const f of families) for (const c of f.children) childHandles.add(c);
  return people.filter((p) => !childHandles.has(p.handle));
}
