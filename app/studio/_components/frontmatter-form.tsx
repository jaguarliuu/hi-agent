'use client'

import { useEffect, useMemo, useState } from 'react'

export interface FrontmatterFormProps {
  /** 当前编辑器中的完整文本 */
  source: string
  /** 应用变更：调用方负责把新的 source 写回编辑器 */
  onApply: (nextSource: string) => void
  disabled?: boolean
}

interface ParsedFrontmatter {
  /** 整段 "---\n...\n---\n"（含末尾换行），不存在时为空字符串 */
  raw: string
  title: string
  description: string
  /** 其它键的原始 yaml 行，按出现顺序保存 */
  extraLines: string[]
}

const FM_RE = /^---\n([\s\S]*?)\n---\n?/

function parseFrontmatter(source: string): ParsedFrontmatter {
  const m = source.match(FM_RE)
  if (!m) return { raw: '', title: '', description: '', extraLines: [] }
  const body = m[1]
  let title = ''
  let description = ''
  const extra: string[] = []
  for (const line of body.split('\n')) {
    const t = line.match(/^title\s*:\s*(.*)$/)
    if (t) {
      title = stripYamlString(t[1])
      continue
    }
    const d = line.match(/^description\s*:\s*(.*)$/)
    if (d) {
      description = stripYamlString(d[1])
      continue
    }
    extra.push(line)
  }
  return { raw: m[0], title, description, extraLines: extra }
}

function stripYamlString(v: string): string {
  const trimmed = v.trim()
  if (
    (trimmed.startsWith('"') && trimmed.endsWith('"')) ||
    (trimmed.startsWith("'") && trimmed.endsWith("'"))
  ) {
    return trimmed.slice(1, -1)
  }
  return trimmed
}

function quoteIfNeeded(s: string): string {
  if (!/[:#&*!|>%@`]/.test(s) && !/^\s|\s$/.test(s)) {
    return s
  }
  return JSON.stringify(s)
}

function buildFrontmatter(
  title: string,
  description: string,
  extraLines: string[]
): string {
  const lines: string[] = ['---']
  if (title) lines.push(`title: ${quoteIfNeeded(title)}`)
  if (description) lines.push(`description: ${quoteIfNeeded(description)}`)
  for (const line of extraLines) {
    if (line.trim().length > 0) lines.push(line)
  }
  lines.push('---', '')
  return lines.join('\n')
}

/**
 * 可视化编辑 mdx 顶部 frontmatter（仅 title/description 两个字段）。
 * 其它已存在键会按行原样保留。
 */
export function FrontmatterForm({
  source,
  onApply,
  disabled
}: FrontmatterFormProps) {
  const parsed = useMemo(() => parseFrontmatter(source), [source])
  const [title, setTitle] = useState(parsed.title)
  const [description, setDescription] = useState(parsed.description)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    setTitle(parsed.title)
    setDescription(parsed.description)
  }, [parsed.title, parsed.description])

  const dirty = title !== parsed.title || description !== parsed.description

  function apply() {
    const fm = buildFrontmatter(title, description, parsed.extraLines)
    const rest = parsed.raw ? source.slice(parsed.raw.length) : source
    onApply(fm + rest)
  }

  return (
    <details
      className="studio-frontmatter"
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary className="studio-frontmatter__summary">
        <span>Frontmatter</span>
        {dirty && <span className="studio-frontmatter__dirty">●</span>}
      </summary>
      <div className="studio-frontmatter__body">
        <label className="studio-frontmatter__field">
          <span>title</span>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            disabled={disabled}
            placeholder="页面标题"
          />
        </label>
        <label className="studio-frontmatter__field">
          <span>description</span>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            disabled={disabled}
            placeholder="一句话简介，用于 SEO / 卡片摘要"
          />
        </label>
        <div className="studio-frontmatter__actions">
          <button
            type="button"
            className="studio-dialog__btn studio-dialog__btn--primary"
            onClick={apply}
            disabled={disabled || !dirty}
          >
            应用到编辑器
          </button>
        </div>
      </div>
    </details>
  )
}
