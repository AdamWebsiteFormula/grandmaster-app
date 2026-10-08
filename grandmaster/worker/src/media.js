// The home page video, answered in byte ranges. Safari and iOS play an MP4
// only from a server that answers Range requests with 206 Partial Content
// (Apple, Safari HTML5 Audio and Video Guide, "Configuring Your Server";
// RFC 9110 section 14). Workers static assets answer a Range request with the
// whole file and 200, so /media/* runs through the Worker first
// (wrangler.jsonc assets.run_worker_first) and is sliced here.

export async function handleMedia(request, env) {
  const asset = await env.ASSETS.fetch(new Request(request.url, { method: "GET" }));
  if (!asset.ok) return asset;
  const headers = new Headers(asset.headers);
  headers.set("Accept-Ranges", "bytes");
  const range = request.headers.get("Range");
  if (!range) {
    return new Response(request.method === "HEAD" ? null : asset.body, { status: 200, headers });
  }
  const buf = await asset.arrayBuffer();
  const size = buf.byteLength;
  const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim());
  let start = -1, end = -1;
  if (m && m[1] !== "") {
    start = Number(m[1]);
    end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1);
  } else if (m && m[2] !== "") {
    start = Math.max(0, size - Number(m[2]));
    end = size - 1;
  }
  if (start < 0 || start > end || start >= size) {
    headers.set("Content-Range", `bytes */${size}`);
    headers.delete("Content-Length");
    return new Response(null, { status: 416, headers });
  }
  headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
  headers.set("Content-Length", String(end - start + 1));
  return new Response(request.method === "HEAD" ? null : buf.slice(start, end + 1), { status: 206, headers });
}
