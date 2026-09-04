import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { aiStatus, api, searchAdvanced, switchAIProvider, toggleAI } from './api'
import { AnnotationEditor } from './components/AnnotationEditor'
import { AITutorPanel } from './components/AITutorPanel'
import { BookCatalog } from './components/BookCatalog'
import { Reader } from './components/Reader'
import type { ReaderPrefs } from './components/Reader'
import { SearchWorkspace } from './components/SearchWorkspace'
import { SettingsPanel } from './components/SettingsPanel'
import { AppShell } from './components/ui'
import type { Book, Bookmark, Chapter, Item, Page, Result, Token } from './types'
import './style.css'

type View = 'books' | 'reader' | 'search' | 'settings'
type Status = 'idle' | 'loading' | 'error'
type Part = { part: number; page_id: number }
type Theme = 'system' | 'light' | 'dark'
const defaultReaderPrefs: ReaderPrefs = { fontSize: 32, lineHeight: 2.25, columnWidth: 980, fontFamily: 'amiri' }

const errorMessage = (error: unknown) => error instanceof Error ? error.message : 'Terjadi kesalahan'
const readStored = <T,>(key: string, fallback: T): T => {
  if (typeof localStorage === 'undefined') return fallback
  try { return JSON.parse(localStorage.getItem(key) || '') as T } catch { return fallback }
}
const writeStored = (key: string, value: unknown) => {
  if (typeof localStorage !== 'undefined') localStorage.setItem(key, JSON.stringify(value))
}

