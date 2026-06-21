import { useEffect, useState, useCallback, useRef } from 'react';
import { useGameStore } from './useGameState';
import { fetchLeaderboard, submitScore, fetchPlayerCount } from './leaderboardService';

/**
 * HTML overlay UI for score, start screen, and game over screen.
 * Lives outside the R3F Canvas so it can use standard HTML/CSS.
 */

const DEFAULT_LEADERBOARD = [];

export default function GameUI() {
  const status = useGameStore((s) => s.status);
  const score = useGameStore((s) => s.score);
  const highScore = useGameStore((s) => s.highScore);
  const startGame = useGameStore((s) => s.startGame);

  const displayScore = Math.floor(score);
  const displayHigh = Math.floor(Math.max(highScore, score));

  // Capture the previous high score at the start of gameplay to strictly check for new best
  const [previousHighScore, setPreviousHighScore] = useState(highScore);

  // User details & Leaderboard
  const [username, setUsername] = useState(() => localStorage.getItem('dino3d_username') || '');
  const [nameInput, setNameInput] = useState('');
  const [leaderboard, setLeaderboard] = useState(() => {
    const current = localStorage.getItem('dino3d_leaderboard_v4');
    return current ? JSON.parse(current) : DEFAULT_LEADERBOARD;
  });

  // Base counts for play session tracker
  const BASE_PLAYS = 0;

  const [playsCount, setPlaysCount] = useState(() => {
    const local = localStorage.getItem('dino3d_local_plays');
    return local ? parseInt(local, 10) : BASE_PLAYS;
  });
  const [uniquesCount, setUniquesCount] = useState(0);

  const namespace = 'dino3d_saurabh_v4';

  const fetchCounts = useCallback(async () => {
    try {
      const playsRes = await fetch(`https://api.counterapi.dev/v1/${namespace}/plays`);
      const playsData = await playsRes.json();

      if (playsData && typeof playsData.count === 'number') {
        const finalPlays = BASE_PLAYS + playsData.count;
        setPlaysCount(finalPlays);
        localStorage.setItem('dino3d_local_plays', String(finalPlays));
      }
    } catch (err) {
      console.warn("Failed to fetch global counter stats:", err);
    }
  }, []);

  const refreshPlayerCount = useCallback(async () => {
    try {
      const count = await fetchPlayerCount();
      setUniquesCount(count);
    } catch (err) {
      console.warn("Failed to fetch player count:", err);
    }
  }, []);

  const incrementPlayCount = useCallback(async () => {
    setPlaysCount((prev) => {
      const next = prev + 1;
      localStorage.setItem('dino3d_local_plays', String(next));
      return next;
    });

    try {
      const res = await fetch(`https://api.counterapi.dev/v1/${namespace}/plays/up`);
      const data = await res.json();
      if (data && typeof data.count === 'number') {
        const finalPlays = BASE_PLAYS + data.count;
        setPlaysCount(finalPlays);
        localStorage.setItem('dino3d_local_plays', String(finalPlays));
      }
    } catch (err) {
      console.warn("Failed to increment global plays count:", err);
    }
  }, []);

  const loadLeaderboard = useCallback(async () => {
    const list = await fetchLeaderboard();
    setLeaderboard(list);
  }, []);

  const handleSaveName = (e) => {
    e.preventDefault();
    if (!nameInput.trim()) return;
    const cleanName = nameInput.trim().slice(0, 12);
    localStorage.setItem('dino3d_username', cleanName);
    setUsername(cleanName);
    loadLeaderboard();
  };

  const updateLeaderboard = useCallback(async (finalScore) => {
    if (!username) return;
    const list = await submitScore(username, finalScore);
    setLeaderboard(list);
  }, [username]);

  // Keep a ref of status to determine state changes safely in effects
  const prevStatusRef = useRef(status);

  // Mount logic & initial load
  useEffect(() => {
    fetchCounts();
    refreshPlayerCount();
    loadLeaderboard();
  }, [fetchCounts, refreshPlayerCount, loadLeaderboard]);

  // Handle game transitions: updates, plays, leaderboard submissions
  useEffect(() => {
    const prevStatus = prevStatusRef.current;
    if (prevStatus !== status) {
      if (status === 'playing') {
        incrementPlayCount();
        setPreviousHighScore(highScore);
      } else if (status === 'gameover' && score > 0) {
        updateLeaderboard(score).then(() => refreshPlayerCount());
      }
      prevStatusRef.current = status;
    }
  }, [status, score, highScore, incrementPlayCount, updateLeaderboard, refreshPlayerCount]);

  const isNewBest = displayScore > Math.floor(previousHighScore) && displayScore > 0;

  return (
    <>
      {/* HUD - visible during gameplay */}
      {status === 'playing' && (
        <div className="game-hud">
          <div>
            <div className="score-display" id="score-display">
              {String(displayScore).padStart(5, '0')}
            </div>
            <div className="high-score">
              HI <span>{String(displayHigh).padStart(5, '0')}</span>
            </div>
          </div>
        </div>
      )}

      {/* 1. Name Entry Screen (First Visit) */}
      {!username && (status === 'idle' || status === 'gameover') && (
        <div className="game-overlay" id="name-screen">
          <div className="overlay-card" style={{ maxWidth: '450px' }}>
            <div className="overlay-title">ENTER NAME</div>
            <div className="overlay-subtitle">Choose your gamer name</div>
            <form onSubmit={handleSaveName} style={{ width: '100%' }}>
              <input
                type="text"
                className="name-input"
                maxLength="12"
                placeholder="GamerName"
                value={nameInput}
                onChange={(e) => setNameInput(e.target.value.replace(/[^a-zA-Z0-9_]/g, ''))}
                autoFocus
                required
              />
              <button type="submit" className="play-button" style={{ marginTop: '8px' }}>
                CONTINUE
              </button>
            </form>
          </div>
        </div>
      )}

      {/* 2. Start Screen (with Leaderboard) */}
      {username && status === 'idle' && (
        <div className="game-overlay" id="start-screen">
          <div className="overlay-layout">
            <div className="overlay-card-left">
              <div className="overlay-title" style={{ fontSize: 'clamp(24px, 4vw, 36px)' }}>DINECRAFT</div>

              <div style={{ fontSize: '11px', color: 'var(--color-text-muted)', marginBottom: '24px' }}>
                Gamer: <span style={{ color: 'var(--color-green)', fontWeight: 'bold' }}>{username}</span>
                <button className="name-edit-btn" onClick={() => setUsername('')}>
                  Edit
                </button>
              </div>

              <button
                className="play-button"
                id="start-button"
                onClick={() => startGame()}
              >
                ▶ START GAME
              </button>
              <div className="controls-hint">
                <kbd>SPACE</kbd> or <kbd>↑</kbd> to Jump<br />
                <kbd>↓</kbd> to Duck &nbsp;·&nbsp; Tap to play on mobile
              </div>
            </div>

            <div className="leaderboard-container">
              <div className="leaderboard-title">🏆 TOP 50 LEADERBOARD</div>
              <div className="leaderboard-list">
                {leaderboard.length === 0 ? (
                  <div style={{ color: 'var(--color-text-muted)', fontSize: '11px', textAlign: 'center', marginTop: '48px', fontFamily: 'var(--font-pixel)', lineHeight: '1.8' }}>
                    NO SCORES YET.<br />PLAY TO SET A RECORD!
                  </div>
                ) : (
                  leaderboard.map((player, i) => (
                    <div
                      key={player.name}
                      className={`leaderboard-row ${player.name.toUpperCase() === username.toUpperCase() ? 'current-player' : ''}`}
                    >
                      <span className={`leaderboard-rank rank-${i + 1}`}>{i + 1}</span>
                      <span className="leaderboard-name">{player.name}</span>
                      <span className="leaderboard-score">{String(player.score).padStart(5, '0')}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. Game Over Screen (with Leaderboard) */}
      {username && status === 'gameover' && (
        <div className="game-overlay" id="gameover-screen">
          <div className="overlay-layout">
            <div className="overlay-card-left">
              <div className="overlay-title">GAME OVER</div>
              <div className="overlay-score">{String(displayScore).padStart(5, '0')}</div>
              {isNewBest && (
                <div className="overlay-best">★ NEW BEST! ★</div>
              )}
              <div className="high-score" style={{ marginBottom: '24px', textAlign: 'center' }}>
                BEST: <span>{String(displayHigh).padStart(5, '0')}</span>
              </div>
              <button
                className="play-button"
                id="restart-button"
                onClick={() => startGame()}
              >
                ↻ PLAY AGAIN
              </button>
              <div className="controls-hint">
                Press <kbd>SPACE</kbd> to restart
              </div>
            </div>

            <div className="leaderboard-container">
              <div className="leaderboard-title">🏆 TOP 50 LEADERBOARD</div>
              <div className="leaderboard-list">
                {leaderboard.length === 0 ? (
                  <div style={{ color: 'var(--color-text-muted)', fontSize: '11px', textAlign: 'center', marginTop: '48px', fontFamily: 'var(--font-pixel)', lineHeight: '1.8' }}>
                    NO SCORES YET.<br />PLAY TO SET A RECORD!
                  </div>
                ) : (
                  leaderboard.map((player, i) => (
                    <div
                      key={player.name}
                      className={`leaderboard-row ${player.name.toUpperCase() === username.toUpperCase() ? 'current-player' : ''}`}
                    >
                      <span className={`leaderboard-rank rank-${i + 1}`}>{i + 1}</span>
                      <span className="leaderboard-name">{player.name}</span>
                      <span className="leaderboard-score">{String(player.score).padStart(5, '0')}</span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Touch zone for mobile */}
      {status === 'playing' && <div className="touch-zone" />}

      {/* Stats display in bottom right corner */}
      <div className="stats-display">
        PLAYS: {playsCount} &nbsp;·&nbsp; PLAYERS: {uniquesCount}
      </div>
    </>
  );
}
