'use client'

import { useEffect, useRef } from 'react'
import { EditorState, Compartment } from '@codemirror/state'
import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { markdown } from '@codemirror/lang-markdown'
import { syntaxHighlighting, defaultHighlightStyle, bracketMatching, indentOnInput } from '@codemirror/language'
import { oneDark } from '@codemirror/theme-one-dark'

export interface MdxEditorHandle {
  getValue: () => string
  setValue: (v: string) => void
  insertAtCursor: (snippet: string) => void
  focus: () => void
}

interface MdxEditorProps {
  initialValue: string
  onChange?: (value: string) => void
  onSave?: () => void
  registerHandle?: (handle: MdxEditorHandle) => void
  /** 编辑器接收到拖拽 / 粘贴的图片 File 时回调；返回的 url 会被插入到光标处 */
  onImageFile?: (file: File) => Promise<string | null>
  dark?: boolean
}

/**
 * CodeMirror 6 编辑器组件。
 *
 * 关注点：
 *   - markdown 模式 + 行号 + 历史 + 自动缩进 + 行包裹
 *   - 拦截 Mod-s 派发 onSave，避免浏览器"另存为"
 *   - 通过 imperative handle 暴露 insertAtCursor / setValue / focus，
 *     供组件面板与外部刷新内容使用
 */
export function MdxEditor({
  initialValue,
  onChange,
  onSave,
  registerHandle,
  onImageFile,
  dark = false
}: MdxEditorProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const viewRef = useRef<EditorView | null>(null)
  const themeCompRef = useRef(new Compartment())
  const onChangeRef = useRef(onChange)
  const onSaveRef = useRef(onSave)
  const onImageFileRef = useRef(onImageFile)
  onChangeRef.current = onChange
  onSaveRef.current = onSave
  onImageFileRef.current = onImageFile

  useEffect(() => {
    if (!hostRef.current) return
    if (viewRef.current) return

    const themeComp = themeCompRef.current
    const state = EditorState.create({
      doc: initialValue,
      extensions: [
        lineNumbers(),
        history(),
        highlightActiveLine(),
        bracketMatching(),
        indentOnInput(),
        markdown(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        keymap.of([
          ...defaultKeymap,
          ...historyKeymap,
          indentWithTab,
          {
            key: 'Mod-s',
            preventDefault: true,
            run: () => {
              onSaveRef.current?.()
              return true
            }
          }
        ]),
        EditorView.lineWrapping,
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current?.(update.state.doc.toString())
          }
        }),
        themeComp.of(dark ? oneDark : [])
      ]
    })

    const view = new EditorView({ state, parent: hostRef.current })
    viewRef.current = view

    const handle: MdxEditorHandle = {
      getValue: () => view.state.doc.toString(),
      setValue: (v) => {
        view.dispatch({
          changes: { from: 0, to: view.state.doc.length, insert: v }
        })
      },
      insertAtCursor: (snippet) => {
        const sel = view.state.selection.main
        view.dispatch({
          changes: { from: sel.from, to: sel.to, insert: snippet },
          selection: { anchor: sel.from + snippet.length },
          scrollIntoView: true
        })
        view.focus()
      },
      focus: () => view.focus()
    }
    registerHandle?.(handle)

    /**
     * 处理来自 paste / drop 的图片 File：先在光标处插入一个上传中占位，
     * 等待回调返回真实 URL 后再用 markdown 图片语法替换该占位。
     * 失败则把占位换成失败注释。
     */
    function handleFile(file: File) {
      const cb = onImageFileRef.current
      if (!cb) return false
      const placeholder = `![uploading ${file.name}…]()`
      const sel = view.state.selection.main
      const insertFrom = sel.from
      view.dispatch({
        changes: { from: sel.from, to: sel.to, insert: placeholder },
        selection: { anchor: sel.from + placeholder.length },
        scrollIntoView: true
      })
      cb(file).then(
        (url) => {
          if (!viewRef.current) return
          const v = viewRef.current
          const doc = v.state.doc.toString()
          const idx = doc.indexOf(placeholder, insertFrom)
          if (idx < 0) return
          const replacement = url
            ? `![${file.name.replace(/[\[\]]/g, '')}](${url})`
            : `<!-- upload failed: ${file.name} -->`
          v.dispatch({
            changes: {
              from: idx,
              to: idx + placeholder.length,
              insert: replacement
            }
          })
        },
        () => {
          // 同上 fallback
          if (!viewRef.current) return
          const v = viewRef.current
          const doc = v.state.doc.toString()
          const idx = doc.indexOf(placeholder, insertFrom)
          if (idx < 0) return
          v.dispatch({
            changes: {
              from: idx,
              to: idx + placeholder.length,
              insert: `<!-- upload failed: ${file.name} -->`
            }
          })
        }
      )
      return true
    }

    function onPaste(e: ClipboardEvent) {
      const items = e.clipboardData?.items
      if (!items) return
      for (let i = 0; i < items.length; i++) {
        const it = items[i]
        if (it.kind === 'file') {
          const f = it.getAsFile()
          if (f && f.type.startsWith('image/')) {
            e.preventDefault()
            handleFile(f)
            return
          }
        }
      }
    }
    function onDrop(e: DragEvent) {
      const files = e.dataTransfer?.files
      if (!files || files.length === 0) return
      const imgs = Array.from(files).filter((f) => f.type.startsWith('image/'))
      if (imgs.length === 0) return
      e.preventDefault()
      for (const f of imgs) handleFile(f)
    }
    function onDragOver(e: DragEvent) {
      const files = e.dataTransfer?.types
      if (files && Array.from(files).includes('Files')) {
        e.preventDefault()
      }
    }

    const dom = view.dom
    dom.addEventListener('paste', onPaste as EventListener)
    dom.addEventListener('drop', onDrop as EventListener)
    dom.addEventListener('dragover', onDragOver as EventListener)

    return () => {
      dom.removeEventListener('paste', onPaste as EventListener)
      dom.removeEventListener('drop', onDrop as EventListener)
      dom.removeEventListener('dragover', onDragOver as EventListener)
      view.destroy()
      viewRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    view.dispatch({
      effects: themeCompRef.current.reconfigure(dark ? oneDark : [])
    })
  }, [dark])

  return <div ref={hostRef} className="studio-editor" />
}
