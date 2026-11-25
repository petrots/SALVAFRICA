import 'dotenv/config';
import express from 'express';
import type { Request, Response } from 'express';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import net from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const webpush = require('web-push') as typeof import('web-push');

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const isProduction =
  process.env.NODE_ENV === 'production' ||
  (process.env.NODE_ENV !== 'development' &&
    fs.existsSync(path.resolve(__dirname, 'dist', 'index.html')));

interface VapidKeyPair {
  publicKey: string;
  privateKey: string;
}

function loadOrCreateVapidKeys(): {
  keys: VapidKeyPair;
  persistent: boolean;
  source: 'env' | 'file' | 'memory';
} {
  const envPublicKey = (process.env.VAPID_PUBLIC_KEY || '').trim();
  const envPrivateKey = (process.env.VAPID_PRIVATE_KEY || '').trim();
  if (envPublicKey && envPrivateKey) {
    return {
      keys: { publicKey: envPublicKey, privateKey: envPrivateKey },
      persistent: true,
      source: 'env',
    };
  }

  const keyFilePath = path.resolve(__dirname, '.vapid-keys.json');
  try {
    if (fs.existsSync(keyFilePath)) {
      const parsed = JSON.parse(
        fs.readFileSync(keyFilePath, 'utf8')
      ) as Partial<VapidKeyPair>;
      if (
        typeof parsed.publicKey === 'string' &&
        parsed.publicKey.length > 20 &&
        typeof parsed.privateKey === 'string' &&
        parsed.privateKey.length > 20
      ) {
        return {
          keys: { publicKey: parsed.publicKey, privateKey: parsed.privateKey },
          persistent: true,
          source: 'file',
        };
      }
    }
  } catch {
    // Fall through to generate a fresh keypair
  }

  const generated = webpush.generateVAPIDKeys();
  try {
    fs.writeFileSync(keyFilePath, JSON.stringify(generated, null, 2), {
      encoding: 'utf8',
      mode: 0o600,
    });
    return { keys: generated, persistent: true, source: 'file' };
  } catch {
    return { keys: generated, persistent: false, source: 'memory' };
  }
}

const vapidConfigState = loadOrCreateVapidKeys();
const vapidKeys = vapidConfigState.keys;
const hasPersistentVapid = vapidConfigState.persistent;

const rawAppUrl = (process.env.APP_URL || '').trim();
const fallbackSubject =
  rawAppUrl.startsWith('https://') && !rawAppUrl.includes('localhost')
    ? rawAppUrl
    : 'mailto:noreply@salvafrica.app';
const envSubject = (process.env.VAPID_SUBJECT || fallbackSubject).trim();
const vapidSubject =
  (envSubject.startsWith('mailto:') || envSubject.startsWith('https://')) &&
  !envSubject.includes('example.com')
    ? envSubject
    : fallbackSubject;

webpush.setVapidDetails(vapidSubject, vapidKeys.publicKey, vapidKeys.privateKey);

const ALLOWED_PUSH_HOST_SUFFIXES = [
  '.push.apple.com',
  '.push.services.mozilla.com',
  '.notify.windows.com',
  '.push.samsungosp.com',
];

const ALLOWED_PUSH_EXACT_HOSTS = new Set([
  'fcm.googleapis.com',
  'android.googleapis.com',
  'push.services.mozilla.com',
  'updates.push.services.mozilla.com',
  'web.push.apple.com',
]);

function isPrivateOrLocalIp(host: string): boolean {
  const cleaned = host.replace(/^\[|\]$/g, '').toLowerCase();
  if (
    cleaned === 'localhost' ||
    cleaned === '::1' ||
    cleaned.endsWith('.local') ||
    cleaned.endsWith('.internal')
  ) {
    return true;
  }

  const ipVersion = net.isIP(cleaned);
  if (ipVersion === 4) {
    const parts = cleaned.split('.').map(Number);
    if (parts[0] === 10 || parts[0] === 127 || parts[0] === 0) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    return true; // Do not allow raw IPv4 push endpoints
  }
  if (ipVersion === 6) {
    return true; // Do not allow raw IPv6 push endpoints
  }
  return false;
}

