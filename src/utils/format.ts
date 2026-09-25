const pad = (n: number) => String(n).padStart(2, '0')

export function formatDuration(minutes: number | null | undefined): string {
  if (minutes == null || Number.isNaN(minutes)) return '—'
  const m = Math.max(0, Math.round(minutes))
  if (m < 1) return '< 1 min'
  if (m < 60) return `${m} min`
  const days = Math.floor(m / 1440)
  const hours = Math.floor((m % 1440) / 60)
  const mins = m % 60
  if (days > 0) return hours > 0 ? `${days}d ${hours}h` : `${days}d`
  return mins > 0 ? `${hours}h ${mins}min` : `${hours}h`
}

export function minutesBetween(a: string, b: string): number {
  return (new Date(b).getTime() - new Date(a).getTime()) / 60000
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export function formatTime(iso: string) {
  const d = new Date(iso)
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function formatDate(iso: string) {
  const d = new Date(iso)
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`
}

export function formatDateTime(iso: string | null | undefined) {
  if (!iso) return '—'
  return `${formatDate(iso)} ${formatTime(iso)}`
}

export function formatShortDateTime(iso: string) {
  const d = new Date(iso)
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${formatTime(iso)}`
}

/** "Hoje às 14:32", "Ontem às 09:10" ou "22/09/2026 às 10:00". */
export function formatFriendly(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  const tomorrow = new Date(now)
  tomorrow.setDate(now.getDate() + 1)
  if (sameDay(d, now)) return `Hoje às ${formatTime(iso)}`
  if (sameDay(d, yesterday)) return `Ontem às ${formatTime(iso)}`
  if (sameDay(d, tomorrow)) return `Amanhã às ${formatTime(iso)}`
  return `${formatDate(iso)} às ${formatTime(iso)}`
}

export function formatRelative(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 60000
  if (diff < 1) return 'agora mesmo'
  if (diff < 60) return `há ${Math.round(diff)} min`
  if (diff < 1440) return `há ${Math.round(diff / 60)}h`
  const days = Math.round(diff / 1440)
  return days === 1 ? 'ontem' : `há ${days} dias`
}

export function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1).replace('.', ',')} MB`
}

export function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function uid(prefix = 'id') {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-4)}`
}

export function fileKind(name: string, type = ''): 'image' | 'pdf' | 'sheet' | 'doc' | 'archive' | 'other' {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  if (type.startsWith('image/') || ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg'].includes(ext)) return 'image'
  if (ext === 'pdf') return 'pdf'
  if (['xls', 'xlsx', 'csv'].includes(ext)) return 'sheet'
  if (['doc', 'docx', 'txt', 'odt', 'rtf'].includes(ext)) return 'doc'
  if (['zip', 'rar', '7z'].includes(ext)) return 'archive'
  return 'other'
}

export function fileTypeLabel(name: string, type = '') {
  const labels = { image: 'Imagem', pdf: 'PDF', sheet: 'Planilha', doc: 'Documento', archive: 'Compactado', other: 'Arquivo' }
  return labels[fileKind(name, type)]
}

const AVATAR_COLORS = [
  'bg-avatar-1', 'bg-avatar-2', 'bg-avatar-3', 'bg-avatar-4',
  'bg-avatar-5', 'bg-avatar-6', 'bg-avatar-7', 'bg-avatar-8',
]

export function avatarColor(seed: string) {
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return AVATAR_COLORS[h % AVATAR_COLORS.length]
}

export function normalize(text: string) {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}
