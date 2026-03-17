const ASSET_CACHE_NAME = "friends-arcade-assets-v1";

const PRECACHE_URLS = [
  "/models/game_boy_classic_interactive.glb",
  "/audio/music/arcade-menu.mp3",
  "/audio/music/tetris-theme.ogg",
  "/audio/music/snake-round.ogg",
  "/audio/sfx/beep-a.mp3",
  "/audio/sfx/beep-b.mp3",
  "/audio/sfx/button-press.wav",
  "/audio/sfx/coin.mp3",
  "/audio/sfx/game-over.mp3",
  "/audio/sfx/line-clear.mp3",
  "/audio/sfx/power-up.mp3",
];

function isArcadeAsset(url) {
  return url.origin === self.location.origin && (
    url.pathname.startsWith("/audio/") || url.pathname.startsWith("/models/")
  );
}

async function cachePrecacheAssets() {
  const cache = await caches.open(ASSET_CACHE_NAME);

  await Promise.allSettled(
    PRECACHE_URLS.map((url) =>
      cache.add(
        new Request(url, {
          cache: "reload",
        }),
      ),
    ),
  );
}

async function cleanupOldCaches() {
  const cacheNames = await caches.keys();

  await Promise.all(
    cacheNames
      .filter((cacheName) => cacheName !== ASSET_CACHE_NAME)
      .map((cacheName) => caches.delete(cacheName)),
  );
}

function buildRangeResponse(arrayBuffer, rangeHeader, contentType) {
  const match = /^bytes=(\d+)-(\d+)?$/i.exec(rangeHeader);
  if (!match) {
    return null;
  }

  const start = Number.parseInt(match[1], 10);
  const end = match[2] ? Number.parseInt(match[2], 10) : arrayBuffer.byteLength - 1;

  if (
    Number.isNaN(start) ||
    Number.isNaN(end) ||
    start < 0 ||
    end < start ||
    end >= arrayBuffer.byteLength
  ) {
    return new Response(null, {
      status: 416,
      headers: {
        "Content-Range": `bytes */${arrayBuffer.byteLength}`,
      },
    });
  }

  return new Response(arrayBuffer.slice(start, end + 1), {
    status: 206,
    headers: {
      "Accept-Ranges": "bytes",
      "Content-Length": String(end - start + 1),
      "Content-Range": `bytes ${start}-${end}/${arrayBuffer.byteLength}`,
      "Content-Type": contentType,
    },
  });
}

self.addEventListener("install", (event) => {
  event.waitUntil(cachePrecacheAssets());
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    cleanupOldCaches().then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") {
    return;
  }

  const url = new URL(event.request.url);
  if (!isArcadeAsset(url)) {
    return;
  }

  const rangeHeader = event.request.headers.get("range");

  event.respondWith((async () => {
    const cache = await caches.open(ASSET_CACHE_NAME);

    if (rangeHeader) {
      const cachedResponse = await cache.match(url.pathname);

      if (cachedResponse) {
        const arrayBuffer = await cachedResponse.arrayBuffer();
        const contentType = cachedResponse.headers.get("Content-Type") ?? "application/octet-stream";
        const rangeResponse = buildRangeResponse(arrayBuffer, rangeHeader, contentType);
        if (rangeResponse) {
          return rangeResponse;
        }
      }

      return fetch(event.request);
    }

    const cachedResponse = await cache.match(event.request, {
      ignoreSearch: true,
    });
    if (cachedResponse) {
      return cachedResponse;
    }

    const networkResponse = await fetch(event.request);
    if (networkResponse.ok) {
      cache.put(url.pathname, networkResponse.clone());
    }

    return networkResponse;
  })());
});
