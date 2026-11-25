import {
  deleteDoc,
  doc,
  getDoc,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../firebase';
import {
  APP_LIMITS,
  NotificationActorKey,
  NotificationItem,
  NotificationPreferences,
  NotificationTargetKey,
  NotificationType,
  PartnerKey,
  PushSubscriptionRecord,
} from '../types';

const PARTNER_STORAGE_KEY = 'salvafrica_partner_key';
const NOTIF_PREFS_STORAGE_KEY = 'salvafrica_notif_prefs';
const PUSH_SUB_ID_STORAGE_KEY = 'salvafrica_push_sub_id';
const PUSH_OPT_OUT_STORAGE_KEY = 'salvafrica_push_opt_out';
const VAPID_PUB_STORAGE_KEY = 'salvafrica_vapid_pub';

export const DEFAULT_NOTIFICATION_PREFS: NotificationPreferences = {
  notifyDeposits: true,
  notifyReactions: true,
  notifyMilestones: true,
  notifyLoveNote: true,
};

function makeId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${prefix}-${crypto.randomUUID().replace(/[^a-zA-Z0-9_-]/g, '')}`.slice(
      0,
      48
    );
  }
  return `${prefix}-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 10)}`.slice(0, 48);
}

function clampString(value: string, maxLen: number): string {
  return value.trim().slice(0, maxLen);
}

export function getSavedPartnerKey(): PartnerKey {
  try {
    return window.localStorage.getItem(PARTNER_STORAGE_KEY) === 'B' ? 'B' : 'A';
  } catch {
    return 'A';
  }
}

export function savePartnerKey(partnerKey: PartnerKey): void {
  try {
    window.localStorage.setItem(PARTNER_STORAGE_KEY, partnerKey);
  } catch {
    // Ignore storage restrictions
  }
}

export function getNotificationPrefs(): NotificationPreferences {
  try {
    const raw = window.localStorage.getItem(NOTIF_PREFS_STORAGE_KEY);
    if (!raw) return DEFAULT_NOTIFICATION_PREFS;
    const parsed = JSON.parse(raw) as Partial<NotificationPreferences>;
    return {
      notifyDeposits: parsed.notifyDeposits ?? true,
      notifyReactions: parsed.notifyReactions ?? true,
      notifyMilestones: parsed.notifyMilestones ?? true,
      notifyLoveNote: parsed.notifyLoveNote ?? true,
    };
  } catch {
    return DEFAULT_NOTIFICATION_PREFS;
  }
}

export function saveNotificationPrefs(prefs: NotificationPreferences): void {
  try {
    window.localStorage.setItem(NOTIF_PREFS_STORAGE_KEY, JSON.stringify(prefs));
  } catch {
    // Ignore storage restrictions
  }
}

export function getDeviceSubscriptionId(): string {
  try {
    const existing = window.localStorage.getItem(PUSH_SUB_ID_STORAGE_KEY);
    if (existing && /^[a-zA-Z0-9_-]{6,64}$/.test(existing)) {
      return existing;
    }
    const created = makeId('sub');
    window.localStorage.setItem(PUSH_SUB_ID_STORAGE_KEY, created);
    return created;
  } catch {
    return makeId('sub');
  }
}

export function isPushOptedOut(): boolean {
  try {
    return window.localStorage.getItem(PUSH_OPT_OUT_STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function setPushOptedOut(optedOut: boolean): void {
  try {
    if (optedOut) {
      window.localStorage.setItem(PUSH_OPT_OUT_STORAGE_KEY, '1');
    } else {
      window.localStorage.removeItem(PUSH_OPT_OUT_STORAGE_KEY);
    }
  } catch {
    // Ignore storage restrictions
  }
}

function getStoredVapidKey(): string | null {
  try {
    const value = window.localStorage.getItem(VAPID_PUB_STORAGE_KEY);
    return value && value.length > 20 ? value : null;
  } catch {
    return null;
  }
}

function setStoredVapidKey(publicKey: string | null): void {
  try {
    if (publicKey) {
      window.localStorage.setItem(VAPID_PUB_STORAGE_KEY, publicKey);
    } else {
      window.localStorage.removeItem(VAPID_PUB_STORAGE_KEY);
    }
  } catch {
    // Ignore storage restrictions
  }
}

export interface PushEnvironmentStatus {
  supported: boolean;
  permission: NotificationPermission | 'unsupported';
  isStandalone: boolean;
  isIOS: boolean;
  isInIframe: boolean;
}

export function getPushEnvironmentStatus(): PushEnvironmentStatus {
  const hasWindow = typeof window !== 'undefined';
  const hasNotification = hasWindow && 'Notification' in window;
  const hasSW = typeof navigator !== 'undefined' && 'serviceWorker' in navigator;
  const hasPushManager = hasWindow && 'PushManager' in window;

  const ua = hasWindow ? window.navigator.userAgent.toLowerCase() : '';
  const isIPadOS =
    hasWindow && ua.includes('mac') && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1;
  const isIOS = /iphone|ipad|ipod/.test(ua) || isIPadOS;
  const isStandalone =
    hasWindow &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true);

  let isInIframe = false;
  if (hasWindow) {
    try {
      isInIframe = window.self !== window.top;
    } catch {
      isInIframe = true;
    }
  }

  return {
    supported: hasNotification && hasSW && hasPushManager,
    permission: hasNotification ? window.Notification.permission : 'unsupported',
    isStandalone,
    isIOS,
    isInIframe,
  };
}

function getDeviceLabel(): string {
  const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
  if (/iPhone/i.test(ua)) return 'iPhone';
  if (/iPad/i.test(ua)) return 'iPad';
  if (/Android/i.test(ua)) return 'Android';
  if (/Macintosh/i.test(ua)) return 'Mac';
  if (/Windows/i.test(ua)) return 'Windows';
  return 'Dispositivo Web';
}

function urlBase64ToUint8Array(base64String: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = window.atob(base64);
  const buffer = new ArrayBuffer(rawData.length);
  const outputArray = new Uint8Array(buffer);
  for (let i = 0; i < rawData.length; i++) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function arrayBufferToBase64Url(buffer: ArrayBuffer | null): string {
  if (!buffer) return '';
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window
    .btoa(binary)
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

export interface VapidConfigResponse {
  publicKey: string;
  persistent: boolean;
}

export async function fetchVapidConfig(): Promise<VapidConfigResponse | null> {
  try {
    const res = await fetch('/api/push/config', {
      cache: 'no-store',
      credentials: 'same-origin',
    });
    if (!res.ok) return null;
    const contentType = res.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) return null;
    const data = (await res.json()) as Partial<VapidConfigResponse>;
    if (typeof data.publicKey !== 'string' || data.publicKey.length <= 20) return null;
    return {
      publicKey: data.publicKey,
      persistent: Boolean(data.persistent),
    };
  } catch {
    return null;
  }
}

async function waitForServiceWorkerReady(
  timeoutMs = 12000
): Promise<ServiceWorkerRegistration> {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) {
    throw new Error('Service Worker non supportato su questo dispositivo.');
  }

  let reg =
    (await navigator.serviceWorker.getRegistration('/')) ??
    (await navigator.serviceWorker.getRegistration());

  const currentScriptUrl =
    reg?.active?.scriptURL ||
    reg?.waiting?.scriptURL ||
    reg?.installing?.scriptURL ||
    '';

  const hasValidSwScript = currentScriptUrl.endsWith('/sw.js');
  const hasAnyWorker = Boolean(reg?.active || reg?.waiting || reg?.installing);

  if (!reg || !hasValidSwScript || !hasAnyWorker) {
    reg = await navigator.serviceWorker.register('/sw.js', {
      scope: '/',
      updateViaCache: 'none',
    });
  }

  if (reg.waiting) {
    try {
      reg.waiting.postMessage({ type: 'SKIP_WAITING' });
    } catch {
      // Ignore postMessage failure
    }
  }

  let timerId: number | undefined;
  try {
    const registration = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise<never>((_resolve, reject) => {
        timerId = window.setTimeout(
          () => reject(new Error('Service Worker timeout')),
          timeoutMs
        );
      }),
    ]);
    if (!registration || !('pushManager' in registration)) {
      throw new Error('PushManager non disponibile nella registrazione Service Worker.');
    }
    return registration;
  } finally {
    if (timerId !== undefined) {
      window.clearTimeout(timerId);
    }
  }
}

function requestNotificationPermissionCompat(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return Promise.resolve('denied');
  }
  const current = window.Notification.permission;
  if (current !== 'default') {
    return Promise.resolve(current);
  }
  return new Promise<NotificationPermission>((resolve, reject) => {
    try {
      const maybePromise = window.Notification.requestPermission((legacyResult) => {
        resolve(legacyResult);
      });
      if (maybePromise && typeof maybePromise.then === 'function') {
        maybePromise.then(resolve).catch(reject);
      }
    } catch (err) {
      reject(err);
    }
  });
}

export function syncBrowserAppBadge(unreadCount: number): void {
  if (typeof navigator === 'undefined') return;
  const navWithBadge = navigator as Navigator & {
    setAppBadge?: (count?: number) => Promise<void>;
    clearAppBadge?: () => Promise<void>;
  };
  try {
    if (unreadCount > 0 && typeof navWithBadge.setAppBadge === 'function') {
      void navWithBadge.setAppBadge(unreadCount).catch(() => {});
    } else if (unreadCount === 0 && typeof navWithBadge.clearAppBadge === 'function') {
      void navWithBadge.clearAppBadge().catch(() => {});
    }
  } catch {
    // Ignore unsupported app badge calls
  }
}

export async function getActiveBrowserPushSubscription(): Promise<PushSubscription | null> {
  if (
    typeof navigator === 'undefined' ||
    !('serviceWorker' in navigator) ||
    !('PushManager' in window)
  ) {
    return null;
  }
  try {
    const registration = await waitForServiceWorkerReady(5000);
    return await registration.pushManager.getSubscription();
  } catch {
    return null;
  }
}

async function persistSubscriptionToFirestore(
  vaultId: string,
  subId: string,
  partnerKey: PartnerKey,
  prefs: NotificationPreferences,
  endpoint: string,
  p256dh: string,
  auth: string
): Promise<void> {
  const path = `vaults/${vaultId}/pushSubscriptions/${subId}`;
  const subDocRef = doc(db, 'vaults', vaultId, 'pushSubscriptions', subId);
  const commonFields = {
    partnerKey,
    endpoint: endpoint.slice(0, 1000),
    p256dh: p256dh.slice(0, 256),
    auth: auth.slice(0, 128),
    deviceLabel: clampString(getDeviceLabel(), APP_LIMITS.deviceLabelMax),
    notifyDeposits: prefs.notifyDeposits,
    notifyReactions: prefs.notifyReactions,
    notifyMilestones: prefs.notifyMilestones,
    notifyLoveNote: prefs.notifyLoveNote,
    updatedAt: serverTimestamp(),
  };

  try {
    const existingSnap = await getDoc(subDocRef);
    if (existingSnap.exists()) {
      await updateDoc(subDocRef, commonFields);
    } else {
      await setDoc(subDocRef, {
        id: subId,
        ...commonFields,
        createdAt: serverTimestamp(),
      });
    }
  } catch (err) {
    handleFirestoreError(err, OperationType.WRITE, path);
  }
}

export async function subscribeDeviceToPush(
  vaultId: string,
  partnerKey: PartnerKey,
  prefs: NotificationPreferences
): Promise<{ ok: boolean; error?: string; persistentVapid?: boolean }> {
  const env = getPushEnvironmentStatus();
  if (env.isInIframe) {
    return {
      ok: false,
      error:
        'Apri SALVAFRICA in una scheda diretta del browser (fuori dall’anteprima) per attivare le notifiche Push.',
    };
  }

  if (!env.supported) {
    if (env.isIOS && !env.isStandalone) {
      return {
        ok: false,
        error:
          'Su iPhone aggiungi prima SALVAFRICA alla schermata Home (Condividi → Aggiungi a schermata Home), poi aprila da lì.',
      };
    }
    return {
      ok: false,
      error: 'Questo browser non supporta le notifiche Push.',
    };
  }

  // Must happen directly from user interaction gesture on iOS Safari
  let permission = window.Notification.permission;
  if (permission === 'default') {
    try {
      permission = await requestNotificationPermissionCompat();
    } catch {
      return {
        ok: false,
        error:
          'Impossibile richiedere il permesso qui. Apri SALVAFRICA direttamente dal browser o dalla schermata Home.',
      };
    }
  }

  if (permission !== 'granted') {
    return {
      ok: false,
      error:
        'Permesso negato dal browser. Abilita le notifiche nelle impostazioni del sito o del telefono.',
    };
  }

  const vapidConfig = await fetchVapidConfig();
  if (!vapidConfig) {
    return {
      ok: false,
      error: 'Servizio Push temporaneamente non raggiungibile.',
    };
  }

  try {
    const registration = await waitForServiceWorkerReady(12000);
    let subscription = await registration.pushManager.getSubscription();

    const expectedKey = urlBase64ToUint8Array(vapidConfig.publicKey);
    const storedVapid = getStoredVapidKey();

    if (subscription) {
      const existingKeyB64 = subscription.options?.applicationServerKey
        ? arrayBufferToBase64Url(subscription.options.applicationServerKey)
        : '';
      const keyConflict =
        (existingKeyB64 && existingKeyB64 !== vapidConfig.publicKey) ||
        (storedVapid && storedVapid !== vapidConfig.publicKey) ||
        (!existingKeyB64 && !storedVapid);

      if (keyConflict) {
        await subscription.unsubscribe().catch(() => {});
        subscription = null;
      }
    }

    if (!subscription) {
      try {
        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: expectedKey,
        });
      } catch (subErr) {
        const subErrName = subErr instanceof Error ? subErr.name : '';
        const subErrMsg = subErr instanceof Error ? subErr.message : '';
        if (
          subErrName === 'InvalidStateError' ||
          /applicationServerKey|existing subscription|already/i.test(subErrMsg)
        ) {
          const staleSub = await registration.pushManager.getSubscription().catch(() => null);
          if (staleSub) {
            await staleSub.unsubscribe().catch(() => {});
          }
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: expectedKey,
          });
        } else {
          throw subErr;
        }
      }
    }

    const p256dh = arrayBufferToBase64Url(subscription.getKey('p256dh'));
    const auth = arrayBufferToBase64Url(subscription.getKey('auth'));
    if (!subscription.endpoint || !p256dh || !auth) {
      return {
        ok: false,
        error: 'Il browser non ha fornito le chiavi di cifratura Push.',
      };
    }

    const subId = getDeviceSubscriptionId();
    await persistSubscriptionToFirestore(
      vaultId,
      subId,
      partnerKey,
      prefs,
      subscription.endpoint,
      p256dh,
      auth
    );

    setStoredVapidKey(vapidConfig.publicKey);
    setPushOptedOut(false);
    return { ok: true, persistentVapid: vapidConfig.persistent };
  } catch (err) {
    console.error('[push/subscribe] Failed:', err);
    const errName = err instanceof Error ? err.name : '';
    const message = err instanceof Error ? err.message : '';
    if (/Service Worker|timeout|PushManager/i.test(message)) {
      return {
        ok: false,
        error: `Service Worker non ancora pronto: ricarica SALVAFRICA e riprova (${message}).`,
      };
    }
    if (/operationType/i.test(message)) {
      return {
        ok: false,
        error: 'Impossibile salvare la registrazione notifiche nel database.',
      };
    }
    if (errName === 'NotAllowedError') {
      return {
        ok: false,
        error:
          'Permesso notifiche bloccato dal sistema o finestra in modalità privata.',
      };
    }
    const detail = [errName, message].filter(Boolean).join(': ').slice(0, 120);
    return {
      ok: false,
      error: detail
        ? `Attivazione Push non riuscita (${detail}). Assicurati di aprire SALVAFRICA direttamente o dalla schermata Home.`
        : 'Attivazione Push non riuscita. Assicurati di aprire SALVAFRICA direttamente o dalla schermata Home.',
    };
  }
}

export async function ensurePushSubscriptionSynced(
  vaultId: string,
  partnerKey: PartnerKey,
  prefs: NotificationPreferences,
  existingSubscriptions: PushSubscriptionRecord[]
): Promise<{ subscribed: boolean; persistentVapid: boolean | null }> {
  const env = getPushEnvironmentStatus();
  const [sub, vapidConfig] = await Promise.all([
    getActiveBrowserPushSubscription(),
    fetchVapidConfig(),
  ]);
  const persistentVapid = vapidConfig ? vapidConfig.persistent : null;

  if (!env.supported || env.permission !== 'granted' || isPushOptedOut() || env.isInIframe) {
    return { subscribed: false, persistentVapid };
  }

  const subId = getDeviceSubscriptionId();
  const storedVapid = getStoredVapidKey();

  // Check if local subscription matches server's active VAPID public key
  let keyMismatch = false;
  if (sub && vapidConfig) {
    if (storedVapid && storedVapid !== vapidConfig.publicKey) {
      keyMismatch = true;
    }
    if (sub.options?.applicationServerKey) {
      const existingKeyB64 = arrayBufferToBase64Url(sub.options.applicationServerKey);
      if (existingKeyB64 && existingKeyB64 !== vapidConfig.publicKey) {
        keyMismatch = true;
      }
    }
  }

  if (!sub || keyMismatch) {
    const res = await subscribeDeviceToPush(vaultId, partnerKey, prefs);
    return {
      subscribed: res.ok,
      persistentVapid: res.persistentVapid ?? persistentVapid,
    };
  }

  if (vapidConfig && !storedVapid) {
    setStoredVapidKey(vapidConfig.publicKey);
  }

  // Browser has a valid subscription matching server VAPID key: ensure Firestore matches
  const p256dh = arrayBufferToBase64Url(sub.getKey('p256dh'));
  const auth = arrayBufferToBase64Url(sub.getKey('auth'));
  const stored = existingSubscriptions.find((s) => s.id === subId);

  if (
    sub.endpoint &&
    p256dh &&
    auth &&
    (!stored ||
      stored.endpoint !== sub.endpoint.slice(0, 1000) ||
      stored.p256dh !== p256dh.slice(0, 256) ||
      stored.auth !== auth.slice(0, 128) ||
      stored.partnerKey !== partnerKey ||
      stored.notifyDeposits !== prefs.notifyDeposits ||
      stored.notifyReactions !== prefs.notifyReactions ||
      stored.notifyMilestones !== prefs.notifyMilestones ||
      stored.notifyLoveNote !== prefs.notifyLoveNote)
  ) {
    try {
      await persistSubscriptionToFirestore(
        vaultId,
        subId,
        partnerKey,
        prefs,
        sub.endpoint,
        p256dh,
        auth
      );
    } catch {
      // Non-blocking sync retry on next focus
    }
  }

  return { subscribed: true, persistentVapid };
}

export async function syncSubscriptionPreferences(
  vaultId: string,
  partnerKey: PartnerKey,
  prefs: NotificationPreferences,
  existingSubscriptions: PushSubscriptionRecord[]
): Promise<void> {
  const subId = getDeviceSubscriptionId();
  const hasStored = existingSubscriptions.some((s) => s.id === subId);
  if (!hasStored) return;

  const path = `vaults/${vaultId}/pushSubscriptions/${subId}`;
  try {
    await updateDoc(doc(db, 'vaults', vaultId, 'pushSubscriptions', subId), {
      partnerKey,
      notifyDeposits: prefs.notifyDeposits,
      notifyReactions: prefs.notifyReactions,
      notifyMilestones: prefs.notifyMilestones,
      notifyLoveNote: prefs.notifyLoveNote,
      deviceLabel: clampString(getDeviceLabel(), APP_LIMITS.deviceLabelMax),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function unsubscribeDeviceFromPush(vaultId: string): Promise<void> {
  setPushOptedOut(true);
  setStoredVapidKey(null);
  try {
    const activeSub = await getActiveBrowserPushSubscription();
    if (activeSub) {
      await activeSub.unsubscribe();
    }
  } catch {
    // Ignore browser unsubscribe errors
  }

  const subId = getDeviceSubscriptionId();
  const path = `vaults/${vaultId}/pushSubscriptions/${subId}`;
  try {
    await deleteDoc(doc(db, 'vaults', vaultId, 'pushSubscriptions', subId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

async function postTestPushRequest(
  partnerName: string,
  subscription: PushSubscription
): Promise<{
  ok: boolean;
  expired?: boolean;
  vapidMismatch?: boolean;
  error?: string;
}> {
  const p256dh = arrayBufferToBase64Url(subscription.getKey('p256dh'));
  const auth = arrayBufferToBase64Url(subscription.getKey('auth'));
  if (!subscription.endpoint || !p256dh || !auth) {
    return { ok: false, error: 'Sottoscrizione locale incompleta.' };
  }

  const res = await fetch('/api/push/test', {
    method: 'POST',
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      partnerName,
      subscription: {
        endpoint: subscription.endpoint,
        p256dh,
        auth,
      },
    }),
  });

  if (res.ok) {
    return { ok: true };
  }

  const errJson = (await res.json().catch(() => ({}))) as {
    expired?: boolean;
    vapidMismatch?: boolean;
    error?: string;
  };
  return {
    ok: false,
    expired: errJson.expired,
    vapidMismatch: errJson.vapidMismatch,
    error: errJson.error || 'Invio notifica Push dal server non riuscito.',
  };
}

export async function sendTestPush(
  vaultId: string,
  partnerName: string,
  partnerKey: PartnerKey,
  prefs: NotificationPreferences
): Promise<{ ok: boolean; message: string; recovered?: boolean }> {
  let activeSub = await getActiveBrowserPushSubscription();
  if (!activeSub) {
    const resub = await subscribeDeviceToPush(vaultId, partnerKey, prefs);
    if (!resub.ok) {
      return {
        ok: false,
        message: resub.error || 'Attiva prima le notifiche Push su questo dispositivo.',
      };
    }
    activeSub = await getActiveBrowserPushSubscription();
    if (!activeSub) {
      return {
        ok: false,
        message: 'Attiva prima le notifiche Push su questo dispositivo.',
      };
    }
  }

  try {
    const firstAttempt = await postTestPushRequest(partnerName, activeSub);
    if (firstAttempt.ok) {
      return {
        ok: true,
        message:
          'Notifica di prova inviata! Se non compare, verifica che Full immersion / Non disturbare sia disattivato.',
      };
    }

    if (firstAttempt.expired || firstAttempt.vapidMismatch) {
      // Stale/mismatched VAPID subscription: renew automatically and retry once
      await activeSub.unsubscribe().catch(() => {});
      const renewed = await subscribeDeviceToPush(vaultId, partnerKey, prefs);
      if (renewed.ok) {
        const freshSub = await getActiveBrowserPushSubscription();
        if (freshSub) {
          const retryAttempt = await postTestPushRequest(partnerName, freshSub);
          if (retryAttempt.ok) {
            return {
              ok: true,
              recovered: true,
              message:
                'Sottoscrizione aggiornata e notifica di prova inviata! Dovresti vederla tra un istante.',
            };
          }
          return {
            ok: false,
            message:
              retryAttempt.error ||
              'Invio notifica Push non riuscito dopo il rinnovo.',
          };
        }
      }
      return {
        ok: false,
        message:
          renewed.error ||
          firstAttempt.error ||
          'Sottoscrizione scaduta: disattiva e riattiva le notifiche Push.',
      };
    }

    return {
      ok: false,
      message: firstAttempt.error || 'Invio notifica Push non riuscito.',
    };
  } catch {
    return {
      ok: false,
      message: 'Server Push non raggiungibile: controlla la connessione e riprova.',
    };
  }
}

function shouldPushToSubscription(
  sub: PushSubscriptionRecord,
  type: NotificationType,
  actorKey: NotificationActorKey,
  targetPartnerKey: NotificationTargetKey
): boolean {
  if (targetPartnerKey !== 'all' && sub.partnerKey !== targetPartnerKey) {
    return false;
  }
  if (actorKey !== 'system' && sub.partnerKey === actorKey) {
    return false;
  }

  switch (type) {
    case 'deposit':
      return sub.notifyDeposits;
    case 'reaction':
      return sub.notifyReactions;
    case 'milestone':
      return sub.notifyMilestones;
    case 'love_note':
      return sub.notifyLoveNote;
    default:
      return true;
  }
}

export interface CreateActivityNotificationInput {
  type: NotificationType;
  actorKey: NotificationActorKey;
  actorName: string;
  targetPartnerKey: NotificationTargetKey;
  title: string;
  body: string;
  amount?: number;
  contributionId?: string;
  reactionEmoji?: string;
}

export async function dispatchActivityNotification(
  vaultId: string,
  input: CreateActivityNotificationInput,
  pushSubscriptions: PushSubscriptionRecord[]
): Promise<string | null> {
  const notifId = makeId('notif');
  const path = `vaults/${vaultId}/notifications/${notifId}`;
  const title = clampString(input.title, APP_LIMITS.notificationTitleMax) || 'SALVAFRICA';
  const body =
    clampString(input.body, APP_LIMITS.notificationBodyMax) ||
    'Nuovo aggiornamento sul salvadanaio.';

  const payload: Record<string, unknown> = {
    id: notifId,
    type: input.type,
    actorKey: input.actorKey,
    actorName: clampString(input.actorName, APP_LIMITS.partnerNameMax) || 'Partner',
    targetPartnerKey: input.targetPartnerKey,
    title,
    body,
    readByA: input.actorKey === 'A',
    readByB: input.actorKey === 'B',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  if (typeof input.amount === 'number' && input.amount > 0) {
    payload.amount = Math.min(100000, Math.round(input.amount * 100) / 100);
  }
  if (input.contributionId) {
    payload.contributionId = input.contributionId;
  }
  if (input.reactionEmoji) {
    payload.reactionEmoji = clampString(input.reactionEmoji, 16);
  }

  try {
    await setDoc(doc(db, 'vaults', vaultId, 'notifications', notifId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, path);
    return null;
  }

  // Trigger Web Push in background for eligible partner devices (deduplicated by endpoint)
  const currentSubId = getDeviceSubscriptionId();
  const seenEndpoints = new Set<string>();
  const targetSubs = pushSubscriptions.filter((sub) => {
    if (
      sub.id === currentSubId ||
      !shouldPushToSubscription(
        sub,
        input.type,
        input.actorKey,
        input.targetPartnerKey
      )
    ) {
      return false;
    }
    if (seenEndpoints.has(sub.endpoint)) return false;
    seenEndpoints.add(sub.endpoint);
    return true;
  });

  if (targetSubs.length > 0) {
    const targetUrl =
      input.type === 'deposit' || input.type === 'reaction'
        ? '/?tab=feed'
        : '/?tab=home';

    fetch('/api/push/send', {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        subscriptions: targetSubs.map((s) => ({
          id: s.id,
          endpoint: s.endpoint,
          p256dh: s.p256dh,
          auth: s.auth,
        })),
        payload: {
          title,
          body,
          tag: notifId,
          url: targetUrl,
        },
      }),
    })
      .then(async (res) => {
        if (!res.ok) return;
        const result = (await res.json()) as { expiredIds?: string[] };
        if (Array.isArray(result.expiredIds) && result.expiredIds.length > 0) {
          await Promise.all(
            result.expiredIds.map((id) =>
              deleteDoc(doc(db, 'vaults', vaultId, 'pushSubscriptions', id)).catch(
                () => {}
              )
            )
          );
        }
      })
      .catch(() => {
        // Non-blocking push delivery failure should never interrupt user flow
      });
  }

  return notifId;
}

export async function markNotificationRead(
  vaultId: string,
  notification: NotificationItem,
  partnerKey: PartnerKey
): Promise<void> {
  const field = partnerKey === 'A' ? 'readByA' : 'readByB';
  if (notification[field]) return;

  const path = `vaults/${vaultId}/notifications/${notification.id}`;
  try {
    await updateDoc(doc(db, 'vaults', vaultId, 'notifications', notification.id), {
      [field]: true,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function markAllNotificationsRead(
  vaultId: string,
  notifications: NotificationItem[],
  partnerKey: PartnerKey
): Promise<void> {
  const field = partnerKey === 'A' ? 'readByA' : 'readByB';
  const unread = notifications.filter((n) => !n[field]);
  if (unread.length === 0) return;

  const path = `vaults/${vaultId}/notifications`;
  try {
    for (let i = 0; i < unread.length; i += 400) {
      const batch = writeBatch(db);
      for (const item of unread.slice(i, i + 400)) {
        batch.update(doc(db, 'vaults', vaultId, 'notifications', item.id), {
          [field]: true,
          updatedAt: serverTimestamp(),
        });
      }
      await batch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, path);
  }
}

export async function deleteNotificationItem(
  vaultId: string,
  notificationId: string
): Promise<void> {
  const path = `vaults/${vaultId}/notifications/${notificationId}`;
  try {
    await deleteDoc(doc(db, 'vaults', vaultId, 'notifications', notificationId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, path);
  }
}

export async function showLocalNotificationIfHidden(
  title: string,
  body: string,
  tag: string,
  url: string
): Promise<void> {
  if (typeof document === 'undefined' || document.visibilityState === 'visible') {
    return;
  }
  if (
    typeof window === 'undefined' ||
    !('Notification' in window) ||
    window.Notification.permission !== 'granted' ||
    !('serviceWorker' in navigator)
  ) {
    return;
  }

  try {
    const registration = await navigator.serviceWorker.ready;
    await registration.showNotification(title, {
      body,
      icon: '/pwa-192x192.png',
      badge: '/pwa-192x192.png',
      tag,
      data: { url },
    });
  } catch {
    // Ignore local notification failure
  }
}

export function isNotificationForPartner(
  item: NotificationItem,
  partnerKey: PartnerKey
): boolean {
  if (item.targetPartnerKey === partnerKey) return true;
  if (item.targetPartnerKey === 'all') {
    return item.actorKey !== partnerKey;
  }
  return false;
}

export function isNotificationUnread(
  item: NotificationItem,
  partnerKey: PartnerKey
): boolean {
  return partnerKey === 'A' ? !item.readByA : !item.readByB;
}

export function doesNotificationMatchPrefs(
  item: NotificationItem,
  prefs: NotificationPreferences
): boolean {
  switch (item.type) {
    case 'deposit':
      return prefs.notifyDeposits;
    case 'reaction':
      return prefs.notifyReactions;
    case 'milestone':
      return prefs.notifyMilestones;
    case 'love_note':
      return prefs.notifyLoveNote;
    default:
      return true;
  }
}
