import { useEffect, useMemo, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import type { Book, Bookmark, Chapter, Page, Token } from '../types'
import { Button, ErrorState, Skeleton, StateCard, TextField } from './ui'

type Status = 'idle' | 'loading' | 'error'
type Part = { part: number; page_id: number }
export type ReaderPrefs = {
  fontSize: number
  lineHeight: number
  columnWidth: number
  fontFamily: 'amiri' | 'naskh'
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

function ReaderIndex({ chapters, parts, bookmarks, chapterQuery, currentPage, isOpen = false, onClose, onChapterQuery, onPage, onOpenBookmark }: ReaderIndexProps) {
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
    <aside className={`reader-index ${isOpen ? 'mobile-open' : ''}`} aria-label="Indeks kitab">
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
        <h3>Bookmark</h3>
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
  onOpenBookmark: (bookmark: Bookmark) => void
  onEditToken: (token: Token) => void
}

export function Reader({ book, page, pageNo, bookmarks, chapters, parts, chapterQuery, status, error, focusMode, prefs, onPrefs, onChapterQuery, onChooseBook, onPage, onRetry, onFocusMode, onToggleBookmark, onAskAI, onOpenBookmark, onEditToken }: Props) {
  const [indexOpen, setIndexOpen] = useState(false)
  const readerTop = useRef<HTMLElement>(null)

  useEffect(() => {
    readerTop.current?.scrollIntoView({ block: 'start' })
  }, [pageNo])

  if (!book) {
    return (
      <section className="empty-reader">
        <StateCard title="Belum ada kitab aktif" message="Pilih kitab dari Daftar Kitab untuk mulai membaca." action={<Button onClick={onChooseBook}>Pilih kitab</Button>} />
      </section>
    )
  }

  const readerStyle = {
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
          onClose={() => setIndexOpen(false)}
          onChapterQuery={onChapterQuery}
          onPage={onPage}
          onOpenBookmark={onOpenBookmark}
        />
      )}
      <div
        className={`sheet-backdrop ${indexOpen ? 'show' : ''}`}
        role="button"
        tabIndex={indexOpen ? 0 : -1}
        aria-label="Tutup indeks"
        onClick={() => setIndexOpen(false)}
        onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); setIndexOpen(false) } }}
      />

      <section className="reader-screen" ref={readerTop}>
        <div className="reader-title" dir="rtl">
          <div>
            <h1>{book.name}</h1>
            <p>{book.authors}</p>
          </div>
          <div className="title-actions">
            <Button className="index-trigger" onClick={() => setIndexOpen(true)}>Indeks</Button>
            <Button className={`bookmark-page ${page?.bookmarked ? 'active' : ''}`} onClick={onToggleBookmark} aria-label={page?.bookmarked ? 'Hapus bookmark halaman' : 'Bookmark halaman'}>
              {page?.bookmarked ? '★ Bookmark' : '☆ Bookmark'}
            </Button>
            <Button className="ai-trigger" onClick={onAskAI}>Asisten AI</Button>
            <Button className="focus-toggle" onClick={() => onFocusMode(!focusMode)}>{focusMode ? 'Tampilkan panel' : 'Mode fokus'}</Button>
          </div>
        </div>

        <nav className="reader-nav" aria-label="Navigasi halaman">
          <Button disabled={status === 'loading'} onClick={() => onPage(Math.max(1, pageNo - 1))}>← Sebelumnya</Button>
          <TextField disabled={status === 'loading'} value={pageNo} type="number" min={1} onChange={event => onPage(Number(event.target.value) || 1)} />
          <Button disabled={status === 'loading'} onClick={() => onPage(pageNo + 1)}>Berikutnya →</Button>
        </nav>

        <div className="reader-toolbar" aria-label="Pengaturan tampilan reader">
          <label><span>Ukuran <output>{prefs.fontSize}px</output></span><input aria-label="Ukuran huruf" type="range" min="24" max="44" value={prefs.fontSize} onChange={event => onPrefs({ ...prefs, fontSize: Number(event.target.value) })} /></label>
          <label><span>Spasi <output>{prefs.lineHeight.toFixed(2)}</output></span><input aria-label="Jarak antarbaris" type="range" min="1.8" max="2.7" step="0.05" value={prefs.lineHeight} onChange={event => onPrefs({ ...prefs, lineHeight: Number(event.target.value) })} /></label>
          <label><span>Lebar <output>{prefs.columnWidth}px</output></span><input aria-label="Lebar kolom bacaan" type="range" min="720" max="1240" step="20" value={prefs.columnWidth} onChange={event => onPrefs({ ...prefs, columnWidth: Number(event.target.value) })} /></label>
          <div className="segmented" role="group" aria-label="Font Arab">
            <Button className={prefs.fontFamily === 'amiri' ? 'active' : ''} onClick={() => onPrefs({ ...prefs, fontFamily: 'amiri' })}>Amiri</Button>
            <Button className={prefs.fontFamily === 'naskh' ? 'active' : ''} onClick={() => onPrefs({ ...prefs, fontFamily: 'naskh' })}>Naskh</Button>
          </div>
        </div>

        <p className="meta">Jilid {page?.part ?? '-'} · Halaman cetak {page?.printed_page ?? '-'}</p>

        <div className={`page-stage ${status === 'loading' ? 'loading' : ''}`} style={readerStyle}>
          {status === 'loading' && <Skeleton lines={12} />}
          {status === 'error' && <ErrorState message={error} retry={onRetry} />}
          {status === 'idle' && (
            <article dir="rtl" aria-label="Halaman kitab">
              {page?.tokens.map((token, index) => {
                const annotation = token.index === null ? undefined : page.annotations[String(token.index)]
                if (!token.is_word) return <span key={index}>{token.text}</span>
                return (
                  <Button key={index} className={annotation ? 'word annotated' : 'word'} onClick={() => onEditToken(token)}>
                    <span>{token.text}</span>
                    {annotation && <small>{annotation.meaning}</small>}
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
