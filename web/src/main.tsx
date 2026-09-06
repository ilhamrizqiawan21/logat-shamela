import { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { aiStatus, api, exportBackup, importBackup, searchAdvanced, switchAIProvider, toggleAI } from './api'
import { AnnotationEditor } from './components/AnnotationEditor'
import { AITutorPanel } from './components/AITutorPanel'
import { BookCatalog } from './components/BookCatalog'
import { BookmarkWorkspace } from './components/BookmarkWorkspace'
import { Reader } from './components/Reader'
import type { ReaderPrefs } from './components/Reader'
import { SearchWorkspace } from './components/SearchWorkspace'
import { SettingsPanel } from './components/SettingsPanel'
import { AppShell } from './components/ui'
import type { Book, Bookmark, Chapter, Item, Page, Result, Token } from './types'
import './style.css'

type View = 'books' | 'reader' | 'search' | 'settings' | 'bookmarks'
type Status = 'idle' | 'loading' | 'error'
type Part = { part: number; page_id: number }
type Theme = 'system' | 'light' | 'dark'
const defaultReaderPrefs: ReaderPrefs = { fontSize: 32, lineHeight: 2.25, columnWidth: 980, fontFamily: 'amiri', annotationSize: 13, showAnnotations: true }

const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Terjadi kesalahan'
const readStored = <T,>(key: string, fallback: T): T => {
  if (typeof localStorage === 'undefined') return fallback
  try { return JSON.parse(localStorage.getItem(key) || '') as T } catch { return fallback }
}
const writeStored = (key: string, value: unknown) => {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(key, JSON.stringify(value)) } catch { /* Reading remains available when storage is full or blocked. */ }
}

