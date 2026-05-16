import { describe, expect, it } from 'vitest';
import {
  COURSES,
  getCourse,
  getLiveCourses,
  getCourseHref,
  getCourseStartHref,
} from '@/app/courses-data';

describe('courses-data SSOT', () => {
  it('exposes a non-empty COURSES catalog with required fields', () => {
    expect(Array.isArray(COURSES)).toBe(true);
    expect(COURSES.length).toBeGreaterThan(0);

    for (const course of COURSES) {
      expect(typeof course.slug).toBe('string');
      expect(course.slug.length).toBeGreaterThan(0);
      expect(typeof course.title).toBe('string');
      expect(typeof course.subtitle).toBe('string');
      expect(typeof course.description).toBe('string');
      expect(['live', 'draft', 'planned']).toContain(course.status);
      expect(typeof course.tag).toBe('string');
      expect(typeof course.startChapterSlug).toBe('string');
      expect(Array.isArray(course.chapters)).toBe(true);
      expect(course.chapters).toContain(course.startChapterSlug);
    }
  });

  it('contains the hi-agent flagship course as a live entry', () => {
    const hiAgent = getCourse('hi-agent');
    expect(hiAgent).toBeDefined();
    expect(hiAgent?.status).toBe('live');
    expect(hiAgent?.startChapterSlug).toBe('chat');
  });

  it('keeps every course slug unique', () => {
    const slugs = COURSES.map((c) => c.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it('getLiveCourses returns only live entries', () => {
    const live = getLiveCourses();
    expect(live.length).toBeGreaterThan(0);
    for (const course of live) {
      expect(course.status).toBe('live');
    }
  });

  it('getCourse returns undefined for unknown slugs', () => {
    expect(getCourse('not-a-real-course')).toBeUndefined();
  });

  it('builds course hrefs under the /courses namespace', () => {
    const hiAgent = getCourse('hi-agent');
    expect(hiAgent).toBeDefined();
    if (!hiAgent) return;

    expect(getCourseHref(hiAgent)).toBe('/courses/hi-agent');
    expect(getCourseStartHref(hiAgent)).toBe('/courses/hi-agent/chat');
  });
});
