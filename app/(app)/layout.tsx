import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { requireMember } from "@/lib/access";
import { getClaimedPerson } from "@/lib/profile";
import { ONBOARDED_COOKIE } from "@/lib/onboarding";
import { Nav } from "@/components/Nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, tree, role } = await requireMember();

  // Everyone links their account to a person in the tree before they get
  // in — or explicitly skips at /welcome (which sets the cookie).
  const claimed = await getClaimedPerson(tree.id, user.id);
  if (!claimed) {
    const skipped = (await cookies()).get(ONBOARDED_COOKIE)?.value === "1";
    if (!skipped) redirect("/welcome");
  }

  return (
    <div className="mx-auto max-w-4xl px-5 py-8">
      <Nav treeName={tree.name} email={user.email} role={role} />
      <main className="mt-8">{children}</main>
    </div>
  );
}
