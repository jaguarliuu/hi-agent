const REPOS = {
  java: 'jaguarliuu/hi-agent-java',
  docs: 'jaguarliuu/hi-agent'
}

const TYPE_META = {
  commit: {
    label: '本节源码',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <path d="M10.86 7a4 4 0 1 1-7.72 0H0V5h3.14a4 4 0 0 1 7.72 0H16v2h-5.14ZM7 10a2 2 0 1 0 0-4 2 2 0 0 0 0 4Z" />
      </svg>
    )
  },
  pr: {
    label: 'Pull Request',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <path d="M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z" />
      </svg>
    )
  },
  file: {
    label: '源文件',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <path d="M2 1.75C2 .784 2.784 0 3.75 0h6.586c.464 0 .909.184 1.237.513l2.914 2.914c.329.328.513.773.513 1.237v9.586A1.75 1.75 0 0 1 13.25 16h-9.5A1.75 1.75 0 0 1 2 14.25Zm1.75-.25a.25.25 0 0 0-.25.25v12.5c0 .138.112.25.25.25h9.5a.25.25 0 0 0 .25-.25V6h-2.75A1.75 1.75 0 0 1 9 4.25V1.5Zm6.75.062V4.25c0 .138.112.25.25.25h2.688l-.011-.013-2.914-2.914-.013-.011Z" />
      </svg>
    )
  },
  repo: {
    label: '项目仓库',
    icon: (
      <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
        <path d="M8 0a8 8 0 0 0-2.53 15.59c.4.07.55-.17.55-.38v-1.33c-2.22.48-2.69-1.07-2.69-1.07-.36-.92-.89-1.17-.89-1.17-.73-.5.05-.49.05-.49.8.06 1.23.83 1.23.83.72 1.23 1.88.87 2.34.67.07-.52.28-.87.51-1.07-1.77-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.22 2.2.82a7.6 7.6 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.28.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48v2.2c0 .21.15.46.55.38A8 8 0 0 0 8 0Z" />
      </svg>
    )
  }
}

function buildUrl({ type, repo, sha, path, number }) {
  const slug = REPOS[repo] || repo
  const base = `https://github.com/${slug}`
  switch (type) {
    case 'commit':
      return `${base}/commit/${sha}`
    case 'pr':
      return `${base}/pull/${number}`
    case 'file':
      return `${base}/blob/${sha || 'main'}/${path}`
    case 'repo':
    default:
      return base
  }
}

function shortRef(value) {
  if (!value) return ''
  return value.length > 8 ? value.slice(0, 7) : value
}

export function SourceLink({
  type = 'commit',
  repo = 'java',
  sha,
  path,
  number,
  title,
  description,
  children
}) {
  const meta = TYPE_META[type] || TYPE_META.commit
  const href = buildUrl({ type, repo, sha, path, number })
  const slug = REPOS[repo] || repo

  const badge =
    type === 'commit'
      ? shortRef(sha)
      : type === 'pr'
        ? `#${number}`
        : type === 'file'
          ? (sha ? shortRef(sha) : 'main')
          : slug

  const headline = title || children || meta.label

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="ha-source-link"
      data-type={type}
    >
      <span className="ha-source-link-icon" aria-hidden>
        {meta.icon}
      </span>
      <span className="ha-source-link-body">
        <span className="ha-source-link-top">
          <span className="ha-source-link-label">{meta.label}</span>
          {badge && <code className="ha-source-link-badge">{badge}</code>}
        </span>
        <span className="ha-source-link-title">{headline}</span>
        {description && (
          <span className="ha-source-link-desc">{description}</span>
        )}
      </span>
      <span className="ha-source-link-arrow" aria-hidden>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M7 17L17 7" />
          <path d="M8 7h9v9" />
        </svg>
      </span>
    </a>
  )
}