export function App() {
  const [view, setView] = useState<View>('books')
  const [books, setBooks] = useState<Book[]>([])
  const [items, setItems] = useState<Item[]>([])
  const [authors, setAuthors] = useState<Item[]>([])
  const [query, setQuery] = useState('')
  const [authorQuery, setAuthorQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<number>()
  const [selectedAuthor, setSelectedAuthor] = useState<number>()
  const [book, setBook] = useState<Book>()
  const [pageNo, setPageNo] = useState(1)
  const [page, setPage] = useState<Page>()
  const [chapters, setChapters] = useState<Chapter[]>([])
  const [parts, setParts] = useState<Part[]>([])
  const [chapterQuery, setChapterQuery] = useState('')
  const [pickedBookIds, setPickedBookIds] = useState<number[]>([])
  const [term, setTerm] = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([])
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

  const loadCatalog = () => {
    setCatalogStatus('loading')
    Promise.all([api.books(debouncedQuery, selectedCategory, selectedAuthor), api.categories(debouncedQuery), api.authors(debouncedAuthorQuery)])
      .then(([loadedBooks, loadedItems, loadedAuthors]) => {
        setBooks(loadedBooks)
        setItems(loadedItems)
        setAuthors(loadedAuthors)
        setCatalogError('')
        setCatalogStatus('idle')
      })
      .catch(error => {
        setCatalogError(errorMessage(error))
        setCatalogStatus('error')
      })
  }

  const openBook = (nextBook: Book, nextPage = 1) => {
    setReaderError('')
    setBook(nextBook)
    setPageNo(nextPage)
    setView('reader')
    window.history.replaceState(null, '', `/?book=${nextBook.id}&page=${nextPage}`)
    setRecentBooks(current => [nextBook, ...current.filter(item => item.id !== nextBook.id)].slice(0, 6))
    Promise.all([api.index(nextBook.id), api.parts(nextBook.id)])
      .then(([loadedChapters, loadedParts]) => {
        setChapters(loadedChapters)
        setParts(loadedParts)
      })
      .catch(error => setReaderError(errorMessage(error)))
  }

  const loadPage = (targetBook: Book, targetPage: number) => {
    setReaderStatus('loading')
    setReaderError('')
    api.page(targetBook.id, targetPage)
      .then(loadedPage => {
        setPage(loadedPage)
        setReaderStatus('idle')
      })
      .catch(error => {
        setReaderError(errorMessage(error))
        setReaderStatus('error')
      })
  }

  const loadBookmarks = () => {
    api.bookmarks().then(setBookmarks).catch(error => setToast(errorMessage(error)))
  }

  const goToPage = (nextPage: number) => {
    const safePage = Math.max(1, nextPage)
    setPageNo(safePage)
    if (book) window.history.replaceState(null, '', `/?book=${book.id}&page=${safePage}`)
  }

  const saveAnnotation = async () => {
    if (!book || !selectedToken) return
    try {
      await api.save(book.id, pageNo, selectedToken, meaning)
      setPage(await api.page(book.id, pageNo))
      setSelectedToken(undefined)
      setToast('Logat tersimpan')
    } catch (error) {
      setToast(errorMessage(error))
      throw error
    }
  }

  const deleteAnnotation = async () => {
    if (!book || !selectedToken) return
    try {
      await api.delete(book.id, pageNo, selectedToken)
      setPage(await api.page(book.id, pageNo))
      setSelectedToken(undefined)
      setToast('Logat dihapus')
    } catch (error) {
      setToast(errorMessage(error))
      throw error
    }
  }

  const togglePageBookmark = async () => {
    if (!book) return
    try {
      const result = await api.toggleBookmark(book.id, pageNo)
      setPage(current => current ? { ...current, bookmarked: result.bookmarked } : current)
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
  }, [book, pageNo])

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const bookId = Number(params.get('book'))
    const initialPage = Number(params.get('page') || '1')
    if (!bookId) return
    api.book(bookId).then(loadedBook => openBook(loadedBook, initialPage)).catch(error => setReaderError(errorMessage(error)))
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
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        setView('search')
      }
      if (event.altKey && event.key === 'ArrowLeft') goToPage(Math.max(1, pageNo - 1))
      if (event.altKey && event.key === 'ArrowRight') goToPage(pageNo + 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [book, pageNo])

  const togglePickedBook = (bookId: number) => {
    setPickedBookIds(current => current.includes(bookId) ? current.filter(id => id !== bookId) : [...current, bookId])
  }

  const toggleFavorite = (bookId: number) => {
    setFavoriteBookIds(current => current.includes(bookId) ? current.filter(id => id !== bookId) : [...current, bookId])
  }

  const clearUiStorage = () => {
    setFavoriteBookIds([])
    setRecentBooks([])
    setRecentSearches([])
    setReaderPrefs(defaultReaderPrefs)
    setTheme('system')
    setToast('Preferensi UI dibersihkan')
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
          onAskAI={() => setAiOpen(true)}
          onOpenBookmark={bookmark => api.book(bookmark.book_id).then(loadedBook => openBook(loadedBook, bookmark.page_id))}
          onEditToken={token => {
            setSelectedToken(token)
            setMeaning(token.index === null ? '' : page?.annotations[String(token.index)]?.meaning || '')
            setSuggestions([])
            if (token.normalized) {
              setSuggestionStatus('loading')
              api.suggestions(token.normalized)
                .then(result => {
                  setSuggestions(result.suggestions)
                  setSuggestionStatus('idle')
                })
                .catch(error => {
                  setSuggestionStatus('error')
                  setToast(errorMessage(error))
                })
            }
          }}
        />
      )}

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
            setToast('Layout reader direset')
          }}
          onClearStorage={clearUiStorage}
          aiEnabled={aiEnabled}
          aiProvider={aiProvider}
          aiModel={aiModel}
          onToggleAI={enabled => { toggleAI(enabled).then(status => { setAiEnabled(status.enabled); setToast(status.enabled ? 'Asisten AI diaktifkan' : 'Asisten AI dinonaktifkan') }).catch(error => setToast(errorMessage(error))) }}
          onProvider={provider => { switchAIProvider(provider).then(status => { setAiProvider(status.provider); setAiModel(status.model); setAiEnabled(status.enabled); setToast(`Provider AI: ${status.provider}`) }).catch(error => setToast(errorMessage(error))) }}
        />
      )}

      {view === 'search' && (
        <SearchWorkspace
          books={books}
          term={term}
          selectedBookIds={pickedBookIds}
          recentSearches={recentSearches}
          results={results}
          hasSearched={hasSearched}
          status={searchStatus}
          error={searchError}
          onTerm={setTerm}
          onToggleBook={togglePickedBook}
          onSelectAll={() => setPickedBookIds(books.map(item => item.id))}
          onClearBooks={() => setPickedBookIds([])}
          onUsePreset={preset => {
            setTerm(preset)
            setView('search')
          }}
          onSearch={runSearch}
          onOpenResult={result => api.book(result.book_id).then(loadedBook => openBook(loadedBook, result.page_id))}
        />
      )}

      {!aiOpen && <AnnotationEditor
        token={selectedToken}
        meaning={meaning}
        suggestions={suggestions}
        suggestionStatus={suggestionStatus}
        hasMeaning={selectedToken?.index !== null && selectedToken?.index !== undefined ? Boolean(page?.annotations[String(selectedToken.index)]) : false}
        onMeaning={setMeaning}
        onSave={saveAnnotation}
        onDelete={deleteAnnotation}
        onClose={() => setSelectedToken(undefined)}
        onAskAI={() => setAiOpen(true)}
      />}

      {aiOpen && book && page && <AITutorPanel book={book} page={page} token={selectedToken} onClose={() => setAiOpen(false)} onDraft={draft => { setMeaning(draft); setAiOpen(false); if (!selectedToken) setToast('Pilih kata untuk memakai draft logat') }} />}

      {toast && <div className="toast" role="status">{toast}</div>}
    </AppShell>
  )
}

if (typeof document !== 'undefined') {
  createRoot(document.getElementById('root')!).render(<App />)
}
