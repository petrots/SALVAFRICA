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
const isProduction = process.env.NODE_ENV === 'production';

// VAPID configuration: read persistent keys from process.env; fall back to in-memory keys in preview/dev
const envPublicKey = (process.env.VAPID_PUBLIC_KEY || '').trim();
const envPrivateKey = (process.env.VAPID_PRIVATE_KEY || '').trim();
const envSubject = (process.env.VAPID_SUBJECT || 'mailto:salvafrica@example.com').trim();

const hasPersistentVapid = Boolean(envPublicKey && envPrivateKey);
const vapidKeys = hasPersistentVapid
  ? { publicKey: envPublicKey, privateKey: envPrivateKey }
  : webpush.generateVAPIDKeys();

const vapidSubject =
  envSubject.startsWith('mailto:') || envSubject.startsWith('https://')
    ? envSubject
    : 'mailto:salvafrica@example.com';

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
          const statusCode =
            typeof err === 'object' && err !== null && 'statusCode' in err
              ? Number((err as { statusCode?: unknown }).statusCode)
              : 0;
          if ((statusCode === 404 || statusCode === 410) && typeof sub.id === 'string') {
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
      tag: 'salvafrica-test-push',
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
      const statusCode =
        typeof err === 'object' && err !== null && 'statusCode' in err
          ? Number((err as { statusCode?: unknown }).statusCode)
          : 500;
      res.status(statusCode === 404 || statusCode === 410 ? 410 : 502).json({
        error: 'Invio notifica di prova non riuscito.',
        expired: statusCode === 404 || statusCode === 410,
      });
    }
  });

  if (!isProduction) {
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
    app.use(express.static(distDir));
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
