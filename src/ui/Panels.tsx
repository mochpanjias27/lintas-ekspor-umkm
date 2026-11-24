import { useApp, fmtRp, type Page, type SpotId } from '../store'
import { ALLOC_KEYS, ALLOC_LABEL, COMMODITIES, normalize } from '../model/sim'
import { LineChart } from './Chart'
import { C } from '../scene/World'

const NAV: { id: Page; label: string }[] = [
  { id: 'beranda', label: 'Beranda' },
  { id: 'simulator', label: 'Simulator' },
  { id: 'optimasi', label: 'Optimasi & risiko' },
  { id: 'struktur', label: 'Struktur model' },
]

export const ALLOC_COLOR = { inovasi: C.kunyit, sertifikasi: C.daun, promosi: C.nila, platform: C.laut }

export function TopBar() {
  const page = useApp((s) => s.page)
  const setPage = useApp((s) => s.setPage)
  return (
    <header className="topbar">
      <button className="brand" onClick={() => setPage('beranda')} aria-label="Lintas, kembali ke beranda">
        <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden>
          <rect x="2" y="12" width="9" height="9" rx="2.5" fill={C.kunyit} />
          <rect x="9.5" y="6" width="9" height="9" rx="2.5" fill={C.nila} />
          <rect x="17" y="12" width="9" height="9" rx="2.5" fill={C.laut} />
        </svg>
        <span>Lintas</span>
      </button>
      <nav aria-label="Halaman">
        {NAV.map((n) => (
          <button key={n.id} className={page === n.id ? 'on' : ''} aria-current={page === n.id ? 'page' : undefined} onClick={() => setPage(n.id)}>
            {n.label}
          </button>
        ))}
      </nav>
    </header>
  )
}

const SPOT_INFO: Record<SpotId, { title: string; body: string; model: string; metric: (s: ReturnType<typeof useApp.getState>, i: number) => string }> = {
  bengkel: {
    title: 'Bengkel produksi',
    body: 'Tempat produk dibuat. Kapasitas menentukan berapa pesanan yang bisa dipenuhi. Saat utilisasi di atas 85%, sebagian laba dipakai menambah kapasitas, dan hasilnya baru terasa sekitar 4 bulan kemudian.',
    model: 'Stok kapasitas produksi dan loop B1 kendala kapasitas',
    metric: (s, i) => `Utilisasi ${(s.traj.utilization[i] * 100).toFixed(0)}%`,
  },
  lab: {
    title: 'Lab inovasi',
    body: 'Anggaran inovasi menaikkan kapabilitas: varian produk baru, mutu, dan desain. Inovasi memperluas pasar potensial dan membuat produk lebih menarik bagi pembeli.',
    model: 'Stok kapabilitas inovasi K dan loop R1 reinvestasi',
    metric: (s, i) => `Indeks inovasi ${(s.traj.K[i] * 100).toFixed(0)}/100`,
  },
  hub: {
    title: 'Hub platform digital',
    body: 'Toko daring, marketplace B2B lintas negara, dan promosi digital. Adopsi digital memperkuat efek promosi dan rekomendasi antarpembeli, lalu ikut membangun reputasi.',
    model: 'Stok adopsi digital D dan reputasi R',
    metric: (s, i) => `Adopsi digital ${(s.traj.D[i] * 100).toFixed(0)}/100`,
  },
  gudang: {
    title: 'Gudang & sertifikasi',
    body: 'Sertifikasi seperti halal, HACCP, atau standar negara tujuan menjadi syarat masuk pasar. Prosesnya lambat, sehingga hasil anggaran sertifikasi baru terlihat beberapa bulan kemudian. Cincin hijau menunjukkan tingkat kesiapannya.',
    model: 'Stok kesiapan sertifikasi S (tunda orde satu)',
    metric: (s, i) => `Kesiapan ${(s.traj.S[i] * 100).toFixed(0)}/100`,
  },
  pelabuhan: {
    title: 'Pelabuhan ekspor',
    body: 'Pesanan dikirim ke pembeli di luar negeri. Makin besar nilai ekspor, makin sering kapal berangkat. Kurs dan tarif negara tujuan memengaruhi daya saing harga.',
    model: 'Aliran penjualan dan pendapatan, dipengaruhi variabel eksogen kurs & tarif',
    metric: (s, i) => `Ekspor ${fmtRp(s.traj.exportValue[i])}/bulan`,
  },
}

