import { Footer, Layout, Navbar } from 'nextra-theme-docs'
import { Banner, Head, Search } from 'nextra/components'
import { getPageMap } from 'nextra/page-map'
import 'nextra-theme-docs/style.css'
import './globals.css'
import { ThemeSwitchRelocator } from './theme-switch-relocator'
import { MotionProvider } from './lib/motion/motion-context'

export const metadata = {
  metadataBase: new URL('https://jaguarliuu.github.io/hi-agent'),
  title: {
    default: 'Hi-Agent — 构建会思考的 AI Agent',
    template: '%s · Hi-Agent'
  },
  description: '一门系统讲解 AI Agent 的文字课程：从 Chat、Agent Loop、Tool、Context Engineering、Memory、Multi-Agent 到 Harness。',
  applicationName: 'Hi-Agent Docs',
  appleWebApp: { title: 'Hi-Agent' },
  other: {
    'msapplication-TileColor': '#fff'
  }
}

const banner = (
  <Banner storageKey="hi-agent-launch">
    Hi-Agent v1.0 · 全新上线 · 一门关于 Agent 工程的系统课程
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
        <span className="ha-logo-badge">Docs</span>
      </span>
    }
    projectLink="https://github.com/jaguarliuu/hi-agent"
  />
)

const footer = (
  <Footer>
    <div style={{ display: 'flex', justifyContent: 'space-between', width: '100%', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
      <span>© {new Date().getFullYear()} Hi-Agent. 一门关于 Agent 工程的系统课程。</span>
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
        <MotionProvider>
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
            {children}
          </Layout>
        </MotionProvider>
      </body>
    </html>
  )
}
