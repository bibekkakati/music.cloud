import { jwtVerify } from "jose";

const CACHE = "public, max-age=86400, s-maxage=864000"; // Client cache for 1 day, edge cache for 10 days
const NOT_FOUND_TTL = 60;

const TYPES = {
	m3u8: ["playlist", "application/vnd.apple.mpegurl"],
	ts: ["segment", "video/mp2t"],
	m4s: ["segment", "audio/mp4"],
	aac: ["segment", "audio/aac"],
	mp3: ["segment", "audio/mpeg"],
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
		const reply = (body, status) => new Response(body, { status, headers: cors });

		if (request.method === "OPTIONS") return reply(null, 204);
		const isHead = request.method === "HEAD";
		if (request.method !== "GET" && !isHead) return reply("Method Not Allowed", 405);

		// ---- Parse path: /stream/<token>/<key> or /<key> ----
		const url = new URL(request.url);
		let key, pathToken = null;
		try {
			const m = url.pathname.match(/^\/stream\/([^/]+)\/(.+)$/);
			if (m) {
				pathToken = decodeURIComponent(m[1]);
				key = decodeURIComponent(m[2]);
			} else {
				key = decodeURIComponent(url.pathname.slice(1));
			}
		} catch {
			return reply("Bad Request", 400);
		}
		if (!key) return reply("OK", 200);

		key = key.replace(/^cover-art\//, "cover_art/");
		const info = classify(key);
		if (!info) return reply("Forbidden", 403);

		// ---- Auth (everything except images) ----
		if (info.kind !== "static") {
			const token = pathToken || getAuthToken(request, url);
			if (!token) return reply("Unauthorized: Missing Token", 401);
			try {
				await jwtVerify(token, new TextEncoder().encode(env.AUTH_SECRET), {
					algorithms: ["HS256"],
					clockTolerance: info.kind === "segment" ? 3600 : 0,
				});
			} catch {
				return reply("Unauthorized: Invalid or Expired Token", 401);
			}
		}

		// ---- Edge cache ----
		const cache = caches.default;
		const cacheKey = cacheRequest(url.origin, key, env);

		const hit = await cache.match(cacheKey).catch(() => null);
		if (hit) {
			const h = withCors(hit.headers, cors, "HIT");
			if (hit.status === 200 && notModified(request, h.get("ETag"))) {
				return new Response(null, { status: 304, headers: h });
			}
			return new Response(isHead ? null : hit.body, { status: hit.status, headers: h });
		}

		// ---- R2 read ----
		let object;
		try {
			object = await (isHead ? env.R2_BUCKET.head(key) : env.R2_BUCKET.get(key));
		} catch {
			return reply("Internal Server Error", 500);
		}

		if (!object) {
			ctx.waitUntil(cache.put(cacheKey, new Response(null, {
				status: 404,
				headers: { "Cache-Control": `public, max-age=${NOT_FOUND_TTL}` },
			})));
			return new Response("Object Not Found", { status: 404, headers: withCors(null, cors, "MISS") });
		}

		const meta = buildMeta(object, info);
		const out = withCors(meta, cors, "MISS");

		if (isHead) {
			out.set("Content-Length", String(object.size));
			return new Response(null, { status: 200, headers: out });
		}

		if (notModified(request, object.httpEtag)) {
			ctx.waitUntil(cache.put(cacheKey, new Response(object.body, { headers: meta })));
			return new Response(null, { status: 304, headers: out });
		}

		const [clientStream, cacheStream] = object.body.tee();
		ctx.waitUntil(cache.put(cacheKey, new Response(cacheStream, { headers: meta })));
		return new Response(clientStream, { status: 200, headers: out });
	},
};

/* ---------------- Helpers ---------------- */

// Salted with env.CACHE_VERSION for instant global cache purges
function cacheRequest(origin, key, env) {
	const version = env?.CACHE_VERSION || "v1";
	const path = key.split("/").map(encodeURIComponent).join("/");
	return new Request(`${origin}/__cache_${version}/${path}`, { method: "GET" });
}

// Stored in cache: R2 metadata + cache directives. No CORS.
function buildMeta(object, info) {
	const h = new Headers();
	object.writeHttpMetadata(h);
	const ct = h.get("Content-Type");
	if (!ct || ct === "application/octet-stream" || info.kind === "playlist") {
		h.set("Content-Type", info.contentType);
	}
	if (object.httpEtag) h.set("ETag", object.httpEtag);
	h.set("Cache-Control", CACHE);
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

function getAuthToken(request, url) {
	const auth = request.headers.get("Authorization");
	if (auth?.startsWith("Bearer ")) return auth.slice(7).trim();
	return url.searchParams.get("token");
}

let _originsRaw, _origins = [];
function allowedOrigins(env) {
	const raw = env.ALLOWED_ORIGINS || "";
	if (raw !== _originsRaw) {
		_originsRaw = raw;
		_origins = raw.split(",").map((s) => s.trim()).filter(Boolean);
	}
	return _origins;
}

function corsHeaders(request, env) {
	const origin = request.headers.get("Origin");
	const allowed = allowedOrigins(env);
	const h = new Headers({
		"Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
		"Access-Control-Allow-Headers": "Authorization, Content-Type, If-None-Match",
		"Access-Control-Expose-Headers": "Content-Length, ETag, X-Cache-Status",
		"Access-Control-Max-Age": "86400",
		"Vary": "Origin",
	});
	const isAllowed = origin && (
		allowed.includes(origin) ||
		allowed.includes("*") ||
		/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
	);
	h.set("Access-Control-Allow-Origin", isAllowed ? origin : "*");
	return h;
}