import { useRef, useMemo } from 'react';
import { useGameStore } from './useGameState';
import { Actor } from '@carverjs/core/components';
import { useCollision, useGameLoop } from '@carverjs/core/hooks';

/**
 * Voxel T-Rex character.
 * 
 * Coordinate system after parent Y rotation +90°:
 *   Model +X → World -Z (running direction)
 *   Model +Z → World +X (right, toward camera)
 *   Model +Y → World +Y (up)
 * 
 * Leg animation uses rotation.z (child's local Z = world +X).
 * This swings legs in the model X-Y plane → world (-Z, Y) plane,
 * which IS forward/backward + up/down (correct running gait).
 * Feet always stay at or above ground (y ≥ hipY - legLen * cos(θ) ≥ 0).
 */

const BODY       = '#B0805B';
const BODY_DARK  = '#8A5C3D';
const BODY_LIGHT = '#B88B5E';
const BELLY      = '#E4B584';
const SPINE      = '#7C5432';
const EYE_WHITE  = '#F5F5DC';
const PUPIL      = '#1a1a1a';
const CLAW       = '#523D30';
const TEETH      = '#E8DCC8';
const MOUTH_INNER = '#A84E4E';
const LEG_UPPER  = '#966D4D'; // slightly different shade for visual separation
const LEG_LOWER  = '#7C5432';

const V = 0.2;

// Leg dimensions (absolute units)
const LEG_W = 0.22;       // leg block width (chunky)
const THIGH_H = 0.28;     // upper leg height
const SHIN_H = 0.22;      // lower leg height
const FOOT_H = 0.06;      // foot thickness
const FOOT_W = 0.26;      // foot width
const LEG_LEN = THIGH_H + SHIN_H + FOOT_H; // total: 0.56

function buildStandingBody() {
  const vx = [];

  // ─── HIP / PELVIS BLOCK (y=2 to y=3) ───
  // These bridge from the torso down to where the legs attach.
  // Wide enough to visually connect to the leg positions.
  for (let x = -1; x <= 2; x++) {
    for (let z = -1; z <= 1; z++) {
      vx.push({ pos: [x * V, 2 * V, z * V], color: BODY_DARK, size: V });
      vx.push({ pos: [x * V, 2.5 * V, z * V], color: BODY_DARK, size: V });
    }
  }

  // ─── TORSO (y=3 to y=7) ───
  for (let x = -1; x <= 3; x++) {
    for (let y = 3; y <= 7; y++) {
      for (let z = -1; z <= 1; z++) {
        const isEdge = x === -1 || x === 3 || y === 3 || y === 7 || Math.abs(z) === 1;
        if (!isEdge) continue;
        let color = BODY;
        if (y === 3) color = BODY_DARK;
        else if (y === 7) color = SPINE;
        else if (Math.abs(z) === 1 && y >= 5) color = BODY_LIGHT;
        vx.push({ pos: [x * V, y * V, z * V], color, size: V });
      }
    }
  }

  // Belly
  for (let y = 3; y <= 5; y++) {
    vx.push({ pos: [3 * V, y * V, 0], color: BELLY, size: V * 0.9 });
  }

  // ─── SPINE RIDGE ───
  for (let x = -2; x <= 2; x++) {
    vx.push({ pos: [x * V, 7.5 * V, 0], color: SPINE, size: V * 0.65 });
  }
  vx.push({ pos: [0, 7.8 * V, 0], color: SPINE, size: V * 0.45 });

  // ─── NECK ───
  for (let y = 7; y <= 9; y++) {
    for (let z = -1; z <= 1; z++) {
      vx.push({ pos: [(3 + (y - 7) * 0.4) * V, y * V, z * V], color: BODY, size: V });
    }
  }

  // ─── HEAD ───
  for (let x = 3; x <= 7; x++) {
    for (let y = 9; y <= 12; y++) {
      for (let z = -1; z <= 1; z++) {
        const isEdge = x === 3 || x === 7 || y === 9 || y === 12 || Math.abs(z) === 1;
        if (!isEdge && x > 4 && x < 7) continue;
        vx.push({ pos: [x * V, y * V, z * V], color: y === 12 ? SPINE : x === 7 ? BODY_DARK : BODY, size: V });
      }
    }
  }

  // Snout
  for (let x = 7; x <= 8; x++) {
    for (let z = -1; z <= 1; z++) {
      vx.push({ pos: [x * V, 9 * V, z * V], color: BODY_DARK, size: V });
      vx.push({ pos: [x * V, 10 * V, z * V], color: BODY, size: V });
    }
  }

  // Eyes
  vx.push({ pos: [6.5 * V, 11 * V, 1.5 * V], color: EYE_WHITE, size: V * 0.8 });
  vx.push({ pos: [6.8 * V, 11 * V, 1.6 * V], color: PUPIL, size: V * 0.35 });
  vx.push({ pos: [6.5 * V, 11 * V, -1.5 * V], color: EYE_WHITE, size: V * 0.8 });
  vx.push({ pos: [6.8 * V, 11 * V, -1.6 * V], color: PUPIL, size: V * 0.35 });

  // Teeth
  for (let x = 5; x <= 8; x += 2) {
    vx.push({ pos: [x * V, 8.7 * V, 0.8 * V], color: TEETH, size: V * 0.3 });
    vx.push({ pos: [x * V, 8.7 * V, -0.8 * V], color: TEETH, size: V * 0.3 });
  }
  for (let x = 5; x <= 7; x++) {
    vx.push({ pos: [x * V, 9 * V, 0], color: MOUTH_INNER, size: V * 0.5 });
  }

  // ─── TINY ARMS ───
  vx.push({ pos: [3.5 * V, 5 * V, 1.5 * V], color: BODY_LIGHT, size: V * 0.65 });
  vx.push({ pos: [4 * V, 4.5 * V, 1.5 * V], color: BODY, size: V * 0.5 });
  vx.push({ pos: [4.2 * V, 4 * V, 1.5 * V], color: CLAW, size: V * 0.3 });
  vx.push({ pos: [3.5 * V, 5 * V, -1.5 * V], color: BODY_LIGHT, size: V * 0.65 });
  vx.push({ pos: [4 * V, 4.5 * V, -1.5 * V], color: BODY, size: V * 0.5 });
  vx.push({ pos: [4.2 * V, 4 * V, -1.5 * V], color: CLAW, size: V * 0.3 });

  // ─── TAIL ───
  for (let i = 0; i < 6; i++) {
    const w = Math.max(0.5, 1.0 - i * 0.1);
    vx.push({ pos: [-(1 + i) * V, (4 + i * 0.35) * V, 0], color: i < 3 ? BODY : BODY_DARK, size: V * w });
    if (w > 0.6) {
      vx.push({ pos: [-(1 + i) * V, (4 + i * 0.35) * V, V * 0.5], color: BODY_DARK, size: V * (w - 0.2) });
      vx.push({ pos: [-(1 + i) * V, (4 + i * 0.35) * V, -V * 0.5], color: BODY_DARK, size: V * (w - 0.2) });
    }
    if (i < 4) vx.push({ pos: [-(1 + i) * V, (4.5 + i * 0.35) * V, 0], color: SPINE, size: V * 0.35 });
  }
  vx.push({ pos: [-7 * V, 6.5 * V, 0], color: SPINE, size: V * 0.3 });

  return vx;
}

