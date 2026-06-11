import { create } from 'zustand';

/**
 * Zustand store for global game state.
 * 
 * Day/Night cycle: Every 1400 points cycles through
 *   morning → afternoon → sunset → night → dawn → morning ...
 * The timeOfDay is a continuous 0-1 value that wraps every 1400 points.
 *   0.00 = sunrise/morning
 *   0.25 = noon/afternoon  
 *   0.50 = sunset/dusk
 *   0.75 = midnight/night
 *   1.00 = dawn → wraps to 0
 */

const DAY_CYCLE_PERIOD = 1400;

export const useGameStore = create((set, get) => ({
  status: 'idle',
  score: 0,
  highScore: parseInt(localStorage.getItem('dino3d-highscore') || '0', 10),
  speed: 11,
  baseSpeed: 11,
  maxSpeed: 24,
  speedIncrement: 0.0025,

  // Dino state
  isJumping: false,
  isDucking: false,
  dinoY: 0,
  dinoVelocityY: 0,
  gameOverTime: 0,

  // Day/night cycle (0-1 continuous)
  timeOfDay: 0.05,

  // Obstacles
  obstacles: [],
  nextObstacleId: 0,

  // Clouds
  clouds: [],
  nextCloudId: 0,

  startGame: () => {
    set({
      status: 'playing',
      score: 0,
      speed: 11,
      isJumping: false,
      isDucking: false,
      dinoY: 0,
      dinoVelocityY: 0,
      timeOfDay: 0.05,
      obstacles: [],
      nextObstacleId: 0,
    });
  },

  gameOver: () => {
    const { score, highScore } = get();
    const newHighScore = Math.max(score, highScore);
    localStorage.setItem('dino3d-highscore', String(newHighScore));
    set({
      status: 'gameover',
      highScore: newHighScore,
      gameOverTime: Date.now(),
    });
  },

  incrementScore: (delta) => {
    set((state) => {
      const newScore = state.score + delta * state.speed * 2;
      const timeOfDay = (newScore % DAY_CYCLE_PERIOD) / DAY_CYCLE_PERIOD;
      return { score: newScore, timeOfDay };
    });
  },

  incrementSpeed: (delta) => {
    set((state) => ({
      speed: Math.min(state.speed + state.speedIncrement * delta * 60, state.maxSpeed),
    }));
  },

  /**
   * Dynamic max cactus height based on current speed.
   * Physics: peak = v₀² / (2g) = 9.5² / 50 = 1.805
   * 
   * At low speeds the player has more reaction time → taller cacti OK.
   * At high speeds less reaction time → shorter cacti needed.
   * 
   * factor lerps from 0.75 (at baseSpeed) to 0.55 (at maxSpeed).
   */
  getMaxJumpableCactusHeight: () => {
    const { speed, baseSpeed, maxSpeed } = get();
    const JUMP_V = 9.5;
    const GRAV = 25;
    const peakY = (JUMP_V * JUMP_V) / (2 * GRAV); // 1.805

    // Normalized speed 0..1
    const t = Math.min(1, Math.max(0, (speed - baseSpeed) / (maxSpeed - baseSpeed)));
    // Factor: 0.75 at slow → 0.55 at fast
    const factor = 0.75 - t * 0.20;
    return peakY * factor;
  },

  setDinoY: (y) => set({ dinoY: y }),
  setDinoVelocityY: (vy) => set({ dinoVelocityY: vy }),
  setIsJumping: (v) => set({ isJumping: v }),
  setIsDucking: (v) => set({ isDucking: v }),

  addObstacle: (obstacle) => {
    set((state) => ({
      obstacles: [...state.obstacles, { ...obstacle, id: state.nextObstacleId }],
      nextObstacleId: state.nextObstacleId + 1,
    }));
  },

  removeObstacle: (id) => {
    set((state) => ({
      obstacles: state.obstacles.filter((o) => o.id !== id),
    }));
  },

  updateObstacles: (delta) => {
    const { speed } = get();
    set((state) => ({
      obstacles: state.obstacles
        .map((o) => ({ ...o, z: o.z + speed * delta }))
        .filter((o) => o.z < 10),
    }));
  },

  addCloud: (cloud) => {
    set((state) => ({
      clouds: [...state.clouds, { ...cloud, id: state.nextCloudId }],
      nextCloudId: state.nextCloudId + 1,
    }));
  },

  updateClouds: (delta) => {
    set((state) => ({
      clouds: state.clouds
        .map((c) => ({ ...c, z: c.z + (c.speed || 1.5) * delta }))
        .filter((c) => c.z < 15),
    }));
  },
}));

