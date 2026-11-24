import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Html, OrbitControls, OrthographicCamera, RoundedBox } from '@react-three/drei'
import { useEffect, useMemo, useRef } from 'react'
import * as THREE from 'three'
import { levelsAt, useApp, type SpotId } from '../store'

export const C = {
  ground: '#EEF0F8',
  wall: '#F8F9FD',
  nila: '#4B5BD6',
  nilaSoft: '#AEB7F2',
  laut: '#2BB3B1',
  lautSoft: '#9FDCDD',
  kunyit: '#F2A23A',
  daun: '#7CC56B',
  road: '#CDD2E6',
  ink: '#1E2340',
}

// Keadaan scene bersama (dibaca di useFrame tanpa memicu render ulang React)
const live = { t: 0, ekspor: 0.2, inovasi: 0.2, sertifikasi: 0.2, digital: 0.2, utilisasi: 0.2 }
const ease = (cur: number, target: number, d: number) => cur + (target - cur) * Math.min(1, d * 3)

function Clock() {
  const last = useRef({ pushed: -1, ext: 0 })
  useFrame((_, d) => {
    const s = useApp.getState()
    // Bila t diubah dari luar (mis. penggeser), ikuti nilai itu
    if (s.t !== last.current.ext) live.t = s.t
    if (s.playing && s.page !== 'optimasi' && s.page !== 'struktur') {
      live.t += d * 2 * s.speed
      if (live.t >= s.months - 1) {
        if (s.page === 'beranda') live.t = 0
        else {
          live.t = s.months - 1
          s.setPlaying(false)
        }
      }
    }
    const step = Math.floor(live.t * 8)
    if (step !== last.current.pushed) {
      last.current.pushed = step
      last.current.ext = live.t
      s.setT(live.t)
    }
    const L = levelsAt(s.traj, live.t)
    live.ekspor = ease(live.ekspor, L.ekspor, d)
    live.inovasi = ease(live.inovasi, L.inovasi, d)
    live.sertifikasi = ease(live.sertifikasi, L.sertifikasi, d)
    live.digital = ease(live.digital, L.digital, d)
    live.utilisasi = ease(live.utilisasi, L.utilisasi, d)
  })
  return null
}

function CameraRig() {
  const { camera, size } = useThree()
  const page = useApp((s) => s.page)
  const target = useRef(28)
  useEffect(() => {
    const base = Math.max(11, Math.min(30, size.width / 50))
    target.current = page === 'simulator' && size.width > 980 ? base * 0.86 : base
  }, [page, size.width])
  const settling = useRef(true)
  useEffect(() => {
    settling.current = true
  }, [page, size.width])
  useFrame((_, d) => {
    if (!settling.current) return
    const cam = camera as THREE.OrthographicCamera
    cam.zoom += (target.current - cam.zoom) * Math.min(1, d * 4)
    cam.updateProjectionMatrix()
    if (Math.abs(cam.zoom - target.current) < 0.05) settling.current = false
  })
  return null
}

/* ---------- Jalan & kendaraan ---------- */

const roadCurve = new THREE.CatmullRomCurve3(
  [
    [-6.5, 0, 6.8],
    [-1, 0, 8],
    [4.5, 0, 7.6],
    [6.2, 0, 4],
    [6.2, 0, -2.5],
    [3, 0, -2.6],
    [-3, 0, -1.4],
    [-6.6, 0, 0.2],
    [-7.6, 0, 3.8],
  ].map(([x, y, z]) => new THREE.Vector3(x, y, z)),
  true,
  'catmullrom',
  0.4,
)

