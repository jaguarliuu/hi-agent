import React from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { AgentCapabilityInteractive } from '@/app/lib/agent-capability-interactive'

afterEach(() => {
  cleanup()
  document.body.style.overflow = ''
})

describe('AgentCapabilityInteractive', () => {
  it('renders cover with the panorama title and open button', () => {
    render(<AgentCapabilityInteractive />)
    expect(screen.getByText('Agent 系统能力全景图')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: '打开能力全景' })).toBeInTheDocument()
  })

  it('opens modal on cover button click and shows step 1 (Chat)', () => {
    render(<AgentCapabilityInteractive />)
    fireEvent.click(screen.getByRole('button', { name: '打开能力全景' }))
    const dialog = screen.getByRole('dialog', { name: 'Agent 能力全景播放器' })
    expect(dialog).toBeInTheDocument()
    expect(within(dialog).getByText('1 / 7')).toBeInTheDocument()
    expect(within(dialog).getByRole('heading', { name: /Chat/ })).toBeInTheDocument()
  })

  it('highlights distinct node clusters across steps via ArrowRight', () => {
    render(<AgentCapabilityInteractive />)
    fireEvent.click(screen.getByRole('button', { name: '打开能力全景' }))

    const collectActiveIds = () =>
      Array.from(
        document.querySelectorAll('[data-diagram-node][data-active="true"]')
      )
        .map((el) => el.getAttribute('data-diagram-node'))
        .filter((id): id is string => id != null)
        .sort()
        .join(',')

    const step1Ids = collectActiveIds()
    expect(step1Ids.length).toBeGreaterThan(0)

    fireEvent.keyDown(window, { key: 'ArrowRight' })

    const step2Ids = collectActiveIds()
    expect(step2Ids.length).toBeGreaterThan(0)
    expect(step2Ids).not.toEqual(step1Ids)
  })

  it('closes modal when Escape is pressed', () => {
    render(<AgentCapabilityInteractive />)
    fireEvent.click(screen.getByRole('button', { name: '打开能力全景' }))
    expect(screen.getByRole('dialog', { name: 'Agent 能力全景播放器' })).toBeInTheDocument()
    fireEvent.keyDown(window, { key: 'Escape' })
    expect(screen.queryByRole('dialog', { name: 'Agent 能力全景播放器' })).not.toBeInTheDocument()
  })
})
