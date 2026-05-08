import { PlaygroundProvider } from '../../../lib/playground/playground-provider'

export default function WebcontainersPilotLayout({ children }) {
  return <PlaygroundProvider>{children}</PlaygroundProvider>
}
