import { useRef, useMemo } from 'react';
import { useGameStore } from './useGameState';
import { useGameLoop } from '@carverjs/core/hooks';

/**
 * Scrolling voxel terrain.
 * EVERYTHING scrolls with the ground segments: trees, flowers, rocks,
 * lakes, animals, hills, waterfalls. Nothing is static.
 * Includes varied tree types: oak, pine, cherry blossom.
 */

const GROUND_LENGTH = 80;
const GROUND_SEGMENTS = 4;
const SEGMENT_LENGTH = GROUND_LENGTH / GROUND_SEGMENTS;

const GRASS_TOP = '#72a443';
const DIRT = '#A58557';
const STONE = '#8F8F8F';
const PATH_COLOR = '#D2B982';

function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ─── Oak Tree ───────────────────────────────────
function OakTree({ position, seed }) {
  const rng = useMemo(() => mulberry32(seed), [seed]);
  const h = useMemo(() => 2 + Math.floor(rng() * 3), [rng]);
  const lSize = useMemo(() => 1.0 + rng() * 0.8, [rng]);
  const trunk = useMemo(() => rng() > 0.5 ? '#7C5432' : '#8A5C3D', [rng]);
  const leaf = useMemo(() => {
    const r = rng();
    return r < 0.33 ? '#3d933d' : r < 0.66 ? '#4fa63a' : '#2d822d';
  }, [rng]);

  return (
    <group position={position}>
      {Array.from({ length: h }, (_, i) => (
        <mesh key={i} position={[0, i * 0.4 + 0.2, 0]} castShadow>
          <boxGeometry args={[0.3, 0.4, 0.3]} />
          <meshStandardMaterial color={trunk} roughness={1} />
        </mesh>
      ))}
      {[0, 0.45, 0.9].map((ly, li) => (
        <group key={li} position={[0, h * 0.4 + ly, 0]}>
          <mesh castShadow>
            <boxGeometry args={[lSize * (li === 2 ? 0.6 : 1), 0.4, lSize * (li === 2 ? 0.6 : 1)]} />
            <meshStandardMaterial color={leaf} roughness={1} />
          </mesh>
          {li < 2 && [[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([dx, dz], ci) => (
            <mesh key={ci} position={[dx * lSize * 0.3, 0, dz * lSize * 0.3]} castShadow>
              <boxGeometry args={[lSize * 0.45, 0.35, lSize * 0.45]} />
              <meshStandardMaterial color={leaf} roughness={1} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

// ─── Pine Tree ──────────────────────────────────
function PineTree({ position, seed }) {
  const rng = useMemo(() => mulberry32(seed), [seed]);
  const h = useMemo(() => 3 + Math.floor(rng() * 3), [rng]);
  const trunk = '#623F20';
  const pine = useMemo(() => rng() > 0.5 ? '#2d7d42' : '#1e6831', [rng]);

  return (
    <group position={position}>
      {/* Trunk */}
      {Array.from({ length: h }, (_, i) => (
        <mesh key={i} position={[0, i * 0.35 + 0.18, 0]} castShadow>
          <boxGeometry args={[0.22, 0.35, 0.22]} />
          <meshStandardMaterial color={trunk} roughness={1} />
        </mesh>
      ))}
      {/* Conical leaf layers (wide at bottom, narrow at top) */}
      {Array.from({ length: 4 }, (_, i) => {
        const layerY = h * 0.35 + i * 0.5;
        const layerW = 1.4 - i * 0.3;
        return (
          <mesh key={`l${i}`} position={[0, layerY, 0]} castShadow>
            <boxGeometry args={[layerW, 0.45, layerW]} />
            <meshStandardMaterial color={i % 2 === 0 ? pine : '#247239'} roughness={1} />
          </mesh>
        );
      })}
      {/* Tip */}
      <mesh position={[0, h * 0.35 + 2.2, 0]} castShadow>
        <boxGeometry args={[0.25, 0.4, 0.25]} />
        <meshStandardMaterial color={pine} roughness={1} />
      </mesh>
    </group>
  );
}

// ─── Cherry Blossom Tree ────────────────────────
function CherryTree({ position, seed }) {
  const config = useMemo(() => {
    const rng = mulberry32(seed);
    const h = 2 + Math.floor(rng() * 2);
    const trunk = '#854F3B';
    const blossomColors = ['#ffb7c5', '#ff91a4', '#ff69b4', '#ffc0cb'];

    // Generate blossom canopy configuration
    const blossoms = [0, 0.4, 0.8].map((ly, li) => {
      const bColor = blossomColors[Math.floor(rng() * blossomColors.length)];
      const sz = li === 1 ? 1.3 : 0.9;
      return { ly, bColor, sz };
    });

    // Generate scattered petals
    const petals = Array.from({ length: 3 }, (_, i) => {
      const px = (rng() - 0.5) * 1.5;
      const pz = (rng() - 0.5) * 1.5;
      const py = h * 0.4 + rng() * 0.6;
      const color = blossomColors[i % blossomColors.length];
      return { px, py, pz, color };
    });

    return { h, trunk, blossoms, petals };
  }, [seed]);

  const { h, trunk, blossoms, petals } = config;

  return (
    <group position={position}>
      {/* Dark trunk */}
      {Array.from({ length: h }, (_, i) => (
        <mesh key={i} position={[0, i * 0.4 + 0.2, 0]} castShadow>
          <boxGeometry args={[0.25, 0.4, 0.25]} />
          <meshStandardMaterial color={trunk} roughness={1} />
        </mesh>
      ))}
      {/* Branch extending sideways */}
      <mesh position={[0.3, h * 0.4, 0]} castShadow>
        <boxGeometry args={[0.5, 0.15, 0.15]} />
        <meshStandardMaterial color={trunk} roughness={1} />
      </mesh>
      {/* Pink/white blossom canopy */}
      {blossoms.map((b, li) => (
        <mesh key={li} position={[0, h * 0.4 + b.ly + 0.2, 0]} castShadow>
          <boxGeometry args={[b.sz, 0.35, b.sz]} />
          <meshStandardMaterial color={b.bColor} roughness={0.7} />
        </mesh>
      ))}
      {/* Scattered petals */}
      {petals.map((p, i) => (
        <mesh key={`p${i}`} position={[p.px, p.py, p.pz]}>
          <boxGeometry args={[0.15, 0.1, 0.15]} />
          <meshStandardMaterial color={p.color} roughness={0.7} />
        </mesh>
      ))}
    </group>
  );
}

// ─── Flowers ────────────────────────────────────
function FlowerPatch({ position, seed }) {
  const flowers = useMemo(() => {
    const rng = mulberry32(seed);
    const colors = ['#ff4444', '#ffee44', '#ff77aa', '#aa55ff', '#44aaff', '#ff8833'];
    const result = [];
    const count = 2 + Math.floor(rng() * 4);
    for (let i = 0; i < count; i++) {
      result.push({
        offset: [(rng() - 0.5) * 0.6, 0, (rng() - 0.5) * 0.6],
        color: colors[Math.floor(rng() * colors.length)],
        height: 0.15 + rng() * 0.15,
      });
    }
    return result;
  }, [seed]);

  return (
    <group position={position}>
      {flowers.map((f, i) => (
        <group key={i} position={f.offset}>
          <mesh position={[0, f.height / 2, 0]}>
            <boxGeometry args={[0.03, f.height, 0.03]} />
            <meshStandardMaterial color="#4c8e31" roughness={1} />
          </mesh>
          <mesh position={[0, f.height + 0.04, 0]}>
            <boxGeometry args={[0.1, 0.08, 0.1]} />
            <meshStandardMaterial color={f.color} roughness={0.8} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

// ─── Rocks ──────────────────────────────────────
function Rock({ position, seed }) {
  const config = useMemo(() => {
    const rng = mulberry32(seed);
    return {
      w: 0.2 + rng() * 0.4, h: 0.15 + rng() * 0.2, d: 0.2 + rng() * 0.3,
      color: rng() > 0.5 ? '#9B9B9B' : '#7F7F7F',
      hasSecond: rng() > 0.5,
    };
  }, [seed]);

  return (
    <group position={position}>
      <mesh position={[0, config.h / 2, 0]} castShadow>
        <boxGeometry args={[config.w, config.h, config.d]} />
        <meshStandardMaterial color={config.color} roughness={1} />
      </mesh>
      {config.hasSecond && (
        <mesh position={[config.w * 0.3, config.h * 0.3, config.d * 0.2]} castShadow>
          <boxGeometry args={[config.w * 0.6, config.h * 0.6, config.d * 0.6]} />
          <meshStandardMaterial color="#8C8C8C" roughness={1} />
        </mesh>
      )}
    </group>
  );
}

// ─── Lake ───────────────────────────────────────
function Lake({ position, seed }) {
  const blocksRef = useRef([]);
  const blocks = useMemo(() => {
    const rng = mulberry32(seed);
    const result = [];
    const w = 5 + Math.floor(rng() * 4);
    const d = 4 + Math.floor(rng() * 4);
    for (let x = 0; x < w; x++) {
      for (let z = 0; z < d; z++) {
        if (rng() > 0.1) {
          result.push({
            pos: [(x - w / 2) * 0.5, 0.04, (z - d / 2) * 0.5],
            color: rng() > 0.5 ? '#44aadd' : '#3099cc',
            phase: rng() * Math.PI * 2,
          });
        }
      }
    }
    return result;
  }, [seed]);

  useGameLoop(() => {
    const t = performance.now() * 0.001;
    blocksRef.current.forEach((mesh, i) => {
      if (mesh && blocks[i]) {
        mesh.position.y = 0.04 + Math.sin(t * 2.5 + blocks[i].phase) * 0.015;
      }
    });
  });

  return (
    <group position={position}>
      {blocks.map((b, i) => (
        <mesh 
          key={i} 
          ref={(el) => (blocksRef.current[i] = el)}
          position={b.pos}
        >
          <boxGeometry args={[0.5, 0.08, 0.5]} />
          <meshStandardMaterial color={b.color} roughness={0.3} metalness={0.2} transparent opacity={0.85} />
        </mesh>
      ))}
    </group>
  );
}

// ─── Passive Animal ─────────────────────────────
function PassiveAnimal({ position, seed }) {
  const config = useMemo(() => {
    const rng = mulberry32(seed);
    const type = rng();
    if (type < 0.33) return { body: '#f0f0f0', head: '#aaa', legs: '#727272', w: 0.35, h: 0.25, d: 0.45, headSize: 0.18 };
    if (type < 0.66) return { body: '#f6acac', head: '#df8f8f', legs: '#b87474', w: 0.3, h: 0.22, d: 0.4, headSize: 0.2 };
    return { body: '#d2ba98', head: '#bd9d7d', legs: '#967e6f', w: 0.15, h: 0.15, d: 0.2, headSize: 0.12 };
  }, [seed]);

  return (
    <group position={position}>
      <mesh position={[0, config.h / 2 + 0.1, 0]} castShadow>
        <boxGeometry args={[config.d, config.h, config.w]} />
        <meshStandardMaterial color={config.body} roughness={0.9} />
      </mesh>
      <mesh position={[config.d * 0.4, config.h * 0.8 + 0.1, 0]} castShadow>
        <boxGeometry args={[config.headSize, config.headSize, config.headSize]} />
        <meshStandardMaterial color={config.head} roughness={0.9} />
      </mesh>
      {[[-0.12, 0.08], [0.12, 0.08], [-0.12, -0.08], [0.12, -0.08]].map(([dx, dz], i) => (
        <mesh key={i} position={[dx, 0.05, dz]}>
          <boxGeometry args={[0.06, 0.1, 0.06]} />
          <meshStandardMaterial color={config.legs} roughness={1} />
        </mesh>
      ))}
    </group>
  );
}

// ─── Waterfall ──────────────────────────────────
function Waterfall({ position }) {
  return (
    <group position={position}>
      <mesh position={[0, 2, 0]}>
        <boxGeometry args={[2.2, 4, 1.5]} />
        <meshStandardMaterial color="#727272" roughness={1} />
      </mesh>
      <mesh position={[0, 4.15, 0]}>
        <boxGeometry args={[2.6, 0.3, 1.8]} />
        <meshStandardMaterial color={GRASS_TOP} roughness={1} />
      </mesh>
      {Array.from({ length: 10 }, (_, i) => (
        <mesh key={i} position={[1.15, 3.5 - i * 0.38, 0]}>
          <boxGeometry args={[0.35, 0.35, 0.6]} />
          <meshStandardMaterial
            color={i % 3 === 0 ? '#33aadd' : i % 3 === 1 ? '#55ccee' : '#44bbdd'}
            roughness={0.15} transparent opacity={0.82}
          />
        </mesh>
      ))}
      <mesh position={[0.8, -0.06, 0.4]}>
        <boxGeometry args={[2, 0.14, 1.5]} />
        <meshStandardMaterial color="#38b4dd" roughness={0.2} transparent opacity={0.85} />
      </mesh>
    </group>
  );
}

// ─── Rolling Hill ───────────────────────────────
function Hill({ position, seed }) {
  const config = useMemo(() => {
    const rng = mulberry32(seed);
    return {
      h: 1.5 + rng() * 3,
      w: 1.5 + rng() * 2.5,
      color: rng() > 0.5 ? '#709362' : '#608352',
      hasSnow: rng() > 0.75 && (1.5 + rng() * 3) > 3,
    };
  }, [seed]);

  return (
    <group position={position}>
      <mesh position={[0, config.h / 2, 0]}>
        <boxGeometry args={[config.w, config.h, config.w * 0.8]} />
        <meshStandardMaterial color={config.color} roughness={1} />
      </mesh>
      <mesh position={[config.w * 0.25, config.h * 0.35, config.w * 0.2]}>
        <boxGeometry args={[config.w * 0.5, config.h * 0.7, config.w * 0.4]} />
        <meshStandardMaterial color={config.color} roughness={1} />
      </mesh>
      {config.hasSnow && (
        <mesh position={[0, config.h + 0.15, 0]}>
          <boxGeometry args={[config.w * 0.5, 0.3, config.w * 0.4]} />
          <meshStandardMaterial color="#f0f0f0" roughness={1} />
        </mesh>
      )}
    </group>
  );
}

// ─── Grass Tufts ────────────────────────────────
function GrassDetails({ segmentLength, seed }) {
  const details = useMemo(() => {
    const items = [];
    const rng = mulberry32(seed * 12345);
    for (let i = 0; i < 25; i++) {
      items.push({
        x: (rng() - 0.5) * 20,
        z: (rng() - 0.5) * segmentLength * 0.9,
        h: 0.04 + rng() * 0.12,
        shade: rng() > 0.5 ? '#60933e' : '#7cae4b',
      });
    }
    return items;
  }, [segmentLength, seed]);

  return (
    <>
      {details.map((d, i) => (
        <mesh key={i} position={[d.x, d.h / 2, d.z]}>
          <boxGeometry args={[0.12, d.h, 0.12]} />
          <meshStandardMaterial color={d.shade} roughness={1} />
        </mesh>
      ))}
    </>
  );
}

function SegmentScenery({ segmentLength, seed }) {
  const items = useMemo(() => {
    const rng = mulberry32(seed * 77777);
    const result = [];
    const s = () => Math.floor(rng() * 99999);

    // ─── Trees (mix of oak, pine, cherry) ───
    const treeCount = 10 + Math.floor(rng() * 8);
    for (let i = 0; i < treeCount; i++) {
      const side = rng() > 0.5 ? 1 : -1;
      const x = side * (2.2 + rng() * 17.3);
      const z = (rng() - 0.5) * segmentLength * 0.85;
      const treeType = rng();
      if (treeType < 0.4) {
        result.push({ type: 'oak', pos: [x, 0, z], seed: s() });
      } else if (treeType < 0.7) {
        result.push({ type: 'pine', pos: [x, 0, z], seed: s() });
      } else {
        result.push({ type: 'cherry', pos: [x, 0, z], seed: s() });
      }
    }

    // Flowers (colorful patches)
    const flowerCount = 6 + Math.floor(rng() * 5);
    for (let i = 0; i < flowerCount; i++) {
      const side = rng() > 0.5 ? 1 : -1;
      result.push({ type: 'flower', pos: [side * (1.8 + rng() * 17.5), 0, (rng() - 0.5) * segmentLength * 0.85], seed: s() });
    }

    // Rocks
    const rockCount = 2 + Math.floor(rng() * 3);
    for (let i = 0; i < rockCount; i++) {
      const side = rng() > 0.5 ? 1 : -1;
      result.push({ type: 'rock', pos: [side * (2.2 + rng() * 17.0), 0, (rng() - 0.5) * segmentLength * 0.8], seed: s() });
    }

    // Lake - less frequent (25% chance)
    if (rng() > 0.75) {
      const side = rng() > 0.5 ? 1 : -1;
      result.push({ type: 'lake', pos: [side * (4.5 + rng() * 11.0), 0, (rng() - 0.5) * segmentLength * 0.6], seed: s() });
    }

    // Animal
    if (rng() > 0.3) {
      const side = rng() > 0.5 ? 1 : -1;
      result.push({ type: 'animal', pos: [side * (2.8 + rng() * 15.0), 0, (rng() - 0.5) * segmentLength * 0.7], seed: s() });
    }

    return result;
  }, [segmentLength, seed]);

  return (
    <>
      {items.map((item, i) => {
        switch (item.type) {
          case 'oak': return <OakTree key={i} position={item.pos} seed={item.seed} />;
          case 'pine': return <PineTree key={i} position={item.pos} seed={item.seed} />;
          case 'cherry': return <CherryTree key={i} position={item.pos} seed={item.seed} />;
          case 'flower': return <FlowerPatch key={i} position={item.pos} seed={item.seed} />;
          case 'rock': return <Rock key={i} position={item.pos} seed={item.seed} />;
          case 'lake': return <Lake key={i} position={item.pos} seed={item.seed} />;
          case 'animal': return <PassiveAnimal key={i} position={item.pos} seed={item.seed} />;
          default: return null;
        }
      })}
    </>
  );
}

// ─── Ground Strip (scrolling) ───────────────────
function GroundStrip({ index }) {
  const ref = useRef();
  const initialZ = -index * SEGMENT_LENGTH;

  useGameLoop((delta) => {
    const state = useGameStore.getState();
    if (state.status !== 'playing') return;
    if (!ref.current) return;

    ref.current.position.z += state.speed * delta;
    if (ref.current.position.z > SEGMENT_LENGTH) {
      ref.current.position.z -= GROUND_LENGTH;
    }
  });

  return (
    <group ref={ref} position={[0, 0, initialZ]}>
      {/* Wide grass surface */}
      <mesh position={[0, -0.12, 0]} receiveShadow>
        <boxGeometry args={[40, 0.25, SEGMENT_LENGTH]} />
        <meshStandardMaterial color={GRASS_TOP} roughness={1} />
      </mesh>

      {/* Running path */}
      <mesh position={[0, -0.08, 0]} receiveShadow>
        <boxGeometry args={[2, 0.08, SEGMENT_LENGTH]} />
        <meshStandardMaterial color={PATH_COLOR} roughness={1} />
      </mesh>
      <mesh position={[1.1, -0.06, 0]}>
        <boxGeometry args={[0.2, 0.06, SEGMENT_LENGTH]} />
        <meshStandardMaterial color="#B0A080" roughness={1} />
      </mesh>
      <mesh position={[-1.1, -0.06, 0]}>
        <boxGeometry args={[0.2, 0.06, SEGMENT_LENGTH]} />
        <meshStandardMaterial color="#B0A080" roughness={1} />
      </mesh>

      {/* Dirt layer */}
      <mesh position={[0, -0.55, 0]}>
        <boxGeometry args={[40, 0.6, SEGMENT_LENGTH]} />
        <meshStandardMaterial color={DIRT} roughness={1} />
      </mesh>

      {/* Stone layer */}
      <mesh position={[0, -1.1, 0]}>
        <boxGeometry args={[40, 0.5, SEGMENT_LENGTH]} />
        <meshStandardMaterial color={STONE} roughness={1} />
      </mesh>

      {/* All scenery scrolls with this segment */}
      <GrassDetails segmentLength={SEGMENT_LENGTH} seed={index} />
      <SegmentScenery segmentLength={SEGMENT_LENGTH} seed={index + 100} />
    </group>
  );
}

export default function Ground() {
  return (
    <group>
      {/* Infinite looking base plane to prevent the 'island in the air' look */}
      <mesh position={[0, -2.5, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[800, 800]} />
        <meshStandardMaterial color={GRASS_TOP} roughness={1} />
      </mesh>

      {Array.from({ length: GROUND_SEGMENTS }, (_, i) => (
        <GroundStrip key={i} index={i} />
      ))}
    </group>
  );
}
