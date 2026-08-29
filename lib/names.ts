export type NameParts = {
  given?: string;
  surname?: string;
  prefix?: string;
  suffix?: string;
  title?: string;
  nick?: string;
};

export function fullName(p: NameParts | null | undefined): string {
  if (!p) return "Unknown";
  const surname = [p.prefix, p.surname].filter(Boolean).join(" ");
  const core = [p.given, surname].filter(Boolean).join(" ").trim();
  const withTitle = p.title ? `${p.title} ${core}` : core;
  const out = (withTitle || "Unknown") + (p.suffix ? ` ${p.suffix}` : "");
  return out.trim();
}

export function shortName(p: NameParts | null | undefined): string {
  if (!p) return "Unknown";
  return [p.given || p.nick, p.surname].filter(Boolean).join(" ").trim() || "Unknown";
}

export function lifespan(p: { birthDate?: string; deathDate?: string } | null | undefined): string {
  if (!p) return "";
  const b = p.birthDate || "";
  const d = p.deathDate || "";
  if (!b && !d) return "";
  return `${b || "?"} – ${d || ""}`.trim();
}
