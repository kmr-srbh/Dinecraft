import { useRef, useMemo } from 'react';
import { useGameStore } from './useGameState';
import { Actor } from '@carverjs/core/components';
import { useCollision, useGameLoop } from '@carverjs/core/hooks';

/**
 * Obstacle spawner and renderer.
 * Detailed voxel cacti with spines, segments, and branches.
 * Cactus height is capped based on dino's max jump height.
 * Pterodactyls appear at higher speeds.
 */

const PTERO_COLOR = '#A08153';
const PTERO_WING = '#B88F5A';
const SPAWN_DISTANCE = -50;
const MIN_SPAWN_INTERVAL = 0.9;

// Stone colors
const STONE_COLORS = ['#808080', '#949494', '#757575', '#A3A3A3'];

function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Detailed Voxel Cactus ─────────────────────

const CACTUS_GREENS = ['#3e9a2b', '#4fa93c', '#318821'];
const CACTUS_DARK = '#266b19';
const CACTUS_LIGHT = '#5fb947';
const CACTUS_SPINE = '#D8D8A0';
const CACTUS_FLOWER = '#ff6688';

function DetailedCactus({ obstacle }) {
  const { height = 1, variant = 0, seed = 0 } = obstacle;
  const mainColor = CACTUS_GREENS[variant % CACTUS_GREENS.length];
  const ref = useRef();

  const colliderConfig = useMemo(() => ({
    shape: 'aabb',
    halfExtents: [0.25, height * 0.5, 0.25],
    offset: [0, height * 0.5, 0],
  }), [height]);

  useCollision({
    ref,
    name: `obstacle-${obstacle.id}-${(obstacle.x || 0).toFixed(2)}`,
    collider: colliderConfig,
    enabled: true,
  });

  const segments = useMemo(() => {
    const rng = mulberry32(seed || variant * 1000 + height * 100);
    const result = [];
    const segCount = Math.max(2, Math.ceil(height / 0.25));
    const segH = height / segCount;

    // Main trunk segments
    for (let i = 0; i < segCount; i++) {
      const y = i * segH + segH / 2;
      const isTop = i === segCount - 1;
      const isBottom = i === 0;
      
      // Core trunk block
      result.push({
        type: 'trunk',
        pos: [0, y, 0],
        size: [0.28, segH + 0.01, 0.28],
        color: isBottom ? CACTUS_DARK : mainColor,
      });

      // Lighter ridge on front/sides (detail)
      if (!isBottom && !isTop) {
        // Vertical ridges (the lines on a real cactus)
        for (const dz of [-0.12, 0, 0.12]) {
          result.push({
            type: 'ridge',
            pos: [0.145, y, dz],
            size: [0.02, segH, 0.05],
            color: CACTUS_LIGHT,
          });
          result.push({
            type: 'ridge',
            pos: [-0.145, y, dz],
            size: [0.02, segH, 0.05],
            color: CACTUS_LIGHT,
          });
        }
      }

      // Spines (small protruding blocks at intervals)
      if (i > 0 && i % 2 === 0) {
        const spinePositions = [
          [0.17, y, 0.08],
          [0.17, y, -0.08],
          [-0.17, y, 0.06],
          [-0.17, y, -0.06],
          [0.06, y, 0.17],
          [-0.06, y, 0.17],
        ];
        for (const sp of spinePositions) {
          if (rng() > 0.4) {
            result.push({
              type: 'spine',
              pos: sp,
              size: [0.03, 0.06, 0.03],
              color: CACTUS_SPINE,
            });
          }
        }
      }

      // Top cap
      if (isTop) {
        // Slightly wider cap piece
        result.push({
          type: 'cap',
          pos: [0, y + segH / 2 + 0.03, 0],
          size: [0.22, 0.06, 0.22],
          color: CACTUS_DARK,
        });
        // Optional flower on top (rare)
        if (rng() > 0.65) {
          result.push({
            type: 'flower',
            pos: [0, y + segH / 2 + 0.1, 0],
            size: [0.12, 0.08, 0.12],
            color: rng() > 0.5 ? CACTUS_FLOWER : '#ffaa44',
          });
        }
      }
    }

    // ─── Side branches (arms) ───
    // Right arm (if height allows)
    if (height >= 0.8) {
      const armY = height * (0.4 + rng() * 0.2);
      const armLen = 2 + Math.floor(rng() * 2);
      // Horizontal segment
      for (let j = 0; j < armLen; j++) {
        result.push({
          type: 'branch',
          pos: [0, armY, 0.18 + j * 0.15],
          size: [0.2, 0.2, 0.15],
          color: j === 0 ? CACTUS_DARK : mainColor,
        });
      }
      // Upward segment on arm
      const armEndZ = 0.18 + (armLen - 1) * 0.15;
      const armUpCount = 1 + Math.floor(rng() * 2);
      for (let j = 0; j < armUpCount; j++) {
        result.push({
          type: 'branch',
          pos: [0, armY + (j + 1) * 0.18, armEndZ],
          size: [0.18, 0.18, 0.18],
          color: mainColor,
        });
      }
      // Arm spine
      result.push({
        type: 'spine',
        pos: [0, armY + armUpCount * 0.18 + 0.12, armEndZ],
        size: [0.03, 0.05, 0.03],
        color: CACTUS_SPINE,
      });
    }

    // Left arm (taller cacti)
    if (height >= 1.1) {
      const armY = height * (0.25 + rng() * 0.15);
      const armLen = 1 + Math.floor(rng() * 2);
      for (let j = 0; j < armLen; j++) {
        result.push({
          type: 'branch',
          pos: [0, armY, -(0.18 + j * 0.15)],
          size: [0.2, 0.2, 0.15],
          color: j === 0 ? CACTUS_DARK : mainColor,
        });
      }
      const armEndZ = -(0.18 + (armLen - 1) * 0.15);
      const armUpCount = 1 + Math.floor(rng() * 2);
      for (let j = 0; j < armUpCount; j++) {
        result.push({
          type: 'branch',
          pos: [0, armY + (j + 1) * 0.18, armEndZ],
          size: [0.18, 0.18, 0.18],
          color: mainColor,
        });
      }
    }

    return result;
  }, [height, variant, seed, mainColor]);

  return (
    <Actor
      ref={ref}
      type="primitive"
      name={`obstacle-${obstacle.id}-${(obstacle.x || 0).toFixed(2)}`}
      position={[obstacle.x || 0, 0, obstacle.z]}
      geometryArgs={[0.01, 0.01, 0.01]}
      materialProps={{ transparent: true, opacity: 0 }}
    >
      {segments.map((seg, i) => (
        <mesh key={i} position={seg.pos} castShadow={seg.type !== 'spine'}>
          <boxGeometry args={seg.size} />
          <meshStandardMaterial
            color={seg.color}
            roughness={seg.type === 'spine' ? 0.6 : 0.9}
          />
        </mesh>
      ))}
    </Actor>
  );
}

