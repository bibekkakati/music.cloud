import { jwtVerify } from "jose";

const CACHE_CONTROL = {
	static: "public, max-age=604800, s-maxage=604800", // cover art: 7d
	playlist: "public, max-age=3600, s-maxage=86400", // master + media playlists
	segment: "public, max-age=86400, s-maxage=86400", // .ts/.m4s/.mp3/.aac: 24h
};
const NOT_FOUND_TTL = 60; // negative-cache 404s so repeat misses don't hit R2

const TYPES = {
	m3u8: ["playlist", "application/vnd.apple.mpegurl"],
	ts: ["segment", "video/mp2t"],
	m4s: ["segment", "audio/mp4"],
	aac: ["audio", "audio/aac"],
	mp3: ["audio", "audio/mpeg"],
	jpg: ["static", "image/jpeg"],
	jpeg: ["static", "image/jpeg"],
	png: ["static", "image/png"],
	webp: ["static", "image/webp"],
	gif: ["static", "image/gif"],
	svg: ["static", "image/svg+xml"],
	ico: ["static", "image/x-icon"],
};

/** Returns { kind, contentType } or null if the key is not allowed. */
function classify(key) {
	if (
		!key || key.includes("..") || key.includes("//") || key.includes("\\") ||
		key.startsWith(".") || key.startsWith("/") ||
		key === "originals" || key.startsWith("originals/")
	) return null;
	const ext = /\.([a-z0-9]+)$/i.exec(key)?.[1].toLowerCase();
	const t = TYPES[ext];
	return t ? { kind: t[0], contentType: t[1] } : null;
}

