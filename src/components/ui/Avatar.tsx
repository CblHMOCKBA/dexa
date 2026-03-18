const COLORS = [
  { bg: '#EBF2FF', text: '#1249A8' },
  { bg: '#E6F9F3', text: '#006644' },
  { bg: '#FFF4E0', text: '#7A4F00' },
  { bg: '#F0E8FF', text: '#5B00CC' },
  { bg: '#FFEBEA', text: '#A8170F' },
]

const SIZES = {
  xs: { size: 30, radius: 8,  font: 10 },
  sm: { size: 40, radius: 10, font: 13 },
  md: { size: 48, radius: 12, font: 15 },
  lg: { size: 64, radius: 16, font: 20 },
}

function initials(name: string) {
  return name.split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase()
}

export default function Avatar({
  name, size = 'md', className = ''
}: { name: string; size?: 'xs' | 'sm' | 'md' | 'lg'; className?: string }) {
  const c = COLORS[name.charCodeAt(0) % COLORS.length]
  const s = SIZES[size]
  return (
    <div className={`avatar flex-shrink-0 ${className}`} style={{
      width: s.size, height: s.size, borderRadius: s.radius,
      background: c.bg, color: c.text,
      fontSize: s.font, fontWeight: 700,
      fontFamily: 'var(--font-mono)',
    }}>
      {initials(name)}
    </div>
  )
}
