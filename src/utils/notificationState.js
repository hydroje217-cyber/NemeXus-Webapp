const READ_KEYS_PREFIX = 'nemexus.notificationReadKeys.v1';
const DISMISSED_KEYS_PREFIX = 'nemexus.notificationDismissedKeys.v1';
const UNREAD_COUNT_PREFIX = 'nemexus.notificationUnreadCount.v1';

function getUserStorageSuffix(profile) {
  return String(profile?.id || profile?.email || 'office-user').replace(/[^a-zA-Z0-9_.:-]/g, '_');
}

export function getNotificationReadStorageKey(profile) {
  return `${READ_KEYS_PREFIX}.${getUserStorageSuffix(profile)}`;
}

export function getNotificationUnreadCountStorageKey(profile) {
  return `${UNREAD_COUNT_PREFIX}.${getUserStorageSuffix(profile)}`;
}

export function getNotificationDismissedStorageKey(profile) {
  return `${DISMISSED_KEYS_PREFIX}.${getUserStorageSuffix(profile)}`;
}

function readStorageValue(key) {
  if (typeof window === 'undefined' || !window.localStorage) {
    return null;
  }

  return window.localStorage.getItem(key);
}

function writeStorageValue(key, value) {
  if (typeof window === 'undefined' || !window.localStorage) {
    return;
  }

  window.localStorage.setItem(key, value);
}

export function loadNotificationReadKeys(profile) {
  try {
    const rawValue = readStorageValue(getNotificationReadStorageKey(profile));
    const parsed = rawValue ? JSON.parse(rawValue) : {};
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function saveNotificationReadKeys(profile, readKeys) {
  try {
    writeStorageValue(getNotificationReadStorageKey(profile), JSON.stringify(readKeys || {}));
  } catch {
    // Notification read state is a convenience cache; ignore storage failures.
  }
}

export function loadNotificationDismissedKeys(profile) {
  try {
    const rawValue = readStorageValue(getNotificationDismissedStorageKey(profile));
    const parsed = rawValue ? JSON.parse(rawValue) : {};
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

export function saveNotificationDismissedKeys(profile, dismissedKeys) {
  try {
    writeStorageValue(getNotificationDismissedStorageKey(profile), JSON.stringify(dismissedKeys || {}));
  } catch {
    // Notification dismissed state is a convenience cache; ignore storage failures.
  }
}

export function saveNotificationUnreadCount(profile, unreadCount) {
  try {
    writeStorageValue(getNotificationUnreadCountStorageKey(profile), String(Math.max(0, Number(unreadCount) || 0)));
  } catch {
    // Notification read state is a convenience cache; ignore storage failures.
  }
}