function Road() {
  const geo = useMemo(() => {
    const pts = roadCurve.getSpacedPoints(240)
    const pos: number[] = []
    const idx: number[] = []
    const w = 0.75
    pts.forEach((p, i) => {
      const tg = roadCurve.getTangentAt(i / 240)
      const n = new THREE.Vector3(-tg.z, 0, tg.x).normalize()
      pos.push(p.x + n.x * w, 0.02, p.z + n.z * w, p.x - n.x * w, 0.02, p.z - n.z * w)
      if (i < pts.length - 1) {
        const a = i * 2
        idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
      }
    })
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    g.setIndex(idx)
    g.computeVertexNormals()
    return g
  }, [])
  const dashes = useMemo(() => roadCurve.getSpacedPoints(60), [])
  return (
    <group>
      <mesh geometry={geo} receiveShadow>
        <meshStandardMaterial color={C.road} side={THREE.DoubleSide} roughness={0.9} />
      </mesh>
      {dashes.map((p, i) => (
        <mesh key={i} position={[p.x, 0.04, p.z]} rotation={[-Math.PI / 2, 0, Math.atan2(roadCurve.getTangentAt(i / 60).x, roadCurve.getTangentAt(i / 60).z)]}>
          <planeGeometry args={[0.08, 0.35]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>
      ))}
    </group>
  )
}

function Truck({ offset, color }: { offset: number; color: string }) {
  const ref = useRef<THREE.Group>(null!)
  const idx = useRef(offset)
  useFrame((_, d) => {
    const visible = offset < 0.18 + live.ekspor * 0.82
    ref.current.visible = visible
    idx.current = (idx.current + d * (0.025 + live.utilisasi * 0.03)) % 1
    const p = roadCurve.getPointAt(idx.current)
    const tg = roadCurve.getTangentAt(idx.current)
    const n = new THREE.Vector3(-tg.z, 0, tg.x).normalize()
    ref.current.position.set(p.x + n.x * 0.35, 0, p.z + n.z * 0.35)
    ref.current.rotation.y = Math.atan2(tg.x, tg.z)
  })
  return (
    <group ref={ref}>
      <RoundedBox args={[0.55, 0.55, 0.5]} radius={0.1} position={[0, 0.38, 0.55]} castShadow>
        <meshStandardMaterial color={C.wall} />
      </RoundedBox>
      <mesh position={[0, 0.48, 0.81]}>
        <boxGeometry args={[0.45, 0.22, 0.02]} />
        <meshStandardMaterial color={C.nila} />
      </mesh>
      <RoundedBox args={[0.6, 0.7, 1.1]} radius={0.08} position={[0, 0.48, -0.25]} castShadow>
        <meshStandardMaterial color={color} />
      </RoundedBox>
      {[-0.3, 0.3].map((x) =>
        [0.55, -0.55].map((z) => (
          <mesh key={`${x}${z}`} position={[x, 0.12, z]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.13, 0.13, 0.08, 14]} />
            <meshStandardMaterial color={C.ink} />
          </mesh>
        )),
      )}
    </group>
  )
}

/* ---------- Bangunan ---------- */

