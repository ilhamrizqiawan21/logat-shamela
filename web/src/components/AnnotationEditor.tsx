import { useEffect, useRef, useState } from 'react'
import type { Token } from '../types'
import { Button, TextField } from './ui'

type Props = {
  token?: Token
  meaning: string
  suggestions: string[]
  suggestionStatus: 'idle' | 'loading' | 'error'
  hasMeaning?: boolean
  onMeaning: (value: string) => void
  onSave: () => void
  onDelete: () => void
  onClose: () => void
  onAskAI: () => void
}

export function AnnotationEditor({ token, meaning, suggestions, suggestionStatus, hasMeaning = false, onMeaning, onSave, onDelete, onClose, onAskAI }: Props) {
  const dialogRef = useRef<HTMLDivElement>(null)
  const previousFocus = useRef<HTMLElement | null>(null)
  const onCloseRef = useRef(onClose)
  const onSaveRef = useRef(onSave)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    onCloseRef.current = onClose
    onSaveRef.current = onSave
  }, [onClose, onSave])

  useEffect(() => {
    if (!token) return
    previousFocus.current = document.activeElement as HTMLElement
    dialogRef.current?.querySelector<HTMLElement>('[data-editor-input]')?.focus()
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current()
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) void Promise.resolve(onSaveRef.current()).catch(() => {})
      if (event.key !== 'Tab' || !dialogRef.current) return
      const focusable = [...dialogRef.current.querySelectorAll<HTMLElement>('input, button:not([disabled])')]
      if (!focusable.length) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus() }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus() }
    }
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('keydown', onKey)
      previousFocus.current?.focus()
    }
  }, [token])

  if (!token) return null

  return (
    <div className="modal" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) onClose() }}>
      <div className="annotation-dialog" ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="annotation-title">
        <h2 id="annotation-title">Editor logat</h2>
        <span>Kata terpilih</span>
        <b dir="rtl">{token.text}</b>
        <p className="word-context" dir="rtl">
          <small>{token.prev_word}</small>
          <strong>{token.text}</strong>
          <small>{token.next_word}</small>
        </p>
        <div className="suggestions-panel">
          <span>Saran arti</span>
          {suggestionStatus === 'loading' && <p>Memuat saran...</p>}
          {suggestionStatus === 'idle' && suggestions.length === 0 && <p>Belum ada saran dari logat tersimpan.</p>}
          {suggestionStatus === 'error' && <p>Saran belum bisa dimuat.</p>}
          {suggestions.length > 0 && (
            <div className="suggestion-chips">
              {suggestions.map(item => <Button key={item} onClick={() => onMeaning(item)}>{item}</Button>)}
            </div>
          )}
        </div>
        <TextField data-editor-input value={meaning} onChange={event => onMeaning(event.target.value)} placeholder="Tulis arti/logat..." disabled={busy} />
        <div className="dialog-actions">
          <Button disabled={busy} onClick={onAskAI}>Analisis AI</Button>
          <Button className="primary" disabled={busy} onClick={async () => { setBusy(true); try { await onSave() } catch {} finally { setBusy(false) } } }>{busy ? 'Menyimpan...' : 'Simpan'}</Button>
          {hasMeaning && <Button className="danger" disabled={busy} onClick={async () => { setBusy(true); try { await onDelete() } catch {} finally { setBusy(false) } } }>Hapus</Button>}
          <Button disabled={busy} onClick={onClose}>Batal</Button>
        </div>
      </div>
    </div>
  )
}