export function SpotCard() {
  const spot = useApp((s) => s.spot)
  const setSpot = useApp((s) => s.setSpot)
  const st = useApp()
  if (!spot) return null
  const info = SPOT_INFO[spot]
  const i = Math.min(st.months - 1, Math.floor(st.t))
  return (
    <aside className="glass spotcard" aria-live="polite">
      <button className="close" onClick={() => setSpot(null)} aria-label="Tutup">
        ×
      </button>
      <h3>{info.title}</h3>
      <p>{info.body}</p>
      <p className="spot-model">{info.model}</p>
      <p className="spot-metric">
        Bulan {i + 1}: <strong>{info.metric(st, i)}</strong>
      </p>
    </aside>
  )
}

export function Home() {
  const setPage = useApp((s) => s.setPage)
  const traj = useApp((s) => s.traj)
  const t = useApp((s) => s.t)
  const i = Math.min(traj.months - 1, Math.floor(t))
  const year = Math.floor(i / 12) + 1
  return (
    <>
      <section className="glass hero">
        <h1>Dari bengkel kecil ke pasar dunia.</h1>
        <p>
          Simulasikan bagaimana inovasi produk dan platform digital membawa UMKM menembus pasar ekspor, lalu temukan alokasi anggaran terbaik dengan
          risiko yang terukur.
        </p>
        <div className="hero-actions">
          <button className="btn primary" onClick={() => setPage('simulator')}>
            Coba simulator
          </button>
          <button className="btn" onClick={() => setPage('struktur')}>
            Lihat struktur model
          </button>
        </div>
        <p className="credit">Prototipe riset sistem dinamis, Departemen Matematika FMIPA Universitas Padjadjaran</p>
      </section>
      <aside className="glass ticker" aria-label="Skenario yang sedang berjalan">
        <p className="ticker-head">
          Tahun {year}, bulan {(i % 12) + 1}
        </p>
        <div className="progress" aria-hidden>
          <span style={{ width: `${((i + 1) / traj.months) * 100}%` }} />
        </div>
        <dl>
          <div>
            <dt>Ekspor per bulan</dt>
            <dd>{fmtRp(traj.exportValue[i])}</dd>
          </div>
          <div>
            <dt>Pembeli luar negeri</dt>
            <dd>{traj.buyers[i].toFixed(0)}</dd>
          </div>
        </dl>
        <p className="hint">Skenario contoh: UMKM kerajinan anyaman & bordir. Klik bangunan untuk melihat perannya dalam model.</p>
      </aside>
    </>
  )
}

function Slider(props: { label: string; value: number; min: number; max: number; step: number; display: string; onChange: (v: number) => void; accent?: string }) {
  return (
    <label className="slider" style={{ ['--accent' as string]: props.accent ?? C.nila, ['--p' as string]: `${((props.value - props.min) / (props.max - props.min)) * 100}%` }}>
      <span className="slider-row">
        <span>{props.label}</span>
        <output>{props.display}</output>
      </span>
      <input type="range" min={props.min} max={props.max} step={props.step} value={props.value} onChange={(e) => props.onChange(Number(e.target.value))} />
    </label>
  )
}

