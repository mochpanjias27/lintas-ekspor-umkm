// Mesin sistem dinamis UMKM ekspor (langkah bulanan, metode Euler).
// Satuan uang: juta rupiah. Semua parameter dapat dikalibrasi ulang dengan data mitra.

export type CommodityId = 'kerajinan' | 'kopi' | 'pangan' | 'fesyen'

export interface Commodity {
  id: CommodityId
  name: string
  short: string
  priceUSD: number // harga per pesanan ekspor (USD)
  unitCost: number // biaya pokok per pesanan (juta Rp)
  ordersPerBuyer: number // pesanan per pembeli aktif per bulan
  market: number // potensi pembeli global awal
  cap0: number // kapasitas produksi awal (pesanan/bulan)
  p: number // koefisien inovasi Bass (pengaruh promosi)
  q: number // koefisien imitasi Bass (dari mulut ke mulut)
  tauCert: number // waktu tunda sertifikasi (bulan)
  K0: number
  S0: number
  D0: number
}

export const COMMODITIES: Commodity[] = [
  { id: 'kerajinan', name: 'Kerajinan anyaman & bordir', short: 'Kerajinan', priceUSD: 1200, unitCost: 11, ordersPerBuyer: 0.6, market: 110, cap0: 22, p: 0.004, q: 0.22, tauCert: 4, K0: 0.25, S0: 0.3, D0: 0.2 },
  { id: 'kopi', name: 'Kopi spesialti', short: 'Kopi', priceUSD: 2400, unitCost: 26, ordersPerBuyer: 0.45, market: 80, cap0: 14, p: 0.005, q: 0.26, tauCert: 6, K0: 0.2, S0: 0.25, D0: 0.25 },
  { id: 'pangan', name: 'Makanan olahan', short: 'Pangan olahan', priceUSD: 1700, unitCost: 17, ordersPerBuyer: 0.8, market: 130, cap0: 26, p: 0.003, q: 0.24, tauCert: 10, K0: 0.2, S0: 0.15, D0: 0.2 },
  { id: 'fesyen', name: 'Fesyen muslim', short: 'Fesyen', priceUSD: 1500, unitCost: 14, ordersPerBuyer: 0.7, market: 120, cap0: 22, p: 0.005, q: 0.3, tauCert: 3, K0: 0.3, S0: 0.35, D0: 0.3 },
]

export interface Allocation {
  inovasi: number
  sertifikasi: number
  promosi: number
  platform: number
}

export const ALLOC_KEYS: (keyof Allocation)[] = ['inovasi', 'sertifikasi', 'promosi', 'platform']

export const ALLOC_LABEL: Record<keyof Allocation, string> = {
  inovasi: 'Inovasi produk',
  sertifikasi: 'Sertifikasi & standar',
  promosi: 'Promosi digital',
  platform: 'Platform & toko daring',
}

export interface Policy {
  budget: number // anggaran dasar per bulan (juta Rp)
  reinvest: number // porsi pendapatan yang diinvestasikan kembali (0–0,3)
  alloc: Allocation
}

export interface Env {
  kurs: number // Rp per USD
  tarif: number // tarif impor negara tujuan (0–0,3)
  volKurs: number // volatilitas tahunan kurs
  volDemand: number // simpangan guncangan permintaan bulanan
}

export interface SimInput {
  commodity: Commodity
  policy: Policy
  env: Env
  months: number
}

export interface Trajectory {
  months: number
  exportValue: number[] // nilai ekspor per bulan (juta Rp)
  buyers: number[]
  cash: number[]
  utilization: number[]
  K: number[]
  S: number[]
  D: number[]
  R: number[]
  capacity: number[]
  kurs: number[]
  profit: number[]
  cumProfit: number
  cumExport: number
}

export const KURS0 = 16000

export function normalize(a: Allocation): Allocation {
  const s = a.inovasi + a.sertifikasi + a.promosi + a.platform || 1
  return { inovasi: a.inovasi / s, sertifikasi: a.sertifikasi / s, promosi: a.promosi / s, platform: a.platform / s }
}

// Pembangkit bilangan acak deterministik (mulberry32) agar skenario dapat diulang.
export function rng(seed: number) {
  let t = seed >>> 0
  const uni = () => {
    t += 0x6d2b79f5
    let r = Math.imul(t ^ (t >>> 15), 1 | t)
    r ^= r + Math.imul(r ^ (r >>> 7), 61 | r)
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296
  }
  let spare: number | null = null
  const norm = () => {
    if (spare !== null) {
      const s = spare
      spare = null
      return s
    }
    let u = 0
    let v = 0
    while (u === 0) u = uni()
    v = uni()
    const m = Math.sqrt(-2 * Math.log(u))
    spare = m * Math.sin(2 * Math.PI * v)
    return m * Math.cos(2 * Math.PI * v)
  }
  return { uni, norm }
}

export interface Shocks {
  z: Float64Array // guncangan kurs
  e: Float64Array // guncangan permintaan
}

export function makeShocks(seed: number, months: number): Shocks {
  const r = rng(seed)
  const z = new Float64Array(months)
  const e = new Float64Array(months)
  for (let i = 0; i < months; i++) {
    z[i] = r.norm()
    e[i] = r.norm()
  }
  return { z, e }
}

const clamp = (x: number, a: number, b: number) => (x < a ? a : x > b ? b : x)

