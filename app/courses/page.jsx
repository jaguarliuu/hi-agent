import Link from 'next/link'
import {
  COURSES,
  getCourseHref,
  getCourseStartHref
} from '../courses-data'

export const metadata = {
  title: '全部课程',
  description: 'Hi-Agent 系列课程合集，围绕 AI Agent 工程的系统性讲解。'
}

const STATUS_META = {
  live: { label: '已上线', tone: 'live' },
  draft: { label: '编写中', tone: 'draft' },
  planned: { label: '规划中', tone: 'planned' }
}

const CHAPTER_LABEL = {
  chat: 'Chat · 对话协议',
  'agent-loop': 'Agent Loop · 思考循环',
  tool: 'Tool · 工具调用',
  'context-engineering': 'Context Engineering',
  memory: 'Memory · 记忆系统',
  'multi-agent': 'Multi-Agent · 协作',
  harness: 'Harness · 工程化',
  labs: 'Labs · 实验场'
}

const ROADMAP = [
  {
    code: 'RAG',
    title: 'Retrieval-Augmented Agent',
    desc: '把检索、Embedding、向量库放进 Agent 的认知回路，从“答得对”到“查得准”。'
  },
  {
    code: 'MCP',
    title: 'Model Context Protocol',
    desc: '用 MCP 把工具、资源、Prompt 解耦成独立服务，让 Agent 真正"插即用"。'
  },
  {
    code: 'Eval',
    title: 'Agent Evaluation',
    desc: '为 Agent 建立可重复的评测流水线：行为追踪、回归测试、效果回归。'
  }
]

function chapterLabel(slug) {
  return CHAPTER_LABEL[slug] ?? slug
}

