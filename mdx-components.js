import { Children, isValidElement } from 'react'
import cn from 'clsx'
import { useMDXComponents as getThemeComponents } from 'nextra-theme-docs'
import { classes } from 'nextra/mdx-components/pre/index'
import { ZoomableImage } from './app/lib/zoomable-image'
import { withBase } from './app/lib/base-path'
import { CommandBlock } from './app/lib/command-block'
import { CopyFeedbackButton } from './app/lib/motion/copy-feedback-button'
import { OpenProjectButton } from './app/lib/open-project-button'
import { PlaygroundSection } from './app/lib/playground/playground-section'
import { RunnableCodeBlock } from './app/lib/runnable-code-block'
import { InteractiveDiagram } from './app/lib/diagrams/interactive-diagram'
import { AgentCapabilityInteractive } from './app/lib/agent-capability-interactive'
import { Lane } from './app/lib/diagrams/children/lane'
import { Phase } from './app/lib/diagrams/children/phase'
import { Step } from './app/lib/diagrams/children/step'
import { Node as DiagramNode } from './app/lib/diagrams/children/node'
import { Edge as DiagramEdge } from './app/lib/diagrams/children/edge'

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

function extractTextContent(node) {
  if (node == null || typeof node === 'boolean') return ''
  if (typeof node === 'string' || typeof node === 'number') return String(node)
  if (Array.isArray(node)) return node.map(extractTextContent).join('')
  if (isValidElement(node)) return extractTextContent(node.props.children)
  return ''
}

function MotionPre({
  children,
  className,
  icon,
  'data-copy': copy,
  'data-filename': filename,
  'data-pagefind-ignore': pagefindIgnore,
  ...props
}) {
  const copyContent = extractTextContent(Children.toArray(children))
  const copyButton =
    copy === '' ? (
      <CopyFeedbackButton
        className={cn('ha-copy-feedback-button', filename && 'x:ms-auto x:text-sm')}
        content={copyContent}
      />
    ) : null

  return (
    <div
      data-pagefind-ignore={pagefindIgnore}
      className="nextra-code x:relative x:not-first:mt-[1.25em]"
    >
      {filename ? (
        <div
          className={cn(
            'x:px-4 x:text-xs x:text-gray-700 x:dark:text-gray-200',
            'x:bg-gray-100 x:dark:bg-neutral-900',
            'x:flex x:items-center x:h-12 x:gap-2 x:rounded-t-md',
            classes.border,
            'x:border-b-0'
          )}
        >
          {icon}
          <span className="x:truncate">{filename}</span>
          {copyButton}
        </div>
      ) : null}
      <pre
        className={cn(
          'x:group',
          'x:focus-visible:nextra-focus',
          'x:overflow-x-auto x:subpixel-antialiased x:text-[.9em]',
          'x:bg-white x:dark:bg-black x:py-4',
          'x:ring-1 x:ring-inset x:ring-gray-300 x:dark:ring-neutral-700',
          'x:contrast-more:ring-gray-900 x:contrast-more:dark:ring-gray-50',
          'x:contrast-more:contrast-150',
          filename ? 'x:rounded-b-md' : 'x:rounded-md',
          'not-prose',
          className
        )}
        {...props}
      >
        {!filename && copyButton ? (
          <div
            className={cn(
              'x:group-hover:opacity-100',
              'x:group-focus:opacity-100',
              'x:opacity-0 x:transition x:focus-within:opacity-100',
              'x:flex x:gap-1 x:absolute x:right-4 x:top-2'
            )}
          >
            {copyButton}
          </div>
        ) : null}
        {children}
      </pre>
    </div>
  )
}

export function useMDXComponents(components) {
  return {
    ...themeComponents,
    ...components,
    img: ZoomImg,
    pre: MotionPre,
    PlaygroundSection,
    RunnableCodeBlock,
    CommandBlock,
    OpenProjectButton,
    InteractiveDiagram,
    AgentCapabilityInteractive,
    Lane,
    Node: DiagramNode,
    Edge: DiagramEdge,
    Phase,
    Step
  }
}
