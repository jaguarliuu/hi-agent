export function CodeBlock({
  title,
  defaultOpen = false,
  previewLines = 0,
  children
}) {
  return (
    <details className="ha-codeblock" open={defaultOpen}>
      <summary className="ha-codeblock-summary">
        <span className="ha-codeblock-chevron" aria-hidden>▸</span>
        <span className="ha-codeblock-title">
          {title || (defaultOpen ? '收起代码' : '展开代码')}
        </span>
        {previewLines > 0 && (
          <span className="ha-codeblock-hint" aria-hidden>
            点击展开 / 收起
          </span>
        )}
      </summary>
      <div className="ha-codeblock-body">{children}</div>
    </details>
  )
}
