import Link from 'next/link'

export const metadata = {
  title: 'Hi-Agent — 构建会思考的 AI Agent'
}

const modules = [
  {
    index: '01',
    slug: '/docs/chat',
    title: 'Chat',
    desc: '从对话接口出发：消息结构、流式输出、角色与协议，理解 Agent 的最小表达单元。',
    tag: 'Foundations'
  },
  {
    index: '02',
    slug: '/docs/agent-loop',
    title: 'Agent Loop',
    desc: '拆解 Observe → Think → Act 的核心循环，认识一个真正"会思考"的 Agent 是如何运作的。',
    tag: 'Core'
  },
  {
    index: '03',
    slug: '/docs/tool',
    title: 'Tool',
    desc: '工具调用的设计哲学：schema、side-effect、error boundary，以及如何让模型"用好"工具。',
    tag: 'Core'
  },
  {
    index: '04',
    slug: '/docs/context-engineering',
    title: 'Context Engineering',
    desc: '上下文工程：Prompt 是 UI，Context 是整台机器——压缩、路由、注入与召回。',
    tag: 'Advanced'
  },
  {
    index: '05',
    slug: '/docs/memory',
    title: 'Memory',
    desc: 'Working / Episodic / Semantic memory 三层模型，构建可以"记住你"的 Agent。',
    tag: 'Advanced'
  },
  {
    index: '06',
    slug: '/docs/multi-agent',
    title: 'Multi-Agent',
    desc: '从单体到群体：编排模式、通信协议、共识与分工，多 Agent 系统的工程化落地。',
    tag: 'Systems'
  },
  {
    index: '07',
    slug: '/docs/harness',
    title: 'Harness',
    desc: 'Agent Harness 是什么？运行时、沙箱、评测环、可观测性——让 Agent 从 Demo 走向生产。',
    tag: 'Systems'
  }
]

export default function HomePage() {
  return (
    <main>
      <section className="ha-hero">
        <div className="ha-hero-bg" aria-hidden />
        <div className="ha-hero-inner">
          <div className="ha-eyebrow ha-reveal" style={{ '--i': 0 }}>
            <span className="ha-eyebrow-dot" />
            一门关于 Agent 工程的系统课程 · v1.0
          </div>
          <h1 className="ha-title ha-reveal" style={{ '--i': 1 }}>
            像工程师一样，<br />
            构建<em>会思考</em>的 AI Agent
          </h1>
          <p className="ha-subtitle ha-reveal" style={{ '--i': 2 }}>
            从 Chat 协议到 Agent Loop，从 Tool 设计到 Context Engineering，
            再到 Memory、Multi-Agent 与 Harness——
            七个模块，把你从"会调 API"带到"能造 Agent"。
          </p>
          <div className="ha-cta-row ha-reveal" style={{ '--i': 3 }}>
            <Link href="/docs/chat" className="ha-btn ha-btn-primary">
              开始学习 <span aria-hidden className="ha-btn-arrow">→</span>
            </Link>
            <Link href="/docs" className="ha-btn ha-btn-ghost">
              课程大纲
            </Link>
          </div>
        </div>
      </section>

      <div className="ha-meta-row">
        <div className="ha-meta-item ha-reveal" style={{ '--i': 4 }}>
          <span className="ha-meta-label">Modules</span>
          <span className="ha-meta-value">7 大模块</span>
        </div>
        <div className="ha-meta-item ha-reveal" style={{ '--i': 5 }}>
          <span className="ha-meta-label">Format</span>
          <span className="ha-meta-value">文字 + 示例代码</span>
        </div>
        <div className="ha-meta-item ha-reveal" style={{ '--i': 6 }}>
          <span className="ha-meta-label">Level</span>
          <span className="ha-meta-value">中级 → 进阶</span>
        </div>
        <div className="ha-meta-item ha-reveal" style={{ '--i': 7 }}>
          <span className="ha-meta-label">Updated</span>
          <span className="ha-meta-value">2026 · 持续更新</span>
        </div>
      </div>

      <section className="ha-section">
        <div className="ha-section-head">
          <div>
            <h2 className="ha-section-title">课程模块</h2>
            <p className="ha-section-desc" style={{ marginTop: 8 }}>
              每个模块都是一个独立、完整的心智模型。按顺序阅读，或直接跳到你关心的部分。
            </p>
          </div>
          <Link href="/docs/chat" className="ha-btn ha-btn-ghost">
            从第一章开始 <span aria-hidden className="ha-btn-arrow">→</span>
          </Link>
        </div>

        <div className="ha-grid">
          {modules.map((m, i) => (
            <Link
              key={m.slug}
              href={m.slug}
              className="ha-card ha-reveal"
              style={{ '--i': 8 + i }}
            >
              <span className="ha-card-index">M / {m.index}</span>
              <h3 className="ha-card-title">{m.title}</h3>
              <p className="ha-card-desc">{m.desc}</p>
              <span className="ha-card-tag"><span /> {m.tag}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="ha-section" style={{ paddingTop: 24 }}>
        <div className="ha-cta-card">
          <h3 className="ha-cta-title">准备好了吗？</h3>
          <p className="ha-cta-desc">
            从 Chat 这一章开始，一步步构建你自己的 Agent 心智模型。
          </p>
          <Link href="/docs/chat" className="ha-btn ha-btn-primary">
            进入第一章：Chat <span aria-hidden className="ha-btn-arrow">→</span>
          </Link>
        </div>
      </section>
    </main>
  )
}
