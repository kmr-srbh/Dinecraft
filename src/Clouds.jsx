import { useRef, useMemo } from 'react';
import { useGameStore } from './useGameState';
import { useGameLoop } from '@carverjs/core/hooks';

/**
 * Blocky voxel clouds floating in the sky.
 */

const CLOUD_COLORS = ['#f0f0f0', '#e8e8e8', '#ffffff', '#dcdcdc'];

function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function CloudBlock({ cloud }) {
  const blocks = useMemo(() => {
    const rng = mulberry32(cloud.seed || cloud.id);
    const result = [];
    const width = 2 + Math.floor(rng() * 3);
    const depth = 1 + Math.floor(rng() * 2);

    for (let x = 0; x < width; x++) {
      for (let z = 0; z < depth; z++) {
        if (rng() > 0.25) {
          const color = CLOUD_COLORS[Math.floor(rng() * CLOUD_COLORS.length)];
          result.push({
            pos: [x * 0.6, 0, z * 0.6],
            size: [0.6, 0.3 + rng() * 0.2, 0.6],
            color,
          });
        }
        if (rng() > 0.5) {
          result.push({
            pos: [x * 0.6, 0.3, z * 0.6],
            size: [0.5, 0.25, 0.5],
            color: '#ffffff',
          });
        }
      }
    }
    return result;
  }, [cloud.seed, cloud.id]);

  return (
    <group position={[cloud.x, cloud.y, cloud.z]}>
      {blocks.map((b, i) => (
        <mesh key={i} position={b.pos}>
          <boxGeometry args={b.size} />
          <meshStandardMaterial
            color={b.color}
            roughness={1}
            transparent
            opacity={0.9}
            fog={false}
          />
        </mesh>
      ))}
    </group>
  );
}

export default function Clouds() {
  const spawnTimerRef = useRef(0);
  const seedRef = useRef(42);

  useGameLoop((delta) => {
    const state = useGameStore.getState();
    if (state.status !== 'playing') return;

    state.updateClouds(delta);

    spawnTimerRef.current += delta;
    if (spawnTimerRef.current > 3.5) {
      spawnTimerRef.current = 0;
      seedRef.current += 1;
      state.addCloud({
        z: -55,
        x: (Math.random() - 0.5) * 8,
        y: 5 + Math.random() * 6,
        speed: 1 + Math.random() * 1.5,
        seed: seedRef.current,
      });
    }
  });

  const clouds = useGameStore((s) => s.clouds);

  return (
    <>
      {clouds.map((c) => (
        <CloudBlock key={c.id} cloud={c} />
      ))}
      <StaticClouds />
    </>
  );
}

function StaticClouds() {
  const configs = useMemo(
    () => [
      { x: -6, y: 7, z: -20, seed: 100 },
      { x: 4, y: 9, z: -30, seed: 200 },
      { x: -2, y: 11, z: -40, seed: 300 },
      { x: 7, y: 6, z: -15, seed: 400 },
    ],
    []
  );

  return (
    <>
      {configs.map((c, i) => (
        <CloudBlock key={`static-${i}`} cloud={{ ...c, id: 9000 + i }} />
      ))}
    </>
  );
}
