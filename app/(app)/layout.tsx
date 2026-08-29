import { requireMember } from "@/lib/auth";
import { Nav } from "@/components/Nav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, tree, role } = await requireMember();
  return (
    <div className="mx-auto max-w-4xl px-5 py-8">
      <Nav treeName={tree.name} email={user.email} role={role} />
      <main className="mt-8">{children}</main>
    </div>
  );
}
