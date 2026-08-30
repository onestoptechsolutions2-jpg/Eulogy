import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { requireMember } from "@/lib/access";
import { getPerson } from "@/lib/queries";
import { canEditPerson } from "@/lib/profile";
import { fullName } from "@/lib/names";
import { updatePerson } from "./actions";

export default async function EditPersonPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { tree, user, role } = await requireMember();
  const person = await getPerson(tree.id, id);
  if (!person) notFound();
  if (!canEditPerson(role, person, user.id)) redirect(`/person/${id}`);

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
    <div className="flex max-w-measure flex-col gap-6">
      <div>
        <p className="label">Editing</p>
        <h1 className="text-2xl">{fullName(person)}</h1>
      </div>

      <form action={updatePerson} className="flex flex-col gap-4">
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

        <Field name="photoUrl" label="Photo URL" value={person.photoUrl} placeholder="https://…" />

        <label className="flex flex-col gap-1">
          <span className="label">About</span>
          <textarea name="bio" defaultValue={person.bio} className="field min-h-[10rem]" />
        </label>

        <div className="flex gap-3">
          <button type="submit" className="btn">Save</button>
          <Link href={`/person/${person.id}`} className="btn ghost">Cancel</Link>
        </div>
      </form>
    </div>
  );
}