function isValidPushEndpoint(rawEndpoint: unknown): rawEndpoint is string {
  if (typeof rawEndpoint !== 'string') return false;
  if (rawEndpoint.length < 12 || rawEndpoint.length > 1000) return false;
  let parsed: URL;
  try {
    parsed = new URL(rawEndpoint);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;
  if (parsed.username || parsed.password) return false;
  const hostname = parsed.hostname.toLowerCase();
  if (!hostname || isPrivateOrLocalIp(hostname)) return false;

  if (ALLOWED_PUSH_EXACT_HOSTS.has(hostname)) return true;
  return ALLOWED_PUSH_HOST_SUFFIXES.some(
    (suffix) => hostname.endsWith(suffix) && hostname.length > suffix.length
  );
}

interface IncomingSubscriptionItem {
  id?: unknown;
  endpoint?: unknown;
  p256dh?: unknown;
  auth?: unknown;
}

function sanitizeRelativeUrl(rawUrl: unknown): string {
  if (typeof rawUrl !== 'string') return '/';
  const trimmed = rawUrl.trim();
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) return '/';
  return trimmed.slice(0, 120);
}

function clampText(value: unknown, maxLen: number, fallback: string): string {
  if (typeof value !== 'string') return fallback;
  const trimmed = value.trim();
  return trimmed ? trimmed.slice(0, maxLen) : fallback;
}

function extractPushErrorInfo(err: unknown): {
  statusCode: number;
  body: string;
  expired: boolean;
  vapidMismatch: boolean;
} {
  const statusCode =
    typeof err === 'object' && err !== null && 'statusCode' in err
      ? Number((err as { statusCode?: unknown }).statusCode) || 500
      : 500;
  const body =
    typeof err === 'object' && err !== null && 'body' in err
      ? String((err as { body?: unknown }).body || '').slice(0, 300)
      : err instanceof Error
        ? err.message.slice(0, 300)
        : '';
  const expired = statusCode === 404 || statusCode === 410;
  const vapidMismatch =
    statusCode === 400 ||
    statusCode === 401 ||
    statusCode === 403 ||
    /vapid|badjwttoken|invalidprovidertoken/i.test(body);
  return { statusCode, body, expired, vapidMismatch };
}

interface FirestoreFieldValue {
  stringValue?: string;
  doubleValue?: number;
  integerValue?: string | number;
}

interface FirestoreDocResponse {
  fields?: Record<string, FirestoreFieldValue>;
}

interface FirestoreListResponse {
  documents?: FirestoreDocResponse[];
  nextPageToken?: string;
}

function readFirebaseClientMeta(): {
  projectId: string;
  databaseId: string;
  apiKey: string;
} | null {
  try {
    const configPath = path.resolve(__dirname, 'firebase-applet-config.json');
    if (!fs.existsSync(configPath)) return null;
    const raw = JSON.parse(fs.readFileSync(configPath, 'utf8')) as {
      projectId?: string;
      firestoreDatabaseId?: string;
      apiKey?: string;
    };
    if (!raw.projectId || !raw.apiKey) return null;
    return {
      projectId: raw.projectId,
      databaseId: raw.firestoreDatabaseId || '(default)',
      apiKey: raw.apiKey,
    };
  } catch {
    return null;
  }
}

