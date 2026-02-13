import { useEffect, useRef } from 'react';

type ScrollSnapshot = {
  scrollY: number;
  hideBottomNav: string | null;
  bodyOverflow: string;
  bodyPosition: string;
  bodyTop: string;
  bodyLeft: string;
  bodyRight: string;
  bodyWidth: string;
  htmlOverflow: string;
};

const activeLockOwners = new Set<string>();
let snapshot: ScrollSnapshot | null = null;

function canUseDom(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

function captureSnapshot(): ScrollSnapshot {
  const body = document.body;
  const html = document.documentElement;
  return {
    scrollY: window.scrollY,
    hideBottomNav: body.getAttribute('data-hide-bottom-nav'),
    bodyOverflow: body.style.overflow,
    bodyPosition: body.style.position,
    bodyTop: body.style.top,
    bodyLeft: body.style.left,
    bodyRight: body.style.right,
    bodyWidth: body.style.width,
    htmlOverflow: html.style.overflow,
  };
}

function applyLockedStyles(nextSnapshot: ScrollSnapshot): void {
  const body = document.body;
  const html = document.documentElement;

  body.style.overflow = 'hidden';
  body.style.position = 'fixed';
  body.style.top = `-${nextSnapshot.scrollY}px`;
  body.style.left = '0';
  body.style.right = '0';
  body.style.width = '100%';
  html.style.overflow = 'hidden';

  body.setAttribute('data-scroll-lock-active', 'true');
  body.setAttribute('data-hide-bottom-nav', 'true');
}

function restoreFromSnapshot(current: ScrollSnapshot): void {
  const body = document.body;
  const html = document.documentElement;

  body.style.overflow = current.bodyOverflow;
  body.style.position = current.bodyPosition;
  body.style.top = current.bodyTop;
  body.style.left = current.bodyLeft;
  body.style.right = current.bodyRight;
  body.style.width = current.bodyWidth;
  html.style.overflow = current.htmlOverflow;

  body.removeAttribute('data-scroll-lock-active');
  if (current.hideBottomNav == null) {
    body.removeAttribute('data-hide-bottom-nav');
  } else {
    body.setAttribute('data-hide-bottom-nav', current.hideBottomNav);
  }

  window.scrollTo(0, current.scrollY);
}

function clearLockedStylesWithoutSnapshot(): void {
  const body = document.body;
  const html = document.documentElement;
  const hadScrollLockMarker = body.getAttribute('data-scroll-lock-active') === 'true';

  body.style.overflow = '';
  body.style.position = '';
  body.style.top = '';
  body.style.left = '';
  body.style.right = '';
  body.style.width = '';
  html.style.overflow = '';

  body.removeAttribute('data-scroll-lock-active');
  if (hadScrollLockMarker && body.getAttribute('data-hide-bottom-nav') === 'true') {
    body.removeAttribute('data-hide-bottom-nav');
  }
}

function hasLockedScrollStyles(): boolean {
  const body = document.body;
  const html = document.documentElement;
  return (
    body.style.position === 'fixed' ||
    body.style.overflow === 'hidden' ||
    html.style.overflow === 'hidden' ||
    body.getAttribute('data-scroll-lock-active') === 'true'
  );
}

function restoreLockIfIdle(): void {
  if (!canUseDom()) return;
  if (activeLockOwners.size > 0) return;

  if (snapshot) {
    const currentSnapshot = snapshot;
    snapshot = null;
    restoreFromSnapshot(currentSnapshot);
    return;
  }

  if (hasLockedScrollStyles()) {
    clearLockedStylesWithoutSnapshot();
  }
}

function createOwnerId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

export function lockBodyScroll(ownerId: string): void {
  if (!canUseDom()) return;

  if (activeLockOwners.has(ownerId)) {
    return;
  }

  activeLockOwners.add(ownerId);

  if (activeLockOwners.size === 1) {
    snapshot = captureSnapshot();
    applyLockedStyles(snapshot);
  }
}

export function unlockBodyScroll(ownerId: string): void {
  if (!canUseDom()) return;

  if (!activeLockOwners.delete(ownerId)) {
    return;
  }

  if (activeLockOwners.size === 0) {
    restoreLockIfIdle();
  }
}

export function hasActiveBodyScrollLocks(): boolean {
  return activeLockOwners.size > 0;
}

export function restoreLeakedBodyScrollLock(): void {
  restoreLockIfIdle();
}

export function useBodyScrollLock(locked: boolean, ownerPrefix = 'scroll-lock'): void {
  const ownerIdRef = useRef<string>(createOwnerId(ownerPrefix));

  useEffect(() => {
    const ownerId = ownerIdRef.current;
    if (locked) {
      lockBodyScroll(ownerId);
      return () => {
        unlockBodyScroll(ownerId);
      };
    }

    unlockBodyScroll(ownerId);
    return undefined;
  }, [locked]);

  useEffect(() => {
    const ownerId = ownerIdRef.current;
    return () => {
      unlockBodyScroll(ownerId);
    };
  }, []);
}