export function App() {
  const [view, setView] = useState<View>('books')
  const [books, setBooks] = useState<Book[]>([])
  const [searchBooks, setSearchBooks] = useState<Book[]>([])
  const [searchBooksStatus, setSearchBooksStatus] = useState<Status>('loading')
  const [searchBooksError, setSearchBooksError] = useState('')
  const [readingPages, setReadingPages] = useState<Record<string, number>>(() => {
    const stored = readStored<Record<string, number>>('logat:readingPages', {})
    return stored && typeof stored === 'object' ? Object.fromEntries(Object.entries(stored).filter(([, value]) => Number.isSafeInteger(value) && value > 0)) : {}
  })
  const pageRequest = useRef(0)
  const indexRequest = useRef(0)
  const suggestionRequest = useRef(0)
  const navigationRequest = useRef(0)
  const resetEditor = () => {
    suggestionRequest.current++
    setSelectedToken(undefined)
    setAiOpen(false)
    setMeaning('')
    setDraftStatus('idle')
    setSuggestions([])
    setSuggestionStatus('idle')
  }
  const loadSearchBooks = () => {
    setSearchBooksStatus('loading')
    api.books().then(result => { setSearchBooks(result); setSearchBooksStatus('idle'); setSearchBooksError('') })
      .catch(error => { setSearchBooksError(errorMessage(error)); setSearchBooksStatus('error') })
  }
  useEffect(loadSearchBooks, [])
  useEffect(() => writeStored('logat:readingPages', readingPages), [readingPages])
  const [items, setItems] = useState<Item[]>([])
  const [authors, setAuthors] = useState<Item[]>([])
  const [query, setQuery] = useState('')
  const [authorQuery, setAuthorQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<number>()
  const [selectedAuthor, setSelectedAuthor] = useState<number>()
  const [book, setBook] = useState<Book>()
  const [pageNo, setPageNo] = useState(1)
  const [readerVersion, setReaderVersion] = useState(0)
  const [page, setPage] = useState<Page>()
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [parts, setParts] = useState<Part[]>([])
  const [chapterQuery, setChapterQuery] = useState('')
  const [pickedBookIds, setPickedBookIds] = useState<number[]>([])
  const [term, setTerm] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
  const [bookmarksStatus, setBookmarksStatus] = useState<Status>('loading')
  const [bookmarksError, setBookmarksError] = useState('')
  const bookmarksRequest = useRef(0)
  const [draftStatus, setDraftStatus] = useState<'saved' | 'error' | 'idle'>('idle')
  const [selectedToken, setSelectedToken] = useState<Token>()
  const [aiOpen, setAiOpen] = useState(false)
  const [aiEnabled, setAiEnabled] = useState(false)
  const [aiProvider, setAiProvider] = useState('')
  const [aiModel, setAiModel] = useState('')
  const [meaning, setMeaning] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [suggestionStatus, setSuggestionStatus] = useState<Status>('idle')
  const [toast, setToast] = useState('')
  const [focusMode, setFocusMode] = useState(false)
  const [theme, setTheme] = useState<Theme>(() => readStored('logat:theme', 'system'))
  const [readerPrefs, setReaderPrefs] = useState<ReaderPrefs>(() => readStored('logat:readerPrefs', defaultReaderPrefs))
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [debouncedAuthorQuery, setDebouncedAuthorQuery] = useState('')
  const [catalogStatus, setCatalogStatus] = useState<Status>('loading')
  const [readerStatus, setReaderStatus] = useState<Status>('idle')
  const [searchStatus, setSearchStatus] = useState<Status>('idle')
  const [hasSearched, setHasSearched] = useState(false)
  const [catalogError, setCatalogError] = useState('')
  const [readerError, setReaderError] = useState('')
  const [searchError, setSearchError] = useState('')
  const [favoriteBookIds, setFavoriteBookIds] = useState<number[]>(() => readStored('logat:favorites', []))
  const [recentBooks, setRecentBooks] = useState<Book[]>(() => readStored('logat:recentBooks', []))
  const [recentSearches, setRecentSearches] = useState<string[]>(() => readStored('logat:recentSearches', []))

  const catalogRequest = useRef(0)
  const loadCatalog = () => {
    const request = ++catalogRequest.current
    setCatalogStatus('loading')
    Promise.all([api.books(debouncedQuery, selectedCategory, selectedAuthor), api.categories(), api.authors(debouncedAuthorQuery)])
      .then(([loadedBooks, loadedItems, loadedAuthors]) => {
        if (request !== catalogRequest.current) return
        setBooks(loadedBooks)
        setItems(loadedItems)
        setAuthors(loadedAuthors)
        setCatalogError('')
        setCatalogStatus('idle')
      })
      .catch(error => {
        if (request !== catalogRequest.current) return
        setCatalogError(errorMessage(error))
        setCatalogStatus('error')
      })
  }

  const openBook = (nextBook: Book, requestedPage?: number) => {
    const nextPage = Math.max(1, Number.isSafeInteger(requestedPage) ? requestedPage! : readingPages[nextBook.id] || 1)
    pageRequest.current++
    navigationRequest.current++
    const request = ++indexRequest.current
    resetEditor()
    setPage(undefined)
    setChapters([])
    setParts([])
    setChapterQuery('')
    setReaderStatus('loading')
    setReaderError('')
    setReaderVersion(current => current + 1)
    setBook(nextBook)
    setPageNo(nextPage)
    setView('reader')
    window.history.replaceState(null, '', `/?book=${nextBook.id}&page=${nextPage}`)
    setRecentBooks(current => [nextBook, ...current.filter(item => item.id !== nextBook.id)].slice(0, 6))
    Promise.all([api.index(nextBook.id), api.parts(nextBook.id)])
      .then(([loadedChapters, loadedParts]) => {
        if (request !== indexRequest.current) return
        setChapters(loadedChapters)
        setParts(loadedParts)
      })
      .catch(error => { if (request === indexRequest.current) setToast(`Indeks tidak dapat dimuat: ${errorMessage(error)}`) })
  }

  const openBookById = (bookId: number, targetPage: number) => {
    const request = ++navigationRequest.current
    api.book(bookId).then(loadedBook => {
      if (request === navigationRequest.current) openBook(loadedBook, targetPage)
    }).catch(error => { if (request === navigationRequest.current) setToast(errorMessage(error)) })
  }

  const loadPage = (targetBook: Book, targetPage: number) => {
    const request = ++pageRequest.current
    setReaderStatus('loading')
    setReaderError('')
    api.page(targetBook.id, targetPage)
      .then(loadedPage => {
        if (request !== pageRequest.current) return
        setPage(loadedPage)
        setReadingPages(current => ({ ...current, [targetBook.id]: targetPage }))
        setReaderStatus('idle')
      })
      .catch(error => {
        if (request !== pageRequest.current) return
        setReaderError(errorMessage(error))
        setReaderStatus('error')
      })
  }

  const loadBookmarks = () => {
    const request = ++bookmarksRequest.current
    setBookmarksStatus('loading')
    api.bookmarks().then(result => {
      if (request !== bookmarksRequest.current) return
      setBookmarks(result); setBookmarksStatus('idle'); setBookmarksError('')
    }).catch(error => {
      if (request !== bookmarksRequest.current) return
      setBookmarksStatus('error'); setBookmarksError(errorMessage(error))
    })
  }

  const goToPage = (nextPage: number) => {
    if (!Number.isSafeInteger(nextPage)) return
    const safePage = Math.max(1, nextPage)
    if (safePage === pageNo) return
    pageRequest.current++
    navigationRequest.current++
    resetEditor()
    setPage(undefined)
    setReaderStatus('loading')
    setPageNo(safePage)
    if (book) window.history.replaceState(null, '', `/?book=${book.id}&page=${safePage}`)
  }

  const draftKey = (token: Token) => `logat:draft:${book?.id}:${pageNo}:${token.index}`
  const updateMeaning = (value: string) => {
    setMeaning(value)
    if (!book || !selectedToken) return
    try {
      localStorage.setItem(draftKey(selectedToken), JSON.stringify({ word: selectedToken.text, meaning: value }))
      setDraftStatus('saved')
    } catch { setDraftStatus('error') }
  }
  const editToken = (token: Token, currentPage = page) => {
    const request = ++suggestionRequest.current
    setSelectedToken(token)
    const draft = readStored<{ word: string, meaning: string } | null>(draftKey(token), null)
    const restored = draft?.word === token.text && typeof draft.meaning === 'string'
    setMeaning(restored ? draft!.meaning : currentPage?.annotations[String(token.index)]?.meaning || '')
    setDraftStatus(restored ? 'saved' : 'idle')
    setSuggestions([])
    setSuggestionStatus(token.normalized ? 'loading' : 'idle')
    if (token.normalized) api.suggestions(token.normalized).then(result => {
      if (request !== suggestionRequest.current) return
      setSuggestions(result.suggestions); setSuggestionStatus('idle')
    }).catch(() => { if (request === suggestionRequest.current) setSuggestionStatus('error') })
  }
  const closeEditor = () => {
    if (draftStatus === 'error' && !window.confirm('Draf belum tersimpan. Tutup dan buang perubahan ini?')) return
    resetEditor()
  }
  useEffect(() => {
    if (draftStatus !== 'error' || !selectedToken) return
    const protect = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', protect)
    return () => window.removeEventListener('beforeunload', protect)
  }, [draftStatus, selectedToken])
  const nextToken = page?.tokens.slice((page?.tokens.findIndex(token => token.index === selectedToken?.index && token.is_word) ?? -1) + 1).find(token => token.is_word && token.index !== null)
  const clearDraft = (token: Token) => {
    try { localStorage.removeItem(draftKey(token)) } catch { setToast('Logat tersimpan, tetapi draf browser belum bisa dibersihkan.') }
  }
  const saveAnnotation = async (advance = false) => {
    if (!book || !selectedToken) return
    const context = navigationRequest.current
    try {
      await api.save(book.id, pageNo, selectedToken, meaning)
      const updated = await api.page(book.id, pageNo)
      if (context !== navigationRequest.current) return
      clearDraft(selectedToken)
      setPage(updated)
      if (advance && nextToken) editToken(nextToken, updated)
      else resetEditor()
      setToast('Logat tersimpan')
    } catch (error) { setToast(errorMessage(error)); throw error }
  }

  const deleteAnnotation = async () => {
    if (!book || !selectedToken) return
    const context = navigationRequest.current
    try {
      await api.delete(book.id, pageNo, selectedToken)
      const updated = await api.page(book.id, pageNo)
      if (context !== navigationRequest.current) return
      clearDraft(selectedToken)
      setPage(updated)
      resetEditor()
      setToast('Logat dihapus')
    } catch (error) {
      setToast(errorMessage(error))
      throw error
    }
  }

  const removeBookmark = async (bookmark: Bookmark) => {
    await api.deleteBookmark(bookmark.book_id, bookmark.page_id)
    bookmarksRequest.current++
    setBookmarks(current => current.filter(item => item.book_id !== bookmark.book_id || item.page_id !== bookmark.page_id))
    setBookmarksStatus('idle')
    setPage(current => current?.book_id === bookmark.book_id && current.page_id === bookmark.page_id ? { ...current, bookmarked: false } : current)
    setToast('Bookmark dihapus')
  }

  const togglePageBookmark = async () => {
    if (!book || !page || readerStatus !== 'idle') return
    const context = navigationRequest.current
    try {
      const result = await api.toggleBookmark(book.id, pageNo)
      if (context === navigationRequest.current) setPage(current => current ? { ...current, bookmarked: result.bookmarked } : current)
      loadBookmarks()
      setToast(result.bookmarked ? 'Halaman ditandai' : 'Bookmark dihapus')
    } catch (error) {
      setToast(errorMessage(error))
    }
  }

  const runSearch = (terms: string[] = [term], operator = 'AND') => {
    const query = terms.join(` ${operator} `)
    if (!terms.length || !pickedBookIds.length) return
    setRecentSearches(current => [query, ...current.filter(item => item !== query)].slice(0, 6))
    setHasSearched(true)
    setSearchError('')
    setSearchStatus('loading')
    searchAdvanced(terms, operator, pickedBookIds)
      .then(searchResult => {
        setResults(searchResult.results)
        setSearchError('')
        setHasSearched(true)
        setSearchStatus('idle')
      })
      .catch(error => {
        setSearchError(errorMessage(error))
        setSearchStatus('error')
      })
  }

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedQuery(query), 220)
    return () => window.clearTimeout(timeout)
  }, [query])

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedAuthorQuery(authorQuery), 220)
    return () => window.clearTimeout(timeout)
  }, [authorQuery])

  useEffect(loadCatalog, [debouncedQuery, debouncedAuthorQuery, selectedCategory, selectedAuthor])

  useEffect(() => {
    const root = document.documentElement
    root.dataset.theme = theme
    writeStored('logat:theme', theme)
  }, [theme])

  useEffect(() => {
    writeStored('logat:readerPrefs', readerPrefs)
  }, [readerPrefs])

  useEffect(() => {
    writeStored('logat:favorites', favoriteBookIds)
  }, [favoriteBookIds])

  useEffect(() => {
    writeStored('logat:recentBooks', recentBooks)
  }, [recentBooks])

  useEffect(() => {
    writeStored('logat:recentSearches', recentSearches)
  }, [recentSearches])

  useEffect(() => {
    if (!book) return
    loadPage(book, pageNo)
  }, [book, pageNo, readerVersion])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const bookId = Number(params.get('book'))
    const initialPage = Number(params.get('page') || '1')
    if (!bookId) return
    openBookById(bookId, initialPage)
  }, [])

  useEffect(() => { aiStatus().then(status => { setAiEnabled(status.enabled); setAiProvider(status.provider); setAiModel(status.model) }).catch(() => {}) }, [])

  useEffect(() => {
    api.health().then(() => setToast('Pembaca Syamilah siap')).catch(() => setToast('Koneksi pembaca Syamilah bermasalah'))
    loadBookmarks()
  }, [])

  useEffect(() => {
    if (!toast) return
    const timeout = window.setTimeout(() => setToast(''), 2200)
    return () => window.clearTimeout(timeout)
  }, [toast])

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (selectedToken || aiOpen) return
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setView('search')
      }
      if (view !== 'reader' || !book || selectedToken || aiOpen || (event.target as HTMLElement)?.closest('input, textarea, select, [contenteditable]')) return
      if (event.altKey && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {
        event.preventDefault()
        goToPage(pageNo + (event.key === 'ArrowLeft' ? -1 : 1))
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [book, pageNo, view, selectedToken, aiOpen])

  const togglePickedBook = (bookId: number) => {
    setPickedBookIds(current => current.includes(bookId) ? current.filter(id => id !== bookId) : [...current, bookId])
  }

  const toggleFavorite = (bookId: number) => {
    setFavoriteBookIds(current => current.includes(bookId) ? current.filter(id => id !== bookId) : [...current, bookId])
  }

  const clearUiStorage = () => {
    setFavoriteBookIds([])
    setRecentBooks([])
    setReadingPages({})
    setRecentSearches([])
    setReaderPrefs(defaultReaderPrefs)
    setTheme('system')
    setToast('Preferensi aplikasi diatur ulang')
  }

  const downloadBackup = async () => {
    try {
      const backup = await exportBackup()
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
      const url = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = `logat-backup-${new Date().toISOString().slice(0, 10)}.json`
      link.click()
      URL.revokeObjectURL(url)
      setToast('Backup logat diunduh')
    } catch (error) { setToast(errorMessage(error)) }
  }

  const restoreBackup = async (file: File) => {
    if (!window.confirm('Restore akan mengganti seluruh logat dan bookmark lokal. Lanjutkan?')) return
    try {
      const backup = JSON.parse(await file.text())
      await importBackup(backup)
      loadBookmarks()
      if (book) setPage(await api.page(book.id, pageNo))
      setToast('Backup logat dipulihkan')
    } catch (error) { setToast(errorMessage(error)) }
  }

  return (
    <AppShell view={view} theme={theme} onView={setView} onTheme={setTheme} focusMode={view === 'reader' && focusMode}>
      {view === 'books' && (
        <BookCatalog
          books={books}
          items={items}
          authors={authors}
          query={query}
          authorQuery={authorQuery}
          selectedCategory={selectedCategory}
          selectedAuthor={selectedAuthor}
          favoriteBookIds={favoriteBookIds}
          recentBooks={recentBooks}
          readingPages={readingPages}
          status={catalogStatus}
          error={catalogError}
          onQuery={setQuery}
          onAuthorQuery={setAuthorQuery}
          onCategory={setSelectedCategory}
          onAuthor={setSelectedAuthor}
          onOpen={openBook}
          onToggleFavorite={toggleFavorite}
          onRetry={loadCatalog}
        />
      )}

      {view === 'reader' && (
        <Reader
          book={book}
          page={page}
          pageNo={pageNo}
          bookmarks={bookmarks}
          chapters={chapters}
          parts={parts}
          chapterQuery={chapterQuery}
          status={readerStatus}
          error={readerError}
          focusMode={focusMode}
          prefs={readerPrefs}
          onPrefs={setReaderPrefs}
          onChapterQuery={setChapterQuery}
          onChooseBook={() => setView('books')}
          onPage={goToPage}
          onRetry={() => book && loadPage(book, pageNo)}
          onFocusMode={setFocusMode}
          onToggleBookmark={togglePageBookmark}
          aiEnabled={aiEnabled}
          onAskAI={() => setAiOpen(true)}
          onOpenBookmark={bookmark => openBookById(bookmark.book_id, bookmark.page_id)}
          onManageBookmarks={() => setView('bookmarks')}
          onEditToken={editToken}
        />
      )}

      {view === 'bookmarks' && <BookmarkWorkspace bookmarks={bookmarks} status={bookmarksStatus} error={bookmarksError} onRetry={loadBookmarks} onOpen={bookmark => openBookById(bookmark.book_id, bookmark.page_id)} onRemove={removeBookmark} />}

      {view === 'settings' && (
        <SettingsPanel
          theme={theme}
          prefs={readerPrefs}
          favoriteCount={favoriteBookIds.length}
          bookmarkCount={bookmarks.length}
          recentBooks={recentBooks}
          recentSearches={recentSearches}
          onTheme={setTheme}
          onPrefs={setReaderPrefs}
          onResetReader={() => {
            setReaderPrefs(defaultReaderPrefs)
            setToast('Tampilan bacaan diatur ulang')
          }}
          onClearStorage={clearUiStorage}
          onExportBackup={downloadBackup}
          onImportBackup={restoreBackup}
          aiEnabled={aiEnabled}
          aiProvider={aiProvider}
          aiModel={aiModel}
          onToggleAI={enabled => { toggleAI(enabled).then(status => { setAiEnabled(status.enabled); setToast(status.enabled ? 'Asisten AI diaktifkan' : 'Asisten AI dinonaktifkan') }).catch(error => setToast(errorMessage(error))) }}
          onProvider={provider => { switchAIProvider(provider).then(status => { setAiProvider(status.provider); setAiModel(status.model); setAiEnabled(status.enabled); setToast(`Provider AI: ${status.provider}`) }).catch(error => setToast(errorMessage(error))) }}
        />
      )}

      {view === 'search' && (
        <SearchWorkspace
          books={searchBooks}
          booksStatus={searchBooksStatus}
          booksError={searchBooksError}
          onRetryBooks={loadSearchBooks}
          term={term}
          selectedBookIds={pickedBookIds}
          recentSearches={recentSearches}
          results={results}
          hasSearched={hasSearched}
          status={searchStatus}
          error={searchError}
          onTerm={setTerm}
          onToggleBook={togglePickedBook}
          onSelectAll={() => setPickedBookIds(searchBooks.map(item => item.id))}
          onClearBooks={() => setPickedBookIds([])}
          onUsePreset={preset => {
            setTerm(preset)
            setView('search')
          }}
          onSearch={runSearch}
          onOpenResult={result => openBookById(result.book_id, result.page_id)}
        />
      )}

      {!aiOpen && <AnnotationEditor
        token={selectedToken}
        meaning={meaning}
        suggestions={suggestions}
        suggestionStatus={suggestionStatus}
        hasMeaning={selectedToken?.index !== null && selectedToken?.index !== undefined ? Boolean(page?.annotations[String(selectedToken.index)]) : false}
        draftStatus={draftStatus}
        hasNext={Boolean(nextToken)}
        onMeaning={updateMeaning}
        onSave={saveAnnotation}
        onDelete={deleteAnnotation}
        onClose={closeEditor}
        aiEnabled={aiEnabled}
        onAskAI={() => setAiOpen(true)}
      />}

      {aiOpen && book && page && <AITutorPanel enabled={aiEnabled} provider={aiProvider} model={aiModel} key={`${book.id}:${page.page_id}:${selectedToken?.index ?? "page"}:${aiProvider}`} book={book} page={page} token={selectedToken} onClose={() => setAiOpen(false)} onDraft={draft => { updateMeaning(draft); setAiOpen(false); if (!selectedToken) setToast('Pilih kata untuk memakai draf logat') }} />}

      {toast && <div className="toast" role="status">{toast}</div>}
    </AppShell>
  )
}

const mount = typeof document !== 'undefined' ? document.getElementById('root') : null
if (mount) createRoot(mount).render(<App />)