export default {
	async fetch(request, env, ctx) {
		const cors = corsHeaders(request, env);
		const plain = (body, status) => new Response(body, { status, headers: cors });

		if (request.method === "OPTIONS") return plain(null, 204);
		if (request.method !== "GET" && request.method !== "HEAD") return plain("Method Not Allowed", 405);

		const url = new URL(request.url);
		let key;
		try {
			key = decodeURIComponent(url.pathname.slice(1));
		} catch {
			return plain("Bad Request", 400);
		}
		if (!key) return plain("OK", 200);

		key = key.replace(/^cover-art\//, "cover_art/");
		const info = classify(key);
		if (!info) return plain("Forbidden", 403);

		// Auth: everything except cover art / images
		if (info.kind !== "static") {
			const token = getAuthToken(request, url);
			if (!token) return plain("Unauthorized: Missing Token", 401);
			try {
				await jwtVerify(token, new TextEncoder().encode(env.AUTH_SECRET), { algorithms: ["HS256"] });
			} catch {
				return plain("Unauthorized: Invalid or Expired Token", 401);
			}
		}

		// Only whole-file audio honors Range (HLS segments/playlists are served whole)
		const range = info.kind === "audio" ? request.headers.get("Range") : null;

		// ---- Edge cache lookup (no R2 operation) ----
		const cache = caches.default;
		const cacheKey = cacheRequest(url.origin, key);
		const matchReq = range ? new Request(cacheKey, { headers: { Range: range } }) : cacheKey;

		try {
			const hit = await cache.match(matchReq);
			if (hit) {
				const h = withCors(hit.headers, cors, "HIT");
				if (notModified(request, h.get("ETag"))) return new Response(null, { status: 304, headers: h });

				if (info.kind === "playlist" && hit.ok) {
					const text = await hit.text();
					ctx.waitUntil(preload(key, text, env, url.origin)); // re-warms evicted children
					return new Response(text, { status: 200, headers: h });
				}
				return new Response(hit.body, { status: hit.status, headers: h });
			}
		} catch {
			// fall through to R2
		}

		// ---- R2 read (Class B) ----
		let object;
		try {
			object = await env.R2_BUCKET.get(key, range ? { range: request.headers } : {});
		} catch {
			return plain("Internal Server Error", 500);
		}

		if (!object) {
			ctx.waitUntil(cache.put(cacheKey, new Response(null, {
				status: 404,
				headers: { "Cache-Control": `public, max-age=${NOT_FOUND_TTL}` },
			})));
			return new Response("Object Not Found", { status: 404, headers: withCors(null, cors, "MISS") });
		}

		const meta = buildMeta(object, info);

		// Range response (audio only): serve 206 now, warm the full file for next time
		if (object.range) {
			const { offset, length } = object.range;
			const h = withCors(meta, cors, "MISS-RANGE");
			h.set("Content-Range", `bytes ${offset}-${offset + length - 1}/${object.size}`);
			ctx.waitUntil(warm(key, env, url.origin));
			return new Response(object.body, { status: 206, headers: h });
		}

		const notMod = notModified(request, object.httpEtag);
		const outHeaders = withCors(meta, cors, "MISS");

		if (info.kind === "playlist") {
			const text = await object.text();
			ctx.waitUntil(Promise.all([
				cache.put(cacheKey, new Response(text, { headers: meta })),
				preload(key, text, env, url.origin),
			]));
			return new Response(notMod ? null : text, { status: notMod ? 304 : 200, headers: outHeaders });
		}

		if (notMod) {
			ctx.waitUntil(cache.put(cacheKey, new Response(object.body, { headers: meta })));
			return new Response(null, { status: 304, headers: outHeaders });
		}

		const [clientStream, cacheStream] = object.body.tee();
		ctx.waitUntil(cache.put(cacheKey, new Response(cacheStream, { headers: meta })));
		return new Response(clientStream, { status: 200, headers: outHeaders });
	},
};

/* ---------------- Preloading (R2 reads only, never writes) ---------------- */

/** Master -> all variants + first segment of each. Media -> first segment. */
async function preload(key, text, env, origin) {
	try {
		const master = text.includes("#EXT-X-STREAM-INF");
		const variants = master
			? uriAfter(text, "#EXT-X-STREAM-INF").map((r) => resolveKey(key, r)).filter(Boolean)
			: [key];

		await Promise.allSettled(
			variants.map(async (vKey) => {
				const vText = master ? await warm(vKey, env, origin) : text;
				if (!vText) return;
				const [seg] = uriAfter(vText, "#EXTINF:", true);
				const segKey = seg && resolveKey(vKey, seg);
				if (segKey) await warm(segKey, env, origin);
			})
		);
	} catch {
		// best-effort
	}
}

/** Ensures key is in edge cache. Returns playlist text (for playlists), else null. */
async function warm(key, env, origin) {
	try {
		const info = classify(key);
		if (!info || info.kind === "static") return null;

		const cache = caches.default;
		const cacheKey = cacheRequest(origin, key);

		const hit = await cache.match(cacheKey);
		if (hit) return info.kind === "playlist" && hit.ok ? hit.text() : null;

		const object = await env.R2_BUCKET.get(key);
		if (!object) return null;

		const meta = buildMeta(object, info);
		if (info.kind === "playlist") {
			const text = await object.text();
			await cache.put(cacheKey, new Response(text, { headers: meta }));
			return text;
		}
		await cache.put(cacheKey, new Response(object.body, { headers: meta }));
		return null;
	} catch {
		return null;
	}
}

/* ---------------- Helpers ---------------- */

// One cache key format everywhere (used by handler + preloader)
function cacheRequest(origin, key) {
	const path = key.split("/").map(encodeURIComponent).join("/");
	return new Request(`${origin}/${path}`, { method: "GET" });
}

// Headers stored in cache: R2 metadata + our cache directives. No CORS.
function buildMeta(object, info) {
	const h = new Headers();
	object.writeHttpMetadata(h);
	const ct = h.get("Content-Type");
	if (!ct || ct === "application/octet-stream") h.set("Content-Type", info.contentType);
	if (info.kind === "playlist") h.set("Content-Type", info.contentType);
	if (object.httpEtag) h.set("ETag", object.httpEtag);
	if (info.kind === "audio") h.set("Accept-Ranges", "bytes");
	h.set("Cache-Control", CACHE_CONTROL[info.kind === "audio" ? "segment" : info.kind]);
	return h;
}

function withCors(base, cors, status) {
	const h = new Headers(base || undefined);
	cors.forEach((v, k) => h.set(k, v));
	h.set("X-Cache-Status", status);
	return h;
}

function notModified(request, etag) {
	const inm = request.headers.get("If-None-Match");
	if (!inm || !etag) return false;
	return inm.split(",").some((t) => t.trim() === etag || t.trim() === "*");
}

// Lines following each occurrence of `tag` that are URIs (not comments)
function uriAfter(text, tag, firstOnly = false) {
	const lines = text.split(/\r?\n/).map((l) => l.trim());
	const out = [];
	for (let i = 0; i < lines.length - 1; i++) {
		if (lines[i].startsWith(tag) && lines[i + 1] && !lines[i + 1].startsWith("#")) {
			out.push(lines[i + 1]);
			if (firstOnly) break;
		}
	}
	return out;
}

function resolveKey(baseKey, rel) {
	if (/^[a-z][a-z0-9+.-]*:/i.test(rel)) return null; // skip absolute URLs
	try {
		return decodeURIComponent(new URL(rel, `https://x/${baseKey}`).pathname.slice(1));
	} catch {
		return null;
	}
}

function getAuthToken(request, url) {
	const auth = request.headers.get("Authorization");
	if (auth?.startsWith("Bearer ")) return auth.slice(7).trim();

	const q = url.searchParams.get("token");
	if (q) return q;

	return (
		request.headers.get("Cookie")
			?.split(";")
			.map((p) => p.trim().split("="))
			.find(([k]) => k === "Stream-Auth-Token")?.[1] ?? null
	);
}

// env.ALLOWED_ORIGINS = "https://app.example.com,https://www.example.com"
function corsHeaders(request, env) {
	const origin = request.headers.get("Origin");
	const allowed = (env.ALLOWED_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
	const h = new Headers({
		"Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
		"Access-Control-Allow-Headers": "Authorization, Content-Type, Range, If-None-Match",
		"Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges, ETag, X-Cache-Status",
		"Access-Control-Max-Age": "86400",
		"Vary": "Origin",
	});
	if (origin && allowed.includes(origin)) {
		h.set("Access-Control-Allow-Origin", origin);
		h.set("Access-Control-Allow-Credentials", "true");
	} else {
		h.set("Access-Control-Allow-Origin", "*"); // no credentials for unknown origins
	}
	return h;
}