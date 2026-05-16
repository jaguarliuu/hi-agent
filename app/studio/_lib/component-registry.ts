/**
 * Studio 组件注册表。
 *
 * 每个条目描述一个可被插入到当前 mdx 光标处的"片段模板"：
 *   - `id`：唯一稳定 ID（持久化到 UI 偏好用）
 *   - `category`：UI 分组
 *   - `label` / `description`：面板上展示
 *   - `imports`：需要确保出现在文件顶部的 import 语句（去重合并由调用方负责，
 *                v1 默认就插到光标处，由用户自行调整）
 *   - `fields`：插入对话框里要让用户填写的字段（v1 简化为 string / textarea / select）
 *   - `template(values)`：给一组字段值，返回最终要插入到编辑器光标处的代码片段
 *
 * 参考 hi-agent 课程中的真实用法（Callout / Cards / DocLink / ZoomableImage 等）。
 */

export type FieldType = 'string' | 'textarea' | 'select'

export interface RegistryField {
  name: string
  label: string
  type: FieldType
  /** 选项；仅 type=select 时用 */
  options?: { value: string; label: string }[]
  placeholder?: string
  default?: string
  required?: boolean
  /** textarea 行数 */
  rows?: number
}

export interface RegistryItem {
  id: string
  category: string
  label: string
  description: string
  /** mdx 顶部需要的 import 行；空数组表示无需 import */
  imports: string[]
  fields: RegistryField[]
  template: (values: Record<string, string>) => string
}

const NEXTRA_CALLOUT_IMPORT =
  "import { Callout } from 'nextra/components'"
const NEXTRA_CARDS_IMPORT = "import { Callout, Cards } from 'nextra/components'"

/**
 * Markdown / 原生组件 —— 这些不需要任何 import。
 */
const MARKDOWN_ITEMS: RegistryItem[] = [
  {
    id: 'md-heading-2',
    category: 'Markdown',
    label: 'H2 标题',
    description: '二级标题，用于章节切分',
    imports: [],
    fields: [
      { name: 'text', label: '标题', type: 'string', required: true, default: '小节标题' }
    ],
    template: ({ text }) => `## ${text}\n\n`
  },
  {
    id: 'md-heading-3',
    category: 'Markdown',
    label: 'H3 标题',
    description: '三级标题',
    imports: [],
    fields: [
      { name: 'text', label: '标题', type: 'string', required: true, default: '段落标题' }
    ],
    template: ({ text }) => `### ${text}\n\n`
  },
  {
    id: 'md-code',
    category: 'Markdown',
    label: '代码块',
    description: '带语言高亮的 fenced code block',
    imports: [],
    fields: [
      {
        name: 'lang',
        label: '语言',
        type: 'select',
        default: 'ts',
        options: [
          { value: 'ts', label: 'TypeScript' },
          { value: 'tsx', label: 'TSX' },
          { value: 'js', label: 'JavaScript' },
          { value: 'jsx', label: 'JSX' },
          { value: 'python', label: 'Python' },
          { value: 'bash', label: 'Bash / Shell' },
          { value: 'json', label: 'JSON' },
          { value: 'yaml', label: 'YAML' },
          { value: 'mermaid', label: 'Mermaid' },
          { value: '', label: '无' }
        ]
      },
      {
        name: 'filename',
        label: '文件名（可选，将作为 ```ts filename="..." 显示）',
        type: 'string',
        placeholder: 'src/index.ts'
      },
      {
        name: 'code',
        label: '代码',
        type: 'textarea',
        rows: 6,
        default: '// your code'
      }
    ],
    template: ({ lang, filename, code }) => {
      const meta = filename ? ` filename="${filename}"` : ''
      return `\n\`\`\`${lang}${meta}\n${code}\n\`\`\`\n\n`
    }
  },
  {
    id: 'md-table',
    category: 'Markdown',
    label: '表格',
    description: '三列示例表格',
    imports: [],
    fields: [
      { name: 'h1', label: '列 1', type: 'string', default: '字段' },
      { name: 'h2', label: '列 2', type: 'string', default: '类型' },
      { name: 'h3', label: '列 3', type: 'string', default: '说明' }
    ],
    template: ({ h1, h2, h3 }) =>
      `\n| ${h1} | ${h2} | ${h3} |\n| --- | --- | --- |\n|  |  |  |\n|  |  |  |\n\n`
  },
  {
    id: 'md-link',
    category: 'Markdown',
    label: '链接',
    description: 'Markdown 链接',
    imports: [],
    fields: [
      { name: 'text', label: '文本', type: 'string', default: 'OpenAI Docs' },
      { name: 'href', label: 'URL', type: 'string', default: 'https://platform.openai.com' }
    ],
    template: ({ text, href }) => `[${text}](${href})`
  }
]

/**
 * Nextra / Hi-Agent 自定义组件
 */
