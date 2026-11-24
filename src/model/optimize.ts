import { makeShocks, monteCarlo, normalize, rng, type Allocation, type RiskSummary, type Shocks, type SimInput } from './sim'

export type RiskMode = 'netral' | 'seimbang' | 'robust'

export const MODE_INFO: Record<RiskMode, { label: string; desc: string }> = {
  netral: { label: 'Netral risiko', desc: 'Memaksimalkan rata-rata laba kumulatif 5 tahun.' },
  seimbang: { label: 'Seimbang', desc: 'Rata-rata laba dikurangi λ × jarak ke CVaR 95%.' },
  robust: { label: 'Robust', desc: 'Memaksimalkan CVaR 95%: hasil rata-rata dari 5% skenario terburuk.' },
}

export function objective(r: RiskSummary, mode: RiskMode, lambda: number) {
  if (mode === 'netral') return r.mean
  if (mode === 'robust') return r.cvar95
  return r.mean - lambda * (r.mean - r.cvar95)
}

export interface OptResult {
  best: Allocation
  bestRisk: RiskSummary
  baseRisk: RiskSummary
  evaluated: number
  history: number[] // nilai objektif terbaik per iterasi
}

function dirichlet(r: ReturnType<typeof rng>): Allocation {
  // Gamma(1) = eksponensial → sampel seragam pada simpleks
  const g = () => -Math.log(1 - r.uni())
  return normalize({ inovasi: g(), sertifikasi: g(), promosi: g(), platform: g() })
}

function perturb(a: Allocation, r: ReturnType<typeof rng>, s: number): Allocation {
  const j = (x: number) => Math.max(0.01, x * Math.exp(s * r.norm()))
  return normalize({ inovasi: j(a.inovasi), sertifikasi: j(a.sertifikasi), promosi: j(a.promosi), platform: j(a.platform) })
}

// Pencarian acak pada simpleks + penyempurnaan lokal, dengan skenario acak bersama (common random numbers).
// Dijalankan bertahap agar antarmuka tetap responsif.
export async function optimize(
  base: SimInput,
  mode: RiskMode,
  lambda: number,
  nScen: number,
  onProgress: (p: number, bestSoFar: Allocation) => void,
): Promise<OptResult> {
  const scen: Shocks[] = Array.from({ length: nScen }, (_, i) => makeShocks(1000 + i, base.months))
  const r = rng(42)
  const evalA = (a: Allocation) => {
    const risk = monteCarlo({ ...base, policy: { ...base.policy, alloc: a } }, scen)
    return { a, risk, f: objective(risk, mode, lambda) }
  }

  const baseEval = evalA(normalize(base.policy.alloc))
  let pool = [baseEval, evalA({ inovasi: 0.25, sertifikasi: 0.25, promosi: 0.25, platform: 0.25 })]
  const history: number[] = []
  const totalRandom = 160
  const totalLocal = 120
  let done = 0
  const total = totalRandom + totalLocal

  const tick = () => new Promise((res) => setTimeout(res, 0))

  for (let i = 0; i < totalRandom; i++) {
    pool.push(evalA(dirichlet(r)))
    done++
    if (i % 8 === 0) {
      pool.sort((x, y) => y.f - x.f)
      pool = pool.slice(0, 12)
      history.push(pool[0].f)
      onProgress(done / total, pool[0].a)
      await tick()
    }
  }
  pool.sort((x, y) => y.f - x.f)
  pool = pool.slice(0, 6)

  for (let i = 0; i < totalLocal; i++) {
    const parent = pool[i % pool.length]
    const s = 0.5 * (1 - i / totalLocal) + 0.05
    const child = evalA(perturb(parent.a, r, s))
    pool.push(child)
    done++
    if (i % 6 === 0) {
      pool.sort((x, y) => y.f - x.f)
      pool = pool.slice(0, 6)
      history.push(pool[0].f)
      onProgress(done / total, pool[0].a)
      await tick()
    }
  }
  pool.sort((x, y) => y.f - x.f)
  history.push(pool[0].f)
  onProgress(1, pool[0].a)

  return { best: pool[0].a, bestRisk: pool[0].risk, baseRisk: baseEval.risk, evaluated: done + 2, history }
}
