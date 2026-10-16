// Sir Fish: Tower of the Abyss — street view logic: spinning rings, a floating crystal, rising bubbles.
export default function build(b) {
  const bubbles = [
    { name: 'bubbles1', x: -2.6, z: 2.8, phase: 0 },
    { name: 'bubbles2', x: 2.9, z: -2.6, phase: 3.3 },
    { name: 'bubbles3', x: 0.0, z: -4.6, phase: 6.6 },
  ]
  const BOTTOM = 1.0, TOP = 10.9
  let pulse = 0

  b.loop((dt, t) => {
    b.node('ring1', { rotation: [0.10 * Math.sin(t * 0.4), t * 0.35, 0.06] })
    b.node('ring2', { rotation: [-0.08, -t * 0.5, 0.10 * Math.sin(t * 0.5)] })
    b.node('ring3', { rotation: [0.12 * Math.sin(t * 0.6), t * 0.8, 0] })
    b.node('crystal', { position: [0, 11.13 + 0.15 * Math.sin(t * 1.2), 0], rotation: [0, t * 0.9, 0] })
    for (const bub of bubbles) {
      const y = BOTTOM + ((t * 0.6 + bub.phase) % (TOP - BOTTOM))
      const s = Math.max(0, Math.min(1, (y - BOTTOM) / 0.8, (TOP - y) / 0.8))
      b.node(bub.name, { position: [bub.x, y, bub.z], scale: [s, s, s] })
    }
    pulse = Math.max(0, pulse - dt * 0.8)
    b.uniform('pulse', pulse)
  })

  b.on('tap', () => { pulse = 1 })
  b.on('enter', () => { pulse = Math.max(pulse, 0.6) })
}