const COMPONENT_ITEMS: RegistryItem[] = [
  {
    id: 'callout',
    category: 'Callouts',
    label: 'Callout · 信息块',
    description: '高亮提示：info / warning / error / default',
    imports: [NEXTRA_CALLOUT_IMPORT],
    fields: [
      {
        name: 'type',
        label: '类型',
        type: 'select',
        default: 'info',
        options: [
          { value: 'info', label: 'info（蓝色）' },
          { value: 'warning', label: 'warning（黄色）' },
          { value: 'error', label: 'error（红色）' },
          { value: 'default', label: 'default（灰色）' }
        ]
      },
      {
        name: 'body',
        label: '内容（支持 mdx）',
        type: 'textarea',
        rows: 4,
        default: '在这里写要强调的内容。',
        required: true
      }
    ],
    template: ({ type, body }) =>
      `\n<Callout type="${type}">\n${body}\n</Callout>\n\n`
  },
  {
    id: 'cards',
    category: 'Layout',
    label: 'Cards · 卡片网格',
    description: '一组导航卡片（Cards.Card）',
    imports: [NEXTRA_CARDS_IMPORT],
    fields: [
      { name: 'title1', label: '卡片 1 标题', type: 'string', default: '入门' },
      { name: 'href1', label: '卡片 1 链接', type: 'string', default: './01-getting-started' },
      { name: 'title2', label: '卡片 2 标题', type: 'string', default: '核心概念' },
      { name: 'href2', label: '卡片 2 链接', type: 'string', default: './02-core-concepts' },
      { name: 'title3', label: '卡片 3 标题', type: 'string', default: '实战练习' },
      { name: 'href3', label: '卡片 3 链接', type: 'string', default: './03-practice' }
    ],
    template: ({ title1, href1, title2, href2, title3, href3 }) =>
      `\n<Cards>\n  <Cards.Card title="${title1}" href="${href1}" />\n  <Cards.Card title="${title2}" href="${href2}" />\n  <Cards.Card title="${title3}" href="${href3}" />\n</Cards>\n\n`
  },
  {
    id: 'doclink',
    category: 'Links',
    label: 'DocLink · 外部文档链接',
    description: '指向外部文档/论文，带统一样式',
    imports: ["import { DocLink } from '../../../lib/doc-link'"],
    fields: [
      { name: 'text', label: '链接文本', type: 'string', default: 'OpenAI Function Calling' },
      { name: 'href', label: 'URL', type: 'string', default: 'https://platform.openai.com/docs/guides/function-calling' }
    ],
    template: ({ text, href }) => `<DocLink href="${href}">${text}</DocLink>`
  },
  {
    id: 'zoomable-image',
    category: 'Media',
    label: 'ZoomableImage · 可放大图片',
    description: '支持点击放大的图片组件',
    imports: ["import { ZoomableImage } from '../../../lib/zoomable-image'"],
    fields: [
      { name: 'src', label: 'src（支持 /courses/<slug>/<chapter>/images/...）', type: 'string', default: '/courses/hi-agent/chat/images/example.png' },
      { name: 'alt', label: 'alt', type: 'string', default: '示意图' },
      { name: 'width', label: '宽度（可选）', type: 'string', default: '720' }
    ],
    template: ({ src, alt, width }) =>
      `\n<ZoomableImage\n  src="${src}"\n  alt="${alt}"${width ? `\n  width={${width}}` : ''}\n/>\n\n`
  },
  {
    id: 'agent-timeline-interactive',
    category: 'Interactive',
    label: 'AgentTimelineInteractive · 时间轴',
    description: 'Hi-Agent 课程内置的 agent 时间轴交互组件',
    imports: [
      "import { AgentTimelineInteractive } from '../../../lib/agent-timeline-interactive'"
    ],
    fields: [],
    template: () => `\n<AgentTimelineInteractive />\n\n`
  },
  {
    id: 'agent-capability-interactive',
    category: 'Interactive',
    label: 'AgentCapabilityInteractive · 能力雷达',
    description: 'Hi-Agent 课程内置的能力交互组件',
    imports: [
      "import { AgentCapabilityInteractive } from '../../../lib/agent-capability-interactive'"
    ],
    fields: [],
    template: () => `\n<AgentCapabilityInteractive />\n\n`
  },
  {
    id: 'mermaid',
    category: 'Diagrams',
    label: 'Mermaid · 流程图',
    description: '使用 fenced code block 渲染 Mermaid 图',
    imports: [],
    fields: [
      {
        name: 'src',
        label: 'Mermaid 源码',
        type: 'textarea',
        rows: 6,
        default:
          'graph LR\n  User --> Agent\n  Agent --> Tool\n  Tool --> Agent\n  Agent --> User'
      }
    ],
    template: ({ src }) => `\n\`\`\`mermaid\n${src}\n\`\`\`\n\n`
  }
]

export const COMPONENT_REGISTRY: RegistryItem[] = [
  ...MARKDOWN_ITEMS,
  ...COMPONENT_ITEMS
]

export function findComponent(id: string): RegistryItem | undefined {
  return COMPONENT_REGISTRY.find((item) => item.id === id)
}

/** 把 registry 按 category 聚合，用于面板渲染 */
export function groupByCategory(): Array<{
  category: string
  items: RegistryItem[]
}> {
  const map = new Map<string, RegistryItem[]>()
  for (const item of COMPONENT_REGISTRY) {
    const arr = map.get(item.category) ?? []
    arr.push(item)
    map.set(item.category, arr)
  }
  return Array.from(map.entries()).map(([category, items]) => ({ category, items }))
}
