import { useEffect, useState } from 'react'
import type { Book, Item } from '../types'
import { Button, ErrorState, Skeleton, TextField } from './ui'

type Status = 'idle' | 'loading' | 'error'

type Props = {
  books: Book[]
  items: Item[]
  authors: Item[]
  query: string
  authorQuery: string
  selectedCategory?: number
  selectedAuthor?: number
  favoriteBookIds: number[]
  recentBooks: Book[]
  status: Status
  error: string
  onQuery: (value: string) => void
  onAuthorQuery: (value: string) => void
  onCategory: (value?: number) => void
  onAuthor: (value?: number) => void
  onOpen: (book: Book) => void
  onToggleFavorite: (bookId: number) => void
  onRetry: () => void
}

export function BookCatalog({ books, items, authors, query, authorQuery, selectedCategory, selectedAuthor, favoriteBookIds, recentBooks, status, error, onQuery, onAuthorQuery, onCategory, onAuthor, onOpen, onToggleFavorite, onRetry }: Props) {
  const [visibleCount, setVisibleCount] = useState(120)
  const hasBooks = books.length > 0
  const visibleBooks = books.slice(0, visibleCount)

  useEffect(() => {
    setVisibleCount(120)
  }, [books])

  return (
    <div className="layout">
      <aside className="catalog-index">
        <h3>Filter katalog</h3>
        <label className="field-label">
          <span>Cari kitab</span>
          <TextField value={query} onChange={event => onQuery(event.target.value)} placeholder="Cari kitab atau kategori..." />
        </label>

        <div className="filter-group">
          <div className="filter-title">
            <span>Fan ilmu</span>
            {selectedCategory && <Button onClick={() => onCategory(undefined)}>Reset</Button>}
          </div>
          {status === 'loading' && <Skeleton lines={5} />}
          {status === 'idle' && (
            <div className="index-list">
              {items.map(item => (
                <Button key={item.id} className={`index-row ${selectedCategory === item.id ? 'active' : ''}`} onClick={() => onCategory(item.id)}>
                  <span>{item.name}</span>
                  <small>{item.count}</small>
                </Button>
              ))}
            </div>
          )}
        </div>

        <div className="filter-group">
          <div className="filter-title">
            <span>Musonnif</span>
            {selectedAuthor && <Button onClick={() => onAuthor(undefined)}>Reset</Button>}
          </div>
          <label className="field-label">
            <span>Cari musonnif</span>
            <TextField value={authorQuery} onChange={event => onAuthorQuery(event.target.value)} placeholder="Cari musonnif..." />
          </label>
          {status === 'idle' && (
            <div className="index-list compact">
              {authors.slice(0, 24).map(author => (
                <Button key={author.id} className={`index-row ${selectedAuthor === author.id ? 'active' : ''}`} onClick={() => onAuthor(author.id)}>
                  <span>{author.name}</span>
                  <small>{author.count}</small>
                </Button>
              ))}
            </div>
          )}
        </div>
      </aside>

      <section className="catalog">
        <div className="section-heading">
          <span>Perpustakaan lokal</span>
          <h1>Pilih Kitab</h1>
        </div>

        {recentBooks.length > 0 && (
          <div className="recent-strip">
            <span>Terakhir dibaca</span>
            {recentBooks.map(item => <Button key={item.id} onClick={() => onOpen(item)} dir="rtl">{item.name}</Button>)}
          </div>
        )}

        {status === 'loading' && <Skeleton lines={10} />}
        {status === 'error' && <ErrorState message={error} retry={onRetry} />}
        {status === 'idle' && !hasBooks && (
          <div className="empty-illustration">
            <strong>لا نتيجة</strong>
            <ErrorState message="Kitab tidak ditemukan untuk filter ini." retry={onRetry} />
          </div>
        )}
        {status === 'idle' && hasBooks && (
          <>
          <div className="book-grid rich">
            {visibleBooks.map(book => {
              const isFavorite = favoriteBookIds.includes(book.id)
              return (
                <div key={book.id} className={`book-card-wrap ${isFavorite ? 'favorite' : ''}`}>
                  <Button className="favorite-toggle" onClick={() => onToggleFavorite(book.id)} aria-label={isFavorite ? 'Hapus favorit' : 'Tambah favorit'}>
                    {isFavorite ? '★' : '☆'}
                  </Button>
                  <Button className="book-card" onClick={() => onOpen(book)} dir="rtl">
                    <b>{book.name}</b>
                    <small>{book.authors || 'Tanpa musonnif'}</small>
                    <span>{book.category || 'Tanpa kategori'}</span>
                    <em>{book.volume_count ? `${book.volume_count} jilid` : 'Jilid Syamilah'}</em>
                  </Button>
                </div>
              )
            })}
          </div>
          {visibleCount < books.length && (
            <div className="load-more">
              <Button onClick={() => setVisibleCount(count => count + 120)}>Tampilkan lagi</Button>
              <span>{visibleCount} dari {books.length} kitab</span>
            </div>
          )}
          </>
        )}
      </section>
    </div>
  )
}
