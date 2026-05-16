'use client'

import { useEffect, useMemo, useState } from 'react'
import type { RegistryItem } from '../_lib/component-registry'

interface InsertDialogProps {
  item: RegistryItem | null
  onCancel: () => void
  /** 用户提交后调用，参数为最终生成的代码片段 + 需要追加的 import 语句 */
  onInsert: (snippet: string, imports: string[]) => void
}

/**
 * 通用的表单驱动插入对话框。
 *
 * 根据 RegistryItem.fields 渲染对应的输入控件（string / textarea / select），
 * 用户提交后调用 item.template(values) 生成片段并交给父组件落到光标处。
 *
 * 不实现 import 自动合并（v1）：仅把 imports 数组上抛，由调用方决定如何插入；
 * 当前 StudioShell 在不影响光标的前提下把缺失的 import 简单插到文档头部。
 */
export function InsertDialog({ item, onCancel, onInsert }: InsertDialogProps) {
  const [values, setValues] = useState<Record<string, string>>({})

  // item 切换 → 用 default 重置表单
  useEffect(() => {
    if (!item) return
    const init: Record<string, string> = {}
    for (const f of item.fields) {
      init[f.name] = f.default ?? ''
    }
    setValues(init)
  }, [item])

  const previewSnippet = useMemo(() => {
    if (!item) return ''
    try {
      return item.template(values)
    } catch (err) {
      return `// template error: ${(err as Error).message}`
    }
  }, [item, values])

  if (!item) return null

  const missing = item.fields
    .filter((f) => f.required && !values[f.name]?.trim())
    .map((f) => f.label)

  return (
    <div className="studio-dialog-overlay" role="dialog" aria-modal="true">
      <div className="studio-dialog">
        <header className="studio-dialog__header">
          <div>
            <h3>{item.label}</h3>
            <p className="studio-dialog__desc">{item.description}</p>
          </div>
          <button type="button" className="studio-dialog__close" onClick={onCancel} title="关闭">
            ✕
          </button>
        </header>

        <div className="studio-dialog__body">
          {item.fields.length === 0 && (
            <p className="studio-dialog__empty">该组件没有可配置项，直接插入即可。</p>
          )}
          {item.fields.map((field) => {
            const value = values[field.name] ?? ''
            const set = (v: string) =>
              setValues((prev) => ({ ...prev, [field.name]: v }))
            return (
              <label key={field.name} className="studio-dialog__field">
                <span className="studio-dialog__label">
                  {field.label}
                  {field.required && <em className="studio-dialog__req">*</em>}
                </span>
                {field.type === 'textarea' && (
                  <textarea
                    rows={field.rows ?? 4}
                    placeholder={field.placeholder}
                    value={value}
                    onChange={(e) => set(e.target.value)}
                  />
                )}
                {field.type === 'select' && (
                  <select value={value} onChange={(e) => set(e.target.value)}>
                    {field.options?.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {opt.label}
                      </option>
                    ))}
                  </select>
                )}
                {field.type === 'string' && (
                  <input
                    type="text"
                    placeholder={field.placeholder}
                    value={value}
                    onChange={(e) => set(e.target.value)}
                  />
                )}
              </label>
            )
          })}

          <div className="studio-dialog__preview">
            <div className="studio-dialog__preview-head">预览</div>
            <pre>{previewSnippet}</pre>
          </div>

          {item.imports.length > 0 && (
            <div className="studio-dialog__imports">
              <div className="studio-dialog__preview-head">需要的 imports</div>
              {item.imports.map((line) => (
                <code key={line}>{line}</code>
              ))}
              <p className="studio-dialog__hint">
                如果文件顶部已有相同 import，会自动跳过；不会去重 named-imports。
              </p>
            </div>
          )}
        </div>

        <footer className="studio-dialog__footer">
          {missing.length > 0 && (
            <span className="studio-dialog__warn">
              请填写：{missing.join('、')}
            </span>
          )}
          <button type="button" className="studio-dialog__btn" onClick={onCancel}>
            取消
          </button>
          <button
            type="button"
            className="studio-dialog__btn studio-dialog__btn--primary"
            disabled={missing.length > 0}
            onClick={() => onInsert(previewSnippet, item.imports)}
          >
            插入到光标处
          </button>
        </footer>
      </div>
    </div>
  )
}
