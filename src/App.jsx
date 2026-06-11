import { useEffect, useRef, useMemo } from 'react';
import { Game, World, Camera } from '@carverjs/core/components';
import { useGameLoop } from '@carverjs/core/hooks';
import { useGameStore as useCarverGameStore } from '@carverjs/core/store';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useGameStore, getEnvironmentColors } from './useGameState';
import Dino from './Dino';
import Ground from './Ground';
import Obstacles from './Obstacles';
import Clouds from './Clouds';
import GameController from './GameController';
import GameUI from './GameUI';
import './index.css';

/**
 * Dynamic lighting that transitions with the day/night cycle.
 * Night uses strong blue moonlight to keep entities visible against a truly dark sky.
 */
function DynamicEnvironment() {
  const ambientRef = useRef();
  const sunRef = useRef();
  const hemiRef = useRef();
  const moonLightRef = useRef();

  useGameLoop(() => {
    const { timeOfDay } = useGameStore.getState();
    const env = getEnvironmentColors(timeOfDay);

    if (ambientRef.current) ambientRef.current.intensity = env.ambientIntensity;
    if (sunRef.current) {
      sunRef.current.intensity = env.sunIntensity;
      sunRef.current.color.set(env.sunColor);
    }
    if (hemiRef.current) {
      hemiRef.current.color.set(env.hemiColor);
      hemiRef.current.groundColor.set(env.isNight ? '#0a0a15' : '#72a443');
      hemiRef.current.intensity = env.ambientIntensity * 0.5;
    }

    // Moonlight: bright blue-white fill during night for entity visibility
    if (moonLightRef.current) {
      let moonI = 0;
      if (timeOfDay > 0.62 && timeOfDay < 0.88) {
        moonI = 0.38;
      } else if (timeOfDay >= 0.55 && timeOfDay <= 0.62) {
        moonI = ((timeOfDay - 0.55) / 0.07) * 0.38;
      } else if (timeOfDay >= 0.88 && timeOfDay <= 0.95) {
        moonI = ((0.95 - timeOfDay) / 0.07) * 0.38;
      }
      moonLightRef.current.intensity = moonI;
    }
  });

  return (
    <>
      <ambientLight ref={ambientRef} intensity={0.65} />
      <directionalLight
        ref={sunRef}
        position={[8, 12, 5]}
        intensity={1.3}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={80}
        shadow-camera-left={-15}
        shadow-camera-right={15}
        shadow-camera-top={15}
        shadow-camera-bottom={-15}
      />
      <hemisphereLight ref={hemiRef} args={['#87ceeb', '#72a443', 0.3]} />

      {/* Moonlight - strong blue directional from upper-front, illuminates during night */}
      <directionalLight
        ref={moonLightRef}
        position={[-3, 18, -15]}
        intensity={0}
        color="#8899dd"
      />

      <DynamicSkyFog />
    </>
  );
}

/**
 * Updates background and fog colors in real time.
 * Night: truly dark background (#000004), very dark fog.
 */
function DynamicSkyFog() {
  const { scene } = useThree();
  useGameLoop(() => {
    const { timeOfDay } = useGameStore.getState();
    const env = getEnvironmentColors(timeOfDay);

    if (!scene.background || !(scene.background instanceof THREE.Color)) {
      scene.background = new THREE.Color(env.sky);
    } else {
      scene.background.set(env.sky);
    }

    if (scene.fog) {
      scene.fog.color.set(env.fog);
      scene.fog.near = env.isNight ? 8 : 15;
      scene.fog.far = env.isNight ? 28 : 45;
    }
  });

  return <fog attach="fog" args={['#a0c4ff', 15, 45]} />;
}

/**
 * Stars - 500 bright points in the upper sky, appear during night.
 */
