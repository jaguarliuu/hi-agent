import { notFound } from 'next/navigation'
import { StudioModeBoundary } from './_components/studio-mode-boundary'

export const metadata = {
  title: 'Studio · 课程编辑器',
  description: '本地课程编辑器，仅在开发环境可访问。'
}

export default function StudioLayout({ children }) {
  if (process.env.NODE_ENV !== 'development') {
    notFound()
  }
  return <StudioModeBoundary>{children}</StudioModeBoundary>
}