// ─── Pterodactyl (unchanged, already detailed) ──
function PterodactylObstacle({ obstacle }) {
  const wingTimeRef = useRef(0);
  const leftWingRef = useRef();
  const rightWingRef = useRef();
  const ref = useRef();

  const colliderConfig = useMemo(() => ({
    shape: 'aabb',
    halfExtents: [0.45, 0.2, 0.35],
    offset: [0, 0, 0],
  }), []);

  useCollision({
    ref,
    name: `obstacle-${obstacle.id}-${(obstacle.x || 0).toFixed(2)}`,
    collider: colliderConfig,
    enabled: true,
  });

  useGameLoop((delta) => {
    wingTimeRef.current += delta * 8;
    const flap = Math.sin(wingTimeRef.current) * 0.4;
    if (leftWingRef.current) leftWingRef.current.rotation.z = flap;
    if (rightWingRef.current) rightWingRef.current.rotation.z = -flap;
  });

  return (
    <Actor
      ref={ref}
      type="primitive"
      name={`obstacle-${obstacle.id}-${(obstacle.x || 0).toFixed(2)}`}
      position={[obstacle.x || 0, obstacle.y || 1.2, obstacle.z]}
      geometryArgs={[0.01, 0.01, 0.01]}
      materialProps={{ transparent: true, opacity: 0 }}
    >
      <mesh castShadow>
        <boxGeometry args={[0.3, 0.25, 0.5]} />
        <meshStandardMaterial color={PTERO_COLOR} roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.05, -0.3]} castShadow>
        <boxGeometry args={[0.22, 0.22, 0.25]} />
        <meshStandardMaterial color={PTERO_COLOR} roughness={0.8} />
      </mesh>
      <mesh position={[0, -0.02, -0.5]}>
        <boxGeometry args={[0.1, 0.08, 0.2]} />
        <meshStandardMaterial color='#DFB460' roughness={0.7} />
      </mesh>
      <mesh position={[0.12, 0.1, -0.32]}>
        <boxGeometry args={[0.05, 0.06, 0.06]} />
        <meshStandardMaterial color='#ffffff' />
      </mesh>
      <group ref={leftWingRef} position={[0.2, 0.08, 0]}>
        <mesh position={[0.3, 0, 0]} castShadow>
          <boxGeometry args={[0.5, 0.06, 0.45]} />
          <meshStandardMaterial color={PTERO_WING} roughness={0.8} />
        </mesh>
      </group>
      <group ref={rightWingRef} position={[-0.2, 0.08, 0]}>
        <mesh position={[-0.3, 0, 0]} castShadow>
          <boxGeometry args={[0.5, 0.06, 0.45]} />
          <meshStandardMaterial color={PTERO_WING} roughness={0.8} />
        </mesh>
      </group>
    </Actor>
  );
}

