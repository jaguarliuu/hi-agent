import { Footer, Layout, Navbar } from 'nextra-theme-docs'
import { Banner, Head, Search } from 'nextra/components'
import { getPageMap } from 'nextra/page-map'
import 'nextra-theme-docs/style.css'
import './globals.css'
import { ThemeSwitchRelocator } from './theme-switch-relocator'
import { MotionProvider } from './lib/motion/motion-context'
import { RouteMotionShell } from './lib/motion/route-motion-shell'
import { ReadingProgress } from './lib/reading-progress'
import { ThemeTransitionToggle } from './lib/motion/theme-transition-toggle'
import { ToastProvider } from './lib/motion/toast-context'
import { HeaderAutohide } from './lib/header-autohide'
import { CommentsBoundary } from './lib/comments/comments-boundary'

export const metadata = {
  metadataBase: new URL('https://jaguarliuu.github.io/hi-agent'),
  title: {
    default: 'Hi-Agent — Agent 工程系列课程',
    template: '%s · Hi-Agent'
  },
  description: 'Hi-Agent 系列课程：围绕 AI Agent 工程的系统课程合集，从 Chat、Agent Loop、Tool、Context Engineering 到 Memory、Multi-Agent、Harness，并持续扩展更多 Agent 主题课程。',
  applicationName: 'Hi-Agent',
  appleWebApp: { title: 'Hi-Agent' },
  other: {
    'msapplication-TileColor': '#fff'
  }
}

const banner = (
  <Banner storageKey="hi-agent-launch">
    Hi-Agent 系列 · 围绕 Agent 工程的系统课程合集 · 持续更新
  </Banner>
)

const search = (
  <Search
    placeholder="Search"
    emptyResult="无匹配结果"
    errorText="搜索索引加载失败"
    loading="加载中…"
    className="ha-search"
  />
)

const navbar = (
  <Navbar
    align="left"
    logo={
      <span className="ha-logo">
        <span aria-hidden className="ha-logo-mark" />
        <span className="ha-logo-text">Hi-Agent</span>
        <span className="ha-logo-badge">Series</span>
      </span>
    }
    projectLink="https://github.com/jaguarliuu/hi-agent"
  />
)

const footer = (
  <Footer>
    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
      <span>© {new Date().getFullYear()} Hi-Agent. 围绕 Agent 工程的系统课程合集。</span>
      <span style={{ opacity: 0.6, fontSize: 12 }}>Built with Next.js + Nextra</span>
    </div>
  </Footer>
)

export default async function RootLayout({ children }) {
  return (
    <html lang="zh-CN" dir="ltr" suppressHydrationWarning>
      <Head
        color={{
          hue: 20,
          saturation: 90,
          lightness: { light: 52, dark: 62 }
        }}
      />
      <body>
        <ThemeSwitchRelocator />
        <HeaderAutohide />
        <MotionProvider>
          <ToastProvider>
            <ReadingProgress />
            <Layout
              banner={banner}
              navbar={navbar}
              search={search}
              footer={footer}
              pageMap={await getPageMap()}
              docsRepositoryBase="https://github.com/jaguarliuu/hi-agent/tree/main"
              editLink=""
              feedback={{ content: '' }}
              sidebar={{ defaultMenuCollapseLevel: 1, toggleButton: true }}
              toc={{ backToTop: '回到顶部' }}
            >
              <ThemeTransitionToggle />
              <RouteMotionShell>
                {children}
                <CommentsBoundary />
              </RouteMotionShell>
            </Layout>
          </ToastProvider>
        </MotionProvider>
      </body>
    </html>
  )
}
