import { useMemo, useState } from 'react'
import type { Book, Result } from '../types'
import { Button, ErrorState, Skeleton, TextField } from './ui'

type Status = 'idle' | 'loading' | 'error'

type Props = {
  books: Book[]
  term: string
  selectedBookIds: number[]
  recentSearches: string[]
  results: Result[]
  status: Status
  error: string
  onTerm: (value: string) => void
  onToggleBook: (bookId: number) => void
  onSelectAll: () => void
  onClearBooks: () => void
  onUsePreset: (value: string) => void
  onSearch: () => void
  onOpenResult: (result: Result) => void
}

function Highlight({ text, term }: { text: string; term: string }) {
  if (!term) return <>{text}</>
  const parts = text.split(new RegExp(`(${term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'))
  return (
    <>
      {parts.map((part, index) => part.toLowerCase() === term.toLowerCase() ? <mark key={index}>{part}</mark> : <span key={index}>{part}</span>)}
    </>
  )
}

export function SearchWorkspace({ books, term, selectedBookIds, recentSearches, results, status, error, onTerm, onToggleBook, onSelectAll, onClearBooks, onUsePreset, onSearch, onOpenResult }: Props) {
  const [bookQuery, setBookQuery] = useState('')
  const visibleBooks = useMemo(() => {
    const query = bookQuery.trim()
    if (!query) return books.slice(0, 350)
    return books.filter(book => `${book.name} ${book.authors}`.includes(query)).slice(0, 350)
  }, [books, bookQuery])

  return (
    <section className="search-screen">
      <div className="section-heading">
        <span>Pencarian frasa</span>
        <h1>Cari dalam kitab</h1>
      </div>

      <div className="search-bar">
        <label className="field-label">
          <span>Kata atau frasa</span>
          <TextField value={term} onChange={event => onTerm(event.target.value)} placeholder="Kata atau frasa" />
        </label>
        <Button onClick={onSearch} disabled={!term || !selectedBookIds.length}>Cari</Button>
      </div>

      <div className="search-presets">
        {recentSearches.map(item => <Button key={item} onClick={() => onUsePreset(item)}>{item}</Button>)}
      </div>

      <div className="search-workspace">
        <aside className="search-filter">
          <div className="filter-title">
            <h3>Filter kitab</h3>
            <span>{selectedBookIds.length} dipilih</span>
          </div>
          <div className="filter-actions">
            <Button onClick={onSelectAll}>Pilih semua</Button>
            <Button onClick={onClearBooks}>Kosongkan</Button>
          </div>
          <label className="field-label">
            <span>Cari kitab filter</span>
            <TextField value={bookQuery} onChange={event => setBookQuery(event.target.value)} placeholder="Cari kitab..." />
          </label>
          <div className="checklist">
            {visibleBooks.map(book => (
              <label key={book.id} dir="rtl">
                <input
                  type="checkbox"
                  checked={selectedBookIds.includes(book.id)}
                  onChange={() => onToggleBook(book.id)}
                />
                <span>{book.name}</span>
              </label>
            ))}
          </div>
          {visibleBooks.length < books.length && <p className="muted small">Menampilkan {visibleBooks.length} dari {books.length} kitab. Ketik untuk mempersempit.</p>}
        </aside>

        <div className="search-results">
          {status === 'loading' && <Skeleton lines={8} />}
          {status === 'error' && <ErrorState message={error} retry={onSearch} />}
          {status === 'idle' && results.length === 0 && (
            <div className="empty-illustration">
              <strong>بحث</strong>
              <p className="muted">Pilih satu atau beberapa kitab, lalu masukkan kata/frasa yang ingin dicari.</p>
            </div>
          )}
          {status === 'idle' && results.map(result => (
            <Button key={`${result.book_id}-${result.page_id}`} className="result-row" onClick={() => onOpenResult(result)} dir="rtl">
              <b>{result.book_name}</b>
              <small>{result.authors || 'Tanpa musonnif'} · Hal. {result.page_id}</small>
              {result.snippet_body && <span><Highlight text={result.snippet_body} term={term} /></span>}
            </Button>
          ))}
        </div>
      </div>
    </section>
  )
}
