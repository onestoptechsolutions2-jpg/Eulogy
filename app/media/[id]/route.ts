import { getImage } from "@/lib/media";

// Serves an image stored in the media table. Ids are 21-char random, so
// the URL is unguessable; treated like the pasted photo URLs the app has
// always rendered (no auth wall — the public eulogy page needs these too).
export async function GET(_req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const m = await getImage(id);
  if (!m) return new Response("Not found", { status: 404 });

  const body = Buffer.from(m.data, "base64");
  return new Response(body, {
    headers: {
      "Content-Type": m.mimeType,
      "Content-Length": String(body.byteLength),
      "Cache-Control": "public, max-age=31536000, immutable",
    },
  });
}