/**
 * Get sky/environment colors for the current time of day.
 * Soft, desaturated, voxel-like subtle pastel tones.
 */
export function getEnvironmentColors(t) {
  const keyframes = [
    // Sunrise (subtle orange/pink)
    { t: 0.00, sky: '#fbd0ba', fog: '#fde0d0', amb: 0.75, sun: 1.3, sunClr: '#fce4c8', hemi: '#fadbc0' },
    // Morning (soft pastel blue)
    { t: 0.10, sky: '#cce0ff', fog: '#e0ecff', amb: 0.95, sun: 1.5, sunClr: '#ffffff', hemi: '#d8e7fe' },
    // Noon (subtle blue)
    { t: 0.25, sky: '#bfd7f7', fog: '#d5e6ff', amb: 1.05, sun: 1.7, sunClr: '#ffffff', hemi: '#d8e4f5' },
    // Afternoon (subtle sky blue)
    { t: 0.40, sky: '#c6dcfa', fog: '#dbe7fd', amb: 0.95, sun: 1.5, sunClr: '#ffffff', hemi: '#dce8f9' },
    // Sunset (soft rose gold)
    { t: 0.50, sky: '#f2cccc', fog: '#fadcdc', amb: 0.70, sun: 1.1, sunClr: '#fad2d2', hemi: '#f5dad4' },
    // Twilight (muted violet)
    { t: 0.57, sky: '#6c5c82', fog: '#5c4d70', amb: 0.35, sun: 0.3, sunClr: '#8a7d9c', hemi: '#6e5e84' },
    // Night onset (deep slate/indigo)
    { t: 0.64, sky: '#110f1c', fog: '#0a0912', amb: 0.12, sun: 0.0, sunClr: '#111122', hemi: '#0d0c15' },
    // Midnight (deep dark night sky)
    { t: 0.75, sky: '#08070d', fog: '#040306', amb: 0.08, sun: 0.0, sunClr: '#080811', hemi: '#050509' },
    // Late night (deep slate/indigo)
    { t: 0.86, sky: '#110f1c', fog: '#0a0912', amb: 0.12, sun: 0.0, sunClr: '#111122', hemi: '#0d0c15' },
    // Pre-dawn (subtle indigo/violet transition)
    { t: 0.93, sky: '#423b5c', fog: '#352e4a', amb: 0.30, sun: 0.3, sunClr: '#4f456e', hemi: '#453c61' },
    // Dawn (soft peach)
    { t: 0.97, sky: '#f0cdc2', fog: '#f6ddd6', amb: 0.70, sun: 1.1, sunClr: '#f5d9cc', hemi: '#eed4ca' },
    // Sunrise wrap
    { t: 1.00, sky: '#fbd0ba', fog: '#fde0d0', amb: 0.75, sun: 1.3, sunClr: '#fce4c8', hemi: '#fadbc0' },
  ];

  let a = keyframes[0], b = keyframes[1];
  for (let i = 0; i < keyframes.length - 1; i++) {
    if (t >= keyframes[i].t && t <= keyframes[i + 1].t) {
      a = keyframes[i];
      b = keyframes[i + 1];
      break;
    }
  }

  const range = b.t - a.t;
  const f = range > 0 ? (t - a.t) / range : 0;

  return {
    sky: lerpColor(a.sky, b.sky, f),
    fog: lerpColor(a.fog, b.fog, f),
    ambientIntensity: a.amb + (b.amb - a.amb) * f,
    sunIntensity: a.sun + (b.sun - a.sun) * f,
    sunColor: lerpColor(a.sunClr, b.sunClr, f),
    hemiColor: lerpColor(a.hemi, b.hemi, f),
    isNight: t > 0.55 && t < 0.95,
  };
}

function lerpColor(c1, c2, f) {
  const r1 = parseInt(c1.slice(1, 3), 16), g1 = parseInt(c1.slice(3, 5), 16), b1 = parseInt(c1.slice(5, 7), 16);
  const r2 = parseInt(c2.slice(1, 3), 16), g2 = parseInt(c2.slice(3, 5), 16), b2 = parseInt(c2.slice(5, 7), 16);
  const r = Math.round(r1 + (r2 - r1) * f);
  const g = Math.round(g1 + (g2 - g1) * f);
  const b = Math.round(b1 + (b2 - b1) * f);
  return `#${r.toString(16).padStart(2, '0')}${g.toString(16).padStart(2, '0')}${b.toString(16).padStart(2, '0')}`;
}
