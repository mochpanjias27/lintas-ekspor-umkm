import { useState } from 'react'
import { C } from '../scene/World'

type NodeId = 'anggaran' | 'inovasi' | 'sertifikasi' | 'digital' | 'promosi' | 'daya' | 'pembeli' | 'pasar' | 'permintaan' | 'penjualan' | 'kapasitas' | 'pemenuhan' | 'reputasi' | 'pendapatan' | 'kas' | 'kurs'

const NODES: Record<NodeId, { x: number; y: number; label: string; stock?: boolean; exo?: boolean }> = {
  anggaran: { x: 145, y: 300, label: 'Anggaran pemasaran' },
  inovasi: { x: 360, y: 110, label: 'Kapabilitas inovasi', stock: true },
  sertifikasi: { x: 360, y: 225, label: 'Kesiapan sertifikasi', stock: true },
  digital: { x: 360, y: 375, label: 'Adopsi digital', stock: true },
  promosi: { x: 360, y: 490, label: 'Promosi digital' },
  kurs: { x: 600, y: 50, label: 'Kurs & tarif', exo: true },
  daya: { x: 600, y: 190, label: 'Daya tarik produk' },
  reputasi: { x: 600, y: 380, label: 'Reputasi', stock: true },
  pasar: { x: 830, y: 70, label: 'Pasar potensial' },
  pembeli: { x: 830, y: 245, label: 'Pembeli aktif', stock: true },
  permintaan: { x: 1020, y: 245, label: 'Permintaan' },
  pemenuhan: { x: 830, y: 420, label: 'Pemenuhan pesanan' },
  kapasitas: { x: 1140, y: 380, label: 'Kapasitas', stock: true },
  penjualan: { x: 1020, y: 470, label: 'Penjualan' },
  pendapatan: { x: 640, y: 560, label: 'Pendapatan' },
  kas: { x: 1050, y: 600, label: 'Kas', stock: true },
}

type Edge = [NodeId, NodeId, '+' | '−' | '±', number?]
const EDGES: Edge[] = [
  ['anggaran', 'inovasi', '+', -0.25],
  ['anggaran', 'sertifikasi', '+', 0.05],
  ['anggaran', 'digital', '+', -0.05],
  ['anggaran', 'promosi', '+', -0.12],
  ['inovasi', 'daya', '+', 0.08],
  ['sertifikasi', 'daya', '+', 0.05],
  ['kurs', 'daya', '±', 0],
  ['reputasi', 'daya', '+', 0],
  ['daya', 'pembeli', '+', 0.05],
  ['digital', 'pembeli', '+', -0.08],
  ['promosi', 'pembeli', '+', 0.12],
  ['digital', 'reputasi', '+', 0.05],
  ['inovasi', 'pasar', '+', -0.12],
  ['pasar', 'pembeli', '+', 0.25],
  ['pembeli', 'pasar', '−', 0.25],
  ['pembeli', 'permintaan', '+', 0.08],
  ['permintaan', 'penjualan', '+', -0.08],
  ['kapasitas', 'penjualan', '+', -0.12],
  ['permintaan', 'pemenuhan', '−', -0.1],
  ['kapasitas', 'pemenuhan', '+', 0.12],
  ['pemenuhan', 'reputasi', '+', 0.1],
  ['penjualan', 'pendapatan', '+', -0.1],
  ['pendapatan', 'anggaran', '+', -0.45],
  ['pendapatan', 'kas', '+', 0.1],
  ['kas', 'kapasitas', '+', 0.15],
]

const LOOPS: { id: string; kind: 'R' | 'B'; name: string; desc: string; path: NodeId[] }[] = [
  {
    id: 'R1',
    kind: 'R',
    name: 'Reinvestasi inovasi',
    desc: 'Pendapatan yang diinvestasikan ulang menaikkan inovasi, produk makin menarik, pembeli bertambah, dan pendapatan naik lagi.',
    path: ['pendapatan', 'anggaran', 'inovasi', 'daya', 'pembeli', 'permintaan', 'penjualan', 'pendapatan'],
  },
  {
    id: 'R2',
    kind: 'R',
    name: 'Investasi kapasitas',
    desc: 'Laba ditanam ke kapasitas produksi sehingga lebih banyak pesanan terlayani. Ada tunda pembangunan sekitar 4 bulan.',
    path: ['penjualan', 'pendapatan', 'kas', 'kapasitas', 'penjualan'],
  },
  {
    id: 'B1',
    kind: 'B',
    name: 'Kendala kapasitas',
    desc: 'Permintaan yang melampaui kapasitas menurunkan pemenuhan pesanan, reputasi turun, dan laju pembeli baru tertahan.',
    path: ['pembeli', 'permintaan', 'pemenuhan', 'reputasi', 'daya', 'pembeli'],
  },
  {
    id: 'B2',
    kind: 'B',
    name: 'Kejenuhan pasar',
    desc: 'Makin banyak pembeli yang sudah didapat, makin sedikit pasar potensial yang tersisa untuk direbut.',
    path: ['pembeli', 'pasar', 'pembeli'],
  },
]

const EQUATIONS = [
  ['Kapabilitas inovasi', 'dK/dt = αK · Iₖ/(Iₖ + hₖ) · (1 − K) − δK · K'],
  ['Kesiapan sertifikasi', 'dS/dt = Iₛ/(Iₛ + hₛ) · (1 − S) / τₛ'],
  ['Adopsi digital', 'dD/dt = αD · I_D/(I_D + h_D) · (1 − D) − δD · D'],
  ['Pembeli aktif', 'dA/dt = (p′ + q · A/M′) · (M′ − A) · Daya tarik − churn · A'],
  ['Penjualan', 'Penjualan = min(Permintaan, Kapasitas)'],
  ['Optimasi robust', 'maks over w ∈ Δ⁴ dari CVaR₉₅[Laba kumulatif(w, ξ)]'],
]