export default function CoursesIndexPage() {
  const liveCourses = COURSES.filter((c) => c.status === 'live')
  const totalChapters = liveCourses.reduce(
    (acc, c) => acc + (c.chapters?.length ?? 0),
    0
  )
  const lastUpdated = COURSES.reduce((acc, c) => {
    if (!c.updatedAt) return acc
    return c.updatedAt > acc ? c.updatedAt : acc
  }, '')

  return (
    <main className="ha-courses-page">
      <section className="ha-hero ha-hero--compact">
        <div className="ha-hero-bg" aria-hidden />
        <div className="ha-hero-inner">
          <div className="ha-eyebrow ha-reveal" style={{ '--i': 0 }}>
            <span className="ha-eyebrow-dot" />
            Hi-Agent · 系列课程合集
          </div>
          <h1 className="ha-title ha-title--md ha-reveal" style={{ '--i': 1 }}>
            一份围绕 <em>Agent</em> 工程的<br />
            系统课程地图
          </h1>
          <p className="ha-subtitle ha-reveal" style={{ '--i': 2 }}>
            每一门课都是一个独立、自包含的心智模型。
            按顺序学完整门课，或者直接挑你最关心的那一章——选择权在你。
          </p>

          <ul className="ha-courses-stats ha-reveal" style={{ '--i': 3 }}>
            <li>
              <strong>{liveCourses.length}</strong>
              <span>门课程已上线</span>
            </li>
            <li>
              <strong>{totalChapters}</strong>
              <span>个章节</span>
            </li>
            <li>
              <strong>{ROADMAP.length}</strong>
              <span>个主题筹备中</span>
            </li>
            {lastUpdated ? (
              <li>
                <strong>{lastUpdated}</strong>
                <span>最近更新</span>
              </li>
            ) : null}
          </ul>
        </div>
      </section>

      <section className="ha-section ha-courses-section">
        <div className="ha-section-head">
          <div>
            <span className="ha-section-kicker">已上线课程</span>
            <h2 className="ha-section-title">现在就可以开始</h2>
            <p className="ha-section-desc">
              点击卡片进入课程总览，或直接跳到任意一个模块——所有章节都已经写好。
            </p>
          </div>
        </div>

        <div className="ha-course-list">
          {liveCourses.map((course, i) => {
            const status = STATUS_META[course.status] ?? STATUS_META.planned
            const visibleChapters = course.chapters.slice(0, 6)
            const remainingCount = Math.max(
              0,
              course.chapters.length - visibleChapters.length
            )
            return (
              <article
                key={course.slug}
                className="ha-course-card ha-reveal"
                style={{ '--i': 4 + i }}
                data-course-status={course.status}
              >
                <header className="ha-course-card__head">
                  <div className="ha-course-card__head-left">
                    <span
                      className="ha-course-card__status"
                      data-tone={status.tone}
                    >
                      <span className="ha-course-card__status-dot" />
                      {status.label}
                    </span>
                    <span className="ha-course-card__tag">{course.tag}</span>
                  </div>
                  {course.updatedAt ? (
                    <time
                      className="ha-course-card__date"
                      dateTime={course.updatedAt}
                    >
                      Updated {course.updatedAt}
                    </time>
                  ) : null}
                </header>

                <div className="ha-course-card__body">
                  <h3 className="ha-course-card__title">
                    <Link href={getCourseHref(course)}>
                      {course.title}
                      <span className="ha-course-card__title-sep">·</span>
                      <span className="ha-course-card__subtitle">
                        {course.subtitle}
                      </span>
                    </Link>
                  </h3>
                  <p className="ha-course-card__desc">{course.description}</p>

                  <ul className="ha-course-card__chapters" aria-label="章节预览">
                    {visibleChapters.map((slug, idx) => (
                      <li key={slug}>
                        <Link href={`/courses/${course.slug}/${slug}`}>
                          <span className="ha-course-card__chapter-num">
                            {String(idx + 1).padStart(2, '0')}
                          </span>
                          <span className="ha-course-card__chapter-title">
                            {chapterLabel(slug)}
                          </span>
                          <span aria-hidden className="ha-course-card__chapter-arrow">
                            →
                          </span>
                        </Link>
                      </li>
                    ))}
                    {remainingCount > 0 ? (
                      <li className="ha-course-card__chapters-more">
                        <Link href={getCourseHref(course)}>
                          +{remainingCount} 更多章节
                        </Link>
                      </li>
                    ) : null}
                  </ul>
                </div>

                <footer className="ha-course-card__foot">
                  <Link
                    href={getCourseStartHref(course)}
                    className="ha-btn ha-btn-primary ha-btn-sm"
                  >
                    开始学习
                    <span aria-hidden className="ha-btn-arrow">
                      →
                    </span>
                  </Link>
                  <Link
                    href={getCourseHref(course)}
                    className="ha-btn ha-btn-ghost ha-btn-sm"
                  >
                    课程总览
                  </Link>
                </footer>
              </article>
            )
          })}
        </div>
      </section>

      <section className="ha-section ha-courses-section">
        <div className="ha-section-head">
          <div>
            <span className="ha-section-kicker">即将上线</span>
            <h2 className="ha-section-title">下一批主题</h2>
            <p className="ha-section-desc">
              围绕 Agent 工程的更多主题正在打磨中。
              想看的方向欢迎在 GitHub Issues 留言。
            </p>
          </div>
        </div>

        <div className="ha-roadmap-grid">
          {ROADMAP.map((item, i) => (
            <article
              key={item.code}
              className="ha-roadmap-card ha-reveal"
              style={{ '--i': 4 + liveCourses.length + i }}
              aria-disabled="true"
            >
              <span className="ha-roadmap-card__code">{item.code}</span>
              <h3 className="ha-roadmap-card__title">{item.title}</h3>
              <p className="ha-roadmap-card__desc">{item.desc}</p>
              <span className="ha-roadmap-card__pill">规划中</span>
            </article>
          ))}
        </div>
      </section>

      <section className="ha-section ha-courses-section ha-courses-section--last">
        <div className="ha-cta-card">
          <h3 className="ha-cta-title">想看的主题没在路线图上？</h3>
          <p className="ha-cta-desc">
            欢迎在 GitHub Issues 提交你的想法，或者直接 PR 一份课程提案。
          </p>
          <Link
            href="https://github.com/jaguarliuu/hi-agent/issues"
            className="ha-btn ha-btn-primary"
            target="_blank"
            rel="noopener noreferrer"
          >
            提交想法
            <span aria-hidden className="ha-btn-arrow">
              →
            </span>
          </Link>
        </div>
      </section>
    </main>
  )
}