function Bengkel() {
  const boxes = useRef<THREE.Group>(null!)
  useFrame((_, d) => {
    boxes.current.children.forEach((b, i) => {
      b.position.x += d * (0.4 + live.utilisasi * 1.4)
      if (b.position.x > 5.4) b.position.x -= 5.6
      b.visible = i / 9 < 0.25 + live.utilisasi
    })
  })
  return (
    <group position={[-9.5, 0, 4]}>
      <RoundedBox args={[4.4, 2, 3.4]} radius={0.18} position={[0, 1, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={C.wall} />
      </RoundedBox>
      {/* atap gergaji khas bengkel */}
      {[-1.4, 0, 1.4].map((x) => (
        <mesh key={x} position={[x, 2.35, 0]} rotation={[0, 0, Math.PI / 4]} castShadow>
          <boxGeometry args={[0.9, 0.9, 3.2]} />
          <meshStandardMaterial color={C.nila} />
        </mesh>
      ))}
      {[-1.2, 0, 1.2].map((x) => (
        <mesh key={x} position={[x, 0.75, 1.71]}>
          <boxGeometry args={[0.8, 1.1, 0.02]} />
          <meshStandardMaterial color={C.nilaSoft} />
        </mesh>
      ))}
      {/* ban berjalan menuju gudang */}
      <mesh position={[4.9, 0.45, -1.6]} castShadow receiveShadow>
        <boxGeometry args={[5.8, 0.18, 0.7]} />
        <meshStandardMaterial color={C.ink} />
      </mesh>
      <group ref={boxes} position={[2.2, 0.72, -1.6]}>
        {Array.from({ length: 9 }, (_, i) => (
          <RoundedBox key={i} args={[0.42, 0.36, 0.42]} radius={0.05} position={[i * 0.62, 0, 0]} castShadow>
            <meshStandardMaterial color={C.kunyit} />
          </RoundedBox>
        ))}
      </group>
    </group>
  )
}

function Lab() {
  const proto = useRef<THREE.Mesh>(null!)
  const glow = useRef<THREE.MeshStandardMaterial>(null!)
  useFrame((st, d) => {
    proto.current.rotation.y += d * (0.4 + live.inovasi * 1.6)
    proto.current.rotation.x = Math.sin(st.clock.elapsedTime * 0.8) * 0.3
    const s = 0.45 + live.inovasi * 0.55
    proto.current.scale.setScalar(s)
    proto.current.position.y = 4 + Math.sin(st.clock.elapsedTime * 1.4) * 0.15
    glow.current.emissiveIntensity = 0.15 + live.inovasi * 0.9
  })
  return (
    <group position={[-9.5, 0, -5]}>
      <RoundedBox args={[3.6, 1.6, 3.2]} radius={0.2} position={[0, 0.8, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={C.wall} />
      </RoundedBox>
      <mesh position={[0, 1.6, 0]} castShadow>
        <sphereGeometry args={[1.3, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshPhysicalMaterial color={C.nilaSoft} transmission={0.4} roughness={0.15} thickness={0.5} transparent opacity={0.85} />
      </mesh>
      <mesh ref={proto} position={[0, 4, 0]} castShadow>
        <torusKnotGeometry args={[0.6, 0.2, 120, 16]} />
        <meshStandardMaterial ref={glow} color={C.kunyit} emissive={C.kunyit} roughness={0.35} />
      </mesh>
      <mesh position={[0, 0.02, 2.2]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.5, 0.65, 32]} />
        <meshBasicMaterial color={C.nila} />
      </mesh>
    </group>
  )
}

const PACKETS = 36
function Hub() {
  const ring = useRef<THREE.Group>(null!)
  const packets = useRef<THREE.InstancedMesh>(null!)
  const beacon = useRef<THREE.MeshStandardMaterial>(null!)
  const seeds = useMemo(
    () =>
      Array.from({ length: PACKETS }, (_, i) => ({
        phase: Math.random(),
        ang: (i / PACKETS) * Math.PI * 2 + Math.random() * 0.4,
        dist: 8 + Math.random() * 10,
        h: 5 + Math.random() * 4,
      })),
    [],
  )
  const dummy = useMemo(() => new THREE.Object3D(), [])
  useFrame((st, d) => {
    ring.current.rotation.y += d * (0.2 + live.digital * 0.8)
    ring.current.children.forEach((c, i) => {
      c.visible = i / 6 < 0.3 + live.digital
      c.position.y = Math.sin(st.clock.elapsedTime * 1.2 + i) * 0.15
    })
    beacon.current.emissiveIntensity = 0.4 + Math.sin(st.clock.elapsedTime * 3) * 0.3 + live.digital
    const active = Math.floor(6 + live.digital * (PACKETS - 6))
    seeds.forEach((s, i) => {
      s.phase = (s.phase + d * 0.35) % 1
      const p = s.phase
      if (i >= active) {
        dummy.scale.setScalar(0)
      } else {
        const r = p * s.dist
        dummy.position.set(Math.cos(s.ang) * r, 4.6 + Math.sin(p * Math.PI) * s.h, Math.sin(s.ang) * r)
        dummy.scale.setScalar(0.12 * (1 - p * 0.6))
      }
      dummy.updateMatrix()
      packets.current.setMatrixAt(i, dummy.matrix)
    })
    packets.current.instanceMatrix.needsUpdate = true
  })
  return (
    <group position={[-2, 0, -6.5]}>
      <mesh position={[0, 0.3, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[2, 2.2, 0.6, 40]} />
        <meshStandardMaterial color={C.wall} />
      </mesh>
      <RoundedBox args={[1.6, 3.8, 1.6]} radius={0.2} position={[0, 2.4, 0]} castShadow>
        <meshStandardMaterial color={C.wall} />
      </RoundedBox>
      {[0.9, 1.7, 2.5, 3.3].map((y) => (
        <mesh key={y} position={[0, y + 0.3, 0.81]}>
          <boxGeometry args={[1.2, 0.35, 0.02]} />
          <meshStandardMaterial color={C.laut} emissive={C.laut} emissiveIntensity={0.4} />
        </mesh>
      ))}
      <mesh position={[0, 4.6, 0]}>
        <sphereGeometry args={[0.28, 20, 20]} />
        <meshStandardMaterial ref={beacon} color={C.laut} emissive={C.laut} />
      </mesh>
      <group ref={ring} position={[0, 2.6, 0]}>
        {Array.from({ length: 6 }, (_, i) => {
          const a = (i / 6) * Math.PI * 2
          return (
            <group key={i} position={[Math.cos(a) * 2.3, 0, Math.sin(a) * 2.3]} rotation={[0, -a + Math.PI / 2, 0]}>
              <RoundedBox args={[1, 0.65, 0.06]} radius={0.03}>
                <meshStandardMaterial color="#ffffff" transparent opacity={0.92} />
              </RoundedBox>
              <mesh position={[0, 0.08, 0.04]}>
                <planeGeometry args={[0.8, 0.12]} />
                <meshBasicMaterial color={i % 2 ? C.nila : C.laut} />
              </mesh>
              <mesh position={[-0.15, -0.12, 0.04]}>
                <planeGeometry args={[0.5, 0.08]} />
                <meshBasicMaterial color={C.nilaSoft} />
              </mesh>
            </group>
          )
        })}
      </group>
      <instancedMesh ref={packets} args={[undefined, undefined, PACKETS]}>
        <sphereGeometry args={[1, 10, 10]} />
        <meshBasicMaterial color={C.laut} />
      </instancedMesh>
    </group>
  )
}

function Gudang() {
  const stack = useRef<THREE.Group>(null!)
  const fork = useRef<THREE.Group>(null!)
  useFrame((st) => {
    stack.current.children.forEach((c, i) => (c.visible = i / 12 < 0.1 + live.ekspor))
    const e = st.clock.elapsedTime * (0.5 + live.utilisasi)
    fork.current.position.x = 0.4 + Math.sin(e) * 1.1
  })
  const colors = [C.kunyit, C.nila, C.laut]
  return (
    <group position={[1.5, 0, 3.6]}>
      <RoundedBox args={[4, 1.8, 3]} radius={0.16} position={[0, 0.9, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={C.wall} />
      </RoundedBox>
      <mesh position={[0, 1.95, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[1.5, 1.5, 4, 32, 1, false, 0, Math.PI]} />
        <meshStandardMaterial color={C.nilaSoft} side={THREE.DoubleSide} />
      </mesh>
      {[-1, 0.2].map((x) => (
        <mesh key={x} position={[x, 0.6, 1.51]}>
          <boxGeometry args={[1, 1.1, 0.02]} />
          <meshStandardMaterial color={C.road} />
        </mesh>
      ))}
      {/* forklift kecil mondar-mandir di depan gudang */}
      <group ref={fork} position={[0.4, 0, 2]}>
        <RoundedBox args={[0.5, 0.4, 0.4]} radius={0.06} position={[0, 0.3, 0]} castShadow>
          <meshStandardMaterial color={C.kunyit} />
        </RoundedBox>
        <mesh position={[0.32, 0.35, 0]}>
          <boxGeometry args={[0.05, 0.6, 0.36]} />
          <meshStandardMaterial color={C.ink} />
        </mesh>
        <RoundedBox args={[0.3, 0.25, 0.3]} radius={0.03} position={[0.5, 0.2, 0]} castShadow>
          <meshStandardMaterial color={C.laut} />
        </RoundedBox>
      </group>
      <group ref={stack} position={[2.9, 0, -0.9]}>
        {Array.from({ length: 12 }, (_, i) => (
          <RoundedBox key={i} args={[0.9, 0.5, 0.45]} radius={0.04} position={[0, 0.25 + Math.floor(i / 4) * 0.52, (i % 4) * 0.5]} castShadow>
            <meshStandardMaterial color={colors[i % 3]} />
          </RoundedBox>
        ))}
      </group>
    </group>
  )
}

function Sertifikasi() {
  const badge = useRef<THREE.Group>(null!)
  const arcRef = useRef<THREE.Mesh>(null!)
  const lastArc = useRef(-1)
  useFrame((st) => {
    badge.current.rotation.y = st.clock.elapsedTime * 0.8
    badge.current.position.y = 2.9 + Math.sin(st.clock.elapsedTime * 1.5) * 0.12
    const q = Math.round(live.sertifikasi * 40) / 40
    if (q !== lastArc.current) {
      lastArc.current = q
      arcRef.current.geometry.dispose()
      arcRef.current.geometry = new THREE.TorusGeometry(0.55, 0.11, 10, 48, Math.max(0.05, q * Math.PI * 2))
    }
  })
  return (
    <group position={[2.4, 0, -0.2]}>
      {/* kantor bertiang, seperti lembaga sertifikasi */}
      <RoundedBox args={[2.4, 0.25, 1.8]} radius={0.06} position={[0, 0.12, 0]} receiveShadow castShadow>
        <meshStandardMaterial color={C.road} />
      </RoundedBox>
      <RoundedBox args={[2, 1.2, 1.3]} radius={0.12} position={[0, 0.85, -0.1]} castShadow receiveShadow>
        <meshStandardMaterial color={C.wall} />
      </RoundedBox>
      {[-0.75, -0.25, 0.25, 0.75].map((x) => (
        <mesh key={x} position={[x, 0.85, 0.68]} castShadow>
          <cylinderGeometry args={[0.07, 0.07, 1.2, 12]} />
          <meshStandardMaterial color="#ffffff" />
        </mesh>
      ))}
      <mesh position={[0, 1.75, 0.05]} rotation={[0, Math.PI / 4, 0]} castShadow>
        <coneGeometry args={[1.55, 0.6, 4]} />
        <meshStandardMaterial color={C.daun} />
      </mesh>
      <group ref={badge} position={[0, 2.9, 0]}>
        <mesh>
          <torusGeometry args={[0.55, 0.05, 8, 48]} />
          <meshStandardMaterial color={C.road} />
        </mesh>
        <mesh ref={arcRef} rotation={[0, 0, Math.PI / 2]}>
          <torusGeometry args={[0.55, 0.11, 10, 48, 1]} />
          <meshStandardMaterial color={C.daun} emissive={C.daun} emissiveIntensity={0.3} />
        </mesh>
        <mesh>
          <circleGeometry args={[0.4, 32]} />
          <meshStandardMaterial color="#ffffff" side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 0, 0.01]}>
          <ringGeometry args={[0.16, 0.24, 32]} />
          <meshBasicMaterial color={C.daun} side={THREE.DoubleSide} />
        </mesh>
      </group>
    </group>
  )
}

function Ship({ index }: { index: number }) {
  const ref = useRef<THREE.Group>(null!)
  const ph = useRef(index / 3)
  const from = new THREE.Vector3(12.5, 0, 0.8)
  const to = new THREE.Vector3(26, 0, -12)
  useFrame((st, d) => {
    ref.current.visible = index / 3 < 0.2 + live.ekspor
    ph.current = (ph.current + d * 0.035) % 1
    const p = ph.current
    ref.current.position.lerpVectors(from, to, p)
    ref.current.position.y = -0.15 + Math.sin(st.clock.elapsedTime * 1.6 + index) * 0.06
    ref.current.rotation.z = Math.sin(st.clock.elapsedTime * 1.2 + index) * 0.03
    const fade = p < 0.06 ? p / 0.06 : p > 0.9 ? (1 - p) / 0.1 : 1
    ref.current.scale.setScalar(Math.max(0.001, fade))
  })
  const dir = Math.atan2(26 - 12.5, -12 - 0.8)
  return (
    <group ref={ref}>
      <group rotation={[0, dir, 0]}>
        <RoundedBox args={[1.3, 0.6, 3.6]} radius={0.2} position={[0, 0.2, 0]} castShadow>
          <meshStandardMaterial color={C.nila} />
        </RoundedBox>
        <RoundedBox args={[1.1, 0.7, 0.7]} radius={0.08} position={[0, 0.8, -1.25]} castShadow>
          <meshStandardMaterial color={C.wall} />
        </RoundedBox>
        {[0, 1, 2, 3].map((i) => (
          <RoundedBox key={i} args={[0.5, 0.35, 0.55]} radius={0.03} position={[i % 2 ? 0.27 : -0.27, 0.68, -0.3 + Math.floor(i / 2) * 0.6]} castShadow>
            <meshStandardMaterial color={[C.kunyit, C.laut, C.wall, C.kunyit][i]} />
          </RoundedBox>
        ))}
      </group>
    </group>
  )
}

function Pelabuhan() {
  const arm = useRef<THREE.Group>(null!)
  const hook = useRef<THREE.Mesh>(null!)
  useFrame((st) => {
    const e = st.clock.elapsedTime * (0.4 + live.ekspor * 0.8)
    arm.current.rotation.y = Math.sin(e) * 0.9
    hook.current.position.y = -0.6 - (Math.sin(e * 2) * 0.5 + 0.5) * 1.2
  })
  return (
    <group>
      <mesh position={[9.5, -0.05, 0.5]} receiveShadow castShadow>
        <boxGeometry args={[5, 0.5, 3]} />
        <meshStandardMaterial color={C.wall} />
      </mesh>
      {[8, 9.5, 11].map((x) => (
        <mesh key={x} position={[x, 0.22, 1.95]}>
          <cylinderGeometry args={[0.12, 0.12, 0.2, 12]} />
          <meshStandardMaterial color={C.ink} />
        </mesh>
      ))}
      <group position={[9, 0, -0.3]}>
        <mesh position={[0, 1.8, 0]} castShadow>
          <boxGeometry args={[0.35, 3.6, 0.35]} />
          <meshStandardMaterial color={C.kunyit} />
        </mesh>
        <group ref={arm} position={[0, 3.6, 0]}>
          <mesh position={[1.2, 0, 0]} castShadow>
            <boxGeometry args={[3.4, 0.28, 0.3]} />
            <meshStandardMaterial color={C.kunyit} />
          </mesh>
          <mesh position={[2.6, -0.3, 0]}>
            <cylinderGeometry args={[0.02, 0.02, 0.8, 6]} />
            <meshStandardMaterial color={C.ink} />
          </mesh>
          <mesh ref={hook} position={[2.6, -0.8, 0]} castShadow>
            <boxGeometry args={[0.5, 0.3, 0.6]} />
            <meshStandardMaterial color={C.laut} />
          </mesh>
        </group>
      </group>
    </group>
  )
}

function Water() {
  const ref = useRef<THREE.Mesh>(null!)
  const geo = useMemo(() => new THREE.PlaneGeometry(90, 90, 60, 60), [])
  const base = useMemo(() => Float32Array.from(geo.attributes.position.array as Float32Array), [geo])
  useFrame((st) => {
    const pos = geo.attributes.position as THREE.BufferAttribute
    const t = st.clock.elapsedTime
    for (let i = 0; i < pos.count; i++) {
      const x = base[i * 3]
      const y = base[i * 3 + 1]
      pos.setZ(i, Math.sin(x * 0.5 + t) * 0.08 + Math.cos(y * 0.6 + t * 0.8) * 0.08)
    }
    pos.needsUpdate = true
    geo.computeVertexNormals()
  })
  return (
    <mesh ref={ref} geometry={geo} rotation={[-Math.PI / 2, 0, 0]} position={[40, -0.45, -6]} receiveShadow>
      <meshStandardMaterial color={C.lautSoft} roughness={0.25} metalness={0.05} flatShading />
    </mesh>
  )
}

function Trees() {
  const spots = useMemo(() => {
    const pts: [number, number, number][] = []
    let s = 7
    const r = () => ((s = (s * 16807) % 2147483647) / 2147483647)
    const blocked = (x: number, z: number) =>
      (x > -12.2 && x < -6.6 && z > 1.6 && z < 6.4) ||
      (x > -12 && x < -7 && z > -7.4 && z < -2.6) ||
      (x > -4.6 && x < 0.6 && z > -9.2 && z < -3.8) ||
      (x > -1 && x < 5.4 && z > 1.6 && z < 6.2) ||
      (x > 0.6 && x < 4.2 && z > -1.6 && z < 1.3) ||
      (x > -8 && x < 0 && z > 1.2 && z < 3)
    while (pts.length < 26) {
      const x = -13.5 + r() * 19.5
      const z = -9.5 + r() * 19
      if (blocked(x, z)) continue
      let near = false
      for (const p of roadCurve.getSpacedPoints(80)) if (Math.hypot(p.x - x, p.z - z) < 1.3) near = true
      if (!near) pts.push([x, 0, z])
    }
    return pts
  }, [])
  return (
    <group>
      {spots.map((p, i) => (
        <group key={i} position={p} scale={0.7 + (i % 4) * 0.12}>
          <mesh position={[0, 0.3, 0]} castShadow>
            <cylinderGeometry args={[0.08, 0.1, 0.6, 8]} />
            <meshStandardMaterial color="#B9A58C" />
          </mesh>
          <mesh position={[0, 0.95, 0]} castShadow>
            {i % 3 === 0 ? <sphereGeometry args={[0.5, 16, 12]} /> : <coneGeometry args={[0.45, 1.2, 12]} />}
            <meshStandardMaterial color={i % 2 ? C.daun : '#97D486'} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

function Clouds() {
  const ref = useRef<THREE.Group>(null!)
  useFrame((_, d) => {
    ref.current.children.forEach((c, i) => {
      c.position.x += d * (0.25 + i * 0.05)
      if (c.position.x > 22) c.position.x = -22
    })
  })
  return (
    <group ref={ref}>
      {[
        [-14, 8, -10],
        [2, 9, -14],
        [12, 7.5, 6],
      ].map((p, i) => (
        <group key={i} position={p as [number, number, number]}>
          {[0, 0.8, -0.7, 0.3].map((o, j) => (
            <mesh key={j} position={[o, j === 3 ? 0.4 : 0, j * 0.2]}>
              <sphereGeometry args={[0.7 - j * 0.08, 16, 12]} />
              <meshStandardMaterial color="#ffffff" transparent opacity={0.9} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

export const SPOTS: { id: SpotId; label: string; pos: [number, number, number] }[] = [
  { id: 'bengkel', label: 'Bengkel produksi', pos: [-9.5, 3.5, 4] },
  { id: 'lab', label: 'Lab inovasi', pos: [-9.5, 5.4, -5] },
  { id: 'hub', label: 'Hub platform digital', pos: [-2, 5.6, -6.5] },
  { id: 'gudang', label: 'Gudang', pos: [1.5, 3.7, 3.6] },
  { id: 'sertifikasi', label: 'Kantor sertifikasi', pos: [2.4, 4.7, -0.2] },
  { id: 'pelabuhan', label: 'Pelabuhan ekspor', pos: [9.4, 4.6, -0.3] },
]

function Hotspots() {
  const spot = useApp((s) => s.spot)
  const setSpot = useApp((s) => s.setSpot)
  const page = useApp((s) => s.page)
  const hidden = page === 'optimasi' || page === 'struktur'
  return (
    <>
      {SPOTS.map((s) => (
        <Html key={s.id} position={s.pos} center zIndexRange={[20, 10]}>
          <button className={`spot ${spot === s.id ? 'on' : ''} ${hidden ? 'hide' : ''}`} tabIndex={hidden ? -1 : 0} onClick={() => setSpot(spot === s.id ? null : s.id)}>
            <span className="spot-dot" />
            {s.label}
          </button>
        </Html>
      ))}
    </>
  )
}

export function World() {
  const page = useApp((s) => s.page)
  const covered = page === 'optimasi' || page === 'struktur'
  return (
    <Canvas shadows dpr={[1, 2]} className="world" frameloop={covered ? 'demand' : 'always'}>
      <color attach="background" args={['#E4E8F4']} />
      <OrthographicCamera makeDefault position={[26, 24, 26]} zoom={28} near={-100} far={200} />
      <OrbitControls
        target={[0, 0, -1]}
        enablePan={false}
        minZoom={16}
        maxZoom={60}
        minPolarAngle={0.5}
        maxPolarAngle={1.15}
      />
      <hemisphereLight args={['#ffffff', '#C9CFEA', 1.1]} />
      <directionalLight
        position={[12, 22, 10]}
        intensity={1.6}
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-camera-left={-26}
        shadow-camera-right={26}
        shadow-camera-top={26}
        shadow-camera-bottom={-26}
        shadow-bias={-0.0004}
      />
      <Clock />
      <CameraRig />
      <RoundedBox args={[25, 1, 22]} radius={0.5} position={[-3.5, -0.5, -0.5]} receiveShadow>
        <meshStandardMaterial color={C.ground} />
      </RoundedBox>
      <Water />
      <Road />
      {[0, 0.17, 0.34, 0.5, 0.67, 0.84].map((o, i) => (
        <Truck key={i} offset={o} color={[C.kunyit, C.wall, C.laut][i % 3]} />
      ))}
      <Bengkel />
      <Lab />
      <Hub />
      <Gudang />
      <Sertifikasi />
      <Pelabuhan />
      {[0, 1, 2].map((i) => (
        <Ship key={i} index={i} />
      ))}
      <Trees />
      <Clouds />
      <Hotspots />
    </Canvas>
  )
}
