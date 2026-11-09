module.exports = async function handler(req, res) {
  const file = String(req.query.file || "");
  if (!/^[0-9a-f-]{36}\.[a-z0-9]{3,4}$/i.test(file)) return res.status(400).end("bad file");
  const src = "https://fdiounclxvaescxfkcnt.supabase.co/storage/v1/object/public/site-media/" + file;
  if (!/\.jpe?g$/i.test(file)) return res.redirect(302, src);
  const r = await fetch(src);
  if (!r.ok) return res.status(r.status).end("not found");
  res.setHeader("Content-Type", "image/jpeg");
  res.setHeader("Cache-Control", "public, max-age=31536000, s-maxage=31536000, immutable");
  res.status(200).send(Buffer.from(await r.arrayBuffer()));
};
