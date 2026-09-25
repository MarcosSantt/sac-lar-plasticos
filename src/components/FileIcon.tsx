import { File, FileArchive, FileSpreadsheet, FileText, Image } from 'lucide-react'
import { fileKind } from '../utils/format'

const STYLES = {
  image: { icon: Image, cls: 'bg-violet-50 text-violet-600' },
  pdf: { icon: FileText, cls: 'bg-red-50 text-red-600' },
  sheet: { icon: FileSpreadsheet, cls: 'bg-brand-50 text-brand-600' },
  doc: { icon: FileText, cls: 'bg-blue-50 text-blue-600' },
  archive: { icon: FileArchive, cls: 'bg-amber-50 text-amber-600' },
  other: { icon: File, cls: 'bg-slate-100 text-slate-500' },
}

export function FileIcon({ name, type, size = 'md' }: { name: string; type?: string; size?: 'sm' | 'md' }) {
  const { icon: Icon, cls } = STYLES[fileKind(name, type)]
  return (
    <span className={`flex shrink-0 items-center justify-center rounded-lg ${cls} ${size === 'sm' ? 'h-7 w-7' : 'h-9 w-9'}`}>
      <Icon className={size === 'sm' ? 'h-3.5 w-3.5' : 'h-4.5 w-4.5'} />
    </span>
  )
}
