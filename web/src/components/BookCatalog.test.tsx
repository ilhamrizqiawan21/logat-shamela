// @vitest-environment jsdom
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, expect, it, vi } from 'vitest'
import { BookCatalog } from './BookCatalog'

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
const host = document.createElement('div')
const root = createRoot(host)
afterEach(() => act(() => root.render(null)))
it('filters favorites, loads more books, and opens the selected book', () => {
  const books = Array.from({ length: 30 }, (_, id) => ({ id, name: `Kitab ${id}`, authors: '', category_id: 1, category: '' }))
  const onOpen = vi.fn()
  act(() => root.render(<BookCatalog books={books} items={[]} authors={[]} query="" authorQuery="" favoriteBookIds={[29]} recentBooks={[]} status="idle" error="" onQuery={vi.fn()} onAuthorQuery={vi.fn()} onCategory={vi.fn()} onAuthor={vi.fn()} onOpen={onOpen} onToggleFavorite={vi.fn()} onRetry={vi.fn()} />))
  expect(host.querySelectorAll('.book-card')).toHaveLength(24)
  act(() => (host.querySelector('.load-more button') as HTMLButtonElement).click())
  expect(host.querySelectorAll('.book-card')).toHaveLength(30)
  act(() => (host.querySelectorAll('.home-tabs button')[1] as HTMLButtonElement).click())
  expect(host.querySelectorAll('.book-card')).toHaveLength(1)
  act(() => (host.querySelector('.book-card') as HTMLButtonElement).click())
  expect(onOpen).toHaveBeenCalledWith(books[29])
})
