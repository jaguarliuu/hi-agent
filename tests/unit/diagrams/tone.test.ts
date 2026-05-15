import { describe, expect, it } from 'vitest'
import { TONE_COLORS } from '@/app/lib/diagrams/tone'

describe('TONE_COLORS', () => {
  it('exposes the 6 brand tones with the canonical hex values', () => {
    expect(TONE_COLORS).toEqual({
      blue: '#2f6feb',
      violet: '#6f4bd8',
      cyan: '#16a3a5',
      orange: '#f2801c',
      green: '#2f9d67',
      navy: '#2763c4'
    })
  })
})