function NightStars() {
  const starsRef = useRef();

  const positions = useMemo(() => {
    const arr = [];
    for (let i = 0; i < 500; i++) {
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.random() * Math.PI * 0.45;
      const r = 30 + Math.random() * 30;
      arr.push(
        Math.cos(theta) * Math.sin(phi) * r,
        Math.cos(phi) * r,
        Math.sin(theta) * Math.sin(phi) * r
      );
    }
    return new Float32Array(arr);
  }, []);

  useGameLoop(() => {
    if (!starsRef.current) return;
    const { timeOfDay } = useGameStore.getState();
    let opacity = 0;
    if (timeOfDay > 0.63 && timeOfDay < 0.87) opacity = 1;
    else if (timeOfDay >= 0.55 && timeOfDay <= 0.63) opacity = (timeOfDay - 0.55) / 0.08;
    else if (timeOfDay >= 0.87 && timeOfDay <= 0.95) opacity = (0.95 - timeOfDay) / 0.08;
    starsRef.current.material.opacity = opacity;
    starsRef.current.visible = opacity > 0.01;
  });

  return (
    <points ref={starsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={positions.length / 3}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial color="#ffffff" size={0.25} transparent opacity={0} sizeAttenuation />
    </points>
  );
}

/**
 * Full Moon positioned AHEAD of the dino (in -Z direction, the running direction).
 * The camera looks from [4, 4.5, 7] toward origin and beyond to -Z.
 * Moon at [0, 16, -35] is directly ahead and high in the sky.
 * Large sphere with bright glow halo. Always uses meshBasicMaterial to stay bright.
 */
function Sun() {
  const sunRef = useRef();
  const glowRef = useRef();

  useGameLoop(() => {
    const { timeOfDay } = useGameStore.getState();
    let opacity = 0;
    if (timeOfDay >= 0.0 && timeOfDay < 0.5) opacity = 1;
    else if (timeOfDay >= 0.5 && timeOfDay <= 0.57) opacity = (0.57 - timeOfDay) / 0.07;
    else if (timeOfDay >= 0.93 && timeOfDay <= 1.0) opacity = (timeOfDay - 0.93) / 0.07;

    if (sunRef.current) {
      sunRef.current.visible = opacity > 0.01;
      sunRef.current.material.opacity = opacity;
    }
    if (glowRef.current) {
      glowRef.current.visible = opacity > 0.01;
      glowRef.current.material.opacity = opacity * 0.25;
    }
  });

  return (
    <group position={[-6, 14, -30]}>
      {/* Voxel Sun disc */}
      <mesh ref={sunRef} visible={false}>
        <boxGeometry args={[4, 4, 1]} />
        <meshBasicMaterial color="#fffae0" transparent opacity={0} fog={false} />
      </mesh>
      {/* Sun glow */}
      <mesh ref={glowRef} visible={false}>
        <boxGeometry args={[6.5, 6.5, 1.1]} />
        <meshBasicMaterial color="#ffcc33" transparent opacity={0} fog={false} />
      </mesh>
    </group>
  );
}

function Moon() {
  const moonRef = useRef();
  const glowRef = useRef();

  useGameLoop(() => {
    const { timeOfDay } = useGameStore.getState();
    let opacity = 0;
    if (timeOfDay > 0.63 && timeOfDay < 0.87) opacity = 1;
    else if (timeOfDay >= 0.55 && timeOfDay <= 0.63) opacity = (timeOfDay - 0.55) / 0.08;
    else if (timeOfDay >= 0.87 && timeOfDay <= 0.95) opacity = (0.95 - timeOfDay) / 0.08;

    if (moonRef.current) {
      moonRef.current.visible = opacity > 0.01;
      moonRef.current.material.opacity = opacity;
    }
    if (glowRef.current) {
      glowRef.current.visible = opacity > 0.01;
      glowRef.current.material.opacity = opacity * 0.2;
    }
  });

  return (
    <group position={[6, 14, -30]}>
      {/* Voxel Moon disc */}
      <mesh ref={moonRef} visible={false}>
        <boxGeometry args={[3.2, 3.2, 1]} />
        <meshBasicMaterial color="#ffffee" transparent opacity={0} fog={false} />
      </mesh>
      {/* Moon glow */}
      <mesh ref={glowRef} visible={false}>
        <boxGeometry args={[5, 5, 1.1]} />
        <meshBasicMaterial color="#aabbcc" transparent opacity={0} fog={false} />
      </mesh>
    </group>
  );
}

/**
 * Main scene content.
 */
function DinoScene() {
  return (
    <>
      {/* Camera: wider FOV, pulled back for full ground visibility on PC */}
      <Camera
        type="perspective"
        controls="none"
        perspectiveProps={{
          position: [4, 4.5, 7],
          fov: 65,
          near: 0.1,
          far: 200,
        }}
      />

      <DynamicEnvironment />
      <NightStars />
      <Sun />
      <Moon />

      <Dino />
      <Ground />
      <Obstacles />
      <Clouds />
      <GameController />
    </>
  );
}

export default function App() {
  useEffect(() => {
    useCarverGameStore.getState().setPhase('playing');
  }, []);

  return (
    <>
      <Game
        mode="3d"
        style={{ width: '100%', height: '100%' }}
        shadows
        dpr={[1, 2]}
        gl={{ antialias: true, alpha: false }}
        environmentProps={{ map: new THREE.Texture(), background: false }}
      >
        <World active={true}>
          <DinoScene />
        </World>
      </Game>
      <GameUI />
    </>
  );
}