const edgeKey = (a: NodeId, b: NodeId) => `${a}>${b}`

export function ModelMap() {
  const [loop, setLoop] = useState<string | null>('R1')
  const active = LOOPS.find((l) => l.id === loop)
  const activeEdges = new Set<string>()
  const activeNodes = new Set<NodeId>()
  if (active) {
    active.path.forEach((n, i) => {
      activeNodes.add(n)
      if (i < active.path.length - 1) activeEdges.add(edgeKey(n, active.path[i + 1]))
    })
  }
  const loopColor = active?.kind === 'R' ? C.nila : C.kunyit

  return (
    <section className="glass sheet map" aria-label="Struktur model sistem dinamis">
      <div className="sheet-col cld-wrap">
        <svg viewBox="0 0 1290 650" className="cld" role="img" aria-label="Diagram loop sebab-akibat">
          <defs>
            {['#9AA2C4', C.nila, C.kunyit].map((c, i) => (
              <marker key={i} id={`arr${i}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0,0 L10,5 L0,10 z" fill={c} />
              </marker>
            ))}
          </defs>
          {EDGES.map(([a, b, sign, bend = 0.12]) => {
            const A = NODES[a]
            const B = NODES[b]
            const on = activeEdges.has(edgeKey(a, b))
            const dim = active && !on
            const mx = (A.x + B.x) / 2
            const my = (A.y + B.y) / 2
            const dx = B.x - A.x
            const dy = B.y - A.y
            const len = Math.hypot(dx, dy)
            const cx = mx - dy * bend
            const cy = my + dx * bend
            // pangkas ujung agar panah berhenti di tepi label
            const trim = (px: number, py: number, qx: number, qy: number, r: number) => {
              const l = Math.hypot(qx - px, qy - py)
              return [px + ((qx - px) / l) * r, py + ((qy - py) / l) * r]
            }
            const [sx, sy] = trim(A.x, A.y, cx, cy, 30)
            const [ex, ey] = trim(B.x, B.y, cx, cy, Math.min(70, 30 + Math.abs((cx - B.x) / Math.max(1, Math.hypot(cx - B.x, cy - B.y))) * (B.label.length * 5.2 - 8)))
            const color = on ? loopColor : '#9AA2C4'
            const mk = on ? (active?.kind === 'R' ? 1 : 2) : 0
            const lx = 0.25 * sx + 0.5 * cx + 0.25 * ex
            const ly = 0.25 * sy + 0.5 * cy + 0.25 * ey
            return (
              <g key={edgeKey(a, b)} opacity={dim ? 0.22 : 1}>
                <path d={`M${sx},${sy} Q${cx},${cy} ${ex},${ey}`} fill="none" stroke={color} strokeWidth={on ? 2.6 : 1.5} markerEnd={`url(#arr${mk})`} />
                {len > 0 && (
                  <text x={lx} y={ly} className={`sign ${on ? 'on' : ''}`} fill={color} dy="-4">
                    {sign}
                  </text>
                )}
              </g>
            )
          })}
          {(Object.keys(NODES) as NodeId[]).map((id) => {
            const n = NODES[id]
            const w = n.label.length * 10.4 + 28
            const on = activeNodes.has(id)
            return (
              <g key={id} opacity={active && !on ? 0.45 : 1} transform={`translate(${n.x},${n.y})`}>
                <rect
                  x={-w / 2}
                  y={-22}
                  width={w}
                  height={44}
                  rx={n.stock ? 8 : 22}
                  fill={n.exo ? '#F3F4FA' : '#fff'}
                  stroke={on ? loopColor : n.stock ? C.ink : '#C9CEE3'}
                  strokeWidth={n.stock ? 2 : 1.2}
                  strokeDasharray={n.exo ? '4 3' : undefined}
                />
                <text textAnchor="middle" dy="7" className="node">
                  {n.label}
                </text>
              </g>
            )
          })}
          {active && (
            <text x={645} y={640} textAnchor="middle" className="loop-tag" fill={loopColor}>
              {active.id}: {active.name}
            </text>
          )}
        </svg>
      </div>
      <div className="sheet-col map-info">
        <div className="map-head">
        <h2>Struktur model</h2>
        <p className="lead">
          Diagram sebab-akibat yang menjadi dasar simulasi. Kotak bergaris tebal adalah stok yang terakumulasi dari waktu ke waktu. Pilih sebuah loop untuk
          melihat jalurnya.
        </p>
        </div>
        <div className="loops">
          {LOOPS.map((l) => (
            <button key={l.id} className={`loop ${loop === l.id ? 'on' : ''} ${l.kind}`} onClick={() => setLoop(loop === l.id ? null : l.id)} aria-pressed={loop === l.id}>
              <span className="loop-id">{l.id}</span>
              <span>
                <strong>{l.name}</strong>
                <small>{l.desc}</small>
              </span>
            </button>
          ))}
        </div>
        <details className="eqs">
          <summary>Persamaan inti</summary>
          <dl>
            {EQUATIONS.map(([k, v]) => (
              <div key={k}>
                <dt>{k}</dt>
                <dd>{v}</dd>
              </div>
            ))}
          </dl>
        </details>
      </div>
    </section>
  )
}
