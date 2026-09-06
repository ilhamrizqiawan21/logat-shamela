import type { ReaderPrefs } from './Reader'
import { Button } from './ui'

export function ReaderAppearance({ prefs, onPrefs }: { prefs: ReaderPrefs; onPrefs: (prefs: ReaderPrefs) => void }) {
  return <div className="reader-toolbar" aria-label="Pengaturan tampilan pembaca">
    <label><span>Ukuran teks <output>{prefs.fontSize}px</output></span><input aria-label="Ukuran huruf" type="range" min="24" max="44" value={prefs.fontSize} onChange={event => onPrefs({ ...prefs, fontSize: Number(event.target.value) })} /></label>
    <label><span>Jarak baris <output>{prefs.lineHeight.toFixed(2)}</output></span><input aria-label="Jarak antarbaris" type="range" min="1.8" max="2.7" step="0.05" value={prefs.lineHeight} onChange={event => onPrefs({ ...prefs, lineHeight: Number(event.target.value) })} /></label>
    <label><span>Lebar bacaan <output>{prefs.columnWidth}px</output></span><input aria-label="Lebar kolom bacaan" type="range" min="720" max="1240" step="20" value={prefs.columnWidth} onChange={event => onPrefs({ ...prefs, columnWidth: Number(event.target.value) })} /></label>
    <div className="segmented" role="group" aria-label="Font Arab">
      <Button aria-pressed={prefs.fontFamily === 'amiri'} className={prefs.fontFamily === 'amiri' ? 'active' : ''} onClick={() => onPrefs({ ...prefs, fontFamily: 'amiri' })}>Amiri</Button>
      <Button aria-pressed={prefs.fontFamily === 'naskh'} className={prefs.fontFamily === 'naskh' ? 'active' : ''} onClick={() => onPrefs({ ...prefs, fontFamily: 'naskh' })}>Naskh</Button>
    </div>
    <label><span>Ukuran logat <output>{prefs.annotationSize ?? 13}px</output></span><input aria-label="Ukuran logat" type="range" min="11" max="20" value={prefs.annotationSize ?? 13} onChange={event => onPrefs({ ...prefs, annotationSize: Number(event.target.value) })} /></label>
    <label className="annotation-visibility"><input type="checkbox" checked={prefs.showAnnotations ?? true} onChange={event => onPrefs({ ...prefs, showAnnotations: event.target.checked })} /><span>Tampilkan logat</span></label>
  </div>
}