// ─── Cactus Cluster (2-3 detailed cacti) ────────
function CactusCluster({ obstacle }) {
  return (
    <group>
      <DetailedCactus
        obstacle={{ ...obstacle, x: (obstacle.x || 0) - 0.3, height: obstacle.height, seed: (obstacle.id || 0) * 3 }}
      />
      <DetailedCactus
        obstacle={{
          ...obstacle,
          x: (obstacle.x || 0) + 0.3,
          height: (obstacle.height || 1) * 0.7,
          variant: 1,
          seed: (obstacle.id || 0) * 3 + 1,
        }}
      />
      {obstacle.triple && (
        <DetailedCactus
          obstacle={{
            ...obstacle,
            x: (obstacle.x || 0) + 0.65,
            height: (obstacle.height || 1) * 0.5,
            variant: 2,
            seed: (obstacle.id || 0) * 3 + 2,
          }}
        />
      )}
    </group>
  );
}

// ─── Stone / Boulder Obstacle ─────────────────────
function StoneObstacle({ obstacle }) {
  const { height = 0.6, seed = 0 } = obstacle;
  const ref = useRef();

  const colliderConfig = useMemo(() => ({
    shape: 'aabb',
    halfExtents: [0.25, height * 0.5, 0.25],
    offset: [0, height * 0.5, 0],
  }), [height]);

  useCollision({
    ref,
    name: `obstacle-${obstacle.id}-${(obstacle.x || 0).toFixed(2)}`,
    collider: colliderConfig,
    enabled: true,
  });

  const blocks = useMemo(() => {
    const rng = mulberry32(seed || 42);
    const result = [];
    const w = 0.3 + rng() * 0.2;

    const layers = Math.max(2, Math.ceil(height / 0.25));
    for (let i = 0; i < layers; i++) {
      const layerY = i * (height / layers) + (height / layers) / 2;
      const shrink = 1 - (i / layers) * 0.3;
      const lw = w * shrink;
      const ld = (w * 0.8) * shrink;
      const offsetX = (rng() - 0.5) * 0.06;
      const offsetZ = (rng() - 0.5) * 0.06;
      result.push({
        pos: [offsetX, layerY, offsetZ],
        size: [lw, height / layers * 0.95, ld],
        color: STONE_COLORS[Math.floor(rng() * STONE_COLORS.length)],
      });
    }

    for (let i = 0; i < 3; i++) {
      result.push({
        pos: [
          (rng() - 0.5) * w * 0.6,
          rng() * height * 0.7 + 0.05,
          (rng() - 0.5) * w * 0.5,
        ],
        size: [w * 0.25, height * 0.2, w * 0.2],
        color: rng() > 0.5 ? '#727272' : '#8C8C8C',
      });
    }

    return result;
  }, [height, seed]);

  return (
    <Actor
      ref={ref}
      type="primitive"
      name={`obstacle-${obstacle.id}-${(obstacle.x || 0).toFixed(2)}`}
      position={[obstacle.x || 0, 0, obstacle.z || 0]}
      geometryArgs={[0.01, 0.01, 0.01]}
      materialProps={{ transparent: true, opacity: 0 }}
    >
      {blocks.map((b, i) => (
        <mesh key={i} position={b.pos} castShadow>
          <boxGeometry args={b.size} />
          <meshStandardMaterial color={b.color} roughness={1} />
        </mesh>
      ))}
    </Actor>
  );
}

