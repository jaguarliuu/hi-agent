import Link from 'next/link'
import { COURSES, getCourseHref, getCourseStartHref } from './courses-data'

export const metadata = {
  title: 'Hi-Agent — Agent 工程系列课程'
}

const STATUS_LABEL = {
  live: { text: 'Live', tone: 'live' },
  draft: { text: '编写中', tone: 'draft' },
  planned: { text: '敬请期待', tone: 'planned' }
}

export default function HomePage() {
  const liveCourses = COURSES.filter((c) => c.status === 'live')
  const flagship = liveCourses[0] ?? COURSES[0]
  const totalCourses = COURSES.length
  const totalChapters = liveCourses.reduce(
    (acc, c) => acc + (c.chapters?.length ?? 0),
    0
  )
  const lastUpdated = COURSES.reduce((acc, c) => {
    if (!c.updatedAt) return acc
    return c.updatedAt > acc ? c.updatedAt : acc
  }, '')

  return (
    <main>
      <section className="ha-hero">
        <div className="ha-hero-bg" aria-hidden />
        <div className="ha-hero-inner">
          <div className="ha-eyebrow ha-reveal" style={{ '--i': 0 }}>
            <span className="ha-eyebrow-dot" />
            围绕 Agent 工程的系统课程合集 · 持续更新
          </div>
          <h1 className="ha-title ha-reveal" style={{ '--i': 1 }}>
            像工程师一样，<br />
            构建<em>会思考</em>的 AI Agent
          </h1>
          <p className="ha-subtitle ha-reveal" style={{ '--i': 2 }}>
            Hi-Agent 是一个围绕 AI Agent 工程的系列课程合集。
            从对话协议、Agent Loop、Tool 调用、Context Engineering，
            到 Memory、Multi-Agent、Harness——把你从“会调 API”带到“能造 Agent”。
          </p>
          <div className="ha-cta-row ha-reveal" style={{ '--i': 3 }}>
            {flagship ? (
              <Link href={getCourseStartHref(flagship)} className="ha-btn ha-btn-primary">
                开始学习 <span aria-hidden className="ha-btn-arrow">→</span>
              </Link>
            ) : null}
            <Link href="/courses" className="ha-btn ha-btn-ghost">
              全部课程
            </Link>
          </div>
        </div>
      </section>

      <div className="ha-meta-row">
        <div className="ha-meta-item ha-reveal" style={{ '--i': 4 }}>
          <span className="ha-meta-label">Courses</span>
          <span className="ha-meta-value">{totalCourses} 门课程</span>
        </div>
        <div className="ha-meta-item ha-reveal" style={{ '--i': 5 }}>
          <span className="ha-meta-label">Chapters</span>
          <span className="ha-meta-value">{totalChapters} 个章节</span>
        </div>
        <div className="ha-meta-item ha-reveal" style={{ '--i': 6 }}>
          <span className="ha-meta-label">Format</span>
          <span className="ha-meta-value">文字 + 可运行示例</span>
        </div>
        <div className="ha-meta-item ha-reveal" style={{ '--i': 7 }}>
          <span className="ha-meta-label">Updated</span>
          <span className="ha-meta-value">{lastUpdated || '持续更新'}</span>
        </div>
      </div>

      <section className="ha-section">
        <div className="ha-section-head">
          <div>
            <h2 className="ha-section-title">课程合集</h2>
            <p className="ha-section-desc" style={{ marginTop: 8 }}>
              每一门课都是一个独立、自包含的心智模型。按顺序学习，或直接跳到你最关心的主题。
            </p>
          </div>
          {flagship ? (
            <Link href={getCourseStartHref(flagship)} className="ha-btn ha-btn-ghost">
              从 {flagship.title} 开始 <span aria-hidden className="ha-btn-arrow">→</span>
            </Link>
          ) : null}
        </div>

        <div className="ha-grid">
          {COURSES.map((course, i) => {
            const status = STATUS_LABEL[course.status] ?? STATUS_LABEL.planned
            const isLive = course.status === 'live'
            const href = isLive ? getCourseHref(course) : undefined
            const cardProps = {
              key: course.slug,
              className: `ha-card ha-reveal${isLive ? '' : ' ha-card-disabled'}`,
              style: { '--i': 8 + i },
              'data-course-status': course.status
            }
            const cardBody = (
              <>
                <span className="ha-card-index">{course.title}</span>
                <h3 className="ha-card-title">{course.subtitle}</h3>
                <p className="ha-card-desc">{course.description}</p>
                <span className="ha-card-tag">
                  <span /> {course.tag} · {status.text}
                </span>
              </>
            )

            return isLive ? (
              <Link href={href} {...cardProps}>
                {cardBody}
              </Link>
            ) : (
              <div {...cardProps} aria-disabled="true">
                {cardBody}
              </div>
            )
          })}
        </div>
      </section>

      {flagship ? (
        <section className="ha-section" style={{ paddingTop: 24 }}>
          <div className="ha-cta-card">
            <h3 className="ha-cta-title">准备好了吗？</h3>
            <p className="ha-cta-desc">
              从 {flagship.title} 开始，一步步构建你自己的 Agent 心智模型。
            </p>
            <Link href={getCourseStartHref(flagship)} className="ha-btn ha-btn-primary">
              进入 {flagship.title} <span aria-hidden className="ha-btn-arrow">→</span>
            </Link>
          </div>
        </section>
      ) : null}
    </main>
  )
}
