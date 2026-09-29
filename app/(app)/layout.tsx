import { redirect } from "next/navigation";
import { requireMember } from "@/lib/access";
import { Nav } from "@/components/Nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, tree, role } = await requireMember();

  // Every account is already a person in its own family; new accounts confirm
  // who they are at /welcome before getting in.
  if (!user.onboardedAt) redirect("/welcome");

  return (
    <div className="mx-auto max-w-4xl px-5 py-8">
      <Nav treeName={tree.name} email={user.email} role={role} />
      <main className="mt-8">{children}</main>
    </div>
  );
}
