import { NextResponse, type NextRequest } from "next/server";
import { consumeLoginToken } from "@/lib/auth";
import { getSession } from "@/lib/session";

export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token") ?? "";
  const userId = await consumeLoginToken(token);
  if (!userId) {
    return NextResponse.redirect(new URL("/login?error=expired", req.url));
  }
  const session = await getSession();
  session.userId = userId;
  await session.save();
  return NextResponse.redirect(new URL("/", req.url));
}
