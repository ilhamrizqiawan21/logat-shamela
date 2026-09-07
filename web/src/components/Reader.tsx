import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { Book, Bookmark, Chapter, Page, Token } from '../types'
import { ReaderAppearance } from './ReaderAppearance'
import { Button, ErrorState, Skeleton, StateCard, TextField } from './ui'

type Status = 'idle' | 'loading' | 'error'
type Part = { part: number; page_id: number }
export type ReaderPrefs = {
  fontSize: number
  lineHeight: number
  columnWidth: number
  fontFamily: 'amiri' | 'naskh'
  annotationSize?: number
  showAnnotations?: boolean
}

type TreeChapter = Chapter & { children: TreeChapter[] }

type ReaderIndexProps = {
  chapters: Chapter[]
  parts: Part[]
  bookmarks: Bookmark[]
  chapterQuery: string
  currentPage: number
  isOpen?: boolean
  onClose?: () => void
  onChapterQuery: (value: string) => void
  onPage: (page: number) => void
  onOpenBookmark: (bookmark: Bookmark) => void
  onManageBookmarks: () => void
}

function buildChapterTree(chapters: Chapter[]) {
  const nodes = new Map<number, TreeChapter>()
  chapters.forEach(chapter => nodes.set(chapter.id, { ...chapter, children: [] }))
  const roots: TreeChapter[] = []
  nodes.forEach(node => {
    const parent = nodes.get(node.parent)
    if (parent) parent.children.push(node)
    else roots.push(node)
  })
  return roots
}

function flattenVisible(nodes: TreeChapter[], collapsed: Set<number>, level = 0): Array<{ chapter: TreeChapter; level: number }> {
  return nodes.flatMap(node => {
    const current = [{ chapter: node, level }]
    return collapsed.has(node.id) ? current : current.concat(flattenVisible(node.children, collapsed, level + 1))
  })
}

