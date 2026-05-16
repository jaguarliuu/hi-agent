'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useTheme } from 'next-themes'
import {
  fetchTree,
  fetchFile,
  saveFile,
  uploadImage,
  type CourseNode
} from '../_lib/file-api-client'
import { MdxEditor, type MdxEditorHandle } from './mdx-editor'
import { TreeSidebar } from './tree-sidebar'
import { LivePreview } from './live-preview'
import { ComponentPalette } from './component-palette'
import { InsertDialog } from './insert-dialog'
import { ScaffoldDialog } from './scaffold-dialog'
import { FrontmatterForm } from './frontmatter-form'
import { StudioThemeToggle } from './studio-theme-toggle'
import type { RegistryItem } from '../_lib/component-registry'

type SaveStatus = 'idle' | 'saving' | 'saved' | 'error' | 'conflict'

interface OpenFileState {
  path: string
  content: string
  mtime: number
  loadedAt: number
}

/**
 * 把缺失的 import 语句注入到文档头部。
 *
 * 策略：
 *   - 若文档以 frontmatter ("---\n...\n---") 开头，跳过 frontmatter 段；
 *   - 把 missing 中尚未出现的整行 import 追加到 frontmatter 之后的第一段空行前；
 *   - 不破坏既有内容；不去重已存在的 import（调用方会先用 includes 过滤）。
 */
function injectImports(content: string, missing: string[]): string {
  if (missing.length === 0) return content
  const fmMatch = content.match(/^---\n[\s\S]*?\n---\n?/)
  const head = fmMatch ? fmMatch[0] : ''
  const rest = fmMatch ? content.slice(head.length) : content
  const block = missing.join('\n') + '\n\n'
  return head + block + rest
}

/**
 * "app/courses/<slug>/<chapter>/.../page.mdx" → { course, chapter }
 * 用于上传图片时反推目标目录。
 */
function parseCourseChapter(
  relPath: string
): { course: string; chapter: string } | null {
  const m = relPath.match(/^app\/courses\/([^/]+)\/([^/]+)/)
  if (!m) return null
  return { course: m[1], chapter: m[2] }
}

/**
 * Studio 主壳：三栏（侧栏 / 中央编辑器 / 右侧组件位）+ 顶部 toolbar。
 *
 * v1 仅实装：左 = 文件树，中 = CodeMirror 编辑器，顶 = 保存 / dirty 提示。
 * 实时预览（s4）、组件面板（s5）、上传（s6）、脚手架（s7）会在后续步骤
 * 接入到这个壳上，所以预先布局好右栏 placeholder 与 toolbar 槽位。
 */
