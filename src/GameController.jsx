import { useRef, useEffect } from 'react';
import { useGameStore } from './useGameState';
import { useInput, useGameLoop } from '@carverjs/core/hooks';

/**
 * GameController handles:
 * - Jump / duck input via CarverJS useInput hook
 * - Dino physics (gravity, position)
 * - Score counting
 * - Speed ramping
 */

const GRAVITY = -25;
const JUMP_VELOCITY = 9.5;
const GROUND_Y = 0;

export default function GameController() {
  const velocityRef = useRef(0);
  const isGroundedRef = useRef(true);
  const touchPressedRef = useRef(false);

  // Check text input focus to disable gameplay controls while typing a name
  const isTyping = document.activeElement && (
    document.activeElement.tagName === 'INPUT' || 
    document.activeElement.tagName === 'TEXTAREA'
  );

  const { isAction, isActionJustPressed } = useInput({
    actions: {
      jump: ['Space', 'ArrowUp', 'KeyW'],
      duck: ['ArrowDown', 'KeyS'],
    },
    enabled: !isTyping
  });

  // Touch support for mobile tap-to-jump (ignoring mouse clicks on desktop)
  useEffect(() => {
    const handleTouchStart = () => {
      if (document.activeElement && (document.activeElement.tagName === 'INPUT' || document.activeElement.tagName === 'TEXTAREA')) {
        return;
      }
      touchPressedRef.current = true;
    };
    window.addEventListener('touchstart', handleTouchStart, { passive: true });
    return () => window.removeEventListener('touchstart', handleTouchStart);
  }, []);

  useGameLoop((delta) => {
    const state = useGameStore.getState();

    // Check keyboard & touch triggers (ignoring mouse pointer triggers)
    const jumpJust = isActionJustPressed('jump') || touchPressedRef.current;
    // Consume touch start trigger
    touchPressedRef.current = false;
    const duck = isAction('duck');

    if (state.status === 'idle') {
      if (jumpJust) {
        state.startGame();
      }
      return;
    }

    if (state.status === 'gameover') {
      if (jumpJust && Date.now() - state.gameOverTime > 500) {
        state.startGame();
      }
      return;
    }

    if (state.status !== 'playing') return;

    // ─── Input ────────────────────────────────
    if (jumpJust && isGroundedRef.current) {
      velocityRef.current = JUMP_VELOCITY;
      isGroundedRef.current = false;
      state.setIsJumping(true);
    }

    // Fast fall when ducking in air
    if (duck && !isGroundedRef.current) {
      velocityRef.current += GRAVITY * 1.5 * delta;
    }

    // Duck on ground
    state.setIsDucking(duck && isGroundedRef.current);

    // ─── Physics ──────────────────────────────
    velocityRef.current += GRAVITY * delta;
    let newY = state.dinoY + velocityRef.current * delta;

    if (newY <= GROUND_Y) {
      newY = GROUND_Y;
      velocityRef.current = 0;
      if (!isGroundedRef.current) {
        isGroundedRef.current = true;
        state.setIsJumping(false);
      }
    }

    state.setDinoY(newY);

    // ─── Score & Speed ────────────────────────
    state.incrementScore(delta);
    state.incrementSpeed(delta);
  });

  return null;
}
