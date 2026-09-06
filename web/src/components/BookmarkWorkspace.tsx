import { useEffect, useMemo, useRef, useState } from 'react'
import type { Bookmark } from '../types'
import { Button, ErrorState, Skeleton, StateCard, TextField } from './ui'

type Props = {
  bookmarks: Bookmark[]
  status: 'idle' | 'loading' | 'error'
  error: string
  onRetry: () => void
  onOpen: (bookmark: Bookmark) => void
  onRemove: (bookmark: Bookmark) => Promise<void>
}

export function BookmarkWorkspace({ bookmarks, status, error, onRetry, onOpen, onRemove }: Props) {
  const [query, setQuery] = useState('')
  const [bookId, setBookId] = useState('')
  const [limit, setLimit] = useState(24)
  const [busy, setBusy] = useState<string>()
  const [removeError, setRemoveError] = useState('')
  const pending = useRef(false)
  const books = useMemo(() => [...new Map(bookmarks.map(item => [String(item.book_id), item.book_name])).entries()], [bookmarks])
  const normalized = query.trim().toLocaleLowerCase()
  const filtered = bookmarks.filter(item => (!bookId || String(item.book_id) === bookId) && `${item.book_name} ${item.authors} ${item.page_id}`.toLocaleLowerCase().includes(normalized))
  useEffect(() => setLimit(24), [query, bookId])
  const remove = async (bookmark: Bookmark) => {
    if (pending.current) return
    pending.current = true
    setBusy(`${bookmark.book_id}:${bookmark.page_id}`); setRemoveError('')
    try { await onRemove(bookmark) } catch (error) { setRemoveError(error instanceof Error ? error.message : 'Bookmark belum dapat dihapus. Coba lagi.') }
    finally { pending.current = false; setBusy(undefined) }
  }
  return <section className="bookmark-screen">
    <div className="section-heading"><span>Koleksi halaman</span><h1>Bookmark</h1><p className="muted">Temukan kembali halaman yang Anda tandai di seluruh kitab.</p></div>
    <div className="bookmark-filters">
      <label className="field-label"><span>Cari bookmark</span><TextField type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Judul, musonnif, atau nomor halaman…" /></label>
      <label className="field-label"><span>Kitab</span><select value={bookId} onChange={event => setBookId(event.target.value)}><option value="">Semua kitab</option>{books.map(([id, name]) => <option key={id} value={id}>{name}</option>)}</select></label>
    </div>
    {status === 'loading' && <Skeleton lines={6} />}
    {status === 'error' && <ErrorState message={error} retry={onRetry} />}
    {removeError && <p role="alert">{removeError}</p>}
    {status === 'idle' && <>
      <p className="muted small" role="status">{filtered.length} dari {bookmarks.length} bookmark</p>
      {!filtered.length && <StateCard title={bookmarks.length ? 'Tidak ada bookmark yang cocok' : 'Belum ada bookmark'} message={bookmarks.length ? 'Coba kata kunci lain atau hapus filter.' : 'Gunakan tombol Bookmark saat membaca untuk menandai halaman.'} action={(query || bookId) ? <Button onClick={() => { setQuery(''); setBookId('') }}>Hapus filter</Button> : undefined} />}
      <div className="bookmark-results">{filtered.slice(0, limit).map(bookmark => {
        const key = `${bookmark.book_id}:${bookmark.page_id}`
        return <div className="bookmark-item" key={key}>
          <Button className="bookmark-open" onClick={() => onOpen(bookmark)}><b dir="rtl" lang="ar">{bookmark.book_name}</b><span dir="rtl" lang="ar">{bookmark.authors}</span><small>Halaman {bookmark.page_id}</small></Button>
          <Button className="bookmark-remove" disabled={Boolean(busy)} aria-label={`Hapus bookmark ${bookmark.book_name}, halaman ${bookmark.page_id}`} onClick={() => void remove(bookmark)}>{busy === key ? 'Menghapus…' : 'Hapus'}</Button>
        </div>
      })}</div>
      {limit < filtered.length && <div className="load-more"><Button onClick={() => setLimit(current => current + 24)}>Tampilkan lagi</Button><span>{Math.min(limit, filtered.length)} dari {filtered.length} bookmark</span></div>}
    </>}
  </section>
}
