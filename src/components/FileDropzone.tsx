import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'

export function FileDropzone({ onFiles }: { onFiles: (files: FileList) => void }) {
  const [dragging, setDragging] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => { e.preventDefault(); setDragging(false); if (e.dataTransfer.files.length) onFiles(e.dataTransfer.files) }}
      onClick={() => input.current?.click()}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && input.current?.click()}
      className={`flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed px-6 py-7 text-center transition-colors ${dragging ? 'border-brand-500 bg-brand-50' : 'border-slate-300 bg-slate-50/60 hover:border-brand-400 hover:bg-brand-50/40'}`}
    >
      <span className={`mb-2 flex h-10 w-10 items-center justify-center rounded-full ${dragging ? 'bg-brand-100 text-brand-600' : 'bg-white text-slate-500 shadow-sm ring-1 ring-slate-200'}`}>
        <Upload className="h-5 w-5" />
      </span>
      <p className="text-sm font-medium text-slate-700">Arraste arquivos aqui ou <span className="text-brand-600">clique para selecionar</span></p>
      <p className="mt-1 text-xs text-slate-500">PDF, imagens, planilhas e documentos · até 10 MB por arquivo</p>
      <input
        ref={input}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => { if (e.target.files) onFiles(e.target.files); e.target.value = '' }}
      />
    </div>
  )
}
