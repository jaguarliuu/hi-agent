import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'

import { AgentTimelineInteractive } from '../app/lib/agent-timeline-interactive'

describe('AgentTimelineInteractive', () => {
  it('opens the timeline in a modal, advances through steps, and closes with Escape', () => {
    const { container } = render(<AgentTimelineInteractive />)

    expect(screen.getByRole('heading', { name: '用户与 OpenClaw Agent 交互时序' })).toBeInTheDocument()
    expect(screen.queryByRole('dialog', { name: 'Agent 交互时序播放器' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '打开交互时序' }))

    const dialog = screen.getByRole('dialog', { name: 'Agent 交互时序播放器' })

    expect(dialog).toBeInTheDocument()
    expect(container).not.toContainElement(dialog)
    expect(screen.getByText('1 / 15')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '用户提出问题' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '下一步' }))

    expect(screen.getByText('2 / 15')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Chat 层接收消息' })).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '工具调用' }))

    expect(screen.getByText('9 / 15')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: '调用天气工具' })).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(screen.queryByRole('dialog', { name: 'Agent 交互时序播放器' })).not.toBeInTheDocument()
  })
})
