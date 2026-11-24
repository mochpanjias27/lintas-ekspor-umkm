import { useState } from 'react'
import { useApp, fmtRp } from '../store'
import { ALLOC_KEYS, ALLOC_LABEL, COMMODITIES, normalize, type Allocation } from '../model/sim'
import { MODE_INFO, optimize, type OptResult, type RiskMode } from '../model/optimize'
import { Histogram } from './Chart'
import { ALLOC_COLOR } from './Panels'

export function Optimizer() {
  const s = useApp()
  const [mode, setMode] = useState<RiskMode>('seimbang')
  const [lambda, setLambda] = useState(0.5)
  const [nScen, setNScen] = useState(80)
  const [progress, setProgress] = useState<number | null>(null)
  const [live, setLive] = useState<Allocation | null>(null)
  const [res, setRes] = useState<OptResult | null>(null)
  const [applied, setApplied] = useState(false)
  const commodity = COMMODITIES.find((c) => c.id === s.commodityId)!

  const run = async () => {
    setRes(null)
    setApplied(false)
    setProgress(0)
    const r = await optimize({ commodity, policy: s.policy, env: s.env, months: s.months }, mode, lambda, nScen, (p, a) => {
      setProgress(p)
      setLive(a)
    })
    setRes(r)
    setProgress(null)
  }

  const base = normalize(s.policy.alloc)
  const shown = res?.best ?? live

  return (
    <section className="glass sheet" aria-label="Optimasi alokasi dan risiko">
      <div className="sheet-col">
        <h2>Cari alokasi anggaran terbaik</h2>
        <p className="lead">
          Mesin optimasi mencoba ratusan kombinasi alokasi untuk UMKM {commodity.name.toLowerCase()}. Setiap kombinasi diuji pada skenario kurs dan
          permintaan acak yang sama, lalu dinilai menurut sikap risiko yang Anda pilih.
        </p>

        <fieldset className="modes">
          <legend>Sikap terhadap risiko</legend>
          {(Object.keys(MODE_INFO) as RiskMode[]).map((m) => (
            <label key={m} className={`mode ${mode === m ? 'on' : ''}`}>
              <input type="radio" name="mode" checked={mode === m} onChange={() => setMode(m)} />
              <strong>{MODE_INFO[m].label}</strong>
              <span>{MODE_INFO[m].desc}</span>
            </label>
          ))}
        </fieldset>

        {mode === 'seimbang' && (
          <label className="slider" style={{ ['--p' as string]: `${lambda * 100}%` }}>
            <span className="slider-row">
              <span>Bobot penghindaran risiko λ</span>
              <output>{lambda.toFixed(2)}</output>
            </span>
            <input type="range" min={0} max={1} step={0.05} value={lambda} onChange={(e) => setLambda(Number(e.target.value))} />
          </label>
        )}
        <label className="slider" style={{ ['--p' as string]: `${((nScen - 40) / 260) * 100}%` }}>
          <span className="slider-row">
            <span>Jumlah skenario Monte Carlo</span>
            <output>{nScen}</output>
          </span>
          <input type="range" min={40} max={300} step={20} value={nScen} onChange={(e) => setNScen(Number(e.target.value))} />
        </label>

        <button className="btn primary wide" onClick={run} disabled={progress !== null}>
          {progress !== null ? `Mengoptimasi… ${Math.round(progress * 100)}%` : res ? 'Jalankan ulang optimasi' : 'Jalankan optimasi'}
        </button>
        {progress !== null && (
          <div className="progress big" aria-hidden>
            <span style={{ width: `${progress * 100}%` }} />
          </div>
        )}
        <p className="note">
          Volatilitas kurs {Math.round(s.env.volKurs * 100)}% per tahun, guncangan permintaan {Math.round(s.env.volDemand * 100)}% per bulan, horizon{' '}
          {s.months} bulan. Skenario dasar diambil dari pengaturan di Simulator.
        </p>
      </div>

      <div className="sheet-col results">
        <h3>Alokasi</h3>
        <div className="alloc-compare">
          {ALLOC_KEYS.map((k) => (
            <div key={k} className="alloc-row">
              <span className="alloc-name">{ALLOC_LABEL[k]}</span>
              <div className="alloc-bars">
                <span className="bar base" style={{ width: `${base[k] * 100}%` }} />
                {shown && <span className="bar best" style={{ width: `${shown[k] * 100}%`, background: ALLOC_COLOR[k] }} />}
              </div>
              <span className="alloc-val">
                {Math.round(base[k] * 100)}%{shown ? ` → ${Math.round(shown[k] * 100)}%` : ''}
              </span>
            </div>
          ))}
        </div>
        <p className="legend">
          <i className="sw base" /> Alokasi Anda sekarang <i className="sw best" /> Alokasi hasil optimasi
        </p>

        {res ? (
          <>
            <h3>Sebaran laba kumulatif 5 tahun</h3>
            <Histogram a={res.baseRisk.values} b={res.bestRisk.values} markA={res.baseRisk.var95} markB={res.bestRisk.var95} format={fmtRp} />
            <p className="legend">
              <i className="sw base" /> Alokasi sekarang <i className="sw best" /> Hasil optimasi <i className="sw var" /> VaR 95% hasil optimasi
            </p>
            <table className="risk">
              <thead>
                <tr>
                  <th scope="col">Ukuran</th>
                  <th scope="col">Sekarang</th>
                  <th scope="col">Optimal</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <th scope="row">Rata-rata laba</th>
                  <td>{fmtRp(res.baseRisk.mean)}</td>
                  <td>{fmtRp(res.bestRisk.mean)}</td>
                </tr>
                <tr>
                  <th scope="row">VaR 95%</th>
                  <td>{fmtRp(res.baseRisk.var95)}</td>
                  <td>{fmtRp(res.bestRisk.var95)}</td>
                </tr>
                <tr>
                  <th scope="row">CVaR 95%</th>
                  <td>{fmtRp(res.baseRisk.cvar95)}</td>
                  <td>{fmtRp(res.bestRisk.cvar95)}</td>
                </tr>
                <tr>
                  <th scope="row">Peluang rugi</th>
                  <td>{(res.baseRisk.pLoss * 100).toFixed(1)}%</td>
                  <td>{(res.bestRisk.pLoss * 100).toFixed(1)}%</td>
                </tr>
              </tbody>
            </table>
            <button
              className="btn wide"
              onClick={() => {
                s.applyAlloc(res.best)
                setApplied(true)
              }}
              disabled={applied}
            >
              {applied ? 'Alokasi diterapkan ke simulator' : 'Terapkan ke simulator'}
            </button>
            {applied && (
              <button className="link" onClick={() => { s.setPage('simulator'); s.setT(0); s.setPlaying(true) }}>
                Buka simulator untuk melihat hasilnya
              </button>
            )}
            <p className="note">{res.evaluated} kombinasi alokasi dievaluasi, masing-masing pada {nScen} skenario.</p>
          </>
        ) : (
          <p className="empty">Pilih sikap risiko, lalu jalankan optimasi. Hasilnya akan dibandingkan dengan alokasi Anda sekarang.</p>
        )}
      </div>
    </section>
  )
}
