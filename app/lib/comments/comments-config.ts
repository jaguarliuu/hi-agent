import { WEBCONTAINER_PATH_PREFIXES } from '@/app/lib/playground/runtime-headers.js';

export type CommentsProvider = 'giscus' | 'utterances';

export interface GiscusOptions {
  repoId: string;
  category: string;
  categoryId: string;
  mapping: 'pathname' | 'url' | 'title' | 'og:title' | 'specific' | 'number';
  strict: '0' | '1';
  reactionsEnabled: '0' | '1';
  emitMetadata: '0' | '1';
  inputPosition: 'top' | 'bottom';
  lang: string;
  loading: 'lazy' | 'eager';
}

export interface UtterancesOptions {
  issueTerm: 'pathname' | 'url' | 'title' | 'og:title';
  label?: string;
}

export interface CommentsConfig {
  provider: CommentsProvider;
  repo: `${string}/${string}`;
  giscus?: GiscusOptions;
  utterances?: UtterancesOptions;
}

export const COMMENTS_CONFIG: CommentsConfig = {
  provider: 'giscus',
  repo: 'jaguarliuu/hi-agent',
  giscus: {
    repoId: 'R_kgDOSSHp0A',
    category: 'General',
    categoryId: 'DIC_kwDOSSHp0M4C9O8V',
    mapping: 'pathname',
    strict: '0',
    reactionsEnabled: '1',
    emitMetadata: '0',
    inputPosition: 'bottom',
    lang: 'zh-CN',
    loading: 'lazy'
  }
};

export const COMMENTS_PATH_BLOCKLIST: ReadonlySet<string> = new Set<string>([]);

export const COMMENTS_MIN_PATH_SEGMENTS = 4;

export function shouldShowComments(pathname: string | null | undefined): boolean {
  if (!pathname) return false;
  if (pathname.startsWith('/studio')) return false;
  if (pathname.startsWith('/api')) return false;
  if (!pathname.startsWith('/courses/')) return false;

  const normalized = normalizePathname(pathname);
  if (
    WEBCONTAINER_PATH_PREFIXES.some((prefix) =>
      normalized.startsWith(prefix.endsWith('/') ? prefix.slice(0, -1) : prefix)
    )
  ) {
    return false;
  }
  if (COMMENTS_PATH_BLOCKLIST.has(normalized)) return false;

  const segments = normalized.split('/').filter(Boolean);
  return segments.length >= COMMENTS_MIN_PATH_SEGMENTS;
}

export function normalizePathname(input: string | null | undefined): string {
  let p = input || '/';
  const base = process.env.NEXT_PUBLIC_BASE_PATH || '';
  if (base && p.startsWith(base)) {
    p = p.slice(base.length) || '/';
  }
  if (p.length > 1 && p.endsWith('/')) {
    p = p.slice(0, -1);
  }
  return p.toLowerCase();
}

export function isCommentsConfigReady(config: CommentsConfig = COMMENTS_CONFIG): boolean {
  if (config.provider === 'giscus') {
    const g = config.giscus;
    return !!g && !!g.repoId && !!g.categoryId;
  }
  if (config.provider === 'utterances') {
    return !!config.utterances;
  }
  return false;
}
