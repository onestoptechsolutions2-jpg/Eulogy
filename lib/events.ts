import { eq } from "drizzle-orm";
import { db } from "@/db";
import { events } from "@/db/schema";
import type { LifeEvent, Person } from "@/db/schema";

export const EVENT_KINDS = [
  "birth",
  "death",
  "marriage",
  "baptism",
  "graduation",
  "residence",
  "military",
  "immigration",
  "custom",
] as const;

const LABELS: Record<string, string> = {
  birth: "Born",
  death: "Died",
  marriage: "Married",
  baptism: "Baptised",
  graduation: "Graduated",
  residence: "Lived",
  military: "Military service",
  immigration: "Immigrated",
  custom: "Event",
};

export function eventLabel(kind: string, title?: string): string {
  return (title && title.trim()) || LABELS[kind] || "Event";
}

export async function listEvents(personId: string): Promise<LifeEvent[]> {
  return db.select().from(events).where(eq(events.personId, personId));
}

export type TimelineItem = {
  kind: string;
  label: string;
  date: string;
  place?: string;
  note?: string;
};

/** Merge the person's birth/death fields with recorded events, by date text. */
export function buildTimeline(person: Person, evs: LifeEvent[]): TimelineItem[] {
  const items: (TimelineItem & { sortKey: string })[] = [];
  const hasDeathEvent = evs.some((e) => e.kind === "death");
  const hasBirthEvent = evs.some((e) => e.kind === "birth");

  if (person.birthDate && !hasBirthEvent) {
    items.push({ kind: "birth", label: "Born", date: person.birthDate, sortKey: person.birthDate });
  }
  for (const e of evs) {
    items.push({
      kind: e.kind,
      label: eventLabel(e.kind, e.title),
      date: e.date,
      place: e.place || undefined,
      note: e.note || undefined,
      sortKey: e.date || "9999-99",
    });
  }
  if (person.deathDate && !hasDeathEvent) {
    items.push({ kind: "death", label: "Died", date: person.deathDate, sortKey: person.deathDate });
  }

  return items
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
    .map(({ sortKey: _sortKey, ...rest }) => rest);
}
