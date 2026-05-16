'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import { createCourse } from '../_lib/file-api-client'

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/

/**
 * 从课程标题猜测一个合理的 slug：
 *   "Hi-Agent 进阶" → "hi-agent-进阶"（中文保留），但若包含非 ASCII 直接清空
 *   英文 → 小写 + 连字符
 */
function guessSlug(title) {
  if (!title) return ''
  const ascii = title
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-')
  return ascii
}

export function CreateCourseDialog({
  open,
  existingSlugs = [],
  onClose,
  onCreated
}) {
  const [slug, setSlug] = useState('')
  const [slugTouched, setSlugTouched] = useState(false)
  const [title, setTitle] = useState('')
  const [subtitle, setSubtitle] = useState('')
  const [description, setDescription] = useState('')
  const [status, setStatus] = useState('draft')
  const [tag, setTag] = useState('Foundations')
  const [startChapterSlug, setStartChapterSlug] = useState('getting-started')
  const [firstChapterTitle, setFirstChapterTitle] = useState('开始入门')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return
    setSlug('')
    setSlugTouched(false)
    setTitle('')
    setSubtitle('')
    setDescription('')
    setStatus('draft')
    setTag('Foundations')
    setStartChapterSlug('getting-started')
    setFirstChapterTitle('开始入门')
    setError(null)
    setSubmitting(false)
  }, [open])

  // 用户没主动改 slug 时，跟随 title 自动生成
  useEffect(() => {
    if (!slugTouched) setSlug(guessSlug(title))
  }, [title, slugTouched])

  const errors = useMemo(() => {
    const list = []
    if (!title.trim()) list.push('课程标题')
    if (!SLUG_RE.test(slug)) list.push('课程 slug 需为小写字母/数字/-')
    else if (existingSlugs.includes(slug)) list.push('slug 已存在')
    if (!SLUG_RE.test(startChapterSlug)) list.push('首章节 slug')
    if (!firstChapterTitle.trim()) list.push('首章节标题')
    return list
  }, [title, slug, existingSlugs, startChapterSlug, firstChapterTitle])

  if (!open || !mounted) return null

  async function submit() {
    setSubmitting(true)
    setError(null)
    try {
      const result = await createCourse({
        slug,
        title: title.trim(),
        subtitle: subtitle.trim(),
        description: description.trim(),
        status,
        tag: tag.trim() || 'Foundations',
        startChapterSlug,
        firstChapterTitle: firstChapterTitle.trim()
      })
      onCreated(result)
    } catch (err) {
      setError(err.message)
      setSubmitting(false)
    }
  }

  return createPortal(
    <div className="studio-dialog-overlay" role="dialog" aria-modal="true">
      <div className="studio-dialog studio-dialog--wide">
        <header className="studio-dialog__header">
          <div>
            <h3>新建课程</h3>
            <p className="studio-dialog__desc">
              自动生成 <code>app/courses/&lt;slug&gt;</code> 目录、_meta、page.mdx 与首个章节脚手架，
              并向 <code>courses-data.js</code> 注册课程对象。
            </p>
          </div>
          <button
            type="button"
            className="studio-dialog__close"
            onClick={onClose}
            disabled={submitting}
          >
            ✕
          </button>
        </header>

        <div className="studio-dialog__body">
          <label className="studio-dialog__field">
            <span className="studio-dialog__label">课程标题</span>
            <input
              type="text"
              placeholder="例如：Hi-Agent 进阶"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
            />
          </label>

          <label className="studio-dialog__field">
            <span className="studio-dialog__label">课程 slug（URL 路径）</span>
            <input
              type="text"
              placeholder="hi-agent-pro"
              value={slug}
              onChange={(e) => {
                setSlugTouched(true)
                setSlug(e.target.value)
              }}
            />
            <span className="studio-dialog__hint">
              将创建 <code>app/courses/{slug || '<slug>'}/</code>，URL 为
              <code> /courses/{slug || '<slug>'}</code>
            </span>
          </label>

          <label className="studio-dialog__field">
            <span className="studio-dialog__label">副标题</span>
            <input
              type="text"
              placeholder="一句话副标题，例如：构建会思考的 AI Agent"
              value={subtitle}
              onChange={(e) => setSubtitle(e.target.value)}
            />
          </label>

          <label className="studio-dialog__field">
            <span className="studio-dialog__label">课程简介（卡片摘要）</span>
            <textarea
              rows={3}
              placeholder="一段简短描述，会显示在 /courses 索引卡片上"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </label>

          <div className="studio-dialog__row">
            <label className="studio-dialog__field">
              <span className="studio-dialog__label">状态</span>
              <select value={status} onChange={(e) => setStatus(e.target.value)}>
                <option value="draft">draft（默认 · 不在公开索引中突出）</option>
                <option value="live">live（已上线）</option>
                <option value="planned">planned（规划中）</option>
              </select>
            </label>
            <label className="studio-dialog__field">
              <span className="studio-dialog__label">分类标签</span>
              <input
                type="text"
                placeholder="Foundations / Advanced / Workshop"
                value={tag}
                onChange={(e) => setTag(e.target.value)}
              />
            </label>
          </div>

          <div className="studio-dialog__row">
            <label className="studio-dialog__field">
              <span className="studio-dialog__label">首章节 slug</span>
              <input
                type="text"
                placeholder="getting-started"
                value={startChapterSlug}
                onChange={(e) => setStartChapterSlug(e.target.value)}
              />
            </label>
            <label className="studio-dialog__field">
              <span className="studio-dialog__label">首章节标题</span>
              <input
                type="text"
                placeholder="开始入门"
                value={firstChapterTitle}
                onChange={(e) => setFirstChapterTitle(e.target.value)}
              />
            </label>
          </div>

          {error && (
            <div className="studio-dialog__warn" style={{ marginRight: 0 }}>
              {error}
            </div>
          )}
        </div>

        <footer className="studio-dialog__footer">
          {errors.length > 0 && (
            <span className="studio-dialog__warn">
              请完善：{errors.join('、')}
            </span>
          )}
          <button
            type="button"
            className="studio-dialog__btn"
            onClick={onClose}
            disabled={submitting}
          >
            取消
          </button>
          <button
            type="button"
            className="studio-dialog__btn studio-dialog__btn--primary"
            disabled={errors.length > 0 || submitting}
            onClick={submit}
          >
            {submitting ? '创建中…' : '创建并打开'}
          </button>
        </footer>
      </div>
    </div>,
    document.body
  )
}
