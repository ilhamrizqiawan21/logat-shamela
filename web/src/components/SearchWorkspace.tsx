import { useEffect, useMemo, useState } from 'react'
import type { Book, Result } from '../types'
import { Button, ErrorState, Skeleton, TextField } from './ui'

type Status = 'idle' | 'loading' | 'error'

type Props = {
  books: Book[]
  term: string
  selectedBookIds: number[]
  recentSearches: string[]
  results: Result[]
  hasSearched: boolean
  status: Status
  error: string
  onTerm: (value: string) => void
  onToggleBook: (bookId: number) => void
  onSelectAll: () => void
  onClearBooks: () => void
  onUsePreset: (value: string) => void
  onSearch: (terms: string[], operator: string) => void
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

export function SearchWorkspace({ books, term, selectedBookIds, recentSearches, results, hasSearched, status, error, onTerm, onToggleBook, onSelectAll, onClearBooks, onUsePreset, onSearch, onOpenResult }: Props) {
  const [bookQuery, setBookQuery] = useState('')
  const [keywords, setKeywords] = useState<string[]>([term, '', '', ''])
  const [operator, setOperator] = useState<'AND' | 'OR' | 'NOT' | 'FUZZY'>('AND')
  useEffect(() => setKeywords(current => current[0] === term ? current : [term, current[1], current[2], current[3]]), [term])
  const filledKeywords = keywords.map(value => value.trim()).filter(Boolean)
  const buildQuery = () => {
    if (operator === 'OR') return filledKeywords.join(' OR ')
    if (operator === 'NOT') return filledKeywords.length > 1 ? `${filledKeywords[0]} AND ${filledKeywords.slice(1).map(value => `NOT ${value}`).join(' AND ')}` : filledKeywords[0] || ''
    if (operator === 'FUZZY') return filledKeywords.map(value => `${value}~`).join(' AND ')
    return filledKeywords.join(' AND ')
  }
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

      <div className="search-bar advanced-search-bar">
        <div className="keyword-grid">
          {keywords.map((keyword, index) => <label className="field-label" key={index}><span>Kata kunci {index + 1}</span><TextField value={keyword} onChange={event => { const next = [...keywords]; next[index] = event.target.value; setKeywords(next); onTerm(next[0]) }} placeholder={index === 0 ? 'Kata utama' : 'Opsional'} dir="rtl" /></label>)}
        </div>
        <div className="search-controls"><label className="field-label"><span>Hubungan kata</span><select value={operator} onChange={event => setOperator(event.target.value as typeof operator)}><option value="AND">Dan</option><option value="OR">Atau</option><option value="NOT">Selain</option><option value="FUZZY">Mirip</option></select></label><Button onClick={() => onSearch(filledKeywords, operator)} disabled={!filledKeywords.length || !selectedBookIds.length}>Cari</Button></div>
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
          {status === 'error' && <ErrorState message={error} retry={() => onSearch(filledKeywords, operator)} />}
          {status === 'idle' && !hasSearched && (
            <div className="empty-illustration">
              <strong>بحث</strong>
              <p className="muted">Pilih satu atau beberapa kitab, lalu masukkan kata/frasa yang ingin dicari.</p>
            </div>
          )}
          {status === 'idle' && hasSearched && results.length === 0 && <div className="empty-illustration"><strong>لا نتيجة</strong><p className="muted">Tidak ada hasil yang cocok dengan pencarian ini.</p></div>}
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
