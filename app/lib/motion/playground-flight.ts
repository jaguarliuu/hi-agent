'use client';

export interface PlaygroundFlightCue {
  sourceId: string;
  targetId: string;
}

let queuedCue: PlaygroundFlightCue | null = null;
let activeClone: HTMLElement | null = null;
let disposeActiveClone: (() => void) | null = null;

const DEFAULT_FLIGHT_TIMEOUT_MS = 420;
const FLIGHT_TIMEOUT_BUFFER_MS = 80;

function escapeAttributeValue(value: string) {
  return value.replaceAll('\\', '\\\\').replaceAll('"', '\\"');
}

function cleanupActiveClone() {
  disposeActiveClone?.();
  disposeActiveClone = null;
  activeClone = null;
}

function parseTransitionTimeMs(value: string) {
  const trimmed = value.trim();

  if (!trimmed) {
    return 0;
  }

  if (trimmed.endsWith('ms')) {
    return Number.parseFloat(trimmed);
  }

  if (trimmed.endsWith('s')) {
    return Number.parseFloat(trimmed) * 1000;
  }

  return 0;
}

function resolveFlightTimeoutMs(element: HTMLElement) {
  const computedStyle = window.getComputedStyle(element);
  const durations = computedStyle.transitionDuration
    .split(',')
    .map(parseTransitionTimeMs)
    .filter((value) => Number.isFinite(value));
  const delays = computedStyle.transitionDelay
    .split(',')
    .map(parseTransitionTimeMs)
    .filter((value) => Number.isFinite(value));

  if (durations.length === 0) {
    return DEFAULT_FLIGHT_TIMEOUT_MS;
  }

  const transitionCount = Math.max(durations.length, delays.length || 1);
  let longestTransitionMs = 0;

  for (let index = 0; index < transitionCount; index += 1) {
    const duration = durations[index % durations.length] ?? 0;
    const delay = delays.length > 0 ? (delays[index % delays.length] ?? 0) : 0;
    longestTransitionMs = Math.max(longestTransitionMs, duration + delay);
  }

  if (longestTransitionMs <= 0) {
    return DEFAULT_FLIGHT_TIMEOUT_MS;
  }

  return longestTransitionMs + FLIGHT_TIMEOUT_BUFFER_MS;
}

export function queuePlaygroundFlight(cue: PlaygroundFlightCue) {
  queuedCue = cue;
}

export function claimPlaygroundFlight(targetId: string | null | undefined) {
  if (!targetId || !queuedCue || queuedCue.targetId !== targetId) {
    return null;
  }

  const cue = queuedCue;
  queuedCue = null;
  return cue;
}

export function clearQueuedPlaygroundFlight() {
  queuedCue = null;
}

export function startPlaygroundFlight(cue: PlaygroundFlightCue) {
  cleanupActiveClone();

  const source = document.querySelector<HTMLElement>(
    `[data-playground-flight-source="${escapeAttributeValue(cue.sourceId)}"]`
  );
  const target = document.querySelector<HTMLElement>(
    `[data-playground-flight-target="${escapeAttributeValue(cue.targetId)}"]`
  );

  if (!source || !target) {
    return null;
  }

  const sourceRect = source.getBoundingClientRect();
  const targetRect = target.getBoundingClientRect();
  const scaleX = targetRect.width > 0 && sourceRect.width > 0
    ? targetRect.width / sourceRect.width
    : 1;
  const scaleY = targetRect.height > 0 && sourceRect.height > 0
    ? targetRect.height / sourceRect.height
    : 1;
  const translateX = targetRect.left - sourceRect.left;
  const translateY = targetRect.top - sourceRect.top;

  const clone = source.cloneNode(true) as HTMLElement;
  clone.setAttribute('data-playground-flight-clone', '');
  clone.setAttribute('aria-hidden', 'true');
  clone.classList.add('ha-playground-flight-clone');
  clone.style.position = 'fixed';
  clone.style.top = `${sourceRect.top}px`;
  clone.style.left = `${sourceRect.left}px`;
  clone.style.width = `${sourceRect.width}px`;
  clone.style.height = `${sourceRect.height}px`;
  clone.style.margin = '0';
  clone.style.pointerEvents = 'none';
  clone.style.transformOrigin = 'top left';
  clone.style.transform = 'translate3d(0, 0, 0) scale(1, 1)';
  clone.style.opacity = '0.92';

  document.body.append(clone);

  let cleaned = false;
  const cleanup = () => {
    if (cleaned) {
      return;
    }

    cleaned = true;
    window.clearTimeout(timeoutId);
    clone.removeEventListener('transitionend', handleTransitionEnd);
    clone.remove();

    if (activeClone === clone) {
      activeClone = null;
      disposeActiveClone = null;
    }
  };

  const handleTransitionEnd = (event: Event) => {
    if (
      event.target === clone &&
      (event as TransitionEvent).propertyName === 'transform'
    ) {
      cleanup();
    }
  };

  const timeoutId = window.setTimeout(cleanup, resolveFlightTimeoutMs(clone));

  clone.addEventListener('transitionend', handleTransitionEnd);
  clone.getBoundingClientRect();
  window.requestAnimationFrame(() => {
    clone.style.transform = `translate3d(${translateX}px, ${translateY}px, 0) scale(${scaleX}, ${scaleY})`;
    clone.style.opacity = '0';
  });

  activeClone = clone;
  disposeActiveClone = cleanup;

  return clone;
}
