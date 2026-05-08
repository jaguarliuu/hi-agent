import { useMDXComponents as getThemeComponents } from 'nextra-theme-docs'
import { ZoomableImage } from './app/lib/zoomable-image'
import { withBase } from './app/lib/base-path'
import { CommandBlock } from './app/lib/command-block'
import { OpenProjectButton } from './app/lib/open-project-button'
import { PlaygroundSection } from './app/lib/playground/playground-section'
import { RunnableCodeBlock } from './app/lib/runnable-code-block'

const themeComponents = getThemeComponents()

function prefixIfInternal(src) {
  if (!src || typeof src !== 'string') return src
  if (/^https?:\/\//.test(src) || src.startsWith('data:') || src.startsWith('blob:')) {
    return src
  }
  return withBase(src)
}

function ZoomImg(props) {
  return <ZoomableImage {...props} src={prefixIfInternal(props.src)} />
}

export function useMDXComponents(components) {
  return {
    ...themeComponents,
    ...components,
    img: ZoomImg,
    PlaygroundSection,
    RunnableCodeBlock,
    CommandBlock,
    OpenProjectButton
  }
}
