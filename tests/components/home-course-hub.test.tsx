import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeAll, describe, expect, it } from 'vitest';
import HomePage from '@/app/page';
import { COURSES } from '@/app/courses-data';

describe('Multi-course HomePage hub', () => {
  beforeAll(() => {
    (globalThis as typeof globalThis & { React?: typeof React }).React = React;
  });

  it('renders a card for every course in the SSOT', () => {
    render(<HomePage />);

    for (const course of COURSES) {
      expect(screen.getByText(course.subtitle)).toBeInTheDocument();
      expect(screen.getByText(course.description)).toBeInTheDocument();
    }
  });

  it('points the primary CTA to the first live course start chapter', () => {
    render(<HomePage />);

    const flagship = COURSES.find((c) => c.status === 'live');
    expect(flagship).toBeDefined();
    if (!flagship) return;

    const expectedHref = `/courses/${flagship.slug}/${flagship.startChapterSlug}`;
    const ctaLinks = screen.getAllByRole('link', { name: /开始学习/ });
    expect(ctaLinks.length).toBeGreaterThan(0);
    expect(ctaLinks[0]).toHaveAttribute('href', expectedHref);
  });

  it('exposes a link to the courses index page', () => {
    render(<HomePage />);

    const allCoursesLink = screen.getByRole('link', { name: '全部课程' });
    expect(allCoursesLink).toHaveAttribute('href', '/courses');
  });

  it('renders live course cards as links and non-live courses as disabled tiles', () => {
    render(<HomePage />);

    for (const course of COURSES) {
      const tile = screen.getByText(course.subtitle).closest('[data-course-status]');
      expect(tile).toBeTruthy();
      expect(tile).toHaveAttribute('data-course-status', course.status);

      if (course.status === 'live') {
        expect(tile?.tagName).toBe('A');
        expect(tile).toHaveAttribute('href', `/courses/${course.slug}`);
      } else {
        expect(tile?.tagName).not.toBe('A');
        expect(tile).toHaveAttribute('aria-disabled', 'true');
      }
    }
  });
});
