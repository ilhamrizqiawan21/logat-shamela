import { useRef } from 'react'
import { ReaderAppearance } from './ReaderAppearance'
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
  onExportBackup: () => void
  onImportBackup: (file: File) => void
  aiEnabled: boolean
  aiProvider: string
  aiModel: string
  onToggleAI: (enabled: boolean) => void
  onProvider: (provider: string) => void
}

export function SettingsPanel({ theme, prefs, favoriteCount, bookmarkCount, recentBooks, recentSearches, onTheme, onPrefs, onResetReader, onClearStorage, onExportBackup, onImportBackup, aiEnabled, aiProvider, aiModel, onToggleAI, onProvider }: Props) {
  const backupInput = useRef<HTMLInputElement>(null)
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
            {(['system', 'light', 'dark'] as const).map(item => <Button key={item} aria-pressed={theme === item} className={theme === item ? 'active' : ''} onClick={() => onTheme(item)}>{{ system: 'Sistem', light: 'Terang', dark: 'Gelap' }[item]}</Button>)}
          </div>
        </section>

        <section className="settings-card">
          <h2>Pembaca</h2>
          <ReaderAppearance prefs={prefs} onPrefs={onPrefs} />
          <Button onClick={onResetReader}>Atur ulang tampilan bacaan</Button>
        </section>

        <section className="settings-card">
          <h2>Penyimpanan lokal</h2>
          <p>{favoriteCount} favorit · {bookmarkCount} bookmark · {recentBooks.length} terakhir dibaca · {recentSearches.length} pencarian terkini</p>
          <div className="settings-actions">
            <Button onClick={onExportBackup}>Unduh cadangan logat</Button>
            <Button onClick={() => backupInput.current?.click()}>Pulihkan cadangan</Button><input ref={backupInput} aria-label="Berkas cadangan logat" type="file" accept="application/json,.json" hidden onChange={event => { const file = event.target.files?.[0]; if (file) onImportBackup(file); event.currentTarget.value = '' }} />
          </div>
          <small>Cadangan dipindahkan ke perangkat lain dengan memilih berkas secara manual.</small>
          <Button className="danger" onClick={onClearStorage}>Atur ulang preferensi aplikasi</Button>
        </section>
        <section className="settings-card">
          <h2>Asisten AI</h2>
          <p>{aiProvider ? `${aiProvider === 'ollama' ? 'Ollama lokal' : aiProvider === 'gemini' ? 'Gemini' : aiProvider} · ${aiModel}` : 'Status AI belum tersedia'}</p>
          <label>Penyedia AI<select value={aiProvider} onChange={event => onProvider(event.target.value)}><option value="gemini">Gemini</option><option value="ollama">Ollama lokal</option></select></label>
          <label className="ai-switch"><input type="checkbox" checked={aiEnabled} onChange={event => onToggleAI(event.target.checked)} /> <span>{aiEnabled ? 'AI aktif' : 'AI nonaktif'}</span></label>
        </section>
      </div>
    </section>
  )
}
