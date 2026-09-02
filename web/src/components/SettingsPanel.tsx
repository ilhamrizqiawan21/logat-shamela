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
}

export function SettingsPanel({ theme, prefs, favoriteCount, bookmarkCount, recentBooks, recentSearches, onTheme, onPrefs, onResetReader, onClearStorage }: Props) {
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
          <label>Ukuran <input type="range" min="24" max="44" value={prefs.fontSize} onChange={event => onPrefs({ ...prefs, fontSize: Number(event.target.value) })} /></label>
          <label>Spasi <input type="range" min="1.8" max="2.7" step="0.05" value={prefs.lineHeight} onChange={event => onPrefs({ ...prefs, lineHeight: Number(event.target.value) })} /></label>
          <label>Lebar <input type="range" min="720" max="1240" step="20" value={prefs.columnWidth} onChange={event => onPrefs({ ...prefs, columnWidth: Number(event.target.value) })} /></label>
          <Button onClick={onResetReader}>Reset layout reader</Button>
        </section>

        <section className="settings-card">
          <h2>Penyimpanan lokal</h2>
          <p>{favoriteCount} favorit · {bookmarkCount} bookmark · {recentBooks.length} terakhir dibaca · {recentSearches.length} pencarian terkini</p>
          <Button className="danger" onClick={onClearStorage}>Bersihkan preferensi UI</Button>
        </section>
      </div>
    </section>
  )
}
