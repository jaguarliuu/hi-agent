import type { DiagramSchema } from '../types'
import { parseDiagramSchema } from '../schema'

const rawAgentCapabilitySchema: DiagramSchema = {
  phases: [
    {
      id: 'chat',
      label: 'Chat 对话入口',
      summary: '消息接入、组织与协议路由'
    },
    {
      id: 'context',
      label: '上下文工程',
      summary: '上下文来源、构建与压缩'
    },
    {
      id: 'loop',
      label: 'Agent Loop / 决策循环',
      summary: '推理、规划、反思与修复'
    },
    {
      id: 'tool',
      label: '工具调用',
      summary: 'Function Calling、MCP 与沙箱执行'
    },
    {
      id: 'memory',
      label: '记忆',
      summary: '短期、长期与向量检索'
    },
    {
      id: 'multi-agent',
      label: '多智能体协作',
      summary: '子智能体、协作协议与任务分发'
    },
    {
      id: 'harness',
      label: '运行时保障',
      summary: '安全、可靠性、可观测性与评测'
    }
  ],
  nodes: [
    { id: 'chat-input', title: '消息接入', x: 40, y: 50, tone: 'violet', phase: 'chat' },
    { id: 'chat-organize', title: '消息组织', x: 40, y: 120, tone: 'violet', phase: 'chat' },
    { id: 'chat-route', title: '协议路由', x: 40, y: 190, tone: 'violet', phase: 'chat' },
    { id: 'chat-session', title: '会话管理', x: 40, y: 260, tone: 'violet', phase: 'chat' },

    { id: 'context-source', title: '上下文来源', x: 300, y: 50, tone: 'blue', phase: 'context' },
    { id: 'context-build', title: '上下文构建', x: 300, y: 120, tone: 'blue', phase: 'context' },
    { id: 'context-compress', title: '上下文压缩', x: 300, y: 190, tone: 'blue', phase: 'context' },
    { id: 'context-prompt', title: '提示词工程', x: 300, y: 260, tone: 'blue', phase: 'context' },

    { id: 'tool-fc', title: 'Function Calling', x: 560, y: 50, tone: 'orange', phase: 'tool' },
    { id: 'tool-mcp', title: 'MCP', x: 560, y: 120, tone: 'orange', phase: 'tool' },
    { id: 'tool-sandbox', title: '沙箱执行', x: 560, y: 190, tone: 'orange', phase: 'tool' },
    { id: 'tool-registry', title: '工具注册', x: 560, y: 260, tone: 'orange', phase: 'tool' },

    { id: 'memory-short', title: '短期记忆', x: 40, y: 330, tone: 'cyan', phase: 'memory' },
    { id: 'memory-long', title: '长期记忆', x: 40, y: 400, tone: 'cyan', phase: 'memory' },
    { id: 'memory-vector', title: '向量检索', x: 40, y: 470, tone: 'cyan', phase: 'memory' },
    { id: 'memory-knowledge', title: '知识库', x: 40, y: 540, tone: 'cyan', phase: 'memory' },

    { id: 'loop-reason', title: 'Reasoning Chain', x: 300, y: 330, tone: 'green', phase: 'loop' },
    { id: 'loop-plan', title: 'Plan & Decompose', x: 300, y: 400, tone: 'green', phase: 'loop' },
    { id: 'loop-reflect', title: '反思修复', x: 300, y: 470, tone: 'green', phase: 'loop' },
    { id: 'loop-act', title: '行动决策', x: 300, y: 540, tone: 'green', phase: 'loop' },

    { id: 'multi-sub', title: '子智能体', x: 560, y: 330, tone: 'violet', phase: 'multi-agent' },
    { id: 'multi-protocol', title: '协作协议', x: 560, y: 400, tone: 'violet', phase: 'multi-agent' },
    { id: 'multi-dispatch', title: '任务分发', x: 560, y: 470, tone: 'violet', phase: 'multi-agent' },
    { id: 'multi-role', title: '角色编排', x: 560, y: 540, tone: 'violet', phase: 'multi-agent' },

    { id: 'harness-runtime', title: '运行时保障', x: 820, y: 50, tone: 'navy', phase: 'harness' },
    { id: 'harness-security', title: '安全与权限', x: 820, y: 170, tone: 'navy', phase: 'harness' },
    { id: 'harness-reliability', title: '可靠性保障', x: 820, y: 290, tone: 'navy', phase: 'harness' },
    { id: 'harness-observability', title: '可观测性', x: 820, y: 410, tone: 'navy', phase: 'harness' },
    { id: 'harness-eval', title: '评测与优化', x: 820, y: 530, tone: 'navy', phase: 'harness' }
  ],
  edges: [],
  steps: [
    {
      id: 1,
      phase: 'chat',
      tone: 'violet',
      title: 'Chat 对话入口',
      subtitle: '消息接入与组织',
      detail: '系统的最外层入口，统一处理用户消息的接入、协议解析与会话上下文组织，把自然语言包装成带身份和会话的事件交给后续模块。',
      engineering: '关注多端协议适配、流式输出与会话生命周期管理。'
    },
    {
      id: 2,
      phase: 'context',
      tone: 'blue',
      title: '上下文工程',
      subtitle: '信息装配与压缩',
      detail: '把任务描述、历史消息、工具能力、用户偏好等多源信息整理成模型可消费的上下文，并在长度受限时做选择性压缩与提示词组装。',
      engineering: '关注 token 预算、检索增强与提示词模板的可维护性。'
    },
    {
      id: 3,
      phase: 'loop',
      tone: 'green',
      title: 'Agent Loop / 决策循环',
      subtitle: '推理 · 规划 · 反思',
      detail: 'Agent 的认知中枢，负责理解任务、推理下一步、必要时拆解子目标，并在失败或异常时触发反思和修复，驱动整体闭环。',
      engineering: '关注 ReAct/Plan-and-Execute 等模式的工程实现与终止条件。'
    },
    {
      id: 4,
      phase: 'tool',
      tone: 'orange',
      title: '工具调用',
      subtitle: 'FC · MCP · 沙箱',
      detail: 'Agent 触达外部世界的能力边界，通过 Function Calling、MCP 协议和沙箱执行环境让模型可以查询数据、调用 API、运行代码。',
      engineering: '关注工具描述质量、参数校验与沙箱隔离边界。'
    },
    {
      id: 5,
      phase: 'memory',
      tone: 'cyan',
      title: '记忆',
      subtitle: '短期 · 长期 · 检索',
      detail: '区分对话窗口内的短期记忆与跨会话沉淀的长期记忆，通过向量检索与知识库把历史经验作为可控材料注入当前任务。',
      engineering: '关注遗忘策略、Embedding 模型选型与检索召回率。'
    },
    {
      id: 6,
      phase: 'multi-agent',
      tone: 'violet',
      title: '多智能体协作',
      subtitle: '分工 · 协议 · 编排',
      detail: '复杂任务由一组角色化的子智能体协同完成，通过明确的协作协议进行任务分发、消息交换和结果归并，提升专业度与并行度。',
      engineering: '关注角色职责边界、消息总线与冲突仲裁机制。'
    },
    {
      id: 7,
      phase: 'harness',
      tone: 'navy',
      title: '运行时保障',
      subtitle: '安全 · 可靠 · 可观测',
      detail: '把 Agent 从 Demo 推向生产的工程支撑层，覆盖权限与安全策略、超时与失败恢复、全链路日志与指标，以及离线/在线评测优化。',
      engineering: '关注审计合规、SLO 指标与回归评测体系建设。'
    }
  ]
}

export const agentCapabilitySchema: DiagramSchema = parseDiagramSchema(rawAgentCapabilitySchema)