// ─── Obstacle Spawner ───────────────────────────
export default function Obstacles() {
  const spawnTimerRef = useRef(0);
  const rngRef = useRef(mulberry32(Date.now()));

  useGameLoop((delta) => {
    const state = useGameStore.getState();
    if (state.status !== 'playing') return;

    state.updateObstacles(delta);

    spawnTimerRef.current += delta;
    const spawnInterval = Math.max(MIN_SPAWN_INTERVAL, 3.5 - state.speed * 0.12);

    if (spawnTimerRef.current >= spawnInterval) {
      spawnTimerRef.current = 0;
      const rng = rngRef.current;
      const roll = rng();

      // Calculate max jumpable cactus height from physics
      const maxH = state.getMaxJumpableCactusHeight();

      if (roll < 0.12 && state.speed > 12) {
        // Pterodactyl (at higher speeds)
        const flyHeights = [0.6, 1.2, 1.8];
        state.addObstacle({
          type: 'pterodactyl',
          z: SPAWN_DISTANCE,
          x: (rng() - 0.5) * 0.5,
          y: flyHeights[Math.floor(rng() * flyHeights.length)],
        });
      } else if (roll < 0.35) {
        // Cactus cluster
        const mainH = Math.min(0.5 + rng() * 0.8, maxH);
        state.addObstacle({
          type: 'cactus-cluster',
          z: SPAWN_DISTANCE,
          x: (rng() - 0.5) * 0.5,
          height: mainH,
          variant: Math.floor(rng() * 3),
          triple: rng() > 0.6,
        });
      } else if (roll < 0.60) {
        // Stone / boulder obstacle
        const h = Math.min(0.4 + rng() * 0.6, maxH);
        state.addObstacle({
          type: 'stone',
          z: SPAWN_DISTANCE,
          x: (rng() - 0.5) * 0.5,
          height: h,
          seed: Math.floor(rng() * 99999),
        });
      } else {
        // Single cactus
        const h = Math.min(0.4 + rng() * 0.8, maxH);
        state.addObstacle({
          type: 'cactus',
          z: SPAWN_DISTANCE,
          x: (rng() - 0.5) * 0.5,
          height: h,
          variant: Math.floor(rng() * 3),
        });
      }
    }
  });

  const obstacles = useGameStore((s) => s.obstacles);

  return (
    <>
      {obstacles.map((obs) => {
        switch (obs.type) {
          case 'pterodactyl': return <PterodactylObstacle key={obs.id} obstacle={obs} />;
          case 'cactus-cluster': return <CactusCluster key={obs.id} obstacle={obs} />;
          case 'stone': return <StoneObstacle key={obs.id} obstacle={obs} />;
          default: return <DetailedCactus key={obs.id} obstacle={obs} />;
        }
      })}
    </>
  );
}
