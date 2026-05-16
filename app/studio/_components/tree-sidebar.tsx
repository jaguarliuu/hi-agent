'use client'

import type { CourseNode } from '../_lib/file-api-client'

interface TreeSidebarProps {
  courses: CourseNode[]
  activePath: string | null
  onSelect: (path: string) => void
  onRefresh: () => void
  loading?: boolean
}

/**
 * 三栏布局的左侧文件树。
 *
 * 数据来源：/api/studio/tree（每次切换文件无需刷新；仅在保存或脚手架后刷新）。
 * 渲染层级：course → chapter → file (mdx)。
 */
export function TreeSidebar({
  courses,
  activePath,
  onSelect,
  onRefresh,
  loading
}: TreeSidebarProps) {
  return (
    <aside className="studio-sidebar">
      <header className="studio-sidebar__header">
        <span className="studio-sidebar__title">Courses</span>
        <button
          type="button"
          className="studio-sidebar__refresh"
          onClick={onRefresh}
          disabled={loading}
          title="刷新文件树"
        >
          {loading ? '⟳' : '↻'}
        </button>
      </header>
      <div className="studio-sidebar__body">
        {courses.length === 0 && !loading && (
          <p className="studio-sidebar__empty">没有课程</p>
        )}
        {courses.map((course) => (
          <section key={course.slug} className="studio-tree-course">
            <h3 className="studio-tree-course__title">
              {course.title}
              <span className={`studio-tree-course__badge studio-tree-course__badge--${course.status}`}>
                {course.status}
              </span>
            </h3>
            {course.chapters.map((chapter) => (
              <details
                key={chapter.slug}
                className="studio-tree-chapter"
                open
              >
                <summary className="studio-tree-chapter__summary">
                  {chapter.slug}
                  <span className="studio-tree-chapter__count">
                    {chapter.files.length}
                  </span>
                </summary>
                <ul className="studio-tree-files">
                  {chapter.files.length === 0 && (
                    <li className="studio-tree-files__empty">无 mdx 文件</li>
                  )}
                  {chapter.files.map((file) => {
                    const isActive = file.path === activePath
                    return (
                      <li key={file.path}>
                        <button
                          type="button"
                          className={`studio-tree-file${isActive ? ' studio-tree-file--active' : ''}`}
                          onClick={() => onSelect(file.path)}
                          title={file.path}
                        >
                          <span className="studio-tree-file__label">
                            {file.label}
                          </span>
                        </button>
                      </li>
                    )
                  })}
                </ul>
              </details>
            ))}
          </section>
        ))}
      </div>
    </aside>
  )
}
