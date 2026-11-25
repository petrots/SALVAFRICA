import { CacheableResponsePlugin } from 'workbox-cacheable-response';
import { ExpirationPlugin } from 'workbox-expiration';
import {
  cleanupOutdatedCaches,
  createHandlerBoundToURL,
  precacheAndRoute,
} from 'workbox-precaching';
import { NavigationRoute, registerRoute } from 'workbox-routing';
import { CacheFirst } from 'workbox-strategies';

interface PrecacheEntryLike {
  url: string;
  revision: string | null;
}

interface SWNotificationOptions {
  body?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  data?: { url?: string };
}

interface SWWindowClient {
  url: string;
  focused?: boolean;
  focus: () => Promise<SWWindowClient>;
  navigate?: (url: string) => Promise<SWWindowClient | null>;
  postMessage: (message: unknown) => void;
}

interface SWPushManager {
  subscribe: (options: {
    userVisibleOnly: boolean;
    applicationServerKey?: BufferSource | string;
  }) => Promise<PushSubscription>;
}

interface SWGlobalScope {
  __WB_MANIFEST: Array<PrecacheEntryLike | string>;
  location: Location;
  skipWaiting: () => Promise<void>;
  clients: {
    claim: () => Promise<void>;
    matchAll: (options: {
      type: 'window';
      includeUncontrolled?: boolean;
    }) => Promise<SWWindowClient[]>;
    openWindow: (url: string) => Promise<SWWindowClient | null>;
  };
  registration: {
    pushManager: SWPushManager;
    showNotification: (title: string, options?: SWNotificationOptions) => Promise<void>;
  };
  addEventListener: (
    type: string,
    listener: (event: unknown) => void
  ) => void;
}

interface PushEventLike {
  data?: {
    json: () => unknown;
    text: () => string;
  } | null;
  waitUntil: (promise: Promise<unknown>) => void;
}

interface NotificationClickEventLike {
  notification: {
    data?: { url?: string };
    close: () => void;
  };
  waitUntil: (promise: Promise<unknown>) => void;
}

interface PushSubscriptionChangeEventLike {
  oldSubscription?: {
    options?: {
      applicationServerKey?: ArrayBuffer | null;
    };
  } | null;
  waitUntil: (promise: Promise<unknown>) => void;
}

declare const self: SWGlobalScope;

self.addEventListener('install', () => {
  void self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  const evt = event as { waitUntil: (p: Promise<unknown>) => void };
  evt.waitUntil(self.clients.claim());
});

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// SPA offline navigation fallback (never intercept /api/* endpoints)
try {
  const handler = createHandlerBoundToURL('/index.html');
  registerRoute(
    new NavigationRoute(handler, {
      denylist: [/^\/api\//],
    })
  );
} catch {
  // Dev mode may not precache /index.html directly
}

// Runtime caching for Google Fonts
registerRoute(
  ({ url }) => url.origin === 'https://fonts.googleapis.com',
  new CacheFirst({
    cacheName: 'google-fonts-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 10,
        maxAgeSeconds: 60 * 60 * 24 * 365,
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
);

registerRoute(
  ({ url }) => url.origin === 'https://fonts.gstatic.com',
  new CacheFirst({
    cacheName: 'gstatic-fonts-cache',
    plugins: [
      new ExpirationPlugin({
        maxEntries: 10,
        maxAgeSeconds: 60 * 60 * 24 * 365,
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200],
      }),
    ],
  })
);

// Web Push Event Listener (compatible with iOS 16.4+ Home Screen PWA, Android & Desktop)
self.addEventListener('push', (event) => {
  const pushEvent = event as PushEventLike;
  let title = 'SALVAFRICA';
  let body = 'Nuovo aggiornamento sul viaggio in Africa.';
  let tag = 'salvafrica-activity';
  let url = '/';

  if (pushEvent.data) {
    try {
      const parsed = pushEvent.data.json() as {
        title?: string;
        body?: string;
        tag?: string;
        url?: string;
      };
      if (parsed?.title && typeof parsed.title === 'string') {
        title = parsed.title;
      }
      if (parsed?.body && typeof parsed.body === 'string') {
        body = parsed.body;
      }
      if (parsed?.tag && typeof parsed.tag === 'string') {
        tag = parsed.tag;
      }
      if (
        parsed?.url &&
        typeof parsed.url === 'string' &&
        parsed.url.startsWith('/') &&
        !parsed.url.startsWith('//')
      ) {
        url = parsed.url;
      }
    } catch {
      try {
        const text = pushEvent.data.text();
        if (text) body = text;
      } catch {
        // Keep default fallback message so iOS never counts a silent push
      }
    }
  }

  // Always resolve showNotification inside waitUntil (required by iOS Safari WebKit)
  const notifyPromise = self.registration
    .showNotification(title, {
      body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag,
      data: { url },
    })
    .catch(() =>
      self.registration.showNotification(title, {
        body,
      })
    );

  pushEvent.waitUntil(notifyPromise);
});

// Notification Click: focus open standalone/browser window and route to target view
self.addEventListener('notificationclick', (event) => {
  const clickEvent = event as NotificationClickEventLike;
  clickEvent.notification.close();

  const rawUrl = clickEvent.notification.data?.url || '/';
  const safePath = rawUrl.startsWith('/') && !rawUrl.startsWith('//') ? rawUrl : '/';
  const targetUrl = new URL(safePath, self.location.origin).href;

  clickEvent.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.startsWith(self.location.origin)) {
            try {
              client.postMessage({
                type: 'SALVAFRICA_NAVIGATE',
                path: safePath,
              });
            } catch {
              // Ignore postMessage failures
            }
            return client.focus().catch(() => {
              if (typeof client.navigate === 'function') {
                return client.navigate(targetUrl);
              }
              return null;
            });
          }
        }
        return self.clients.openWindow(targetUrl);
      })
  );
});

function decodeBase64UrlToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const output = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; i++) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
}

// Handle browser/APNs push subscription rotation automatically
self.addEventListener('pushsubscriptionchange', (event) => {
  const changeEvent = event as PushSubscriptionChangeEventLike;

  const resubscribePromise = (async () => {
    try {
      let applicationServerKey: ArrayBuffer | Uint8Array<ArrayBuffer> | undefined =
        changeEvent.oldSubscription?.options?.applicationServerKey ?? undefined;

      if (!applicationServerKey) {
        const res = await fetch('/api/push/config');
        if (res.ok) {
          const cfg = (await res.json()) as { publicKey?: string };
          if (cfg.publicKey) {
            applicationServerKey = decodeBase64UrlToUint8Array(cfg.publicKey);
          }
        }
      }

      if (!applicationServerKey) return;

      await self.registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });

      const clients = await self.clients.matchAll({
        type: 'window',
        includeUncontrolled: true,
      });
      for (const client of clients) {
        client.postMessage({ type: 'SALVAFRICA_PUSH_SUBSCRIPTION_CHANGED' });
      }
    } catch {
      // Client will re-sync on next app open
    }
  })();

  changeEvent.waitUntil(resubscribePromise);
});
