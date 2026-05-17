import { PlaygroundProvider } from '../../../../lib/playground/playground-provider'
import { PlaygroundPrewarm } from '../../../../lib/playground/playground-prewarm'
import { resolveManifestAssetPath } from '../../../../lib/playground/manifest-loader'

const SNAPSHOT_URL = resolveManifestAssetPath(
  '/webcontainer-snapshots/labs-01-webcontainers-pilot.bin'
)

export default function WebcontainersPilotLayout({ children }) {
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
