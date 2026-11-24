import { useId } from 'react'

interface Props {
  label: string
  data: number[]
  t: number
  color: string
  format: (v: number) => string
  compare?: number[]
}

// Grafik garis SVG ringan dengan penanda bulan berjalan.
export function LineChart({ label, data, t, color, format, compare }: Props) {
  const id = useId()
  const W = 260
  const H = 92
  const pad = 4
  const all = compare ? data.concat(compare) : data
  const max = Math.max(...all, 1e-9)
  const min = Math.min(0, ...all)
  const x = (i: number) => pad + (i / (data.length - 1)) * (W - pad * 2)
  const y = (v: number) => H - pad - ((v - min) / (max - min || 1)) * (H - pad * 2)
  const path = (arr: number[]) => arr.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('')
  const i = Math.max(0, Math.min(data.length - 1, Math.floor(t)))
  const area = `${path(data)}L${x(data.length - 1)},${H - pad}L${x(0)},${H - pad}Z`
  return (
    <figure className="chart">
      <figcaption>
        <span>{label}</span>
        <strong style={{ color }}>{format(data[i])}</strong>
      </figcaption>
      <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`${label}: ${format(data[i])} pada bulan ${i + 1}`}>
        <defs>
          <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.28" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {min < 0 && <line x1={pad} x2={W - pad} y1={y(0)} y2={y(0)} stroke="#B8BED6" strokeDasharray="3 3" />}
        {compare && <path d={path(compare)} fill="none" stroke="#9AA2C4" strokeWidth="1.5" strokeDasharray="4 3" />}
        <path d={area} fill={`url(#${id})`} />
        <path d={path(data)} fill="none" stroke={color} strokeWidth="2.2" strokeLinejoin="round" />
        <line x1={x(i)} x2={x(i)} y1={pad} y2={H - pad} stroke="#1E2340" strokeOpacity="0.25" />
        <circle cx={x(i)} cy={y(data[i])} r="4" fill="#fff" stroke={color} strokeWidth="2" />
      </svg>
    </figure>
  )
}

interface HistProps {
  a: number[]
  b?: number[]
  markA?: number
  markB?: number
  format: (v: number) => string
}

// Histogram dua distribusi laba kumulatif (awal vs optimal) dengan garis VaR 95%.
export function Histogram({ a, b, markA, markB, format }: HistProps) {
  const W = 520
  const H = 170
  const bins = 28
  // rentang dipotong pada persentil 1–97 agar ekor ekstrem tidak memampatkan grafik
  const all = (b ? a.concat(b) : a).slice().sort((x, y) => x - y)
  const lo = all[Math.floor(all.length * 0.01)]
  const hi = all[Math.floor(all.length * 0.97)]
  const bw = (hi - lo) / bins || 1
  const count = (arr: number[]) => {
    const c = new Array(bins).fill(0)
    arr.forEach((v) => (c[Math.max(0, Math.min(bins - 1, Math.floor((v - lo) / bw)))] += 1))
    return c
  }
  const ca = count(a)
  const cb = b ? count(b) : []
  const maxC = Math.max(...ca, ...cb, 1)
  const x = (v: number) => 10 + ((v - lo) / (hi - lo || 1)) * (W - 20)
  const barW = (W - 20) / bins
  return (
    <svg viewBox={`0 0 ${W} ${H + 22}`} className="hist" role="img" aria-label="Sebaran laba kumulatif 5 tahun">
      {ca.map((c, i) => (
        <rect key={`a${i}`} x={10 + i * barW + 1} y={H - (c / maxC) * (H - 10)} width={barW - 2} height={(c / maxC) * (H - 10)} fill="#9AA2C4" opacity="0.55" rx="2" />
      ))}
      {cb.map((c, i) => (
        <rect key={`b${i}`} x={10 + i * barW + 3} y={H - (c / maxC) * (H - 10)} width={barW - 6} height={(c / maxC) * (H - 10)} fill="#4B5BD6" opacity="0.85" rx="2" />
      ))}
      {lo < 0 && hi > 0 && <line x1={x(0)} x2={x(0)} y1={0} y2={H} stroke="#1E2340" strokeOpacity="0.3" />}
      {markA !== undefined && markA >= lo && <line x1={x(markA)} x2={x(markA)} y1={0} y2={H} stroke="#9AA2C4" strokeWidth="2" strokeDasharray="4 3" />}
      {markB !== undefined && markB >= lo && <line x1={x(markB)} x2={x(markB)} y1={0} y2={H} stroke="#F2A23A" strokeWidth="2.5" />}
      <text x={10} y={H + 16} className="axis">{format(lo)}</text>
      <text x={W - 10} y={H + 16} className="axis" textAnchor="end">{format(hi)}+</text>
    </svg>
  )
}
