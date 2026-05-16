'use client'

import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import {
  scaffold,
  type CourseNode,
  type ScaffoldInput
} from '../_lib/file-api-client'

interface ScaffoldDialogProps {
  open: boolean
  courses: CourseNode[]
  /** 默认选中的课程 slug（如有当前打开文件，可预填） */
  defaultCourse?: string
  /** 默认选中的章节 slug（subchapter 模式时作为父章节默认值） */
  defaultChapter?: string
  onClose: () => void
  onCreated: (openPath: string) => void
}

const SLUG_RE = /^[a-z0-9][a-z0-9-]*$/

/**
 * 章节脚手架对话框：在选定课程下创建新 chapter 或在已有 chapter 下创建小节。
 *
 * 创建成功后调用 onCreated(openPath) 让 StudioShell 自动打开新文件并刷新文件树。
 */
export function ScaffoldDialog({
  open,
  courses,
  defaultCourse,
  defaultChapter,
  onClose,
  onCreated
}: ScaffoldDialogProps) {
  const [mode, setMode] = useState<'chapter' | 'subchapter'>('chapter')
  const [course, setCourse] = useState(defaultCourse ?? courses[0]?.slug ?? '')
  const [chapter, setChapter] = useState(defaultChapter ?? '')
  const [title, setTitle] = useState('')
  const [subSlug, setSubSlug] = useState('')
  const [subTitle, setSubTitle] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    if (!open) return
    setError(null)
    setSubmitting(false)
    setMode('chapter')
    setCourse(defaultCourse ?? courses[0]?.slug ?? '')
    setChapter(defaultChapter ?? '')
    setTitle('')
    setSubSlug('')
    setSubTitle('')
    // 只在 open 由 false → true 时重置一次。
    // 不把 courses / defaultCourse / defaultChapter 放进依赖：
    // 父组件保存 / 刷新文件树时 courses 引用会变，
    // 不应清空用户正在填写的表单。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const currentCourse = useMemo(
    () => courses.find((c) => c.slug === course),
    [courses, course]
  )

  if (!open || !mounted) return null

  const errors: string[] = []
  if (!SLUG_RE.test(course)) errors.push('选择课程')
  if (mode === 'chapter') {
    if (!SLUG_RE.test(chapter)) errors.push('章节 slug 需为小写字母/数字/-')
    if (!title.trim()) errors.push('章节标题')
  } else {
    if (!chapter) errors.push('选择父章节')
    if (!SLUG_RE.test(subSlug)) errors.push('小节 slug 需为小写字母/数字/-')
    if (!title.trim()) errors.push('小节标题')
  }

  async function submit() {
    setSubmitting(true)
    setError(null)
    try {
      const payload: ScaffoldInput =
        mode === 'chapter'
          ? { mode, course, chapter, title }
          : {
              mode,
              course,
              chapter,
              subSlug,
              subTitle: subTitle.trim() || title,
              title
            }
      const res = await scaffold(payload)
      onCreated(res.openPath)
    } catch (err) {
      setError((err as Error).message)
      setSubmitting(false)
    }
  }

  return createPortal(
    <div className="studio-dialog-overlay" role="dialog" aria-modal="true">
      <div className="studio-dialog">
        <header className="studio-dialog__header">
          <div>
            <h3>新建章节 / 小节</h3>
            <p className="studio-dialog__desc">
              自动生成目录、_meta.js、page.mdx 模板，并写入 courses-data.js。
            </p>
          </div>
          <button type="button" className="studio-dialog__close" onClick={onClose}>
            ✕
          </button>
        </header>

        <div className="studio-dialog__body">
          <label className="studio-dialog__field">
            <span className="studio-dialog__label">类型</span>
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value as typeof mode)}
            >
              <option value="chapter">新建章节（chapter）</option>
              <option value="subchapter">新建小节（subchapter）</option>
            </select>
          </label>

          <label className="studio-dialog__field">
            <span className="studio-dialog__label">课程</span>
            <select value={course} onChange={(e) => setCourse(e.target.value)}>
              {courses.map((c) => (
                <option key={c.slug} value={c.slug}>
                  {c.title} · {c.slug}
                </option>
              ))}
            </select>
          </label>

          {mode === 'chapter' ? (
            <>
              <label className="studio-dialog__field">
                <span className="studio-dialog__label">章节 slug</span>
                <input
                  type="text"
                  placeholder="例如：context-engineering"
                  value={chapter}
                  onChange={(e) => setChapter(e.target.value)}
                />
              </label>
              <label className="studio-dialog__field">
                <span className="studio-dialog__label">章节标题（显示）</span>
                <input
                  type="text"
                  placeholder="例如：Context Engineering"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
            </>
          ) : (
            <>
              <label className="studio-dialog__field">
                <span className="studio-dialog__label">父章节</span>
                <select
                  value={chapter}
                  onChange={(e) => setChapter(e.target.value)}
                >
                  <option value="">— 请选择 —</option>
                  {currentCourse?.chapters.map((ch) => (
                    <option key={ch.slug} value={ch.slug}>
                      {ch.slug}
                    </option>
                  ))}
                </select>
              </label>
              <label className="studio-dialog__field">
                <span className="studio-dialog__label">小节 slug</span>
                <input
                  type="text"
                  placeholder="例如：05-prompt-caching"
                  value={subSlug}
                  onChange={(e) => setSubSlug(e.target.value)}
                />
              </label>
              <label className="studio-dialog__field">
                <span className="studio-dialog__label">小节标题（显示）</span>
                <input
                  type="text"
                  placeholder="例如：Prompt Caching 实战"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </label>
              <label className="studio-dialog__field">
                <span className="studio-dialog__label">_meta.js 中的标签（可选，留空使用上面标题）</span>
                <input
                  type="text"
                  placeholder="例如：1.5 Prompt Caching"
                  value={subTitle}
                  onChange={(e) => setSubTitle(e.target.value)}
                />
              </label>
            </>
          )}

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
