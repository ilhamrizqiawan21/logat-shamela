// @vitest-environment jsdom
import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { api } from './api'
import { App } from './main'
import type { Page } from './types'

vi.mock('./api', () => ({
  api: { books: vi.fn(), categories: vi.fn(), authors: vi.fn(), page: vi.fn(), index: vi.fn(), parts: vi.fn(), bookmarks: vi.fn(), health: vi.fn(), suggestions: vi.fn(), save: vi.fn(), delete: vi.fn(), deleteBookmark: vi.fn() },
  resolvePartPage: vi.fn(async (_book, part, localPage) => ({ page_id: part === 2 && localPage === 1 ? 250 : localPage })),
  aiStatus: vi.fn(async () => ({ enabled: false, provider: 'gemini', model: 'test' })),
  searchAdvanced: vi.fn(), exportBackup: vi.fn(), importBackup: vi.fn(), switchAIProvider: vi.fn(), toggleAI: vi.fn(),
}))
Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true })
const books = [1, 2].map(id => ({ id, name: `Kitab ${id}`, authors: '', category_id: 1, category: '' }))
const page = (book: number, id: number): Page => ({ book_id: book, page_id: id, part: 1, printed_page: id, tokens: [{ text: `Isi ${book}/${id}`, is_word: false, index: null, style: '', normalized: '', prev_word: '', next_word: '' }], annotations: {}, book_name: '', authors: '', bookmarked: false })
let host: HTMLDivElement, root: Root
const click = async (selector: string) => { await act(async () => { (host.querySelector(selector) as HTMLButtonElement).click() }) }
beforeEach(async () => {
  vi.clearAllMocks(); localStorage.clear(); window.history.replaceState(null, '', '/')
  Element.prototype.scrollIntoView = vi.fn()
  window.scrollTo = vi.fn()
  vi.mocked(api.save).mockResolvedValue(undefined)
  vi.mocked(api.suggestions).mockResolvedValue({ suggestions: [] })
  vi.mocked(api.books).mockResolvedValue(books)
  vi.mocked(api.categories).mockResolvedValue([]); vi.mocked(api.authors).mockResolvedValue([])
  vi.mocked(api.index).mockResolvedValue([]); vi.mocked(api.parts).mockResolvedValue([])
  vi.mocked(api.bookmarks).mockResolvedValue([]); vi.mocked(api.health).mockResolvedValue({ ok: true })
  vi.mocked(api.page).mockImplementation(async (book, id) => page(book, id))
  host = document.createElement('div'); document.body.append(host); root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove() })
it('resumes saved pages and only navigates a typed page on submit', async () => {
  localStorage.setItem('logat:readingPages', JSON.stringify({ 1: 42 }))
  await act(async () => root.render(<App />)); await click('.book-card')
  expect(api.page).toHaveBeenLastCalledWith(1, 42)
  const input = host.querySelector('.page-jump input') as HTMLInputElement
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, '125')
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
  expect(api.page).toHaveBeenCalledTimes(1)
  await act(async () => { host.querySelector('.page-jump')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) })
  expect(api.page).toHaveBeenLastCalledWith(1, 125)
  expect(JSON.parse(localStorage.getItem('logat:readingPages')!)[1]).toBe(125)
  await click('.mainnav button'); await click('.recent-strip button')
  expect(host.textContent).toContain('Isi 1/125')
})
it('ignores stale page and index responses after opening another book', async () => {
  let resolveOld!: (value: Page) => void
  let resolveIndex!: (value: { id: number, parent: number, page_id: number, title: string }[]) => void
  vi.mocked(api.page).mockImplementation((book, id) => book === 1 ? new Promise(resolve => { resolveOld = resolve }) : Promise.resolve(page(book, id)))
  vi.mocked(api.index).mockImplementation(book => book === 1 ? new Promise(resolve => { resolveIndex = resolve }) : Promise.resolve([]))
  await act(async () => root.render(<App />)); await click('.book-card')
  await click('.mainnav button'); await click('.book-card-wrap:nth-child(2) .book-card')
  await act(async () => { resolveOld(page(1, 1)); resolveIndex([{ id: 1, parent: 0, page_id: 1, title: 'Bab lama' }]) })
  expect(host.querySelector('article')!.textContent).toBe('Isi 2/1')
  expect(host.textContent).not.toContain('Bab lama')
})
it('offers volume navigation directly above the page without opening the index', async () => {
  vi.mocked(api.parts).mockResolvedValue([{ part: 1, page_id: 1 }, { part: 2, page_id: 250 }])
  await act(async () => root.render(<App />)); await click('.book-card')
  const select = host.querySelector('.reader-nav select') as HTMLSelectElement
  expect(select.disabled).toBe(false)
  await act(async () => {
    select.value = '2'
    select.dispatchEvent(new Event('change', { bubbles: true }))
  })
  expect(api.page).toHaveBeenLastCalledWith(1, 250)
  expect(api.page).toHaveBeenCalledTimes(2)
  expect(host.querySelector('.page-jump input')!.getAttribute('value')).toBe('250')
})
it('keeps search scope independent of a filtered catalog', async () => {
  vi.mocked(api.categories).mockResolvedValue([{ id: 1, name: 'Kategori', count: 1 }])
  vi.mocked(api.books).mockImplementation(async (_query, category) => category ? [books[0]] : books)
  await act(async () => root.render(<App />)); await click('.index-row')
  expect(host.querySelectorAll('.book-card')).toHaveLength(1)
  await click('.mainnav button:nth-child(3)')
  expect(host.querySelectorAll('.checklist input')).toHaveLength(2)
  await click('.filter-actions button')
  expect(host.textContent).toContain('2 dipilih')
})

