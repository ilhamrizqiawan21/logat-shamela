import { useEffect, useRef, useState } from 'react'
import type { Token } from '../types'
import { Button, TextField } from './ui'

type Props = {
  token?: Token
  meaning: string
  suggestions: string[]
  suggestionStatus: 'idle' | 'loading' | 'error'
  hasMeaning?: boolean
  hasNext: boolean
  draftStatus: 'saved' | 'error' | 'idle'
  onMeaning: (value: string) => void
  onSave: (next?: boolean) => Promise<void>
  onDelete: () => Promise<void>
  onClose: () => void
  onAskAI: () => void
  aiEnabled: boolean
}

export function AnnotationEditor({ token, meaning, suggestions, suggestionStatus, hasMeaning = false, hasNext, draftStatus, onMeaning, onSave, onDelete, onClose, onAskAI, aiEnabled }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)
  const pending = useRef(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const run = async (action: () => Promise<void>) => {
    if (pending.current) return
    pending.current = true; setBusy(true); setError('')
    try { await action() } catch (error) { setError(error instanceof Error ? error.message : 'Perubahan belum tersimpan. Coba lagi.') }
    finally { pending.current = false; setBusy(false) }
  }
  const handlers = useRef({ onClose, onSave, hasNext })
  handlers.current = { onClose, onSave, hasNext }

  const isOpen = Boolean(token)
  useEffect(() => {
    if (!isOpen) return
    previousFocus.current = document.activeElement as HTMLElement
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); if (!pending.current) handlers.current.onClose() }
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) {
        event.preventDefault()
        void run(() => handlers.current.onSave(event.shiftKey && handlers.current.hasNext))
      }
      if (event.key !== 'Tab' || !dialogRef.current) return
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>('input:not([disabled]), button:not([disabled])')]
      if (!focusable.length) { event.preventDefault(); return }
      const first = focusable[0], last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', onKey)
    return () => { window.removeEventListener('keydown', onKey); previousFocus.current?.focus() }
  }, [isOpen])

  useEffect(() => {
    setError('')
  }, [token])
  useEffect(() => {
    if (token && !busy) dialogRef.current?.querySelector<HTMLElement>('[data-editor-input]')?.focus()
  }, [token, busy])

  if (!token) return null
  return <div className="modal" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget && !pending.current) onClose() }}>
    <div className="annotation-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="annotation-title" aria-busy={busy}>
      <h2 id="annotation-title">Editor logat</h2><span>Kata terpilih</span><b dir="rtl">{token.text}</b>
      <p className="word-context" dir="rtl"><small>{token.prev_word}</small><strong>{token.text}</strong><small>{token.next_word}</small></p>
      <div className="suggestions-panel"><span>Saran arti</span>
        {suggestionStatus === 'loading' && <p>Memuat saran...</p>}
        {suggestionStatus === 'idle' && suggestions.length === 0 && <p>Belum ada saran dari logat tersimpan.</p>}
        {suggestionStatus === 'error' && <p>Saran belum bisa dimuat.</p>}
        {suggestions.length > 0 && <div className="suggestion-chips">{suggestions.map(item => <Button disabled={busy} key={item} onClick={() => onMeaning(item)}>{item}</Button>)}</div>}
      </div>
      <label className="field-label"><span>Arti / logat</span><TextField data-editor-input value={meaning} onChange={event => onMeaning(event.target.value)} placeholder="Tulis arti/logat..." disabled={busy} /></label>
      <p className="editor-note" role="status">{draftStatus === 'saved' ? 'Draf disimpan di browser ini. Tekan Simpan untuk menyimpan ke logat.' : draftStatus === 'error' ? 'Draf belum bisa disimpan di browser. Simpan logat sebelum menutup.' : 'Ctrl+Enter: simpan · Ctrl+Shift+Enter: simpan & lanjut'}</p>
      {error && <p className="editor-error" role="alert">{error}</p>}
      <div className="dialog-actions">
        <Button className="primary" disabled={busy} onClick={() => void run(() => onSave())}>{busy ? 'Memproses…' : 'Simpan'}</Button>
        <Button disabled={busy || !hasNext} onClick={() => void run(() => onSave(true))}>Simpan & kata berikutnya</Button>
        <Button disabled={busy || !aiEnabled} title={aiEnabled ? undefined : 'Aktifkan AI di Pengaturan'} onClick={onAskAI}>{aiEnabled ? 'Analisis AI' : 'AI nonaktif'}</Button>
        {hasMeaning && <Button className="danger" disabled={busy} onClick={() => void run(onDelete)}>Hapus</Button>}
        <Button disabled={busy} onClick={onClose}>Tutup</Button>
      </div>
      {!hasNext && <p className="editor-note">Kata terakhir pada halaman ini.</p>}
    </div>
  </div>
}
