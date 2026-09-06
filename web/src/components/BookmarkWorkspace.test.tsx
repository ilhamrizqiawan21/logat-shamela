// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { expect, it, vi } from 'vitest'
import { BookmarkWorkspace } from './BookmarkWorkspace'
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
it('opens bookmarks beyond the old limit and filters by book and page', async () => {
  const host = document.createElement('div'), root = createRoot(host)
  const bookmarks = Array.from({ length: 30 }, (_, index) => ({ book_id: index < 25 ? 1 : 2, book_name: index < 25 ? 'Kitab A' : 'Kitab B', authors: 'Musonnif', page_id: index + 1, created_at: '' }))
  const onOpen = vi.fn(), onRemove = vi.fn().mockRejectedValue(new Error('Gagal menghapus bookmark'))
  try {
    await act(async () => root.render(<BookmarkWorkspace bookmarks={bookmarks} status="idle" error="" onRetry={vi.fn()} onOpen={onOpen} onRemove={onRemove} />))
    expect(host.querySelectorAll('.bookmark-item')).toHaveLength(24)
    await act(async () => { (host.querySelector('.load-more button') as HTMLButtonElement).click() })
    expect(host.querySelectorAll('.bookmark-item')).toHaveLength(30)
    await act(async () => { (host.querySelectorAll('.bookmark-open')[29] as HTMLButtonElement).click() })
    expect(onOpen).toHaveBeenCalledWith(bookmarks[29])
    await act(async () => { const select = host.querySelector('select')!; select.value = '2'; select.dispatchEvent(new Event('change', { bubbles: true })) })
    expect(host.querySelectorAll('.bookmark-item')).toHaveLength(5)
    await act(async () => {
      const input = host.querySelector('input')!
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '30')
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
    expect(host.querySelectorAll('.bookmark-item')).toHaveLength(1)
    await act(async () => { (host.querySelector('.bookmark-remove') as HTMLButtonElement).click() })
    expect(onRemove).toHaveBeenCalledWith(bookmarks[29])
    expect(host.querySelector('[role="alert"]')!.textContent).toBe('Gagal menghapus bookmark')
    expect(host.querySelectorAll('.bookmark-item')).toHaveLength(1)
  } finally { act(() => root.unmount()) }
})
