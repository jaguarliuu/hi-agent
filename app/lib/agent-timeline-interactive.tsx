'use client'

import React, { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'

type LaneId =
  | 'user'
  | 'chat'
  | 'context'
  | 'loop'
  | 'tool'
  | 'api'
  | 'memory'
  | 'harness'

type PhaseId =
  | 'chat'
  | 'context'
  | 'loop'
  | 'tool'
  | 'observe'
  | 'response'
  | 'harness'

type Tone = 'blue' | 'violet' | 'cyan' | 'orange' | 'green' | 'navy'

type Step = {
  id: number
  from: LaneId
  to: LaneId
  y: number
  phase: PhaseId
  tone: Tone
  title: string
  subtitle: string
  detail: string
  engineering: string
}

const lanes: Array<{
  id: LaneId
  title: string
  subtitle: string
  tone: Tone
}> = [
  { id: 'user', title: '用户', subtitle: '发起需求', tone: 'blue' },
  { id: 'chat', title: 'Chat 层', subtitle: '消息组织', tone: 'violet' },
  { id: 'context', title: 'Context Engineering', subtitle: '上下文工程', tone: 'blue' },
  { id: 'loop', title: 'Agent Loop', subtitle: '智能体循环', tone: 'cyan' },
  { id: 'tool', title: 'Tool', subtitle: '工具调用', tone: 'orange' },
  { id: 'api', title: '第三方 API', subtitle: '天气接口', tone: 'blue' },
  { id: 'memory', title: 'Memory', subtitle: '长期记忆', tone: 'green' },
  { id: 'harness', title: 'Harness', subtitle: '运行时保障', tone: 'navy' }
]

const phases: Array<{ id: PhaseId; label: string; summary: string }> = [
  { id: 'chat', label: '消息接入', summary: '识别用户、会话和目标 Agent' },
  { id: 'context', label: '上下文准备', summary: '整理问题、工具、权限和偏好' },
  { id: 'loop', label: '决策行动', summary: '判断是否需要真实世界动作' },
  { id: 'tool', label: '工具调用', summary: '通过工具访问外部能力' },
  { id: 'observe', label: '结果观察', summary: '把结构化结果交回模型' },
  { id: 'response', label: '生成回复', summary: '组织自然语言并流式输出' },
  { id: 'harness', label: '安全保障', summary: '兜底权限、超时、日志和恢复' }
]

const steps: Step[] = [
  {
    id: 1,
    from: 'user',
    to: 'chat',
    y: 78,
    phase: 'chat',
    tone: 'blue',
    title: '用户提出问题',
    subtitle: '多比，今天西安天气如何？',
    detail: '一句普通提问进入系统，触发一次完整的 Agent 执行链路。',
    engineering: '输入先被当作事件处理，而不是直接丢给模型生成答案。'
  },
  {
    id: 2,
    from: 'chat',
    to: 'context',
    y: 118,
    phase: 'chat',
    tone: 'violet',
    title: 'Chat 层接收消息',
    subtitle: '识别用户 / 会话 / Agent',
    detail: '系统确认消息是谁发来、属于哪个会话，以及应该交给哪个 Agent。',
    engineering: 'Chat 层负责把自然语言包装成带身份、来源和会话上下文的消息。'
  },
  {
    id: 3,
    from: 'context',
    to: 'loop',
    y: 160,
    phase: 'context',
    tone: 'blue',
    title: '构建上下文',
    subtitle: '时间、问题、工具、权限、历史偏好',
    detail: 'Context Engineering 整理模型判断下一步所需的信息。',
    engineering: '真正的 Agent 不靠模型凭经验猜天气，而是把实时性、工具能力和用户偏好一起交给模型判断。'
  },
  {
    id: 4,
    from: 'memory',
    to: 'loop',
    y: 122,
    phase: 'context',
    tone: 'green',
    title: '读取用户偏好',
    subtitle: '长期记忆参与上下文',
    detail: '系统检索用户平时关心的天气维度，例如通勤、孩子上学、空气质量。',
    engineering: 'Memory 让 Agent 理解用户为什么问天气，而不只是回答天气本身。'
  },
  {
    id: 5,
    from: 'memory',
    to: 'loop',
    y: 154,
    phase: 'context',
    tone: 'green',
    title: '返回偏好信息',
    subtitle: '把记忆注入当前任务',
    detail: '偏好信息回到上下文中，成为模型决策的一部分。',
    engineering: '记忆不是替代上下文，而是作为可控材料被装配进当前请求。'
  },
  {
    id: 6,
    from: 'loop',
    to: 'loop',
    y: 212,
    phase: 'loop',
    tone: 'cyan',
    title: '理解任务',
    subtitle: '判断需要实时天气',
    detail: 'Agent Loop 识别天气属于实时信息，不能直接靠模型记忆回答。',
    engineering: 'Agent Loop 的第一步是判断任务性质，而不是急着输出。'
  },
  {
    id: 7,
    from: 'loop',
    to: 'tool',
    y: 256,
    phase: 'loop',
    tone: 'cyan',
    title: '决策：调用天气工具',
    subtitle: '从回答转向行动',
    detail: '模型做出行动决策：需要调用天气查询工具。',
    engineering: '这里是 ChatBot 和 Agent 的关键差异：Agent 会选择动作，并等待外部结果。'
  },
  {
    id: 8,
    from: 'harness',
    to: 'tool',
    y: 294,
    phase: 'harness',
    tone: 'navy',
    title: '权限检查与安全策略',
    subtitle: '超时控制 / 日志记录',
    detail: 'Harness 介入工具调用前后的权限、审计、超时和失败恢复。',
    engineering: '生产级 Agent 不能只会调用工具，还要知道是否允许调用、调用失败怎么处理。'
  },
  {
    id: 9,
    from: 'tool',
    to: 'api',
    y: 322,
    phase: 'tool',
    tone: 'orange',
    title: '调用天气工具',
    subtitle: '获取天气数据',
    detail: 'Tool 层把模型的意图转成可执行的接口请求。',
    engineering: '工具是模型触达外部系统的边界，负责参数、协议和返回结构。'
  },
  {
    id: 10,
    from: 'api',
    to: 'api',
    y: 354,
    phase: 'tool',
    tone: 'orange',
    title: '请求天气数据',
    subtitle: '城市=西安，日期=今天',
    detail: '第三方 API 接收请求并查询真实天气信息。',
    engineering: '实时事实由外部系统提供，模型只负责判断和组织。'
  },
  {
    id: 11,
    from: 'api',
    to: 'tool',
    y: 404,
    phase: 'tool',
    tone: 'orange',
    title: '返回天气数据',
    subtitle: '温度、降水、风力、空气质量',
    detail: '天气 API 返回结构化数据，交回 Tool 层。',
    engineering: '结构化结果比自然语言更适合被模型继续观察和加工。'
  },
  {
    id: 12,
    from: 'tool',
    to: 'loop',
    y: 440,
    phase: 'observe',
    tone: 'orange',
    title: '返回工具结果',
    subtitle: '结构化数据进入观察',
    detail: 'Tool 把接口结果整理后交还给 Agent Loop。',
    engineering: 'Agent Loop 不是一次调用结束，而是拿到观察结果后继续判断。'
  },
  {
    id: 13,
    from: 'loop',
    to: 'context',
    y: 482,
    phase: 'observe',
    tone: 'cyan',
    title: '观察结果',
    subtitle: '组织自然语言回复',
    detail: '模型读取工具结果，并结合上下文组织回答。',
    engineering: '观察阶段把外部事实转成用户能理解的表达。'
  },
  {
    id: 14,
    from: 'context',
    to: 'chat',
    y: 522,
    phase: 'response',
    tone: 'violet',
    title: '生成最终回复',
    subtitle: '流式输出',
    detail: '回复从 Agent 内部回到 Chat 层，准备返回给用户。',
    engineering: 'Chat 层继续承担输出通道、流式展示和会话记录职责。'
  },
  {
    id: 15,
    from: 'chat',
    to: 'user',
    y: 562,
    phase: 'response',
    tone: 'blue',
    title: '用户看到结果',
    subtitle: '天气 + 个性化提醒',
    detail: '最终回答不只是天气数据，还可以加入通勤、穿衣等贴近用户的提醒。',
    engineering: '用户看到的是一句回复，背后是一套模型、工具、记忆和运行时协作。'
  }
]

const laneX: Record<LaneId, number> = lanes.reduce(
  (acc, lane, index) => ({ ...acc, [lane.id]: 70 + index * 142 }),
  {} as Record<LaneId, number>
)

const toneColors: Record<Tone, string> = {
  blue: '#2f6feb',
  violet: '#6f4bd8',
  cyan: '#16a3a5',
  orange: '#f2801c',
  green: '#2f9d67',
  navy: '#2763c4'
}

function clampStep(index: number) {
  return Math.max(0, Math.min(steps.length - 1, index))
}

function isBetween(current: number, step: Step) {
  return step.id <= current + 1
}

function buildLinePath(step: Step) {
  const startX = laneX[step.from]
  const endX = laneX[step.to]
  const y = step.y

  if (step.from === step.to) {
    return `M ${startX - 16} ${y - 24} L ${startX - 16} ${y + 24}`
  }

  return `M ${startX} ${y} L ${endX} ${y}`
}

export function AgentTimelineInteractive() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return

    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', onKey)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [open])

  const modal = open
    ? createPortal(
        <div
          className="ha-agent-timeline-modal"
          role="dialog"
          aria-modal="true"
          aria-label="Agent 交互时序播放器"
          onClick={() => setOpen(false)}
        >
          <div className="ha-agent-timeline-modal__panel" onClick={(event) => event.stopPropagation()}>
            <button
              type="button"
              aria-label="关闭交互时序"
              className="ha-agent-timeline-modal__close"
              onClick={() => setOpen(false)}
            >
              <span aria-hidden>×</span>
            </button>
            <AgentTimelinePlayer />
          </div>
        </div>,
        document.body
      )
    : null

  return (
    <>
      <div className="ha-agent-timeline-entry">
        <section className="ha-agent-timeline-cover" aria-labelledby="ha-agent-timeline-cover-title">
        <div className="ha-agent-timeline-cover__content">
          <p className="ha-agent-timeline-cover__eyebrow">Interactive Sequence</p>
          <h3 id="ha-agent-timeline-cover-title">用户与 OpenClaw Agent 交互时序</h3>
          <p>
            从一句“多比，今天西安天气如何？”开始，展开 Chat、Context、Agent Loop、Tool、
            Memory 与 Harness 的完整协作过程。
          </p>
          <button type="button" aria-label="打开交互时序" onClick={() => setOpen(true)}>
            <span>打开交互时序</span>
            <span aria-hidden>↗</span>
          </button>
        </div>
        <button
          type="button"
          aria-label="打开交互时序预览"
          className="ha-agent-timeline-cover__preview"
          onClick={() => setOpen(true)}
        >
          <span className="ha-agent-timeline-cover__question">多比，今天西安天气如何？</span>
          <span className="ha-agent-timeline-cover__lanes" aria-hidden="true">
            {lanes.map((lane) => (
              <span key={lane.id} data-tone={lane.tone}>
                <strong>{lane.title}</strong>
              </span>
            ))}
          </span>
          <span className="ha-agent-timeline-cover__pulse one" aria-hidden="true" />
          <span className="ha-agent-timeline-cover__pulse two" aria-hidden="true" />
          <span className="ha-agent-timeline-cover__pulse three" aria-hidden="true" />
        </button>
        </section>
      </div>
      {modal}
    </>
  )
}

