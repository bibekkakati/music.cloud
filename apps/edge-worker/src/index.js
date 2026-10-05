import { jwtVerify } from "jose";

// Segment Sliding Cache Constants (12h initial, extend by 6h if remaining TTL < 6h)
const SEGMENT_DEFAULT_TTL_SECONDS = 12 * 3600; // 12 hours (43,200s)
const SEGMENT_EXTEND_THRESHOLD_SECONDS = 6 * 3600; // 6 hours (21,600s)
const SEGMENT_EXTENSION_SECONDS = 6 * 3600; // 6 hours (21,600s)

// Cover Art Sliding Cache Constants (24h initial, extend by 12h if remaining TTL < 12h)
const COVER_ART_DEFAULT_TTL_SECONDS = 24 * 3600; // 24 hours (86,400s)
const COVER_ART_EXTEND_THRESHOLD_SECONDS = 12 * 3600; // 12 hours (43,200s)
const COVER_ART_EXTENSION_SECONDS = 12 * 3600; // 12 hours (43,200s)

// 1. In-memory cache for playlists (.m3u8 files are ~1-2KB, perfectly suited for RAM)
// Cloudflare Worker isolates keep globals warm across subsequent requests.
const memoryPlaylistCache = new Map();
const MAX_MEMORY_ENTRIES = 500;

function getFromMemoryCache(key) {
	const item = memoryPlaylistCache.get(key);
	if (!item) return null;
	if (Date.now() > item.expiresAt) {
		memoryPlaylistCache.delete(key);
		return null;
	}
	return item;
}

function setToMemoryCache(key, text, contentType = "application/vnd.apple.mpegurl", ttlMs = 3600 * 1000) {
	if (memoryPlaylistCache.size >= MAX_MEMORY_ENTRIES) {
		const oldestKey = memoryPlaylistCache.keys().next().value;
		memoryPlaylistCache.delete(oldestKey);
	}
	memoryPlaylistCache.set(key, {
		text,
		contentType,
		expiresAt: Date.now() + ttlMs,
	});
}

function getImageContentType(key) {
	const lower = key.toLowerCase();
	if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
	if (lower.endsWith(".png")) return "image/png";
	if (lower.endsWith(".webp")) return "image/webp";
	if (lower.endsWith(".svg")) return "image/svg+xml";
	if (lower.endsWith(".gif")) return "image/gif";
	if (lower.endsWith(".ico")) return "image/x-icon";
	return "application/octet-stream";
}

