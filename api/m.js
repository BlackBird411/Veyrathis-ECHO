const SRC = "https://fdiounclxvaescxfkcnt.supabase.co/storage/v1/object/public/site-media/";
const IMAGE_TYPES = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };
const MAX_BYTES = 4 * 1024 * 1024; // Vercel functions can return roughly 4.5 MB at most

function redirect(res, src) {
  // short CDN cache so repeat visitors don't re-invoke the function
  res.setHeader("Cache-Control", "public, s-maxage=86400");
  return res.redirect(302, src);
}

module.exports = async function handler(req, res) {
  const file = String(req.query.file || "");
  if (!/^[0-9a-f-]{36}\.[a-z0-9]{3,4}$/i.test(file)) return res.status(400).end("bad file");
  const src = SRC + file;
  const type = IMAGE_TYPES[file.split(".").pop().toLowerCase()];

  // videos and anything else: let the browser fetch from Supabase (range requests, large files)
  if (!type) return redirect(res, src);

  const r = await fetch(src);
  if (!r.ok) return res.status(r.status).end("not found");

  // too big for a function response: fall back to Supabase rather than fail
  if (Number(r.headers.get("content-length") || 0) > MAX_BYTES) return redirect(res, src);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length > MAX_BYTES) return redirect(res, src);

  res.setHeader("Content-Type", type);
  res.setHeader("Cache-Control", "public, max-age=31536000, s-maxage=31536000, immutable");
  res.status(200).send(buf);
};
