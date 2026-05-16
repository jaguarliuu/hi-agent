'use client'

import { useMemo, useState } from 'react'
import { groupByCategory, type RegistryItem } from '../_lib/component-registry'

interface ComponentPaletteProps {
  onPick: (item: RegistryItem) => void
  disabled?: boolean
}

/**
 * 组件抽屉。位于编辑器顶部 toolbar 旁边，点击 chip 打开浮层；选中条目后
 * 调起 InsertDialog 并把字段值写入到模板。带搜索过滤。
 */
export function ComponentPalette({ onPick, disabled }: ComponentPaletteProps) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')

  const groups = useMemo(() => {
    const all = groupByCategory()
    const q = query.trim().toLowerCase()
    if (!q) return all
    return all
      .map((g) => ({
        category: g.category,
        items: g.items.filter(
          (it) =>
            it.label.toLowerCase().includes(q) ||
            it.description.toLowerCase().includes(q) ||
            it.id.includes(q)
        )
      }))
      .filter((g) => g.items.length > 0)
  }, [query])

  return (
    <div className="studio-palette">
      <button
        type="button"
        className="studio-palette__trigger"
        onClick={() => setOpen((v) => !v)}
        disabled={disabled}
        title="插入组件 / 片段"
      >
        ＋ 插入组件
      </button>
      {open && (
        <>
          <button
            type="button"
            aria-label="关闭"
            className="studio-palette__scrim"
            onClick={() => setOpen(false)}
          />
          <div className="studio-palette__menu" role="menu">
            <input
              type="search"
              className="studio-palette__search"
              placeholder="搜索：callout / mermaid / 图片…"
              autoFocus
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            <div className="studio-palette__list">
              {groups.length === 0 && (
                <p className="studio-palette__empty">无匹配项</p>
              )}
              {groups.map((g) => (
                <section key={g.category}>
                  <h4 className="studio-palette__category">{g.category}</h4>
                  {g.items.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      className="studio-palette__item"
                      onClick={() => {
                        setOpen(false)
                        setQuery('')
                        onPick(item)
                      }}
                    >
                      <span className="studio-palette__item-label">
                        {item.label}
                      </span>
                      <span className="studio-palette__item-desc">
                        {item.description}
                      </span>
                    </button>
                  ))}
                </section>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
