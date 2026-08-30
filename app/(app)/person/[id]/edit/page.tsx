import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireMember, canEdit } from "@/lib/access";
import { getPerson } from "@/lib/queries";
import { canEditPerson } from "@/lib/profile";
import { fullName } from "@/lib/names";
import { listEvents, eventLabel, EVENT_KINDS } from "@/lib/events";
import { listGallery } from "@/lib/media";
import { updatePerson } from "./actions";
import {
  setPersonImage,
  clearPersonImage,
  addGalleryPhoto,
  removeGalleryPhoto,
} from "../media-actions";
import { addEvent, deleteEvent, markDeceased, markLiving } from "../life-actions";

const ACCEPT = "image/jpeg,image/png,image/webp,image/gif";

export default async function EditPersonPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ msg?: string; error?: string }>;
}) {
  const { id } = await params;
  const { msg, error } = await searchParams;
  const { tree, user, role } = await requireMember();
  const person = await getPerson(tree.id, id);
  if (!person) notFound();
  if (!canEditPerson(role, person, user.id)) redirect(`/person/${id}`);

  const isEditor = canEdit(role);
  const [evs, gallery] = await Promise.all([listEvents(id), listGallery(tree.id, id)]);

  const Field = ({
    name,
    label,
    value,
    placeholder,
  }: {
    name: string;
    label: string;
    value: string;
    placeholder?: string;
  }) => (
    <label className="flex flex-col gap-1">
      <span className="label">{label}</span>
      <input name={name} defaultValue={value} placeholder={placeholder} className="field" />
    </label>
  );

  return (
    <div className="flex max-w-measure flex-col gap-10">
      <div>
        <p className="label">Editing</p>
        <h1 className="text-2xl">{fullName(person)}</h1>
        <Link href={`/person/${person.id}`} className="text-sm">← Back to profile</Link>
      </div>

      {(msg || error) && (
        <p
          className="card p-3 text-sm"
          style={{ borderLeft: `3px solid ${error ? "var(--earth)" : "var(--indigo)"}` }}
        >
          {error ? decodeURIComponent(error) : "Saved."}
        </p>
      )}

      {/* --- Photos ------------------------------------------------------ */}
      <section className="flex flex-col gap-4">
        <h2 className="label">Photos</h2>
        <div className="grid gap-6 sm:grid-cols-2">
          <ImageSlot
            personId={person.id}
            field="photoUrl"
            title="Profile photo"
            url={person.photoUrl}
            round
          />
          <ImageSlot
            personId={person.id}
            field="coverUrl"
            title="Background"
            url={person.coverUrl}
          />
        </div>
      </section>

      {/* --- Details --------------------------------------------------- */}
      <form action={updatePerson} className="flex flex-col gap-4">
        <h2 className="label">Details</h2>
        <input type="hidden" name="id" value={person.id} />

        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="given" label="First / given name" value={person.given} />
          <Field name="surname" label="Surname" value={person.surname} />
          <Field name="prefix" label="Surname prefix" value={person.prefix} placeholder="e.g. father's name" />
          <Field name="suffix" label="Suffix" value={person.suffix} placeholder="Jr, III…" />
          <Field name="title" label="Title" value={person.title} placeholder="Mr, Dr, Eng…" />
          <Field name="nick" label="Nickname" value={person.nick} />
        </div>

        <label className="flex flex-col gap-1">
          <span className="label">Gender</span>
          <select name="gender" defaultValue={person.gender} className="field !w-40">
            <option value="U">Unspecified</option>
            <option value="F">Female</option>
            <option value="M">Male</option>
          </select>
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="birthDate" label="Born" value={person.birthDate} placeholder="1975 or 1975-04-12" />
          <Field name="deathDate" label="Died" value={person.deathDate} placeholder="blank if living" />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="photoUrl" label="Profile photo URL" value={person.photoUrl} placeholder="or upload above" />
          <Field name="coverUrl" label="Background URL" value={person.coverUrl} placeholder="or upload above" />
        </div>

        <label className="flex flex-col gap-1">
          <span className="label">About</span>
          <textarea name="bio" defaultValue={person.bio} className="field min-h-[10rem]" />
        </label>

        <div className="flex gap-3">
          <button type="submit" className="btn">Save details</button>
          <Link href={`/person/${person.id}`} className="btn ghost">Cancel</Link>
        </div>
      </form>

      {/* --- Deceased status (owner/editor) --------------------------- */}
      {isEditor && (
        <section className="flex flex-col gap-3">
          <h2 className="label">Status</h2>
          {person.living ? (
            <form action={markDeceased} className="card flex flex-wrap items-end gap-3 p-4">
              <input type="hidden" name="personId" value={person.id} />
              <label className="flex flex-col gap-1">
                <span className="label">Date of death</span>
                <input name="deathDate" className="field" placeholder="2024 or 2024-03-01" />
              </label>
              <label className="flex flex-col gap-1">
                <span className="label">Place (optional)</span>
                <input name="place" className="field" />
              </label>
              <button type="submit" className="btn ghost">Mark as deceased</button>
            </form>
          ) : (
            <form action={markLiving} className="card flex items-center justify-between gap-3 p-4 text-sm">
              <span>Recorded as deceased{person.deathDate ? ` (${person.deathDate})` : ""}.</span>
              <input type="hidden" name="personId" value={person.id} />
              <button type="submit" className="btn ghost">Undo</button>
            </form>
          )}
        </section>
      )}

      {/* --- Life events -------------------------------------------------- */}
      <section className="flex flex-col gap-3">
        <h2 className="label">Life events</h2>
        {evs.length > 0 && (
          <ul className="flex flex-col divide-y divide-[color:var(--rule)]">
            {evs.map((e) => (
              <li key={e.id} className="flex items-center justify-between gap-4 py-2 text-sm">
                <span>
                  <span className="label mr-2">{e.date || "—"}</span>
                  {eventLabel(e.kind, e.title)}
                  {e.place && <span className="text-[color:var(--ink-soft)]"> · {e.place}</span>}
                </span>
                <form action={deleteEvent}>
                  <input type="hidden" name="personId" value={person.id} />
                  <input type="hidden" name="id" value={e.id} />
                  <button className="text-[color:var(--earth-ink)] underline" type="submit">
                    remove
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <form action={addEvent} className="card grid gap-3 p-4 sm:grid-cols-2">
          <input type="hidden" name="personId" value={person.id} />
          <label className="flex flex-col gap-1">
            <span className="label">Type</span>
            <select name="kind" defaultValue="custom" className="field">
              {EVENT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {eventLabel(k)}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1">
            <span className="label">Date</span>
            <input name="date" className="field" placeholder="1998 or 1998-06-20" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="label">Title (optional)</span>
            <input name="title" className="field" placeholder="overrides the type label" />
          </label>
          <label className="flex flex-col gap-1">
            <span className="label">Place (optional)</span>
            <input name="place" className="field" />
          </label>
          <label className="flex flex-col gap-1 sm:col-span-2">
            <span className="label">Note (optional)</span>
            <textarea name="note" className="field min-h-[4rem]" />
          </label>
          <button type="submit" className="btn ghost self-start sm:col-span-2">Add event</button>
        </form>
      </section>

      {/* --- Gallery --------------------------------------------------- */}
      <section className="flex flex-col gap-3">
        <h2 className="label">Gallery</h2>
        {gallery.length > 0 && (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {gallery.map((m) => (
              <li key={m.id} className="flex flex-col gap-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={`/media/${m.id}`}
                  alt={m.caption || "Gallery photo"}
                  className="aspect-square w-full rounded object-cover"
                />
                {m.caption && <span className="text-xs text-[color:var(--ink-soft)]">{m.caption}</span>}
                <form action={removeGalleryPhoto}>
                  <input type="hidden" name="personId" value={person.id} />
                  <input type="hidden" name="mediaId" value={m.id} />
                  <button className="text-xs text-[color:var(--earth-ink)] underline" type="submit">
                    remove
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <form
          action={addGalleryPhoto}
          encType="multipart/form-data"
          className="card flex flex-col gap-3 p-4"
        >
          <input type="hidden" name="personId" value={person.id} />
          <input type="file" name="file" accept={ACCEPT} required className="text-sm" />
          <input name="caption" className="field" placeholder="Caption (optional)" />
          <button type="submit" className="btn ghost self-start">Add photo</button>
        </form>
      </section>
    </div>
  );

  function ImageSlot({
    personId,
    field,
    title,
    url,
    round,
  }: {
    personId: string;
    field: "photoUrl" | "coverUrl";
    title: string;
    url: string;
    round?: boolean;
  }) {
    return (
      <div className="flex flex-col gap-2">
        <span className="label">{title}</span>
        {url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={url}
            alt={title}
            className={
              round
                ? "h-24 w-24 rounded-full object-cover"
                : "h-24 w-full rounded object-cover"
            }
          />
        ) : (
          <div
            className={`${round ? "h-24 w-24 rounded-full" : "h-24 w-full rounded"} bg-[color:var(--surface-sunk)]`}
          />
        )}
        <form action={setPersonImage} encType="multipart/form-data" className="flex flex-col gap-2">
          <input type="hidden" name="personId" value={personId} />
          <input type="hidden" name="field" value={field} />
          <input type="file" name="file" accept={ACCEPT} required className="text-xs" />
          <div className="flex gap-2">
            <button type="submit" className="btn ghost text-xs">Upload</button>
          </div>
        </form>
        {url && (
          <form action={clearPersonImage}>
            <input type="hidden" name="personId" value={personId} />
            <input type="hidden" name="field" value={field} />
            <button type="submit" className="text-xs text-[color:var(--earth-ink)] underline">
              Remove
            </button>
          </form>
        )}
      </div>
    );
  }
}
