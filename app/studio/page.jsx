import { COURSES } from '../courses-data'
import { StudioLandingClient } from './_components/studio-landing-client'

export const metadata = {
  title: 'Studio'
}

export default function StudioLandingPage() {
  // 在 server 端把 COURSES 序列化后交给 client，避免 client bundle 直接引用
  // courses-data.js 整个文件（节省体积）。
  const courses = COURSES.map((c) => ({
    slug: c.slug,
    title: c.title,
    subtitle: c.subtitle,
    status: c.status,
    tag: c.tag,
    chapters: c.chapters
  }))

  return (
    <div className="studio-landing">
      <header className="studio-landing__header">
        <div>
          <span className="studio-landing__eyebrow">Hi-Agent · Studio</span>
          <h1 className="studio-landing__title">课程编辑工作台</h1>
          <p className="studio-landing__desc">
            本地课程内容工作台。选择一门课程进入章节大纲，或新建一个章节开始写作。
          </p>
        </div>
        <span className="studio-landing__pill" title="dev only">
          <span className="studio-landing__pill-dot" />
          dev only
        </span>
      </header>

      <StudioLandingClient courses={courses} />
    </div>
  )
}