export default {
	async fetch(request, env, ctx) {
		const url = new URL(request.url);
		let objectKey = decodeURIComponent(url.pathname.slice(1));
		const headers = getCorsHeaders(request);

		if (request.method === "OPTIONS") {
			return new Response(null, {
				status: 204,
				headers,
			});
		}

		if (!objectKey) {
			return new Response("OK", {
				status: 200,
				headers,
			});
		}

		// 1. Security Check: Block directory traversal, hidden files, or malformed paths
		if (
			objectKey.includes("..") ||
			objectKey.startsWith(".") ||
			objectKey.startsWith("/") ||
			objectKey.includes("//")
		) {
			return new Response("Forbidden: Invalid Object Path", {
				status: 403,
				headers,
			});
		}

		// 2. Security Check: Strictly block direct access to original uncompressed source audio files
		if (objectKey.startsWith("originals/") || objectKey === "originals") {
			return new Response("Forbidden: Direct access to source audio masters is restricted", {
				status: 403,
				headers,
			});
		}

		// Normalize cover-art alias to cover_art folder in R2
		if (objectKey.startsWith("cover-art/")) {
			objectKey = objectKey.replace(/^cover-art\//, "cover_art/");
		}

		// Determine resource classification
		const isStaticAsset =
			objectKey.startsWith("cover_art/") ||
			objectKey.startsWith("assets/") ||
			objectKey.startsWith("images/") ||
			/\.(jpe?g|png|webp|gif|svg|ico)$/i.test(objectKey);

		const isPlaylist = objectKey.endsWith(".m3u8");
		const isSegment = /\.(ts|m4s|aac|mp3)$/i.test(objectKey);

		// 3. Security Check: Restrict access to only whitelisted resource types in R2 bucket
		if (!isStaticAsset && !isPlaylist && !isSegment) {
			return new Response("Forbidden: Resource type not permitted", {
				status: 403,
				headers,
			});
		}

		// 1. Authentication Check: Only required for protected media (audio streams and segments)
		// Static assets (like cover art) are public and do not require streaming JWT tokens
		if (!isStaticAsset) {
			const token = getAuthToken(request, url);
			if (!token) {
				return new Response("Unauthorized: Missing Token", {
					status: 401,
					headers,
				});
			}

			try {
				await verifyToken(token, env.AUTH_SECRET);
			} catch {
				return new Response("Unauthorized: Invalid or Expired Token", {
					status: 403,
					headers,
				});
			}
		}

		// 2. Playlists: Fast-path from in-memory cache (< 1ms)
		if (isPlaylist) {
			const memHit = getFromMemoryCache(objectKey);
			if (memHit) {
				headers.set("Content-Type", memHit.contentType);
				headers.set("Cache-Control", "public, max-age=3600, s-maxage=86400");
				headers.set("X-Cache-Status", "HIT-MEMORY");
				return new Response(memHit.text, {
					status: 200,
					headers,
				});
			}
		}

		// 3. Check Cloudflare Edge Cache (caches.default) for GET requests without Range
		const rangeHeader = request.headers.get("Range");
		const cache = caches.default;
		const canonicalCacheUrl = new URL(url.pathname, url.origin).toString();
		const cacheKey = new Request(canonicalCacheUrl, { method: "GET" });

		if (!rangeHeader) {
			try {
				const cachedResponse = await cache.match(cacheKey);
				if (cachedResponse) {
					// Check conditional If-None-Match for 304 Not Modified
					const clientEtag = request.headers.get("If-None-Match");
					const cachedEtag = cachedResponse.headers.get("ETag");
					if (clientEtag && cachedEtag && clientEtag === cachedEtag) {
						return new Response(null, {
							status: 304,
							headers,
						});
					}

					const cachedHeaders = new Headers(cachedResponse.headers);
					// Re-apply caller's CORS headers
					headers.forEach((value, key) => cachedHeaders.set(key, value));
					cachedHeaders.set("X-Cache-Status", "HIT-EDGE");

					// If playlist was in edge cache, promote to in-memory cache and preload first segment
					if (isPlaylist) {
						const playlistText = await cachedResponse.text();
						setToMemoryCache(objectKey, playlistText);
						if (ctx?.waitUntil) {
							ctx.waitUntil(preloadPlaylistTargets(objectKey, playlistText, url.origin, env));
						}
						return new Response(playlistText, {
							status: 200,
							headers: cachedHeaders,
						});
					}

					// Sliding TTL for audio segments:
					// Default is 12h. If requested by user and remaining TTL < 6h, extend TTL by 6h.
					if (isSegment && ctx?.waitUntil) {
						ctx.waitUntil(maybeExtendSegmentCache(cacheKey, cachedResponse, cache));
					}

					// Sliding TTL for cover art / static images:
					// Default is 24h. If requested by user and remaining TTL < 12h, extend TTL by 12h.
					if (isStaticAsset && ctx?.waitUntil) {
						ctx.waitUntil(maybeExtendCoverArtCache(cacheKey, cachedResponse, cache));
					}

					return new Response(cachedResponse.body, {
						status: cachedResponse.status,
						headers: cachedHeaders,
					});
				}
			} catch (e) {
				// Continue to fetch from R2 on cache match failure
			}
		}

		// 4. Fetch from R2 Storage
		let object;
		try {
			const getOptions = {};
			if (rangeHeader && !isPlaylist) {
				getOptions.range = request.headers;
			}
			object = await env.R2_BUCKET.get(objectKey, getOptions);
		} catch (error) {
			return new Response("Internal Server Error", {
				status: 500,
				headers,
			});
		}

		if (!object) {
			return new Response("Object Not Found", {
				status: 404,
				headers,
			});
		}

		object.writeHttpMetadata(headers);
		if (object.httpEtag) {
			headers.set("ETag", object.httpEtag);
		}
		headers.set("Accept-Ranges", "bytes");

		// Handle client 304 Not Modified condition
		const ifNoneMatch = request.headers.get("If-None-Match");
		if (ifNoneMatch && object.httpEtag && ifNoneMatch === object.httpEtag) {
			return new Response(null, {
				status: 304,
				headers,
			});
		}

		// Set caching and Content-Type directives based on media type
		if (isStaticAsset) {
			// Cover Art & Images: 24-hour sliding TTL (extends by +12h on access when remaining < 12h)
			const detectedType = getImageContentType(objectKey);
			if (!headers.has("Content-Type") || headers.get("Content-Type") === "application/octet-stream") {
				headers.set("Content-Type", detectedType);
			}
			const expiresAt = Date.now() + COVER_ART_DEFAULT_TTL_SECONDS * 1000;
			headers.set(
				"Cache-Control",
				`public, max-age=${COVER_ART_DEFAULT_TTL_SECONDS}, s-maxage=${COVER_ART_DEFAULT_TTL_SECONDS}`
			);
			headers.set("X-Cache-Expires-At", String(expiresAt));
		} else if (isPlaylist) {
			headers.set("Content-Type", "application/vnd.apple.mpegurl");
			headers.set("Cache-Control", "public, max-age=3600, s-maxage=86400");
		} else if (isSegment) {
			const expiresAt = Date.now() + SEGMENT_DEFAULT_TTL_SECONDS * 1000;
			headers.set(
				"Cache-Control",
				`public, max-age=${SEGMENT_DEFAULT_TTL_SECONDS}, s-maxage=${SEGMENT_DEFAULT_TTL_SECONDS}`
			);
			headers.set("X-Cache-Expires-At", String(expiresAt));
		}

		// 5. If playlist, read text, populate memory cache, and trigger background preloading
		if (isPlaylist) {
			const playlistText = await object.text();
			setToMemoryCache(objectKey, playlistText);

			// Preload the next segment/variant in background into Edge Cache
			if (ctx?.waitUntil) {
				ctx.waitUntil(preloadPlaylistTargets(objectKey, playlistText, url.origin, env));
			}

			// Save full playlist response into Cloudflare Edge Cache
			if (ctx?.waitUntil) {
				const cacheHeaders = new Headers(headers);
				cacheHeaders.set("Access-Control-Allow-Origin", "*");
				const edgeResponse = new Response(playlistText, {
					status: 200,
					headers: cacheHeaders,
				});
				ctx.waitUntil(cache.put(cacheKey, edgeResponse));
			}

			headers.set("X-Cache-Status", "MISS");
			return new Response(playlistText, {
				status: 200,
				headers,
			});
		}

		// Handle range requests for non-playlist files
		if (object.range) {
			const { offset, length } = object.range;
			headers.set(
				"Content-Range",
				`bytes ${offset}-${offset + length - 1}/${object.size}`
			);
			headers.set("X-Cache-Status", "MISS-RANGE");
			return new Response(object.body, {
				status: 206,
				headers,
			});
		}

		// 6. Static asset or audio segment: cache into Edge Cache in background
		if ((isStaticAsset || isSegment) && ctx?.waitUntil && !rangeHeader) {
			const [clientStream, cacheStream] = object.body.tee();
			const cacheHeaders = new Headers(headers);
			cacheHeaders.set("Access-Control-Allow-Origin", "*");
			const edgeResponse = new Response(cacheStream, {
				status: 200,
				headers: cacheHeaders,
			});
			ctx.waitUntil(cache.put(cacheKey, edgeResponse));

			headers.set("X-Cache-Status", "MISS");
			return new Response(clientStream, {
				status: 200,
				headers,
			});
		}

		headers.set("X-Cache-Status", "MISS");
		return new Response(object.body, {
			status: 200,
			headers,
		});
	},
};

/**
 * Background preloader:
 * - If master playlist: pre-fetches the first variant playlist and its first audio segment into edge cache
 * - If media playlist: pre-fetches the first segment (seg_000.ts) into edge cache
 * This ensures that by the time the browser requests them, they are already warm in Edge Cache!
 */
/**
 * Sliding TTL Helper for Audio Segments:
 * - Default TTL is 12 hours.
 * - When a user requests an existing segment from cache and remaining TTL < 6 hours,
 *   we extend the TTL by 6 hours.
 */
async function maybeExtendSegmentCache(cacheKey, cachedResponse, cache) {
	try {
		const expiresHeader = cachedResponse.headers.get("X-Cache-Expires-At");
		const now = Date.now();
		let remainingMs = 0;

		if (expiresHeader) {
			const expiresAt = parseInt(expiresHeader, 10);
			remainingMs = expiresAt - now;
		}

		// If remaining TTL is less than 6 hours (or expired header), extend by 6 hours
		if (remainingMs < SEGMENT_EXTEND_THRESHOLD_SECONDS * 1000) {
			const newTtlSeconds = Math.max(
				SEGMENT_EXTENSION_SECONDS,
				Math.floor(remainingMs / 1000) + SEGMENT_EXTENSION_SECONDS
			);
			const newExpiresAt = now + newTtlSeconds * 1000;

			const newHeaders = new Headers(cachedResponse.headers);
			newHeaders.set("Cache-Control", `public, max-age=${newTtlSeconds}, s-maxage=${newTtlSeconds}`);
			newHeaders.set("X-Cache-Expires-At", String(newExpiresAt));

			// Re-save in Cloudflare Edge Cache with updated TTL
			await cache.put(
				cacheKey,
				new Response(cachedResponse.body, {
					status: cachedResponse.status,
					headers: newHeaders,
				})
			);
		}
	} catch (e) {
		// Silent best-effort
	}
}

/**
 * Sliding TTL Helper for Cover Art & Images:
 * - Default TTL is 24 hours.
 * - When a user requests an existing cover art from cache and remaining TTL < 12 hours,
 *   we extend the TTL by 12 hours.
 */
async function maybeExtendCoverArtCache(cacheKey, cachedResponse, cache) {
	try {
		const expiresHeader = cachedResponse.headers.get("X-Cache-Expires-At");
		const now = Date.now();
		let remainingMs = 0;

		if (expiresHeader) {
			const expiresAt = parseInt(expiresHeader, 10);
			remainingMs = expiresAt - now;
		}

		// If remaining TTL is less than 12 hours (or expired header), extend by 12 hours
		if (remainingMs < COVER_ART_EXTEND_THRESHOLD_SECONDS * 1000) {
			const newTtlSeconds = Math.max(
				COVER_ART_EXTENSION_SECONDS,
				Math.floor(remainingMs / 1000) + COVER_ART_EXTENSION_SECONDS
			);
			const newExpiresAt = now + newTtlSeconds * 1000;

			const newHeaders = new Headers(cachedResponse.headers);
			newHeaders.set("Cache-Control", `public, max-age=${newTtlSeconds}, s-maxage=${newTtlSeconds}`);
			newHeaders.set("X-Cache-Expires-At", String(newExpiresAt));

			// Re-save in Cloudflare Edge Cache with updated TTL
			await cache.put(
				cacheKey,
				new Response(cachedResponse.body, {
					status: cachedResponse.status,
					headers: newHeaders,
				})
			);
		}
	} catch (e) {
		// Silent best-effort
	}
}

/**
 * Background preloader:
 * - If master playlist: pre-fetches ALL variant playlists (e.g. 256k & 320k) and segment 0 for each variant
 * - If media playlist: pre-fetches the first segment (seg_000.ts) into edge cache
 * Ensures instant near-zero latency playback whether user requests 256k or 320k!
 */
async function preloadPlaylistTargets(objectKey, playlistText, origin, env) {
	try {
		const cache = caches.default;
		const basePath = objectKey.substring(0, objectKey.lastIndexOf("/") + 1);

		// Case A: Multivariant / Master playlist -> Preload ALL variants & their segment 0
		if (playlistText.includes("#EXT-X-STREAM-INF")) {
			const lines = playlistText.split("\n");
			const variantPaths = [];

			for (let i = 0; i < lines.length; i++) {
				const line = lines[i].trim();
				if (line.startsWith("#EXT-X-STREAM-INF") && i + 1 < lines.length) {
					const relPath = lines[i + 1].trim();
					if (relPath && !relPath.startsWith("#")) {
						variantPaths.push(relPath);
					}
				}
			}

			if (variantPaths.length > 0) {
				await Promise.allSettled(
					variantPaths.map(async (variantRel) => {
						const variantKey = basePath + variantRel;
						const variantCacheKey = new Request(`${origin}/${encodeURIComponent(variantKey)}`, { method: "GET" });

						let variantObj = await cache.match(variantCacheKey);
						let variantText = "";
						if (variantObj) {
							variantText = await variantObj.text();
						} else {
							const r2Obj = await env.R2_BUCKET.get(variantKey);
							if (r2Obj) {
								variantText = await r2Obj.text();
								setToMemoryCache(variantKey, variantText);

								const vHeaders = new Headers();
								r2Obj.writeHttpMetadata(vHeaders);
								vHeaders.set("Content-Type", "application/vnd.apple.mpegurl");
								vHeaders.set("Cache-Control", "public, max-age=3600, s-maxage=86400");
								vHeaders.set("Access-Control-Allow-Origin", "*");
								await cache.put(variantCacheKey, new Response(variantText, { status: 200, headers: vHeaders }));
							}
						}

						if (variantText) {
							await preloadFirstSegmentFromMediaPlaylist(variantKey, variantText, origin, env);
						}
					})
				);
			}
			return;
		}

		// Case B: Media playlist
		await preloadFirstSegmentFromMediaPlaylist(objectKey, playlistText, origin, env);
	} catch (err) {
		// Preload is best-effort background optimization
	}
}

async function preloadFirstSegmentFromMediaPlaylist(playlistKey, playlistText, origin, env) {
	try {
		const cache = caches.default;
		const basePath = playlistKey.substring(0, playlistKey.lastIndexOf("/") + 1);

		const lines = playlistText.split("\n");
		let firstSegmentRel = null;
		for (let i = 0; i < lines.length; i++) {
			const line = lines[i].trim();
			if (line.startsWith("#EXTINF:") && i + 1 < lines.length) {
				firstSegmentRel = lines[i + 1].trim();
				break;
			}
		}

		if (!firstSegmentRel || firstSegmentRel.startsWith("#")) return;

		const segmentKey = basePath + firstSegmentRel;
		const segCacheKey = new Request(`${origin}/${encodeURIComponent(segmentKey)}`, { method: "GET" });

		// Check if already in cache
		const existing = await cache.match(segCacheKey);
		if (existing) return;

		// Pull segment into Edge Cache with 12h initial TTL
		const segObject = await env.R2_BUCKET.get(segmentKey);
		if (!segObject) return;

		const expiresAt = Date.now() + SEGMENT_DEFAULT_TTL_SECONDS * 1000;
		const segHeaders = new Headers();
		segObject.writeHttpMetadata(segHeaders);
		if (segObject.httpEtag) segHeaders.set("ETag", segObject.httpEtag);
		segHeaders.set("Accept-Ranges", "bytes");
		segHeaders.set(
			"Cache-Control",
			`public, max-age=${SEGMENT_DEFAULT_TTL_SECONDS}, s-maxage=${SEGMENT_DEFAULT_TTL_SECONDS}`
		);
		segHeaders.set("X-Cache-Expires-At", String(expiresAt));
		segHeaders.set("Access-Control-Allow-Origin", "*");

		await cache.put(
			segCacheKey,
			new Response(segObject.body, {
				status: 200,
				headers: segHeaders,
			})
		);
	} catch (e) {
		// Silent best-effort
	}
}

function getAuthToken(request, url) {
	const authorization = request.headers.get("Authorization");
	if (authorization?.startsWith("Bearer ")) {
		return authorization.slice(7).trim();
	}

	const queryToken = url.searchParams.get("token");
	if (queryToken) {
		return queryToken;
	}

	const cookie = request.headers.get("Cookie");
	return (
		cookie
			?.split(";")
			.map((part) => part.trim().split("="))
			.find(([key]) => key === "Stream-Auth-Token")?.[1] ?? null
	);
}

function verifyToken(token, secret) {
	const key = new TextEncoder().encode(secret);
	return jwtVerify(token, key, {
		algorithms: ["HS256"],
	});
}

function getCorsHeaders(request) {
	const origin = request.headers.get("Origin");
	const headers = new Headers({
		"Access-Control-Allow-Origin": origin || "*",
		"Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
		"Access-Control-Allow-Headers": "Content-Type, Authorization, Cookie, Range, If-None-Match",
		"Access-Control-Expose-Headers": "Content-Length, Content-Range, Accept-Ranges, ETag, X-Cache-Status, X-Cache-Expires-At",
		"Access-Control-Max-Age": "86400",
	});

	if (origin) {
		headers.set("Access-Control-Allow-Credentials", "true");
	}

	return headers;
}