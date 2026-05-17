/**
 * 课程目录的单一数据源 (Single Source of Truth)。
 *
 * 当需要新增一门课程时，只需要在这里追加一项 entry，并在
 * `app/courses/<slug>/` 下放置 `_meta.js` + `page.mdx` + 章节目录即可。
 *
 * @typedef {'live' | 'draft' | 'planned'} CourseStatus
 *
 * @typedef {Object} CourseMeta
 * @property {string} slug              URL slug, e.g. 'hi-agent'
 * @property {string} title             显示名，e.g. 'Hi-Agent'
 * @property {string} subtitle          一句话副标题
 * @property {string} description       面向卡片/索引页的简介
 * @property {CourseStatus} status      'live' 已上线 | 'draft' 草稿 | 'planned' 规划中
 * @property {string} tag               分类，如 'Foundations' / 'Advanced'
 * @property {string} startChapterSlug  入口章节，用于 "开始学习" CTA
 * @property {string} updatedAt         最近更新日期 (ISO date)
 * @property {string[]} chapters        章节 slug 顺序
 */

/** @type {CourseMeta[]} */
export const COURSES = [
  {
    slug: 'hi-agent',
    title: 'Hi-Agent',
    subtitle: '构建会思考的 AI Agent',
    description:
      '从 Chat、Agent Loop、Tool、Context Engineering，到 Memory、Multi-Agent、Harness——七个模块，把你从“会调 API”带到“能造 Agent”。',
    status: 'live',
    tag: 'Foundations',
    startChapterSlug: 'chat',
    updatedAt: '2026-05-16',
    chapters: [
      'begin',
      'chat',
      'agent-loop',
      'tool',
      'context-engineering',
      'memory',
      'multi-agent',
      'harness'
    ]
  }
]

export function getCourse(slug) {
  return COURSES.find((c) => c.slug === slug)
}

export function getLiveCourses() {
  return COURSES.filter((c) => c.status === 'live')
}

export function getCourseHref(course) {
  return `/courses/${course.slug}`
}

export function getCourseStartHref(course) {
  return `/courses/${course.slug}/${course.startChapterSlug}`
}