function buildDuckingBody() {
  const vx = [];
  for (let x = -2; x <= 5; x++) {
    for (let z = -1; z <= 1; z++) {
      vx.push({ pos: [x * V, 1 * V, z * V], color: BODY, size: V });
      vx.push({ pos: [x * V, 2 * V, z * V], color: x < 0 ? BODY_DARK : BODY_LIGHT, size: V });
    }
  }
  for (let x = -1; x <= 4; x++) vx.push({ pos: [x * V, 2.5 * V, 0], color: SPINE, size: V * 0.5 });
  for (let x = 5; x <= 7; x++) {
    for (let z = -1; z <= 1; z++) {
      vx.push({ pos: [x * V, 1 * V, z * V], color: BODY_DARK, size: V });
      vx.push({ pos: [x * V, 2 * V, z * V], color: BODY, size: V });
    }
  }
  vx.push({ pos: [6.5 * V, 2 * V, 1.4 * V], color: EYE_WHITE, size: V * 0.6 });
  vx.push({ pos: [6.5 * V, 2 * V, -1.4 * V], color: EYE_WHITE, size: V * 0.6 });
  for (let i = 0; i < 3; i++) vx.push({ pos: [-(2 + i) * V, 1.5 * V, 0], color: BODY_DARK, size: V * (0.8 - i * 0.15) });
  return vx;
}