function ReaderIndex({ chapters, parts, bookmarks, chapterQuery, currentPage, isOpen = false, onClose, onChapterQuery, onPage, onOpenBookmark, onManageBookmarks }: ReaderIndexProps) {
  const [collapsed, setCollapsed] = useState<Set<number>>(new Set())
  const tree = useMemo(() => buildChapterTree(chapters), [chapters])
  const activeChapterId = useMemo(() => {
    return [...chapters].reverse().find(chapter => chapter.page_id <= currentPage)?.id
  }, [chapters, currentPage])
  const rows = useMemo(() => {
    if (chapterQuery) return chapters.filter(chapter => chapter.title.includes(chapterQuery)).map(chapter => ({ chapter: { ...chapter, children: [] }, level: 0 }))
    return flattenVisible(tree, collapsed)
  }, [chapters, chapterQuery, tree, collapsed])

  const activePart = useMemo(() => [...parts].reverse().find(part => part.page_id <= currentPage)?.part, [parts, currentPage])

  const jump = (page: number) => {
    onPage(page)
    onClose?.()
  }

  const toggle = (id: number) => {
    setCollapsed(current => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <aside className={`reader-index ${isOpen ? 'mobile-open' : ''}`} aria-label="Indeks kitab" role={isOpen ? 'dialog' : undefined} aria-modal={isOpen || undefined}>
      <div className="reader-index-head">
        <div>
          <span>Indeks</span>
          <h2>Bab dan Juz</h2>
        </div>
        <Button className="icon-button close-index" onClick={onClose} aria-label="Tutup indeks">x</Button>
      </div>

      <h3>Juz / Jilid</h3>
      <div className="part-list" role="list" aria-label="Juz atau jilid">
        {parts.map(part => (
          <Button
            key={part.part}
            className={part.part === activePart ? 'active' : ''}
            onClick={() => jump(part.page_id)}
          >
            {part.part}
          </Button>
        ))}
      </div>

      <TextField value={chapterQuery} onChange={event => onChapterQuery(event.target.value)} placeholder="Cari bab..." />
      <div className="chapter-list">
        {rows.length === 0 && <p className="muted small">Tidak ada bab yang cocok.</p>}
        {rows.map(({ chapter, level }) => {
          const hasChildren = chapter.children.length > 0
          const isCollapsed = collapsed.has(chapter.id)
          return (
            <div key={chapter.id} className="chapter-shell" style={{ '--chapter-level': level } as CSSProperties}>
              {hasChildren && !chapterQuery && (
                <Button className="chapter-toggle" onClick={() => toggle(chapter.id)} aria-label={isCollapsed ? 'Buka cabang bab' : 'Tutup cabang bab'}>
                  {isCollapsed ? '+' : '-'}
                </Button>
              )}
              <Button
                className={`chapter-row ${chapter.id === activeChapterId ? 'active' : ''}`}
                onClick={() => jump(chapter.page_id)}
                dir="rtl"
              >
                <span>{chapter.title}</span>
                <small>Hal. {chapter.page_id}</small>
              </Button>
            </div>
          )
        })}
      </div>

      <div className="bookmark-list">
        <h3>Bookmark terbaru</h3>
        <Button className="manage-bookmarks" onClick={() => { onManageBookmarks(); onClose?.() }}>Kelola semua bookmark ({bookmarks.length})</Button>
        {bookmarks.length === 0 && <p className="muted small">Belum ada halaman yang ditandai.</p>}
        {bookmarks.slice(0, 12).map(bookmark => (
          <Button key={`${bookmark.book_id}-${bookmark.page_id}`} className="bookmark-row" onClick={() => { onOpenBookmark(bookmark); onClose?.() }} dir="rtl">
            <span>{bookmark.book_name}</span>
            <small>Hal. {bookmark.page_id}</small>
          </Button>
        ))}
      </div>
    </aside>
  )
}

type Props = {
  book?: Book
  page?: Page
  pageNo: number
  bookmarks: Bookmark[]
  chapters: Chapter[]
  parts: Part[]
  chapterQuery: string
  status: Status
  error: string
  focusMode: boolean
  prefs: ReaderPrefs
  onPrefs: (prefs: ReaderPrefs) => void
  onChapterQuery: (value: string) => void
  onChooseBook: () => void
  onPage: (page: number) => void
  onRetry: () => void
  onFocusMode: (value: boolean) => void
  onToggleBookmark: () => void
  onAskAI: () => void
  aiEnabled: boolean
  onOpenBookmark: (bookmark: Bookmark) => void
  onManageBookmarks: () => void
  onEditToken: (token: Token) => void
}

export function Reader({ book, page, pageNo, bookmarks, chapters, parts, chapterQuery, status, error, focusMode, prefs, onPrefs, onChapterQuery, onChooseBook, onPage, onRetry, onFocusMode, onToggleBookmark, onAskAI, aiEnabled, onOpenBookmark, onManageBookmarks, onEditToken }: Props) {
  const [indexOpen, setIndexOpen] = useState(false)
  const [activeWord, setActiveWord] = useState(0)
  const [pageInput, setPageInput] = useState(String(pageNo))
  useEffect(() => setPageInput(String(pageNo)), [book?.id, pageNo])
  const readerTop = useRef<HTMLElement>(null)
  const indexReturnFocus = useRef<HTMLElement | null>(null)

  const closeIndex = () => {
    setIndexOpen(false)
    window.setTimeout(() => indexReturnFocus.current?.focus(), 0)
  }

  const openIndex = (target: HTMLElement) => {
    indexReturnFocus.current = target
    setIndexOpen(true)
  }

  useEffect(() => {
    if (!indexOpen) return
    const panel = document.querySelector<HTMLElement>('.reader-index.mobile-open')
    const focusable = () => Array.from(panel?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), [tabindex="0"]') ?? [])
    focusable()[0]?.focus()
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); closeIndex(); return }
      if (event.key !== 'Tab') return
      const items = focusable()
      if (!items.length) return
      const first = items[0]
      const last = items[items.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [indexOpen])

  useEffect(() => {
    const firstWord = page?.tokens.findIndex(token => token.is_word) ?? -1
    setActiveWord(Math.max(0, firstWord))
  }, [page?.book_id, page?.page_id])

  const moveWordFocus = (current: number, direction: -1 | 1) => {
    if (!page) return
    let next = current + direction
    while (next >= 0 && next < page.tokens.length && !page.tokens[next].is_word) next += direction
    if (next < 0 || next >= page.tokens.length) return
    setActiveWord(next)
    window.requestAnimationFrame(() => document.querySelector<HTMLElement>('[data-word-position="' + next + '"]')?.focus())
  }

  useEffect(() => {
    if (!book || status !== 'idle' || page?.page_id !== pageNo || page.book_id !== book.id) return
    const key = `logat:scroll:${book.id}:${pageNo}`
    let saved: string | null = null
    try { saved = localStorage.getItem(key) } catch {}
    const position = Number(saved)
    if (saved !== null && Number.isFinite(position) && position >= 0) window.scrollTo(0, position)
    else readerTop.current?.scrollIntoView({ block: 'start' })
    let lastPosition = window.scrollY
    const save = () => { try { localStorage.setItem(key, String(lastPosition)) } catch {} }
    const onScroll = () => { lastPosition = window.scrollY }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('pagehide', save)
    return () => {
      save()
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('pagehide', save)
    }
  }, [book?.id, page?.page_id, pageNo, status])

  if (!book) {
    return (
      <section className="empty-reader">
        <StateCard title="Belum ada kitab aktif" message="Pilih kitab dari Daftar Kitab untuk mulai membaca." action={<Button onClick={onChooseBook}>Pilih kitab</Button>} />
      </section>
    )
  }

  const readerStyle = {
    '--annotation-font-size': `${prefs.annotationSize ?? 13}px`,
    '--reader-font-size': `${prefs.fontSize}px`,
    '--reader-line-height': prefs.lineHeight,
    '--reader-width': `${prefs.columnWidth}px`,
    '--reader-font': prefs.fontFamily === 'amiri' ? 'Amiri' : 'Noto Naskh Arabic',
  } as CSSProperties

  return (
    <div className={`reading-layout ${indexOpen ? 'index-visible' : ''} ${focusMode ? 'reader-focus' : ''}`}>
      {!focusMode && (
        <ReaderIndex
          chapters={chapters}
          parts={parts}
          bookmarks={bookmarks}
          chapterQuery={chapterQuery}
          currentPage={pageNo}
          isOpen={indexOpen}
          onClose={closeIndex}
          onChapterQuery={onChapterQuery}
          onPage={onPage}
          onOpenBookmark={onOpenBookmark}
          onManageBookmarks={onManageBookmarks}
        />
      )}
      <div
        className={`sheet-backdrop ${indexOpen ? 'show' : ''}`}
        role="button"
        tabIndex={indexOpen ? 0 : -1}
        aria-label="Tutup indeks"
        onClick={closeIndex}
        onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); closeIndex() } }}
      />

      <section className="reader-screen" ref={readerTop}>
        <div className="reader-title" dir="rtl">
          <div>
            <h1>{book.name}</h1>
            <p>{book.authors}</p>
          </div>
          <div className="title-actions">
            <Button className="index-trigger" onClick={event => openIndex(event.currentTarget)}>Indeks</Button>
            <Button disabled={status !== 'idle' || !page} className={`bookmark-page ${page?.bookmarked ? 'active' : ''}`} onClick={onToggleBookmark} aria-label={page?.bookmarked ? 'Hapus bookmark halaman' : 'Bookmark halaman'}>
              {page?.bookmarked ? '★ Bookmark' : '☆ Bookmark'}
            </Button>
            <Button disabled={status !== 'idle' || !page || !aiEnabled} title={aiEnabled ? 'Buka asisten AI' : 'Aktifkan AI di Pengaturan'} className="ai-trigger" onClick={onAskAI}>{aiEnabled ? 'Asisten AI' : 'AI nonaktif'}</Button>
            <Button className="focus-toggle" onClick={() => onFocusMode(!focusMode)}>{focusMode ? 'Tampilkan panel' : 'Mode fokus'}</Button>
          </div>
        </div>

        <nav className="reader-nav" aria-label="Navigasi halaman">
          <Button disabled={status === 'loading' || pageNo <= 1} onClick={() => onPage(Math.max(1, pageNo - 1))}>← Sebelumnya</Button>
          <form className="page-jump" onSubmit={event => { event.preventDefault(); const target = Number(pageInput); if (Number.isSafeInteger(target) && target >= 1) onPage(target) }}>
            <TextField aria-label="Nomor halaman" required value={pageInput} type="number" min={1} step={1} onChange={event => setPageInput(event.target.value)} />
            <Button type="submit" disabled={status === 'loading'}>Buka</Button>
          </form>
          <Button disabled={status === 'loading'} onClick={() => onPage(pageNo + 1)}>Berikutnya →</Button>
        </nav>

        <details className="reader-appearance">
          <summary>Tampilan bacaan</summary>
          <ReaderAppearance prefs={prefs} onPrefs={onPrefs} />
        </details>

        <p className="meta">Jilid {page?.part ?? '-'} · Halaman cetak {page?.printed_page ?? '-'}</p>

        <div className={`page-stage ${status === 'loading' ? 'loading' : ''}`} style={readerStyle}>
          {status === 'loading' && <Skeleton lines={12} />}
          {status === 'error' && <ErrorState message={error} retry={onRetry} />}
          {status === 'idle' && (
            <article dir="rtl" lang="ar" aria-label="Halaman kitab">
              {page?.tokens.map((token, index) => {
                const annotation = token.index === null ? undefined : page.annotations[String(token.index)]
                if (!token.is_word) return <span key={index}>{token.text}</span>
                return (
                  <Button key={index} data-word-position={index} tabIndex={activeWord === index ? 0 : -1} className={annotation && (prefs.showAnnotations ?? true) ? 'word annotated' : 'word'} onFocus={() => setActiveWord(index)} onKeyDown={event => { if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); moveWordFocus(index, event.key === 'ArrowRight' ? -1 : 1) } }} onClick={() => onEditToken(token)}>
                    <span>{token.text}</span>
                    {annotation && (prefs.showAnnotations ?? true) && <small lang="id">{annotation.meaning}</small>}
                    <em className="word-popover" dir="rtl">
                      {token.prev_word} <b>{token.text}</b> {token.next_word}
                    </em>
                  </Button>
                )
              })}
            </article>
          )}
        </div>
      </section>
    </div>
  )
}
