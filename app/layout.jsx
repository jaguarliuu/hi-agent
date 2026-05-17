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
import { RegisterSW } from './lib/pwa/register-sw'
import { InstallPrompt } from './lib/pwa/install-prompt'

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || ''

export const metadata = {
  metadataBase: new URL('https://jaguarliuu.github.io/hi-agent'),
  title: {
    default: 'Hi-Agent — Agent 工程系列课程',
    template: '%s · Hi-Agent'
  },
  description: 'Hi-Agent 系列课程：围绕 AI Agent 工程的系统课程合集，从 Chat、Agent Loop、Tool、Context Engineering 到 Memory、Multi-Agent、Harness，并持续扩展更多 Agent 主题课程。',
  applicationName: 'Hi-Agent',
  manifest: `${basePath}/manifest.webmanifest`,
  appleWebApp: {
    title: 'Hi-Agent',
    capable: true,
    statusBarStyle: 'default'
  },
  icons: {
    icon: [
      { url: `${basePath}/icons/favicon.svg`, type: 'image/svg+xml' },
      { url: `${basePath}/icons/icon.svg`, type: 'image/svg+xml', sizes: 'any' }
    ],
    apple: [
      { url: `${basePath}/icons/icon.svg`, type: 'image/svg+xml' }
    ],
    shortcut: [`${basePath}/icons/favicon.svg`]
  },
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#FF7A3D' },
    { media: '(prefers-color-scheme: dark)', color: '#1f1d1c' }
  ],
  other: {
    'msapplication-TileColor': '#FF7A3D'
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
        <RegisterSW />
        <MotionProvider>
          <ToastProvider>
            <ReadingProgress />
            <InstallPrompt />
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