export function StudioShell() {
  const { resolvedTheme } = useTheme()
  const isDark = resolvedTheme === 'dark'
  const [tree, setTree] = useState<CourseNode[]>([])
  const [treeLoading, setTreeLoading] = useState(false)
  const [openFile, setOpenFile] = useState<OpenFileState | null>(null)
  const [editorValue, setEditorValue] = useState('')
  const [dirty, setDirty] = useState(false)
  const [saveStatus, setSaveStatus] = useState<SaveStatus>('idle')
  const [saveMessage, setSaveMessage] = useState<string | null>(null)
  const [previewReloadToken, setPreviewReloadToken] = useState(0)
  const [insertTarget, setInsertTarget] = useState<RegistryItem | null>(null)
  const [scaffoldOpen, setScaffoldOpen] = useState(false)
  const editorHandleRef = useRef<MdxEditorHandle | null>(null)
  const editorValueRef = useRef('')
  editorValueRef.current = editorValue

  const refreshTree = useCallback(async () => {
    setTreeLoading(true)
    try {
      const { courses } = await fetchTree()
      setTree(courses)
    } catch (err) {
      console.error('[studio] fetchTree failed', err)
    } finally {
      setTreeLoading(false)
    }
  }, [])

  useEffect(() => {
    refreshTree()
  }, [refreshTree])

  const openPath = useCallback(
    async (path: string) => {
      if (
        dirty &&
        !window.confirm('当前文件有未保存的更改，确认放弃并切换？')
      ) {
        return
      }
      try {
        const file = await fetchFile(path)
        setOpenFile({
          path,
          content: file.content,
          mtime: file.mtime,
          loadedAt: Date.now()
        })
        setEditorValue(file.content)
        editorHandleRef.current?.setValue(file.content)
        setDirty(false)
        setSaveStatus('idle')
        setSaveMessage(null)
      } catch (err) {
        console.error('[studio] open file failed', err)
        setSaveStatus('error')
        setSaveMessage((err as Error).message)
      }
    },
    [dirty]
  )

  const persist = useCallback(async () => {
    if (!openFile) return
    setSaveStatus('saving')
    setSaveMessage(null)
    try {
      const result = await saveFile({
        path: openFile.path,
        content: editorValueRef.current,
        baseMtime: openFile.mtime
      })
      setOpenFile({
        ...openFile,
        content: editorValueRef.current,
        mtime: result.mtime
      })
      setDirty(false)
      setSaveStatus('saved')
      setSaveMessage('已保存')
      setPreviewReloadToken((n) => n + 1)
      window.setTimeout(() => {
        setSaveStatus((s) => (s === 'saved' ? 'idle' : s))
      }, 1500)
      // 保存后异步刷新文件树（更新 mtime）
      refreshTree()
    } catch (err) {
      const e = err as Error & { status?: number }
      if (e.status === 409) {
        setSaveStatus('conflict')
        setSaveMessage('文件已被外部修改，请手动选择覆盖或刷新')
      } else {
        setSaveStatus('error')
        setSaveMessage(e.message)
      }
    }
  }, [openFile, refreshTree])

  // 强制覆盖：把 baseMtime 设为 0 让服务端跳过乐观锁
  const forceOverwrite = useCallback(async () => {
    if (!openFile) return
    if (!window.confirm('确认覆盖磁盘上较新的版本？此操作不可撤销。')) return
    setSaveStatus('saving')
    try {
      const result = await saveFile({
        path: openFile.path,
        content: editorValueRef.current,
        baseMtime: 0
      })
      setOpenFile({
        ...openFile,
        content: editorValueRef.current,
        mtime: result.mtime
      })
      setDirty(false)
      setSaveStatus('saved')
      setSaveMessage('已覆盖保存')
      setPreviewReloadToken((n) => n + 1)
      refreshTree()
    } catch (err) {
      setSaveStatus('error')
      setSaveMessage((err as Error).message)
    }
  }, [openFile, refreshTree])

  const reloadFromDisk = useCallback(async () => {
    if (!openFile) return
    if (
      dirty &&
      !window.confirm('当前编辑器有未保存的更改，确认放弃并从磁盘重载？')
    ) {
      return
    }
    await openPath(openFile.path)
  }, [openFile, openPath, dirty])

  const handleEditorChange = useCallback(
    (value: string) => {
      setEditorValue(value)
      if (!openFile) return
      setDirty(value !== openFile.content)
      if (saveStatus === 'saved') setSaveStatus('idle')
    },
    [openFile, saveStatus]
  )

  /**
   * 把组件代码片段插入到光标处。如果该组件需要某些 import 但当前文件
   * 顶部还没有，会把缺失的 import 行追加到文档头部（frontmatter 之后），
   * 不影响光标位置。
   */
  const insertSnippet = useCallback(
    (snippet: string, imports: string[]) => {
      const handle = editorHandleRef.current
      if (!handle) return
      // 1. 处理 imports：合并到文档头部
      const current = handle.getValue()
      const missing = imports.filter((line) => !current.includes(line))
      if (missing.length > 0) {
        const next = injectImports(current, missing)
        handle.setValue(next)
      }
      // 2. 在光标处插入片段
      handle.insertAtCursor(snippet)
      setInsertTarget(null)
    },
    []
  )

  /**
   * 接收 MdxEditor 派发的图片 File（来自 paste / drop），
   * 上传到当前章节的 images/ 目录，返回 markdown 可用的公网 URL。
   */
  const handleImageFile = useCallback(
    async (file: File): Promise<string | null> => {
      if (!openFile) return null
      const ctx = parseCourseChapter(openFile.path)
      if (!ctx) {
        console.warn('[studio] cannot infer course/chapter for', openFile.path)
        return null
      }
      try {
        const res = await uploadImage({
          course: ctx.course,
          chapter: ctx.chapter,
          file
        })
        return res.url
      } catch (err) {
        console.error('[studio] upload failed', err)
        setSaveStatus('error')
        setSaveMessage(`上传失败：${(err as Error).message}`)
        return null
      }
    },
    [openFile]
  )

  // 离开页面前提示
  useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!dirty) return
      e.preventDefault()
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [dirty])

  /**
   * scaffold 创建成功后：刷新文件树并打开新文件。
   */
  const handleScaffolded = useCallback(
    async (openPath: string) => {
      setScaffoldOpen(false)
      await refreshTree()
      // 切换到新文件（refreshTree 不会自动 open）
      try {
        const file = await fetchFile(openPath)
        setOpenFile({
          path: openPath,
          content: file.content,
          mtime: file.mtime,
          loadedAt: Date.now()
        })
        setEditorValue(file.content)
        editorHandleRef.current?.setValue(file.content)
        setDirty(false)
        setSaveStatus('saved')
        setSaveMessage('已创建')
        window.setTimeout(() => {
          setSaveStatus((s) => (s === 'saved' ? 'idle' : s))
        }, 1500)
      } catch (err) {
        console.error('[studio] open scaffolded file failed', err)
      }
    },
    [refreshTree]
  )

  /**
   * 把 FrontmatterForm 修改后的整文档写回编辑器，标记 dirty。
   */
  const applyFrontmatter = useCallback(
    (nextSource: string) => {
      const handle = editorHandleRef.current
      if (!handle) return
      handle.setValue(nextSource)
      setEditorValue(nextSource)
      if (openFile) {
        setDirty(nextSource !== openFile.content)
      }
    },
    [openFile]
  )


  return (
    <div className="studio-shell">
      <header className="studio-toolbar">
        <div className="studio-toolbar__left">
          <Link href="/studio" className="studio-toolbar__home">
            ← Studio
          </Link>
          <span className="studio-toolbar__path">
            {openFile?.path ?? <em className="studio-toolbar__placeholder">未选择文件</em>}
          </span>
          {dirty && <span className="studio-toolbar__dirty">●未保存</span>}
          <ComponentPalette
            disabled={!openFile}
            onPick={(item) => setInsertTarget(item)}
          />
          <button
            type="button"
            className="studio-toolbar__new"
            onClick={() => setScaffoldOpen(true)}
            disabled={tree.length === 0}
            title="新建章节或小节"
          >
            ＋ 新建
          </button>
        </div>
        <div className="studio-toolbar__right">
          {saveStatus === 'saving' && (
            <span className="studio-status studio-status--saving">保存中…</span>
          )}
          {saveStatus === 'saved' && (
            <span className="studio-status studio-status--saved">{saveMessage}</span>
          )}
          {saveStatus === 'error' && (
            <span className="studio-status studio-status--error" title={saveMessage ?? ''}>
              错误：{saveMessage}
            </span>
          )}
          {saveStatus === 'conflict' && (
            <span className="studio-status studio-status--conflict">
              冲突 · 文件已被外部修改
              <button type="button" className="studio-status__action" onClick={forceOverwrite}>
                覆盖
              </button>
              <button type="button" className="studio-status__action" onClick={reloadFromDisk}>
                重载
              </button>
            </span>
          )}
          <button
            type="button"
            className="studio-toolbar__save"
            onClick={persist}
            disabled={!openFile || !dirty || saveStatus === 'saving'}
            title="Cmd/Ctrl + S"
          >
            保存
          </button>
          <StudioThemeToggle className="studio-theme-toggle--toolbar" />
        </div>
      </header>

      <div className="studio-body">
        <TreeSidebar
          courses={tree}
          activePath={openFile?.path ?? null}
          onSelect={openPath}
          onRefresh={refreshTree}
          loading={treeLoading}
        />

        <main className="studio-main">
          {openFile ? (
            <MdxEditor
              key={openFile.path /* 切换文件时强制重建编辑器 */}
              initialValue={openFile.content}
              dark={isDark}
              onChange={handleEditorChange}
              onSave={persist}
              onImageFile={handleImageFile}
              registerHandle={(h) => {
                editorHandleRef.current = h
              }}
            />
          ) : (
            <div className="studio-empty">
              <p>← 从左侧选择一个 mdx 文件开始编辑</p>
            </div>
          )}
        </main>

        <aside className="studio-aside">
          {openFile && (
            <FrontmatterForm
              source={editorValue}
              onApply={applyFrontmatter}
              disabled={saveStatus === 'saving'}
            />
          )}
          <LivePreview
            filePath={openFile?.path ?? null}
            dirty={dirty}
            reloadToken={previewReloadToken}
          />
        </aside>
      </div>

      <InsertDialog
        item={insertTarget}
        onCancel={() => setInsertTarget(null)}
        onInsert={insertSnippet}
      />

      <ScaffoldDialog
        open={scaffoldOpen}
        courses={tree}
        defaultCourse={
          openFile ? parseCourseChapter(openFile.path)?.course : undefined
        }
        defaultChapter={
          openFile ? parseCourseChapter(openFile.path)?.chapter : undefined
        }
        onClose={() => setScaffoldOpen(false)}
        onCreated={handleScaffolded}
      />
    </div>
  )
}