it('restores the stored scroll position when resuming a book', async () => {
  localStorage.setItem('logat:readingPages', JSON.stringify({ 1: 42 }))
  localStorage.setItem('logat:scroll:1:42', '350')
  await act(async () => root.render(<App />)); await click('.book-card')
  expect(window.scrollTo).toHaveBeenCalledWith(0, 350)
})

const wordPage = () => ({ ...page(1, 1), tokens: ['قال', 'زيد'].map((text, index) => ({ text, is_word: true, index, style: '', normalized: text, prev_word: '', next_word: '' })) })
const typeMeaning = async (value: string) => {
  const input = host.querySelector('[data-editor-input]') as HTMLInputElement
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
it('restores a draft after closing the editor and clears it only after saving', async () => {
  vi.mocked(api.page).mockResolvedValue(wordPage())
  await act(async () => root.render(<App />)); await click('.book-card'); await click('.word')
  await typeMeaning('berkata')
  await act(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })) })
  expect(host.querySelector('.annotation-dialog')).toBeNull()
  await click('.word')
  expect((host.querySelector('[data-editor-input]') as HTMLInputElement).value).toBe('berkata')
  await click('.dialog-actions .primary')
  expect(api.save).toHaveBeenCalledWith(1, 1, expect.objectContaining({ index: 0 }), 'berkata')
  expect(localStorage.getItem('logat:draft:1:1:0')).toBeNull()
})
it('keeps the current word on save failure, then saves and advances to the next word', async () => {
  vi.mocked(api.page).mockResolvedValue(wordPage())
  vi.mocked(api.save).mockRejectedValueOnce(new Error('Gagal menyimpan'))
  await act(async () => root.render(<App />)); await click('.book-card'); await click('.word')
  await typeMeaning('berkata')
  await click('.dialog-actions button:nth-child(2)')
  expect(host.querySelector('.annotation-dialog > b')!.textContent).toBe('قال')
  expect(host.querySelector('[role="alert"]')!.textContent).toBe('Gagal menyimpan')
  expect(localStorage.getItem('logat:draft:1:1:0')).not.toBeNull()
  await click('.dialog-actions button:nth-child(2)')
  expect(host.querySelector('.annotation-dialog > b')!.textContent).toBe('زيد')
  expect((host.querySelector('.dialog-actions button:nth-child(2)') as HTMLButtonElement).disabled).toBe(true)
  expect(document.activeElement).toBe(host.querySelector('[data-editor-input]'))
})
it('blocks closing and duplicate shortcut saves while a save is pending', async () => {
  vi.mocked(api.page).mockResolvedValue(wordPage())
  let finish!: () => void
  vi.mocked(api.save).mockImplementation(() => new Promise(resolve => { finish = resolve }))
  await act(async () => root.render(<App />)); await click('.book-card'); await click('.word')
  await click('.dialog-actions .primary')
  await act(async () => {
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', ctrlKey: true }))
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    host.querySelector('.modal')!.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }))
  })
  expect(api.save).toHaveBeenCalledTimes(1)
  expect(host.querySelector('.annotation-dialog')).not.toBeNull()
  await act(async () => finish())
})

it('warns before closing when browser draft storage fails', async () => {
  vi.mocked(api.page).mockResolvedValue(wordPage())
  await act(async () => root.render(<App />)); await click('.book-card'); await click('.word')
  const write = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Quota exceeded') })
  const confirm = vi.spyOn(window, 'confirm').mockReturnValue(false)
  try {
    await typeMeaning('belum tersimpan')
    await act(async () => { window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })) })
    expect(confirm).toHaveBeenCalled()
    expect((host.querySelector('[data-editor-input]') as HTMLInputElement).value).toBe('belum tersimpan')
    const unload = new Event('beforeunload', { cancelable: true })
    window.dispatchEvent(unload)
    expect(unload.defaultPrevented).toBe(true)
  } finally { write.mockRestore(); confirm.mockRestore() }
})

it('hides annotations without deleting them and persists reading appearance', async () => {
  vi.mocked(api.page).mockResolvedValue({ ...wordPage(), annotations: { '0': { word: 'قال', meaning: 'berkata' } } })
  await act(async () => root.render(<App />)); await click('.book-card')
  expect(host.querySelector('.annotated small')!.textContent).toBe('berkata')
  const details = host.querySelector('.reader-appearance') as HTMLDetailsElement
  expect(details.open).toBe(false)
  await act(async () => { (host.querySelector('.reader-appearance summary') as HTMLElement).click() })
  expect(details.open).toBe(true)
  await click('.annotation-visibility input')
  expect(host.querySelector('.annotated small')).toBeNull()
  expect(JSON.parse(localStorage.getItem('logat:readerPrefs')!).showAnnotations).toBe(false)
  expect(api.delete).not.toHaveBeenCalled()
  await click('.annotation-visibility input')
  expect(host.querySelector('.annotated small')!.textContent).toBe('berkata')
})
