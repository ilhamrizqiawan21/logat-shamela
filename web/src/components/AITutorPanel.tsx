import { useEffect, useRef, useState } from 'react'
import type { Book, Page, Token } from '../types'
import { Button, ErrorState, Skeleton, StateCard } from './ui'

type Mode = 'language' | 'nahwu' | 'shorof' | 'munasabah'
type Result = { mode: Mode; answer: string; sections: { title: string; content: string }[]; source: { book_name: string; authors: string; page_id: number; chapter: string }; disclaimer: string }
type Props = { enabled: boolean; provider: string; model: string; book: Book; page: Page; token?: Token; onClose: () => void; onDraft: (meaning: string) => void }

export function AITutorPanel({ book, page, token, enabled, provider, model, onClose, onDraft }: Props) {
  const [mode, setMode] = useState<Mode>('language')
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle')
  const [result, setResult] = useState<Result>()
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [copyError, setCopyError] = useState('')
  const request = useRef<AbortController>()
  const providerName = provider === 'ollama' ? 'Ollama lokal' : provider === 'gemini' ? 'Gemini' : provider || 'AI'
  useEffect(() => () => { request.current?.abort(); request.current = undefined }, [])
  const copyAnswer = async () => {
    setCopied(false); setCopyError('')
    try {
      if (!navigator.clipboard) throw new Error('Clipboard tidak tersedia')
      await navigator.clipboard.writeText(result?.answer || '')
      setCopied(true)
    } catch { setCopyError('Jawaban belum dapat disalin. Pilih teks jawaban dan salin secara manual.') }
  }
  const words = page.tokens.filter(item => item.is_word)
  const tokenPosition = token ? words.findIndex(item => item.index === token.index) : -1
  const start = tokenPosition >= 0 ? Math.max(0, tokenPosition - 10) : 0
  const end = tokenPosition >= 0 ? Math.min(words.length, tokenPosition + 11) : Math.min(words.length, 16)
  const contextWords = words.slice(start, end)
  const contextText = contextWords.map(item => item.text).join(' ') || ''
  const text = mode === 'language' && token ? token.text : contextText
  const contextBefore = mode === 'language' ? '' : contextWords.slice(0, Math.max(0, tokenPosition >= 0 ? tokenPosition - start : 0)).map(item => item.text).join(' ')
  const contextAfter = mode === 'language' ? '' : contextWords.slice(tokenPosition >= 0 ? tokenPosition - start + 1 : contextWords.length).map(item => item.text).join(' ')
  const analyze = async () => {
    if (!enabled || request.current) return
    setStatus('loading'); setError(''); setCopied(false); setCopyError('')
    const controller = new AbortController(); request.current = controller; const timeout = window.setTimeout(() => controller.abort(), 95000)
    try {
      const response = await fetch('/api/ai/analyze', { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal, body: JSON.stringify({ book_id: book.id, page_id: page.page_id, mode, text, word: token?.text || '', context_before: contextBefore, context_after: contextAfter }) })
      const data = await response.json(); if (!response.ok) throw new Error(data.detail || 'Analisis AI gagal')
      if (request.current !== controller) return
      setResult(data); setStatus('idle')
    } catch (err) { if (request.current !== controller) return; setError(err instanceof DOMException && err.name === 'AbortError' ? 'Analisis terlalu lama (batas 95 detik). Coba lagi atau gunakan konteks yang lebih singkat.' : err instanceof Error ? err.message : 'Analisis AI gagal'); setStatus('error') }
    finally { window.clearTimeout(timeout); if (request.current === controller) request.current = undefined }
  }
  if (!enabled) return <aside className="ai-panel" aria-label="Asisten AI"><Button onClick={onClose}>Tutup</Button><StateCard title="AI nonaktif" message="Aktifkan asisten AI melalui Pengaturan untuk mulai menganalisis." /></aside>
  if (status === 'loading') return <aside className="ai-panel" aria-label="Asisten AI"><div className="ai-panel-head"><h2>Asisten AI</h2><Button onClick={onClose} aria-label="Tutup asisten AI">×</Button></div><p className="ai-progress" role="status">{providerName} sedang menganalisis{model ? ` dengan ${model}` : ''}.{provider === 'ollama' ? ' Proses pertama dapat membutuhkan waktu untuk memuat model.' : ' Menunggu jawaban dari layanan AI.'}</p><Skeleton lines={6} /></aside>
  return <aside className="ai-panel" aria-label="Asisten AI"><div className="ai-panel-head"><div><span>{providerName} · {model}</span><h2>Asisten AI</h2></div><Button onClick={onClose} aria-label="Tutup asisten AI">×</Button></div><div className="ai-modes" role="group" aria-label="Mode analisis">{([['language','Bahasa'],['nahwu','Nahwu'],['shorof','Shorof'],['munasabah','Munasabah']] as const).map(([key, label]) => <Button key={key} aria-pressed={mode === key} className={mode === key ? 'active' : ''} onClick={() => { setMode(key); setResult(undefined); setStatus('idle'); setCopied(false); setCopyError('') }}>{label}</Button>)}</div><p className="ai-context" dir="rtl">{text}</p>{status === 'error' && <ErrorState message={error} retry={analyze} />}{status === 'idle' && !result && <Button className="primary ai-analyze" onClick={analyze}>Analisis dengan AI</Button>}{result && <div className="ai-result"><p>{result.answer}</p>{result.sections.map(section => <section key={section.title}><h3>{section.title}</h3><p>{section.content}</p></section>)}<small>Sumber: {result.source.book_name} · Hal. {result.source.page_id}{result.source.chapter && ` · ${result.source.chapter}`}</small><p className="ai-disclaimer">{result.disclaimer}</p><div className="ai-actions"><Button onClick={() => void copyAnswer()}>{copied ? 'Tersalin' : 'Salin jawaban'}</Button>{token && <Button className="primary" onClick={() => onDraft(result.answer)}>Gunakan sebagai draf logat</Button>}</div>{copyError && <p role="alert">{copyError}</p>}</div>}</aside>
}