export function simulate(input: SimInput, shocks?: Shocks, record = true): Trajectory {
  const { commodity: c, policy, env, months } = input
  const w = normalize(policy.alloc)
  const dt = 1 / 12

  let K = c.K0
  let S = c.S0
  let D = c.D0
  let R = 0.3
  let A = 3 // pembeli aktif awal
  let cap = c.cap0
  let capPipe = 0
  let cash = 150
  let kurs = env.kurs
  let revPrev = 0
  let fill = 1

  const n = record ? months : 0
  const out: Trajectory = {
    months,
    exportValue: new Array(n),
    buyers: new Array(n),
    cash: new Array(n),
    utilization: new Array(n),
    K: new Array(n),
    S: new Array(n),
    D: new Array(n),
    R: new Array(n),
    capacity: new Array(n),
    kurs: new Array(n),
    profit: new Array(n),
    cumProfit: 0,
    cumExport: 0,
  }

  for (let t = 0; t < months; t++) {
    // Lingkungan stokastik
    let shock = 1
    if (shocks) {
      kurs = kurs * Math.exp(-0.5 * env.volKurs * env.volKurs * dt + env.volKurs * Math.sqrt(dt) * shocks.z[t])
      shock = Math.exp(env.volDemand * shocks.e[t] - 0.5 * env.volDemand * env.volDemand)
    }
    const comp = clamp(Math.pow(kurs / KURS0, 0.6) * (1 - 1.4 * env.tarif), 0.1, 2)

    // Anggaran: dasar + reinvestasi; dibatasi bila kas negatif (kendala likuiditas)
    let spend = policy.budget + policy.reinvest * revPrev
    if (cash < 0) spend *= 0.3
    const sI = spend * w.inovasi
    const sS = spend * w.sertifikasi
    const sP = spend * w.promosi
    const sD = spend * w.platform

    // Stok kapabilitas
    const dK = 0.06 * (sI / (sI + 15)) * (1 - K) - 0.012 * K
    const dS = ((sS / (sS + 8)) * (1 - S)) / c.tauCert - 0.004 * S
    const dD = 0.1 * (sD / (sD + 6)) * (1 - D) - 0.02 * D

    // Difusi pembeli (Bass yang dimodifikasi)
    const Meff = c.market * (1 + 0.8 * K)
    const P = Math.max(Meff - A, 0)
    const pEff = c.p * (1 + (6 * sP) / (sP + 10)) * (0.3 + 0.7 * D)
    const attract = (0.15 + 0.85 * S) * (0.4 + 0.6 * K) * (0.3 + 0.7 * R) * comp
    const adoption = (pEff + ((c.q * A) / Meff) * (0.5 + 0.5 * D)) * P * attract * shock
    const churn = A * (0.01 + 0.05 * (1 - R) + 0.08 * (1 - fill))

    // Permintaan, penjualan, kapasitas
    const demand = A * c.ordersPerBuyer * (1 + 0.4 * K)
    const sales = Math.min(demand, cap)
    fill = demand > 0 ? sales / demand : 1
    const util = cap > 0 ? sales / cap : 0

    const revenue = (sales * c.priceUSD * kurs) / 1e6
    const cogs = sales * c.unitCost
    const profit = revenue - cogs - 10 - spend

    // Investasi kapasitas saat utilisasi tinggi (tunda pembangunan 4 bulan)
    const capex = util > 0.85 && cash > 60 ? Math.min(0.2 * Math.max(profit, 0), 120) : 0
    const capDone = capPipe / 4

    // Reputasi menyesuaikan perlahan ke targetnya
    const Rt = (0.3 + 0.7 * K) * (0.4 + 0.6 * fill) * (0.5 + 0.5 * D)

    // Integrasi
    K = clamp(K + dK, 0, 1)
    S = clamp(S + dS, 0, 1)
    D = clamp(D + dD, 0, 1)
    R = clamp(R + (Rt - R) / 8, 0, 1)
    A = Math.max(A + adoption - churn, 0)
    capPipe = capPipe + capex / 12 - capDone
    cap = cap * (1 - 0.004) + capDone
    cash = cash + profit - capex
    revPrev = revenue

    out.cumProfit += profit
    out.cumExport += revenue
    if (record) {
      out.exportValue[t] = revenue
      out.buyers[t] = A
      out.cash[t] = cash
      out.utilization[t] = util
      out.K[t] = K
      out.S[t] = S
      out.D[t] = D
      out.R[t] = R
      out.capacity[t] = cap
      out.kurs[t] = kurs
      out.profit[t] = profit
    }
  }
  return out
}

export interface RiskSummary {
  values: number[] // laba kumulatif tiap skenario
  mean: number
  var95: number // kuantil 5% laba kumulatif
  cvar95: number // rata-rata 5% skenario terburuk
  pLoss: number
}

export function summarize(values: number[]): RiskSummary {
  const v = [...values].sort((a, b) => a - b)
  const n = v.length
  const k = Math.max(1, Math.floor(0.05 * n))
  let tail = 0
  for (let i = 0; i < k; i++) tail += v[i]
  const mean = v.reduce((a, b) => a + b, 0) / n
  return { values, mean, var95: v[k - 1], cvar95: tail / k, pLoss: v.filter((x) => x < 0).length / n }
}

export function monteCarlo(base: SimInput, scen: Shocks[]): RiskSummary {
  const vals = scen.map((s) => simulate(base, s, false).cumProfit)
  return summarize(vals)
}
