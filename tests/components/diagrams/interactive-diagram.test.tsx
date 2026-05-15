import React from 'react'
import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react'
import { InteractiveDiagram } from '@/app/lib/diagrams/interactive-diagram'
import { Lane } from '@/app/lib/diagrams/children/lane'
import { Phase } from '@/app/lib/diagrams/children/phase'
import { Step } from '@/app/lib/diagrams/children/step'
import type { DiagramSchema } from '@/app/lib/diagrams/types'

function buildTwoStepSchema(): DiagramSchema {
  return {
    lanes: [
      { id: 'user', title: '用户', tone: 'blue' },
      { id: 'agent', title: 'Agent', tone: 'violet' }
    ],
    phases: [
      { id: 'intake', label: '接收', summary: '接收消息' },
      { id: 'reply', label: '回复', summary: '生成回复' }
    ],
    steps: [
      {
        id: 1,
        from: 'user',
        to: 'agent',
        phase: 'intake',
        tone: 'blue',
        title: '用户提问',
        detail: '用户向 Agent 发送一个请求'
      },
      {
        id: 2,
        from: 'agent',
        to: 'user',
        phase: 'reply',
        tone: 'violet',
        title: 'Agent 回复',
        detail: 'Agent 生成回复并返回'
      }
    ]
  }
}

afterEach(() => {
  cleanup()
  document.body.style.overflow = ''
})

describe('InteractiveDiagram - data 形态', () => {
  it('点击封面按钮后弹出 dialog 并显示 1 / 2', () => {
    render(
      <InteractiveDiagram
        id="diag-data"
        layout="lanes"
        coverTitle="时序示意"
        coverButtonLabel="打开时序"
        modalTitle="时序播放器"
        data={buildTwoStepSchema()}
      />
    )

    expect(screen.queryByRole('dialog', { name: '时序播放器' })).not.toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: '打开时序' }))

    const dialog = screen.getByRole('dialog', { name: '时序播放器' })
    expect(dialog).toBeInTheDocument()
    expect(within(dialog).getByText('1 / 2')).toBeInTheDocument()
    expect(within(dialog).getByRole('heading', { name: '用户提问' })).toBeInTheDocument()
  })
})

describe('InteractiveDiagram - 键盘交互', () => {
  it('ArrowRight 推进到 step 2，Esc 关闭 dialog', () => {
    render(
      <InteractiveDiagram
        id="diag-keyboard"
        layout="lanes"
        coverTitle="时序示意"
        coverButtonLabel="打开时序"
        modalTitle="时序播放器"
        data={buildTwoStepSchema()}
      />
    )

    fireEvent.click(screen.getByRole('button', { name: '打开时序' }))
    const dialog = screen.getByRole('dialog', { name: '时序播放器' })
    expect(within(dialog).getByText('1 / 2')).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'ArrowRight' })

    expect(within(dialog).getByText('2 / 2')).toBeInTheDocument()
    expect(within(dialog).getByRole('heading', { name: 'Agent 回复' })).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(screen.queryByRole('dialog', { name: '时序播放器' })).not.toBeInTheDocument()
  })
})

describe('InteractiveDiagram - children 形态', () => {
  it('使用 <Lane>/<Phase>/<Step> 子组件声明等价 schema 时同样工作', () => {
    render(
      <InteractiveDiagram
        id="diag-children"
        layout="lanes"
        coverTitle="时序示意"
        coverButtonLabel="打开时序"
        modalTitle="时序播放器"
      >
        <Lane id="user" title="用户" tone="blue" />
        <Lane id="agent" title="Agent" tone="violet" />
        <Phase id="intake" label="接收" summary="接收消息">
          <Step
            id={1}
            from="user"
            to="agent"
            tone="blue"
            title="用户提问"
            detail="用户向 Agent 发送一个请求"
          />
        </Phase>
        <Phase id="reply" label="回复" summary="生成回复">
          <Step
            id={2}
            from="agent"
            to="user"
            tone="violet"
            title="Agent 回复"
            detail="Agent 生成回复并返回"
          />
        </Phase>
      </InteractiveDiagram>
    )

    fireEvent.click(screen.getByRole('button', { name: '打开时序' }))

    const dialog = screen.getByRole('dialog', { name: '时序播放器' })
    expect(within(dialog).getByText('1 / 2')).toBeInTheDocument()
    expect(within(dialog).getByRole('heading', { name: '用户提问' })).toBeInTheDocument()

    fireEvent.keyDown(window, { key: 'ArrowRight' })

    expect(within(dialog).getByText('2 / 2')).toBeInTheDocument()
    expect(within(dialog).getByRole('heading', { name: 'Agent 回复' })).toBeInTheDocument()
  })
})

describe('InteractiveDiagram - 多实例 body overflow 引用计数', () => {
  it('两个实例分别打开/关闭时正确管理 body overflow', () => {
    render(
      <>
        <InteractiveDiagram
          id="diag-a"
          layout="lanes"
          coverTitle="第一个"
          coverButtonLabel="打开第一个"
          modalTitle="第一个播放器"
          data={buildTwoStepSchema()}
        />
        <InteractiveDiagram
          id="diag-b"
          layout="lanes"
          coverTitle="第二个"
          coverButtonLabel="打开第二个"
          modalTitle="第二个播放器"
          data={buildTwoStepSchema()}
        />
      </>
    )

    expect(document.body.style.overflow).toBe('')

    fireEvent.click(screen.getByRole('button', { name: '打开第一个' }))
    expect(document.body.style.overflow).toBe('hidden')

    fireEvent.click(screen.getByRole('button', { name: '打开第二个' }))
    expect(document.body.style.overflow).toBe('hidden')

    const dialogA = screen.getByRole('dialog', { name: '第一个播放器' })
    const closeA = within(dialogA).getByRole('button', { name: '关闭交互时序' })
    fireEvent.click(closeA)

    expect(screen.queryByRole('dialog', { name: '第一个播放器' })).not.toBeInTheDocument()
    expect(document.body.style.overflow).toBe('hidden')

    const dialogB = screen.getByRole('dialog', { name: '第二个播放器' })
    const closeB = within(dialogB).getByRole('button', { name: '关闭交互时序' })
    fireEvent.click(closeB)

    expect(screen.queryByRole('dialog', { name: '第二个播放器' })).not.toBeInTheDocument()
    expect(document.body.style.overflow).toBe('')
  })
})
