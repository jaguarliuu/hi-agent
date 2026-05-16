import Link from 'next/link'
import { COURSES } from '../courses-data'

export const metadata = {
  title: 'Studio'
}

export default function StudioLandingPage() {
  return (
    <div className="studio-landing">
      <header className="studio-landing__header">
        <div>
          <span className="studio-landing__eyebrow">Hi-Agent · Studio</span>
          <h1 className="studio-landing__title">课程编辑工作台</h1>
          <p className="studio-landing__desc">
            本地课程内容工作台。选择一门课程进入章节大纲。
          </p>
        </div>
        <span className="studio-landing__pill" title="dev only">
          <span className="studio-landing__pill-dot" />
          dev only
        </span>
      </header>

      <section className="studio-landing__grid">
        {COURSES.map((course) => (
          <Link
            key={course.slug}
            href={`/studio/edit/app/courses/${course.slug}/page.mdx`}
            className="studio-landing__card"
          >
            <div className="studio-landing__card-head">
              <span className="studio-landing__card-tag">{course.tag}</span>
              <span
                className={`studio-landing__card-status studio-landing__card-status--${course.status}`}
              >
                {course.status}
              </span>
            </div>
            <h2 className="studio-landing__card-title">{course.title}</h2>
            <p className="studio-landing__card-subtitle">{course.subtitle}</p>
            <div className="studio-landing__card-meta">
              {course.chapters?.length ?? 0} 个章节
            </div>
          </Link>
        ))}
      </section>
    </div>
  )
}
