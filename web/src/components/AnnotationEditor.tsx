import { useEffect } from 'react'
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
}

export function AnnotationEditor({ token, meaning, suggestions, suggestionStatus, hasMeaning = false, onMeaning, onSave, onDelete, onClose }: Props) {
  useEffect(() => {
    if (!token) return
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
      if (event.key === 'Enter' && (event.ctrlKey || event.metaKey)) onSave()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [token, onClose, onSave])

  if (!token) return null

  return (
    <div className="modal" role="dialog" aria-modal="true" aria-label="Editor logat">
      <div className="annotation-dialog">
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
        <TextField autoFocus value={meaning} onChange={event => onMeaning(event.target.value)} placeholder="Tulis arti/logat..." />
        <div className="dialog-actions">
          <Button className="primary" onClick={onSave}>Simpan</Button>
          {hasMeaning && <Button className="danger" onClick={onDelete}>Hapus</Button>}
          <Button onClick={onClose}>Batal</Button>
        </div>
      </div>
    </div>
  )
}
