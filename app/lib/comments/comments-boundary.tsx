'use client';

import React, { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import { shouldShowComments } from './comments-config';

const LazyComments = dynamic(
  () => import('./comments').then((mod) => mod.Comments),
  { ssr: false }
);

const ROOT_MARGIN = '200px';

export function CommentsBoundary() {
  const pathname = usePathname();
  const enabled = shouldShowComments(pathname);
  const placeholderRef = useRef<HTMLDivElement | null>(null);
  const [shouldMount, setShouldMount] = useState(false);

  useEffect(() => {
    setShouldMount(false);
  }, [pathname]);

  useEffect(() => {
    if (!enabled) return;
    if (typeof IntersectionObserver === 'undefined') {
      setShouldMount(true);
      return;
    }
    const target = placeholderRef.current;
    if (!target) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setShouldMount(true);
            observer.disconnect();
            break;
          }
        }
      },
      { rootMargin: ROOT_MARGIN }
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [enabled, pathname]);

  if (!enabled || !pathname) return null;

  return (
    <div ref={placeholderRef} data-testid="ha-comments-boundary">
      {shouldMount ? <LazyComments pathname={pathname} /> : null}
    </div>
  );
}

export default CommentsBoundary;
