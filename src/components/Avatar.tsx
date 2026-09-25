import { avatarColor, initials } from '../utils/format'

const SIZES = { xs: 'h-6 w-6 text-[10px]', sm: 'h-8 w-8 text-xs', md: 'h-9 w-9 text-[13px]', lg: 'h-11 w-11 text-sm' }

export function Avatar({ name, size = 'md', ring = false }: { name: string; size?: keyof typeof SIZES; ring?: boolean }) {
  return (
    <span
      title={name}
      className={`inline-flex shrink-0 select-none items-center justify-center rounded-full font-semibold text-white ${avatarColor(name)} ${SIZES[size]} ${ring ? 'ring-2 ring-white' : ''}`}
    >
      {initials(name)}
    </span>
  )
}