function readFirestoreNumber(field?: FirestoreFieldValue): number {
  if (!field) return 0;
  if (typeof field.doubleValue === 'number' && Number.isFinite(field.doubleValue)) {
    return field.doubleValue;
  }
  if (field.integerValue !== undefined) {
    const parsed = Number(field.integerValue);
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

async function startServer() {
  const app = express();
  app.disable('x-powered-by');
  app.use(express.json({ limit: '64kb' }));

  app.get('/api/push/config', (_req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    res.json({
      publicKey: vapidKeys.publicKey,
      persistent: hasPersistentVapid,
    });
  });

  app.get('/api/widget', async (_req: Request, res: Response) => {
    res.setHeader('Cache-Control', 'no-store');
    const fb = readFirebaseClientMeta();
    if (!fb) {
      res.status(503).json({ error: 'Configurazione Firebase non disponibile.' });
      return;
    }

    const baseUrl = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(
      fb.projectId
    )}/databases/${encodeURIComponent(fb.databaseId)}/documents/vaults/salvafrica-viaggio`;

    try {
      const vaultRes = await fetch(
        `${baseUrl}?key=${encodeURIComponent(fb.apiKey)}`
      );

      let title = 'Viaggio in Africa';
      let targetAmount = 8000;
      if (vaultRes.ok) {
        const vaultDoc = (await vaultRes.json()) as FirestoreDocResponse;
        if (vaultDoc.fields?.title?.stringValue) {
          title = vaultDoc.fields.title.stringValue;
        }
        const parsedTarget = readFirestoreNumber(vaultDoc.fields?.targetAmount);
        if (parsedTarget > 0) {
          targetAmount = parsedTarget;
        }
      }

      let totalSaved = 0;
      let pageToken = '';
      let pages = 0;
      do {
        const listUrl = new URL(`${baseUrl}/contributions`);
        listUrl.searchParams.set('pageSize', '300');
        listUrl.searchParams.set('key', fb.apiKey);
        if (pageToken) {
          listUrl.searchParams.set('pageToken', pageToken);
        }

        const listRes = await fetch(listUrl.toString());
        if (!listRes.ok) break;
        const listJson = (await listRes.json()) as FirestoreListResponse;
        if (Array.isArray(listJson.documents)) {
          for (const docItem of listJson.documents) {
            totalSaved += readFirestoreNumber(docItem.fields?.amount);
          }
        }
        pageToken = listJson.nextPageToken || '';
        pages += 1;
      } while (pageToken && pages < 15);

      const safeTotal = Math.max(0, Math.round(totalSaved * 100) / 100);
      const safeTarget = Math.max(1, targetAmount);
      const progressPercent = Math.min(
        100,
        Math.round((safeTotal / safeTarget) * 1000) / 10
      );
      const remainingAmount = Math.max(
        0,
        Math.round((safeTarget - safeTotal) * 100) / 100
      );

      res.json({
        app: 'SALVAFRICA',
        title,
        totalSaved: safeTotal,
        targetAmount: safeTarget,
        progressPercent,
        remainingAmount,
        updatedAt: new Date().toISOString(),
      });
    } catch {
      res.status(503).json({ error: 'Dati widget temporaneamente non raggiungibili.' });
    }
  });

  app.post('/api/push/send', async (req: Request, res: Response) => {
    const body = req.body as {
      subscriptions?: unknown;
      payload?: {
        title?: unknown;
        body?: unknown;
        tag?: unknown;
        url?: unknown;
      };
    };

    if (!Array.isArray(body?.subscriptions)) {
      res.status(400).json({ error: 'Lista sottoscrizioni non valida.' });
      return;
    }

    const validSubs = (body.subscriptions as IncomingSubscriptionItem[])
      .slice(0, 20)
      .filter(
        (sub) =>
          isValidPushEndpoint(sub?.endpoint) &&
          typeof sub.p256dh === 'string' &&
          sub.p256dh.length >= 1 &&
          sub.p256dh.length <= 256 &&
          typeof sub.auth === 'string' &&
          sub.auth.length >= 1 &&
          sub.auth.length <= 128
      );

    if (validSubs.length === 0) {
      res.json({ sent: 0, failed: 0, expiredIds: [] });
      return;
    }

    const notificationPayload = JSON.stringify({
      title: clampText(body.payload?.title, 100, 'SALVAFRICA'),
      body: clampText(body.payload?.body, 240, 'Nuovo aggiornamento sul viaggio in Africa.'),
      tag: clampText(body.payload?.tag, 64, `salvafrica-${Date.now()}`),
      url: sanitizeRelativeUrl(body.payload?.url),
    });

    const expiredIds: string[] = [];
    let sent = 0;
    let failed = 0;

    await Promise.all(
      validSubs.map(async (sub) => {
        try {
          await webpush.sendNotification(
            {
              endpoint: sub.endpoint as string,
              keys: {
                p256dh: sub.p256dh as string,
                auth: sub.auth as string,
              },
            },
            notificationPayload,
            { TTL: 60 * 60 * 12, urgency: 'high' }
          );
          sent += 1;
        } catch (err: unknown) {
          failed += 1;
          const info = extractPushErrorInfo(err);
          console.error('[push/send] Delivery failed:', info.statusCode, info.body);
          if ((info.expired || info.vapidMismatch) && typeof sub.id === 'string') {
            expiredIds.push(sub.id);
          }
        }
      })
    );

    res.json({ sent, failed, expiredIds });
  });

  app.post('/api/push/test', async (req: Request, res: Response) => {
    const body = req.body as {
      subscription?: IncomingSubscriptionItem;
      partnerName?: unknown;
    };

    const sub = body?.subscription;
    if (
      !sub ||
      !isValidPushEndpoint(sub.endpoint) ||
      typeof sub.p256dh !== 'string' ||
      sub.p256dh.length < 1 ||
      sub.p256dh.length > 256 ||
      typeof sub.auth !== 'string' ||
      sub.auth.length < 1 ||
      sub.auth.length > 128
    ) {
      res.status(400).json({ error: 'Sottoscrizione push non valida.' });
      return;
    }

    const name = clampText(body.partnerName, 40, 'Viaggiatore');
    const payload = JSON.stringify({
      title: 'SALVAFRICA · Notifiche attive',
      body: `Ciao ${name}! Riceverai qui gli avvisi per nuovi versamenti, reazioni e traguardi.`,
      tag: `salvafrica-test-${Date.now()}`,
      url: '/?notifications=1',
    });

    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        payload,
        { TTL: 60, urgency: 'high' }
      );
      res.json({ ok: true });
    } catch (err: unknown) {
      const info = extractPushErrorInfo(err);
      console.error('[push/test] Delivery failed:', info.statusCode, info.body);
      res.status(info.expired ? 410 : 502).json({
        error: info.vapidMismatch
          ? 'Chiave VAPID disallineata: rinnovo automatico della sottoscrizione necessario.'
          : info.expired
            ? 'Sottoscrizione scaduta: rinnovo automatico necessario.'
            : `Invio Push rifiutato dal servizio (${info.statusCode}).`,
        expired: info.expired,
        vapidMismatch: info.vapidMismatch,
        statusCode: info.statusCode,
      });
    }
  });

  if (!isProduction) {
    let cachedDevSw: { code: string; mtimeMs: number } | null = null;
    const swEntryPath = path.resolve(__dirname, 'src', 'sw.ts');

    app.get('/sw.js', async (_req: Request, res: Response, next) => {
      try {
        const stat = fs.statSync(swEntryPath);
        if (!cachedDevSw || cachedDevSw.mtimeMs !== stat.mtimeMs) {
          const esbuild = await import('esbuild');
          const built = await esbuild.build({
            entryPoints: [swEntryPath],
            bundle: true,
            write: false,
            format: 'iife',
            platform: 'browser',
            target: ['es2020', 'safari16'],
            define: {
              'self.__WB_MANIFEST': '[]',
            },
          });
          const outputText = built.outputFiles?.[0]?.text;
          if (!outputText) {
            throw new Error('Empty service worker bundle');
          }
          cachedDevSw = { code: outputText, mtimeMs: stat.mtimeMs };
        }
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('Service-Worker-Allowed', '/');
        res.type('application/javascript; charset=utf-8').send(cachedDevSw.code);
      } catch (err) {
        next(err);
      }
    });

    app.get('/manifest.webmanifest', (_req: Request, res: Response) => {
      res.setHeader('Cache-Control', 'no-store');
      res.type('application/manifest+json; charset=utf-8').json({
        id: '/',
        name: 'SALVAFRICA — Salvadanaio Viaggio in Africa',
        short_name: 'SALVAFRICA',
        description:
          'Salvadanaio condiviso di coppia per il viaggio in Africa finanziato solo da attività esterne extra.',
        theme_color: '#FAF6F0',
        background_color: '#FAF6F0',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: '/pwa-maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      });
    });

    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: false,
        ws: false,
        watch: null,
      },
      appType: 'spa',
    });

    app.get('/@vite/client', async (_req: Request, res: Response, next) => {
      try {
        const result = await vite.transformRequest('/@vite/client');
        if (!result?.code) {
          next();
          return;
        }
        const patched = result.code.replace(
          'transport.connect(createHMRHandler(handleMessage));',
          'void 0;'
        );
        res.type('application/javascript').send(patched);
      } catch (err) {
        next(err);
      }
    });

    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(
      express.static(distDir, {
        setHeaders(res, filePath) {
          if (filePath.endsWith(`${path.sep}sw.js`)) {
            res.setHeader('Cache-Control', 'no-store');
            res.setHeader('Service-Worker-Allowed', '/');
          } else if (filePath.endsWith(`${path.sep}manifest.webmanifest`)) {
            res.setHeader('Cache-Control', 'no-store');
            res.setHeader('Content-Type', 'application/manifest+json; charset=utf-8');
          }
        },
      })
    );
    app.get('/{*splat}', (_req: Request, res: Response) => {
      const indexHtml = path.join(distDir, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Build not found');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SALVAFRICA server listening on port ${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
