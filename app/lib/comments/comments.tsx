'use client';

import React, { useEffect, useRef, useState, type ComponentType } from 'react';
import {
  COMMENTS_CONFIG,
  isCommentsConfigReady,
  normalizePathname,
  type CommentsConfig
} from './comments-config';
import { useGiscusTheme } from './use-giscus-theme';
import './comments.css';

type GiscusReactProps = {
  id?: string;
  repo: `${string}/${string}`;
  repoId: string;
  category: string;
  categoryId: string;
  mapping: 'pathname' | 'url' | 'title' | 'og:title' | 'specific' | 'number';
  term: string;
  strict: '0' | '1';
  reactionsEnabled: '0' | '1';
  emitMetadata: '0' | '1';
  inputPosition: 'top' | 'bottom';
  theme: string;
  lang: string;
  loading: 'lazy' | 'eager';
};

type GiscusComponent = ComponentType<GiscusReactProps>;

const READY_TIMEOUT_MS = 5000;

export interface CommentsProps {
  pathname: string;
  config?: CommentsConfig;
}

export function Comments({ pathname, config = COMMENTS_CONFIG }: CommentsProps) {
  const theme = useGiscusTheme();
  const [GiscusComp, setGiscusComp] = useState<GiscusComponent | null>(null);
  const [importFailed, setImportFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [timedOut, setTimedOut] = useState(false);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const configReady = isCommentsConfigReady(config);
  const term = normalizePathname(pathname);

  useEffect(() => {
    if (!configReady || config.provider !== 'giscus') return;
    let cancelled = false;
    import('@giscus/react')
      .then((mod) => {
        if (cancelled) return;
        const Comp =
          (mod as unknown as { default?: GiscusComponent }).default ??
          (mod as unknown as { Giscus?: GiscusComponent }).Giscus;
        if (Comp) {
          setGiscusComp(() => Comp);
        } else {
          setImportFailed(true);
        }
      })
      .catch(() => {
        if (!cancelled) setImportFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [configReady, config.provider]);

  useEffect(() => {
    if (!configReady) return;
    if (typeof window === 'undefined') return;

    const handler = (event: MessageEvent) => {
      if (!event.origin.includes('giscus.app')) return;
      const data = event.data as { giscus?: unknown } | null;
      if (data && typeof data === 'object' && 'giscus' in data) {
        setReady(true);
      }
    };
    window.addEventListener('message', handler);

    const timer = window.setTimeout(() => {
      setTimedOut(true);
    }, READY_TIMEOUT_MS);

    return () => {
      window.removeEventListener('message', handler);
      window.clearTimeout(timer);
    };
  }, [configReady]);

  if (!configReady) {
    return (
      <section
        className="ha-comments"
        aria-labelledby="ha-comments-title"
        data-comments-state="config-missing"
      >
        <h2 id="ha-comments-title" className="ha-comments-heading">
          讨论与评论
        </h2>
        <p className="ha-comments-config-warning">
          评论尚未启用：请在 <code>app/lib/comments/comments-config.ts</code> 填入 Giscus 的{' '}
          <code>repoId</code> / <code>categoryId</code>。
        </p>
      </section>
    );
  }

  const giscusOptions = config.giscus!;
  const showFallback = (importFailed || timedOut) && !ready;

  return (
    <section
      className="ha-comments"
      aria-labelledby="ha-comments-title"
      data-comments-state={ready ? 'ready' : 'loading'}
    >
      <h2 id="ha-comments-title" className="ha-comments-heading">
        讨论与评论
      </h2>
      <p className="ha-comments-privacy">
        评论由{' '}
        <a
          href={`https://github.com/${config.repo}/discussions`}
          target="_blank"
          rel="noreferrer noopener"
        >
          GitHub Discussions
        </a>{' '}
        提供。点击下方区域登录评论意味着你同意将评论内容公开发布到本仓库的 Discussions，并遵循{' '}
        <a
          href="https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement"
          target="_blank"
          rel="noreferrer noopener"
        >
          GitHub 隐私政策
        </a>
        。
      </p>
      <div ref={containerRef} className="ha-comments-frame" data-testid="ha-comments-frame">
        {GiscusComp ? (
          <GiscusComp
            id="ha-giscus"
            repo={config.repo}
            repoId={giscusOptions.repoId}
            category={giscusOptions.category}
            categoryId={giscusOptions.categoryId}
            mapping={giscusOptions.mapping}
            term={term}
            strict={giscusOptions.strict}
            reactionsEnabled={giscusOptions.reactionsEnabled}
            emitMetadata={giscusOptions.emitMetadata}
            inputPosition={giscusOptions.inputPosition}
            theme={theme}
            lang={giscusOptions.lang}
            loading={giscusOptions.loading}
          />
        ) : null}
      </div>
      {showFallback ? (
        <p className="ha-comments-fallback" role="status">
          评论加载较慢或被网络拦截。可直接前往{' '}
          <a
            href={`https://github.com/${config.repo}/discussions`}
            target="_blank"
            rel="noreferrer noopener"
          >
            本仓库 Discussions
          </a>{' '}
          留言。
        </p>
      ) : null}
    </section>
  );
}

export default Comments;
