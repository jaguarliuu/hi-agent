import { PlaygroundProvider } from '../../../../lib/playground/playground-provider'
import { PlaygroundPrewarm } from '../../../../lib/playground/playground-prewarm'
import { resolveManifestAssetPath } from '../../../../lib/playground/manifest-loader'

const SNAPSHOT_URL = resolveManifestAssetPath(
  '/webcontainer-snapshots/chat-01-getting-started.bin'
)

export default function ChatGettingStartedLayout({ children }) {
  return (
    <PlaygroundProvider>
      <link
        rel="preload"
        as="fetch"
        href={SNAPSHOT_URL}
        crossOrigin="anonymous"
      />
      <PlaygroundPrewarm snapshotUrl={SNAPSHOT_URL} />
      {children}
    </PlaygroundProvider>
  )
}
