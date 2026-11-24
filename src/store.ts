import { create } from 'zustand'
import { COMMODITIES, simulate, type Allocation, type CommodityId, type Env, type Policy, type Trajectory } from './model/sim'

export type Page = 'beranda' | 'simulator' | 'optimasi' | 'struktur'
export type SpotId = 'bengkel' | 'lab' | 'hub' | 'gudang' | 'pelabuhan'

// Level visual yang dibaca scene 3D (0–1)
export interface SceneLevels {
  ekspor: number
  inovasi: number
  sertifikasi: number
  digital: number
  utilisasi: number
}

interface State {
  page: Page
  setPage: (p: Page) => void
  spot: SpotId | null
  setSpot: (s: SpotId | null) => void

  commodityId: CommodityId
  policy: Policy
  env: Env
  months: number
  traj: Trajectory
  t: number
  playing: boolean
  speed: number

  setCommodity: (id: CommodityId) => void
  setPolicy: (p: Partial<Policy>) => void
  setAlloc: (k: keyof Allocation, v: number) => void
  applyAlloc: (a: Allocation) => void
  setEnv: (e: Partial<Env>) => void
  setT: (t: number) => void
  setPlaying: (p: boolean) => void
  setSpeed: (s: number) => void
}

const defaultPolicy: Policy = {
  budget: 25,
  reinvest: 0.1,
  alloc: { inovasi: 30, sertifikasi: 25, promosi: 25, platform: 20 },
}
const defaultEnv: Env = { kurs: 16000, tarif: 0.08, volKurs: 0.12, volDemand: 0.15 }

const run = (id: CommodityId, policy: Policy, env: Env, months: number) =>
  simulate({ commodity: COMMODITIES.find((c) => c.id === id)!, policy, env, months })

export const useApp = create<State>((set, get) => ({
  page: 'beranda',
  setPage: (page) => set({ page, spot: null }),
  spot: null,
  setSpot: (spot) => set({ spot }),

  commodityId: 'kerajinan',
  policy: defaultPolicy,
  env: defaultEnv,
  months: 60,
  traj: run('kerajinan', defaultPolicy, defaultEnv, 60),
  t: 0,
  playing: true,
  speed: 1,

  setCommodity: (commodityId) => {
    const { policy, env, months } = get()
    set({ commodityId, traj: run(commodityId, policy, env, months) })
  },
  setPolicy: (p) => {
    const { commodityId, env, months } = get()
    const policy = { ...get().policy, ...p }
    set({ policy, traj: run(commodityId, policy, env, months) })
  },
  setAlloc: (k, v) => {
    const alloc = { ...get().policy.alloc, [k]: v }
    get().setPolicy({ alloc })
  },
  applyAlloc: (a) => {
    get().setPolicy({
      alloc: {
        inovasi: Math.round(a.inovasi * 100),
        sertifikasi: Math.round(a.sertifikasi * 100),
        promosi: Math.round(a.promosi * 100),
        platform: Math.round(a.platform * 100),
      },
    })
  },
  setEnv: (e) => {
    const { commodityId, policy, months } = get()
    const env = { ...get().env, ...e }
    set({ env, traj: run(commodityId, policy, env, months) })
  },
  setT: (t) => set({ t }),
  setPlaying: (playing) => set({ playing }),
  setSpeed: (speed) => set({ speed }),
}))

// Mengubah keadaan simulasi pada bulan t menjadi level visual untuk scene.
export function levelsAt(traj: Trajectory, t: number): SceneLevels {
  const i = Math.max(0, Math.min(traj.months - 1, Math.floor(t)))
  const ekspor = Math.min(1, Math.log10(1 + traj.exportValue[i]) / Math.log10(1 + 2500))
  return {
    ekspor,
    inovasi: traj.K[i],
    sertifikasi: traj.S[i],
    digital: traj.D[i],
    utilisasi: traj.utilization[i],
  }
}

export const fmtRp = (juta: number) => {
  const a = Math.abs(juta)
  const s = juta < 0 ? '−' : ''
  if (a >= 1000) return `${s}Rp${(a / 1000).toLocaleString('id-ID', { maximumFractionDigits: 2 })} M`
  return `${s}Rp${a.toLocaleString('id-ID', { maximumFractionDigits: 0 })} jt`
}
