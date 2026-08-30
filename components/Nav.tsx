import Link from "next/link";
import { canEdit } from "@/lib/access";
import { signOut } from "@/auth";

export function Nav({
  treeName,
  email,
  role,
}: {
  treeName: string;
  email: string;
  role: string;
}) {
  const links: [string, string][] = [
    ["/feed", "Feed"],
    ["/people", "People"],
    ["/relate", "Relate"],
    ["/tree", "Tree"],
    ["/stats", "Stats"],
    ["/settings", "You"],
  ];
  if (canEdit(role)) links.push(["/admin", "Admin"]);

  return (
    <header className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 border-b border-[color:var(--rule)] pb-4">
      <div className="flex items-baseline gap-4">
        <Link href="/feed" className="font-serif text-lg no-underline">
          {treeName}
        </Link>
        <nav className="flex gap-4 text-sm">
          {links.map(([href, label]) => (
            <Link key={href} href={href} className="no-underline">
              {label}
            </Link>
          ))}
        </nav>
      </div>
      <div className="label flex items-center gap-3">
        <span>{email}</span>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button type="submit" className="no-underline text-[color:var(--indigo)]">
            sign out
          </button>
        </form>
      </div>
    </header>
  );
}