function AgentTimelinePlayer() {
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(false)
  const current = steps[currentIndex]
  const activePhase = current.phase

  const phaseLookup = useMemo(
    () =>
      phases.reduce(
        (acc, phase) => {
          acc[phase.id] = steps.findIndex((step) => step.phase === phase.id)
          return acc
        },
        {} as Record<PhaseId, number>
      ),
    []
  )

  useEffect(() => {
    if (!isPlaying) return

    const timer = window.setInterval(() => {
      setCurrentIndex((index) => {
        if (index >= steps.length - 1) {
          window.clearInterval(timer)
          setIsPlaying(false)
          return index
        }

        return index + 1
      })
    }, 1400)

    return () => window.clearInterval(timer)
  }, [isPlaying])

  return (
    <section className="ha-agent-timeline" aria-label="Agent 交互时序播放器">
      <div className="ha-agent-timeline__header">
        <div>
          <p className="ha-agent-timeline__eyebrow">OpenClaw Agent Sequence</p>
          <h3>Agent 执行链路</h3>
          <p>以“多比，今天西安天气如何？”为例，逐步观察一次请求如何穿过 Agent 系统。</p>
        </div>
        <div className="ha-agent-timeline__controls" aria-label="时序控制">
          <button
            type="button"
            aria-label="上一步"
            onClick={() => {
              setIsPlaying(false)
              setCurrentIndex((index) => clampStep(index - 1))
            }}
          >
            <span aria-hidden>‹</span>
          </button>
          <button
            type="button"
            aria-label={isPlaying ? '暂停' : '播放'}
            className="is-primary"
            onClick={() => setIsPlaying((playing) => !playing)}
          >
            <span aria-hidden>{isPlaying ? 'Ⅱ' : '▶'}</span>
          </button>
          <button
            type="button"
            aria-label="下一步"
            onClick={() => {
              setIsPlaying(false)
              setCurrentIndex((index) => clampStep(index + 1))
            }}
          >
            <span aria-hidden>›</span>
          </button>
        </div>
      </div>

      <div className="ha-agent-timeline__body">
        <div className="ha-agent-timeline__stage" aria-hidden="true">
          <div className="ha-agent-timeline__lanes">
            {lanes.map((lane) => (
              <div
                key={lane.id}
                className="ha-agent-timeline__lane-card"
                data-tone={lane.tone}
                data-active={lane.id === current.from || lane.id === current.to}
              >
                <span className="ha-agent-timeline__lane-icon" />
                <strong>{lane.title}</strong>
                <small>{lane.subtitle}</small>
              </div>
            ))}
          </div>
          <div className="ha-agent-timeline__canvas">
            <svg viewBox="0 0 1064 620" role="img">
              <defs>
                <marker
                  id="ha-agent-arrow"
                  viewBox="0 0 10 10"
                  refX="8"
                  refY="5"
                  markerWidth="6"
                  markerHeight="6"
                  orient="auto-start-reverse"
                >
                  <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" />
                </marker>
              </defs>
              {lanes.map((lane) => (
                <line
                  key={lane.id}
                  x1={laneX[lane.id]}
                  x2={laneX[lane.id]}
                  y1="20"
                  y2="604"
                  className="ha-agent-timeline__lifeline"
                />
              ))}
              {steps.map((step) => {
                const active = step.id === current.id
                const visited = isBetween(currentIndex, step)
                const x = laneX[step.to]
                const color = toneColors[step.tone]

                return (
                  <g
                    key={step.id}
                    className="ha-agent-timeline__step"
                    data-active={active}
                    data-visited={visited}
                    style={{ color }}
                  >
                    <path
                      d={buildLinePath(step)}
                      markerEnd={step.from === step.to ? undefined : 'url(#ha-agent-arrow)'}
                    />
                    <circle cx={x} cy={step.y} r={active ? 15 : 11} />
                    <text x={x} y={step.y + 4} textAnchor="middle">
                      {step.id}
                    </text>
                    <text
                      x={step.from === step.to ? x + 20 : Math.min(laneX[step.from], laneX[step.to]) + 18}
                      y={step.y - 10}
                      className="ha-agent-timeline__step-label"
                    >
                      {step.title}
                    </text>
                  </g>
                )
              })}
            </svg>
          </div>
        </div>

        <aside className="ha-agent-timeline__inspector" data-tone={current.tone}>
          <div className="ha-agent-timeline__counter">{current.id} / 15</div>
          <h4>{current.title}</h4>
          <p className="ha-agent-timeline__subtitle">{current.subtitle}</p>
          <p>{current.detail}</p>
          <div className="ha-agent-timeline__note">
            <span>工程含义</span>
            <p>{current.engineering}</p>
          </div>
        </aside>
      </div>

      <nav className="ha-agent-timeline__phases" aria-label="核心流程阶段">
        {phases.map((phase) => (
          <button
            key={phase.id}
            type="button"
            aria-label={phase.label}
            data-active={phase.id === activePhase}
            onClick={() => {
              setIsPlaying(false)
              setCurrentIndex(phaseLookup[phase.id])
            }}
          >
            <span>{phase.label}</span>
            <small>{phase.summary}</small>
          </button>
        ))}
      </nav>
    </section>
  )
}
