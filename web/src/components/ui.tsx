import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from 'react'

export function Button({ className = '', ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button className={`ui-button ${className}`} {...props} />
}

export function TextField({ className = '', ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={`text-field ${className}`} {...props} />
}

export function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="skeleton" aria-label="Memuat">
      {Array.from({ length: lines }, (_, i) => <i key={i} />)}
    </div>
  )
}

export function StateCard({ title, message, action }: { title: string; message: string; action?: ReactNode }) {
  return (
    <section className="state-card">
      <span className="state-dot" aria-hidden="true" />
      <strong>{title}</strong>
      <p>{message}</p>
      {action && <div className="state-actions">{action}</div>}
    </section>
  )
}

export function ErrorState({ message, retry }: { message: string; retry: () => void }) {
  return <StateCard title="Tidak dapat memuat data" message={message} action={<Button onClick={retry}>Coba lagi</Button>} />
}

type View = 'books'|'reader'|'search'|'settings'
type Theme = 'system'|'light'|'dark'

export function AppShell({ view, theme, onView, onTheme, focusMode = false, children }: { view: string; theme: Theme; onView: (v: View) => void; onTheme: (theme: Theme) => void; focusMode?: boolean; children: ReactNode }) {
  const nextTheme = theme === 'system' ? 'light' : theme === 'light' ? 'dark' : 'system'

  return (
    <main className={focusMode ? 'focus-mode' : ''}>
      <a className="skip-link" href="#content">Lewati ke konten</a>
      <header>
        <div className="brand">
          <strong>ل</strong>
          <span>Logat Syamilah<small>Ruang belajar kitab</small></span>
        </div>
        <nav className="mainnav" aria-label="Navigasi utama">
          {([['books','Daftar Kitab'],['reader','Baca Kitab'],['search','Cari'],['settings','Pengaturan']] as const).map(([id,label]) => (
            <Button key={id} className={view === id ? 'active' : ''} aria-current={view === id ? 'page' : undefined} onClick={() => onView(id)}>{label}</Button>
          ))}
        </nav>
        <Button className="theme-toggle" onClick={() => onTheme(nextTheme)} aria-label={`Tema ${theme}`}>
          {theme === 'dark' ? '☾' : theme === 'light' ? '☼' : '◐'}
        </Button>
      </header>
      <div id="content">{children}</div>
    </main>
  )
}
