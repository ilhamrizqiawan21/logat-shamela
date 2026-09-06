import { useEffect, useState } from 'react'
import type { Book, Item } from '../types'
import { Button, ErrorState, Skeleton, StateCard, TextField } from './ui'

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
  readingPages?: Record<string, number>
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

export function BookCatalog({ books, items, authors, query, authorQuery, selectedCategory, selectedAuthor, favoriteBookIds, recentBooks, readingPages = {}, status, error, onQuery, onAuthorQuery, onCategory, onAuthor, onOpen, onToggleFavorite, onRetry }: Props) {
  const [visibleCount, setVisibleCount] = useState(24)
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const filteredBooks = favoritesOnly ? books.filter(book => favoriteBookIds.includes(book.id)) : books
  const hasBooks = filteredBooks.length > 0
  const visibleBooks = filteredBooks.slice(0, visibleCount)
  const hasFilters = Boolean(query || authorQuery || selectedCategory !== undefined || selectedAuthor !== undefined)
  const resetFilters = () => { onQuery(''); onAuthorQuery(''); onCategory(undefined); onAuthor(undefined) }

  useEffect(() => {
    setVisibleCount(24)
  }, [books, favoritesOnly])

  return (
    <div className={`home-screen ${recentBooks.length ? 'returning-reader' : ''}`}>
      {recentBooks.length > 0 && <section className="home-recent" aria-label="Terakhir dibaca">
        <div><h2>Lanjutkan membaca</h2><p>Lanjutkan dari halaman terakhir yang Anda baca.</p></div>
        <div className="recent-strip">{recentBooks.map(item => <Button key={item.id} onClick={() => onOpen(item)} dir="rtl" lang="ar">{item.name}{readingPages[item.id] && <small dir="ltr">Lanjutkan halaman {readingPages[item.id]}</small>}</Button>)}</div>
      </section>}
      <section className="home-intro" aria-labelledby="home-title">
        <div>
          <span className="home-eyebrow">PERPUSTAKAAN LOKAL · LOGAT SYAMILAH</span>
          <h1 id="home-title">Ruang untuk mendalami kitab.</h1>
          <p>Temukan kitab, baca dengan tenang, dan simpan makna di setiap kata.</p>
          <label className="home-search field-label">
            <span>Cari di perpustakaan</span>
            <TextField type="search" value={query} onChange={event => onQuery(event.target.value)} placeholder="Ketik judul kitab atau musonnif…" />
          </label>
        </div>
        <div className="home-calligraphy" lang="ar" dir="rtl" aria-hidden="true">بِسْمِ اللَّهِ<br /><small>الرَّحْمَٰنِ الرَّحِيمِ</small></div>
      </section>
      <div className="home-toolbar">
        <div className="home-tabs" aria-label="Pilihan koleksi">
          <Button aria-pressed={!favoritesOnly} className={!favoritesOnly ? 'selected' : ''} onClick={() => setFavoritesOnly(false)}>Daftar Kitab</Button>
          <Button aria-pressed={favoritesOnly} className={favoritesOnly ? 'selected' : ''} onClick={() => setFavoritesOnly(true)}>Favorit <span>{favoriteBookIds.length}</span></Button>
        </div>
        <Button className="home-filter-toggle" aria-expanded={filtersOpen} aria-controls="catalog-filters" onClick={() => setFiltersOpen(!filtersOpen)}>Filter {hasFilters ? '•' : ''}</Button>
      </div>
      <div className="layout home-layout">
      <aside id="catalog-filters" className={`catalog-index ${filtersOpen ? 'filters-open' : ''}`}>
        <div className="filter-title"><h3>Filter katalog</h3>{hasFilters && <Button onClick={resetFilters}>Reset semua</Button>}</div>
        <div className="filter-group">
          <div className="filter-title">
            <span>Fan ilmu</span>
            {selectedCategory !== undefined && <Button onClick={() => onCategory(undefined)}>Reset</Button>}
          </div>
          {status === 'loading' && <Skeleton lines={5} />}
          {status === 'idle' && (
            <div className="index-list">
              {items.map(item => (
                <Button key={item.id} aria-pressed={selectedCategory === item.id} className={`index-row ${selectedCategory === item.id ? 'active' : ''}`} onClick={() => onCategory(item.id)}>
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
            {selectedAuthor !== undefined && <Button onClick={() => onAuthor(undefined)}>Reset</Button>}
          </div>
          <label className="field-label">
            <span>Cari musonnif</span>
            <TextField value={authorQuery} onChange={event => onAuthorQuery(event.target.value)} placeholder="Cari musonnif..." />
          </label>
          {status === 'idle' && (
            <div className="index-list compact">
              {authors.slice(0, 24).map(author => (
                <Button key={author.id} aria-pressed={selectedAuthor === author.id} className={`index-row ${selectedAuthor === author.id ? 'active' : ''}`} onClick={() => onAuthor(author.id)}>
                  <span>{author.name}</span>
                  <small>{author.count}</small>
                </Button>
              ))}
            </div>
          )}
        </div>
      </aside>

      <section className="catalog">
        <div className="catalog-heading">
          <div><h2>{favoritesOnly ? 'Kitab favorit' : 'Pilih Kitab'}</h2><p>{hasFilters ? 'Hasil sesuai pencarian dan filter Anda.' : 'Jelajahi khazanah ilmu dalam koleksi Anda.'}</p></div>
          <span role="status">{status === 'idle' ? `${filteredBooks.length.toLocaleString('id-ID')} kitab` : status === 'loading' ? 'Memuat…' : 'Belum tersedia'}</span>
        </div>
        {status === 'loading' && <Skeleton lines={10} />}
        {status === 'error' && <ErrorState message={error} retry={onRetry} />}
        {status === 'idle' && !hasBooks && (
          <div className="empty-illustration">
            <strong>لا نتيجة</strong>
            <StateCard title={favoritesOnly ? "Belum ada favorit yang cocok" : "Kitab tidak ditemukan"} message={favoritesOnly ? "Tandai kitab dengan tombol bintang untuk mengumpulkannya di sini." : "Coba kata kunci lain atau hapus filter untuk melihat koleksi."} action={hasFilters ? <Button onClick={resetFilters}>Hapus filter</Button> : favoritesOnly ? <Button onClick={() => setFavoritesOnly(false)}>Jelajahi kitab</Button> : undefined} />
          </div>
        )}
        {status === 'idle' && hasBooks && (
          <>
          <div className="book-grid rich">
            {visibleBooks.map(book => {
              const isFavorite = favoriteBookIds.includes(book.id)
              return (
                <div key={book.id} className={`book-card-wrap ${isFavorite ? 'favorite' : ''}`}>
                  <Button className="favorite-toggle" onClick={() => onToggleFavorite(book.id)} aria-pressed={isFavorite} aria-label={`${isFavorite ? 'Hapus favorit' : 'Tambah favorit'}: ${book.name}`}>
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
          {visibleCount < filteredBooks.length && (
            <div className="load-more">
              <Button onClick={() => setVisibleCount(count => count + 24)}>Tampilkan lagi</Button>
              <span>{visibleCount} dari {filteredBooks.length} kitab</span>
            </div>
          )}
          </>
        )}
      </section>
      </div>
    </div>
  )
}
