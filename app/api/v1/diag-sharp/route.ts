// TEMP DIAGNOSTIC (remove after) — verifies sharp + its native libvips codecs
// (libpng/libjpeg) load AND run inside the Vercel serverless function, exercising
// the exact operations the image-attach path uses: decode → rotate → resize →
// webp encode. It generates its own valid PNG/JPEG with libvips (no external input
// that could decode-fail), so a clean ok:true means the upload pipeline works.
// Needs no auth and no uploaded object. Delete this route once confirmed.
export const dynamic = 'force-dynamic'

export async function GET() {
  try {
    const sharp = (await import('sharp')).default
    const base = {
      create: { width: 64, height: 48, channels: 3, background: { r: 200, g: 120, b: 60 } },
    } as const

    // libvips ENCODES valid inputs (tests libpng/libjpeg write paths).
    const png = await sharp(base).png().toBuffer()
    const jpeg = await sharp(base).jpeg().toBuffer()

    const results: Record<string, unknown> = {}
    for (const [fmt, buf] of [
      ['png', png],
      ['jpeg', jpeg],
    ] as const) {
      // Decode (libpng/libjpeg read) + the attach ops (rotate/resize/webp encode).
      const meta = await sharp(buf).metadata()
      const webp = await sharp(buf)
        .rotate()
        .resize({ width: 32, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer()
      results[fmt] = {
        inputBytes: buf.length,
        decodedFormat: meta.format ?? null,
        decodedW: meta.width ?? null,
        decodedH: meta.height ?? null,
        webpBytes: webp.length,
      }
    }
    return Response.json({ ok: true, results })
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
