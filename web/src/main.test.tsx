import { renderToString } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { App } from './main'

describe('reader shell', () => {
  it('renders the local catalog and reading entry point', () => {
    const view = renderToString(<App />)
    expect(view).toContain('Logat Syamilah')
    expect(view).toContain('Daftar Kitab')
    expect(view).toContain('Pilih Kitab')
  })
})
