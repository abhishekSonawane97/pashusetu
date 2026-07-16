// TEMP DIAGNOSTIC (remove after) — verifies that sharp + its libvips native
// binary actually load and run inside the Vercel serverless function. Exercises
// the exact operation the image-attach path fails on (dynamic import → metadata
// → webp encode) but with a tiny in-memory PNG, so it needs no auth and no
// uploaded object. Delete this route once the upload fix is confirmed.
export const dynamic = 'force-dynamic'

const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC',
  'base64',
)

export async function GET() {
  try {
    const sharp = (await import('sharp')).default
    const meta = await sharp(PNG_1x1).metadata()
    const webp = await sharp(PNG_1x1).webp({ quality: 80 }).toBuffer()
    return Response.json({
      ok: true,
      width: meta.width ?? null,
      height: meta.height ?? null,
      webpBytes: webp.length,
    })
  } catch (e) {
    const err = e as { name?: string; message?: string; code?: string; stack?: string }
    return Response.json(
      {
        ok: false,
        name: err?.name ?? null,
        message: String(err?.message ?? e).slice(0, 400),
        code: err?.code ?? null,
        stack: String(err?.stack ?? '').split('\n').slice(0, 6),
      },
      { status: 599 },
    )
  }
}
