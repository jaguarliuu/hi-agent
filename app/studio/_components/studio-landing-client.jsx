'use client'

import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { useState } from 'react'
import { CreateCourseDialog } from './create-course-dialog'

/**
 * Studio landing 的客户端壳：渲染课程卡片网格 + "新建课程"卡片，
 * 并管理 CreateCourseDialog 的开闭与创建后跳转。
 *
 * 课程列表是 props 传入的 server 数据快照；创建成功后用 router.refresh()
 * 让 RSC 重新拉取 [courses-data.js](file:///c:/Users/Administrator/Desktop/Jaguarliu/code/hi-agent/app/courses-data.js) 的最新内容，再通过 query 跳到编辑器。
 */
export function StudioLandingClient({ courses }) {
  const router = useRouter()
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <>
      <section className="studio-landing__grid">
        {courses.map((course) => (
          <Link
            key={course.slug}
            href={`/studio/edit?course=${course.slug}`}
            className="studio-landing__card"
            data-status={course.status}
          >
            <header>
              <span className="studio-landing__status">{course.status}</span>
              <span className="studio-landing__tag">{course.tag}</span>
            </header>
            <h2>{course.title}</h2>
            <p>{course.subtitle}</p>
            <footer>
              <span>{course.chapters?.length ?? 0} chapters</span>
              <span>→</span>
            </footer>
          </Link>
        ))}

        <button
          type="button"
          className="studio-landing__card studio-landing__card--new"
          onClick={() => setCreateOpen(true)}
        >
          <header>
            <span className="studio-landing__status studio-landing__status--new">
              new
            </span>
            <span className="studio-landing__tag">create</span>
          </header>
          <h2>＋ 新建课程</h2>
          <p>创建一门新的课程，自动生成目录结构与首章节脚手架。</p>
          <footer>
            <span>course skeleton</span>
            <span>→</span>
          </footer>
        </button>
      </section>

      <CreateCourseDialog
        open={createOpen}
        existingSlugs={courses.map((c) => c.slug)}
        onClose={() => setCreateOpen(false)}
        onCreated={(result) => {
          setCreateOpen(false)
          // 刷新 SSR 数据后跳到新课程的编辑器（编辑器会自动 fetchTree）
          router.refresh()
          router.push(`/studio/edit?course=${result.slug}`)
        }}
      />
    </>
  )
}