export function Simulator() {
  const s = useApp()
  const i = Math.min(s.months - 1, Math.floor(s.t))
  const w = normalize(s.policy.alloc)
  const cum = s.traj.profit.slice(0, i + 1).reduce((a, b) => a + b, 0)
  const restart = () => {
    s.setT(0)
    s.setPlaying(true)
  }
  return (
    <>
      <div className="kpis" role="status">
        <div className="glass kpi">
          <span>Ekspor per bulan</span>
          <strong>{fmtRp(s.traj.exportValue[i])}</strong>
        </div>
        <div className="glass kpi">
          <span>Pembeli luar negeri</span>
          <strong>{s.traj.buyers[i].toFixed(0)}</strong>
        </div>
        <div className="glass kpi">
          <span>Kas usaha</span>
          <strong className={s.traj.cash[i] < 0 ? 'neg' : ''}>{fmtRp(s.traj.cash[i])}</strong>
        </div>
        <div className="glass kpi">
          <span>Laba kumulatif</span>
          <strong className={cum < 0 ? 'neg' : ''}>{fmtRp(cum)}</strong>
        </div>
      </div>

      <section className="glass controls" aria-label="Pengaturan skenario">
        <h2>Skenario UMKM</h2>
        <div className="chips" role="radiogroup" aria-label="Komoditas">
          {COMMODITIES.map((c) => (
            <button key={c.id} role="radio" aria-checked={s.commodityId === c.id} className={s.commodityId === c.id ? 'on' : ''} onClick={() => { s.setCommodity(c.id); restart() }}>
              {c.short}
            </button>
          ))}
        </div>

        <h3>Anggaran</h3>
        <Slider label="Anggaran dasar per bulan" value={s.policy.budget} min={5} max={80} step={1} display={`Rp${s.policy.budget} jt`} onChange={(v) => s.setPolicy({ budget: v })} />
        <Slider label="Pendapatan yang diinvestasikan ulang" value={s.policy.reinvest} min={0} max={0.3} step={0.01} display={`${Math.round(s.policy.reinvest * 100)}%`} onChange={(v) => s.setPolicy({ reinvest: v })} />

        <h3>Alokasi anggaran</h3>
        <div className="stack" aria-hidden>
          {ALLOC_KEYS.map((k) => (
            <span key={k} style={{ flexGrow: w[k], background: ALLOC_COLOR[k] }} />
          ))}
        </div>
        {ALLOC_KEYS.map((k) => (
          <Slider key={k} label={ALLOC_LABEL[k]} value={s.policy.alloc[k]} min={0} max={100} step={1} display={`${Math.round(w[k] * 100)}%`} accent={ALLOC_COLOR[k]} onChange={(v) => s.setAlloc(k, v)} />
        ))}

        <h3>Lingkungan pasar</h3>
        <Slider label="Kurs rupiah per USD" value={s.env.kurs} min={14000} max={18500} step={100} display={`Rp${s.env.kurs.toLocaleString('id-ID')}`} onChange={(v) => s.setEnv({ kurs: v })} />
        <Slider label="Tarif negara tujuan" value={s.env.tarif} min={0} max={0.3} step={0.01} display={`${Math.round(s.env.tarif * 100)}%`} onChange={(v) => s.setEnv({ tarif: v })} />
      </section>

      <section className="glass charts" aria-label="Grafik hasil simulasi">
        <LineChart label="Nilai ekspor per bulan" data={s.traj.exportValue} t={s.t} color={C.nila} format={fmtRp} />
        <LineChart label="Pembeli luar negeri" data={s.traj.buyers} t={s.t} color={C.laut} format={(v) => v.toFixed(0)} />
        <LineChart label="Kas usaha" data={s.traj.cash} t={s.t} color={C.kunyit} format={fmtRp} />
        <LineChart label="Utilisasi kapasitas" data={s.traj.utilization} t={s.t} color={C.daun} format={(v) => `${(v * 100).toFixed(0)}%`} />
      </section>

      <div className="glass timeline">
        <button className="play" onClick={() => (s.t >= s.months - 1 ? restart() : s.setPlaying(!s.playing))} aria-label={s.playing ? 'Jeda' : 'Putar'}>
          {s.playing ? (
            <svg width="14" height="14" viewBox="0 0 14 14"><rect x="2" y="1" width="3.5" height="12" rx="1" fill="currentColor" /><rect x="8.5" y="1" width="3.5" height="12" rx="1" fill="currentColor" /></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 14 14"><path d="M3 1.5v11l9-5.5z" fill="currentColor" /></svg>
          )}
        </button>
        <label className="scrub" style={{ ['--accent' as string]: C.nila, ['--p' as string]: `${(s.t / (s.months - 1)) * 100}%` }}>
          <span className="sr">Bulan simulasi</span>
          <input type="range" min={0} max={s.months - 1} step={0.1} value={s.t} onChange={(e) => { s.setPlaying(false); s.setT(Number(e.target.value)) }} />
        </label>
        <span className="month">
          Bulan {i + 1}<small>/{s.months}</small>
        </span>
        <div className="speed" role="radiogroup" aria-label="Kecepatan">
          {[0.5, 1, 2].map((v) => (
            <button key={v} role="radio" aria-checked={s.speed === v} className={s.speed === v ? 'on' : ''} onClick={() => s.setSpeed(v)}>
              {v}×
            </button>
          ))}
        </div>
      </div>
    </>
  )
}
