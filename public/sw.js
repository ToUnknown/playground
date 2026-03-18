const ASSET_CACHE_NAME = "friends-arcade-assets-v4";

const PRECACHE_URLS = [
  "/models/game_boy_classic_interactive.glb",
  "/audio/music/arcade-menu.mp3",
  "/audio/music/blackjack-music.m4a",
  "/audio/music/snake-round.ogg",
  "/audio/tetris/01. Title.m4a",
  "/audio/tetris/02. A-Type Music (v1.0).m4a",
  "/audio/tetris/03. A-Type Music (Korobeiniki).m4a",
  "/audio/tetris/04. B-Type Music.m4a",
  "/audio/tetris/05. C-Type Music.m4a",
  "/audio/tetris/08. Stage Clear.m4a",
  "/audio/tetris/18. Game Over.m4a",
  "/audio/sfx/beep-a.mp3",
  "/audio/sfx/beep-b.mp3",
  "/audio/sfx/button-press.wav",
  "/audio/sfx/coin.mp3",
  "/audio/sfx/game-over.mp3",
  "/audio/sfx/line-clear.mp3",
  "/audio/sfx/power-up.mp3",
  "/tetris-gameboy-assets/font.ttf",
  "/tetris-gameboy-assets/i.png",
  "/tetris-gameboy-assets/j.png",
  "/tetris-gameboy-assets/l.png",
  "/tetris-gameboy-assets/o.png",
  "/tetris-gameboy-assets/s.png",
  "/tetris-gameboy-assets/score_board.svg",
  "/tetris-gameboy-assets/t.png",
  "/tetris-gameboy-assets/title_screen.jpg",
  "/tetris-gameboy-assets/wall.png",
  "/tetris-gameboy-assets/z.png",
  "/blackjack-gameboy-assets/back.svg",
  "/blackjack-gameboy-assets/chip.svg",
  "/blackjack-gameboy-assets/cards/c-10.svg",
  "/blackjack-gameboy-assets/cards/c-2.svg",
  "/blackjack-gameboy-assets/cards/c-3.svg",
  "/blackjack-gameboy-assets/cards/c-4.svg",
  "/blackjack-gameboy-assets/cards/c-5.svg",
  "/blackjack-gameboy-assets/cards/c-6.svg",
  "/blackjack-gameboy-assets/cards/c-7.svg",
  "/blackjack-gameboy-assets/cards/c-8.svg",
  "/blackjack-gameboy-assets/cards/c-9.svg",
  "/blackjack-gameboy-assets/cards/c-a.svg",
  "/blackjack-gameboy-assets/cards/c-j.svg",
  "/blackjack-gameboy-assets/cards/c-k.svg",
  "/blackjack-gameboy-assets/cards/c-q.svg",
  "/blackjack-gameboy-assets/cards/d-10.svg",
  "/blackjack-gameboy-assets/cards/d-2.svg",
  "/blackjack-gameboy-assets/cards/d-3.svg",
  "/blackjack-gameboy-assets/cards/d-4.svg",
  "/blackjack-gameboy-assets/cards/d-5.svg",
  "/blackjack-gameboy-assets/cards/d-6.svg",
  "/blackjack-gameboy-assets/cards/d-7.svg",
  "/blackjack-gameboy-assets/cards/d-8.svg",
  "/blackjack-gameboy-assets/cards/d-9.svg",
  "/blackjack-gameboy-assets/cards/d-a.svg",
  "/blackjack-gameboy-assets/cards/d-j.svg",
  "/blackjack-gameboy-assets/cards/d-k.svg",
  "/blackjack-gameboy-assets/cards/d-q.svg",
  "/blackjack-gameboy-assets/cards/h-10.svg",
  "/blackjack-gameboy-assets/cards/h-2.svg",
  "/blackjack-gameboy-assets/cards/h-3.svg",
  "/blackjack-gameboy-assets/cards/h-4.svg",
  "/blackjack-gameboy-assets/cards/h-5.svg",
  "/blackjack-gameboy-assets/cards/h-6.svg",
  "/blackjack-gameboy-assets/cards/h-7.svg",
  "/blackjack-gameboy-assets/cards/h-8.svg",
  "/blackjack-gameboy-assets/cards/h-9.svg",
  "/blackjack-gameboy-assets/cards/h-a.svg",
  "/blackjack-gameboy-assets/cards/h-j.svg",
  "/blackjack-gameboy-assets/cards/h-k.svg",
  "/blackjack-gameboy-assets/cards/h-q.svg",
  "/blackjack-gameboy-assets/cards/s-10.svg",
  "/blackjack-gameboy-assets/cards/s-2.svg",
  "/blackjack-gameboy-assets/cards/s-3.svg",
  "/blackjack-gameboy-assets/cards/s-4.svg",
  "/blackjack-gameboy-assets/cards/s-5.svg",
  "/blackjack-gameboy-assets/cards/s-6.svg",
  "/blackjack-gameboy-assets/cards/s-7.svg",
  "/blackjack-gameboy-assets/cards/s-8.svg",
  "/blackjack-gameboy-assets/cards/s-9.svg",
  "/blackjack-gameboy-assets/cards/s-a.svg",
  "/blackjack-gameboy-assets/cards/s-j.svg",
  "/blackjack-gameboy-assets/cards/s-k.svg",
  "/blackjack-gameboy-assets/cards/s-q.svg",
];

function isArcadeAsset(url) {
  return url.origin === self.location.origin && (
    url.pathname.startsWith("/audio/") ||
    url.pathname.startsWith("/models/") ||
    url.pathname.startsWith("/tetris-gameboy-assets/") ||
    url.pathname.startsWith("/blackjack-gameboy-assets/")
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