export default function Dino() {
  const groupRef = useRef();
  const legFLRef = useRef();
  const legFRRef = useRef();
  const legBLRef = useRef();
  const legBRRef = useRef();
  const legTimeRef = useRef(0);

  const isDucking = useGameStore((s) => s.isDucking);
  const dinoY = useGameStore((s) => s.dinoY);
  const status = useGameStore((s) => s.status);

  const bodyVoxels = useMemo(() => buildStandingBody(), []);
  const duckVoxels = useMemo(() => buildDuckingBody(), []);
  const voxels = isDucking ? duckVoxels : bodyVoxels;

  // Memoize collider config to prevent CollisionManager re-registration overhead
  const colliderConfig = useMemo(() => ({
    shape: 'aabb',
    halfExtents: isDucking ? [0.55, 0.28, 0.55] : [0.35, 0.85, 0.35],
    offset: isDucking ? [0, 0.28, 0] : [0, 0.85, 0],
  }), [isDucking]);

  useCollision({
    ref: groupRef,
    name: 'dino',
    collider: colliderConfig,
    onCollisionEnter: (e) => {
      if (e.otherName.startsWith('obstacle-')) {
        useGameStore.getState().gameOver();
      }
    },
    enabled: status === 'playing',
  });

  // Leg positions in model space
  const frontX = 0.24;   // front legs (forward)
  const backX = -0.08;   // back legs (rear)
  const legZ = 0.16;     // INSIDE body width (body edge is at z=±0.2)
  // Hip at bottom of hip block: y=2*V=0.4. Legs hang from here.
  // With LEG_LEN=0.56, feet land at 0.4-0.56=-0.16 below ground.
  // So raise hipY to LEG_LEN = 0.56 to place feet at y=0.
  const hipY = LEG_LEN;  // 0.56

  useGameLoop((delta) => {
    if (status !== 'playing') return;
    if (groupRef.current) groupRef.current.position.y = dinoY;

    const state = useGameStore.getState();
    const refs = [legFLRef, legFRRef, legBLRef, legBRRef];

    if (!state.isJumping && !isDucking) {
      // RUNNING: rotation.z gives correct forward/backward swing
      legTimeRef.current += delta * state.speed * 2.2;
      const stride = 0.7;
      const t = legTimeRef.current;
      // Diagonal gait: FL+BR together, FR+BL together
      const angles = [
        Math.sin(t) * stride,
        Math.sin(t + Math.PI) * stride,
        Math.sin(t + Math.PI) * stride,
        Math.sin(t) * stride,
      ];
      refs.forEach((ref, i) => {
        if (ref.current) {
          ref.current.rotation.z = angles[i];
          ref.current.position.y = hipY;
        }
      });
    } else {
      // JUMPING/DUCKING: legs straight down
      refs.forEach((ref) => {
        if (ref.current) {
          ref.current.rotation.z = 0;
          ref.current.position.y = hipY;
        }
      });
    }
  });

  return (
    <Actor
      ref={groupRef}
      type="primitive"
      name="dino"
      position={[0, dinoY, 0]}
      geometryArgs={[0.01, 0.01, 0.01]}
      materialProps={{ transparent: true, opacity: 0 }}
    >
      <group rotation={[0, Math.PI / 2, 0]}>
        {/* Body voxels */}
        {voxels.map((v, i) => (
          <mesh key={`${isDucking ? 'd' : 's'}-${i}`} position={v.pos} castShadow>
            <boxGeometry args={[v.size, v.size, v.size]} />
            <meshStandardMaterial color={v.color} roughness={0.85} metalness={0.05} />
          </mesh>
        ))}

        {/* ─── ANIMATED LEGS ─── */}
        {!isDucking && (
          <>
            {[
              { ref: legFLRef, x: frontX, z: legZ },
              { ref: legFRRef, x: frontX, z: -legZ },
              { ref: legBLRef, x: backX, z: legZ },
              { ref: legBRRef, x: backX, z: -legZ },
            ].map(({ ref, x, z }, idx) => (
              <group key={idx} ref={ref} position={[x, hipY, z]}>
                {/* Thigh */}
                <mesh position={[0, -(THIGH_H / 2), 0]} castShadow>
                  <boxGeometry args={[LEG_W, THIGH_H, LEG_W]} />
                  <meshStandardMaterial color={LEG_UPPER} roughness={0.85} />
                </mesh>
                {/* Shin */}
                <mesh position={[0, -(THIGH_H + SHIN_H / 2), 0]} castShadow>
                  <boxGeometry args={[LEG_W * 0.85, SHIN_H, LEG_W * 0.85]} />
                  <meshStandardMaterial color={LEG_LOWER} roughness={0.85} />
                </mesh>
                {/* Foot */}
                <mesh position={[0.02, -(THIGH_H + SHIN_H + FOOT_H / 2), 0]} castShadow>
                  <boxGeometry args={[FOOT_W, FOOT_H, LEG_W]} />
                  <meshStandardMaterial color={CLAW} roughness={0.9} />
                </mesh>
              </group>
            ))}
          </>
        )}

        {/* Ducking legs */}
        {isDucking && (
          <>
            {[[1, 0.8], [1, -0.8], [3.5, 0.8], [3.5, -0.8]].map(([lx, lz], i) => (
              <mesh key={i} position={[lx * V, 0, lz * V]} castShadow>
                <boxGeometry args={[0.16, 0.25, 0.16]} />
                <meshStandardMaterial color={i < 2 ? BODY_DARK : BODY} roughness={0.85} />
              </mesh>
            ))}
          </>
        )}
      </group>
    </Actor>
  );
}
