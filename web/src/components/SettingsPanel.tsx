import type { Book } from '../types'
import type { ReaderPrefs } from './Reader'
import { Button } from './ui'

type Theme = 'system' | 'light' | 'dark'

type Props = {
  theme: Theme
  prefs: ReaderPrefs
  favoriteCount: number
  bookmarkCount: number
  recentBooks: Book[]
  recentSearches: string[]
  onTheme: (theme: Theme) => void
  onPrefs: (prefs: ReaderPrefs) => void
  onResetReader: () => void
  onClearStorage: () => void
  aiEnabled: boolean
  aiProvider: string
  aiModel: string
  onToggleAI: (enabled: boolean) => void
  onProvider: (provider: string) => void
}

export function SettingsPanel({ theme, prefs, favoriteCount, bookmarkCount, recentBooks, recentSearches, onTheme, onPrefs, onResetReader, onClearStorage, aiEnabled, aiProvider, aiModel, onToggleAI, onProvider }: Props) {
  return (
    <section className="settings-screen">
      <div className="section-heading">
        <span>Preferensi lokal</span>
        <h1>Pengaturan</h1>
      </div>

      <div className="settings-grid">
        <section className="settings-card">
          <h2>Tema</h2>
          <div className="segmented wide">
            {(['system', 'light', 'dark'] as const).map(item => <Button key={item} className={theme === item ? 'active' : ''} onClick={() => onTheme(item)}>{item}</Button>)}
          </div>
        </section>

        <section className="settings-card">
          <h2>Reader</h2>
          <label><span>Ukuran <output>{prefs.fontSize}px</output></span><input aria-label="Ukuran huruf" type="range" min="24" max="44" value={prefs.fontSize} onChange={event => onPrefs({ ...prefs, fontSize: Number(event.target.value) })} /></label>
          <label><span>Spasi <output>{prefs.lineHeight.toFixed(2)}</output></span><input aria-label="Jarak antarbaris" type="range" min="1.8" max="2.7" step="0.05" value={prefs.lineHeight} onChange={event => onPrefs({ ...prefs, lineHeight: Number(event.target.value) })} /></label>
          <label><span>Lebar <output>{prefs.columnWidth}px</output></span><input aria-label="Lebar kolom bacaan" type="range" min="720" max="1240" step="20" value={prefs.columnWidth} onChange={event => onPrefs({ ...prefs, columnWidth: Number(event.target.value) })} /></label>
          <Button onClick={onResetReader}>Reset layout reader</Button>
        </section>

        <section className="settings-card">
          <h2>Penyimpanan lokal</h2>
          <p>{favoriteCount} favorit · {bookmarkCount} bookmark · {recentBooks.length} terakhir dibaca · {recentSearches.length} pencarian terkini</p>
          <Button className="danger" onClick={onClearStorage}>Bersihkan preferensi UI</Button>
        </section>
        <section className="settings-card">
          <h2>Asisten AI</h2>
          <p>{aiProvider} · {aiModel}</p>
          <label>Provider<select value={aiProvider} onChange={event => onProvider(event.target.value)}><option value="gemini">Gemini</option><option value="ollama">Ollama lokal</option></select></label>
          <label className="ai-switch"><input type="checkbox" checked={aiEnabled} onChange={event => onToggleAI(event.target.checked)} /> <span>{aiEnabled ? 'AI aktif' : 'AI nonaktif'}</span></label>
        </section>
      </div>
    </section>
  )
}
