import { useEffect, useState } from 'react';
import Menu from './components/Menu.jsx';
import Lobby from './components/Lobby.jsx';
import GameScreen from './components/GameScreen.jsx';
import { useSinglePlayerGame } from './hooks/useSinglePlayerGame.js';
import { useMultiplayer } from './hooks/useMultiplayer.js';

const NAME_KEY = 'domino.playerName';

function SinglePlayer({ playerName, difficulty, onExit }) {
  const { view, actions } = useSinglePlayerGame(playerName, difficulty);
  return (
    <GameScreen
      view={view}
      onPlay={actions.play}
      onDraw={actions.draw}
      onPass={actions.pass}
      onNextRound={actions.nextRound}
      onNewMatch={actions.newMatch}
      onExit={onExit}
    />
  );
}

function Multiplayer({ playerName, onExit }) {
  const { connected, room, view, isHost, error, notice, closedReason, actions } =
    useMultiplayer(playerName);

  // Relógio para a contagem regressiva de reconexão.
  const [now, setNow] = useState(Date.now());
  const pausedDeadline = view?.paused?.deadline;
  useEffect(() => {
    if (!pausedDeadline) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [pausedDeadline]);

  const inGame = view && room?.status === 'playing';

  if (!inGame) {
    return (
      <Lobby
        connected={connected}
        room={room}
        isHost={isHost}
        error={error}
        closedReason={closedReason}
        actions={actions}
        onBack={onExit}
      />
    );
  }

  const gameView = {
    ...view,
    paused: view.paused
      ? {
          name: view.paused.name,
          secondsLeft: Math.max(0, Math.ceil((view.paused.deadline - now) / 1000)),
        }
      : null,
  };

  return (
    <>
      {notice && <div className="notice">{notice}</div>}
      {error && (
        <div className="notice error" onClick={actions.dismissError}>
          {error}
        </div>
      )}
      <GameScreen
        view={gameView}
        onPlay={actions.play}
        onDraw={actions.draw}
        onPass={actions.pass}
        onNextRound={isHost ? actions.nextRound : undefined}
        onNewMatch={isHost ? actions.newMatch : undefined}
        onExit={() => {
          actions.leave();
          onExit();
        }}
      />
    </>
  );
}

export default function App() {
  const [screen, setScreen] = useState({ name: 'menu' });
  const goMenu = () => setScreen({ name: 'menu' });

  if (screen.name === 'single') {
    return (
      <SinglePlayer
        key={screen.gameId}
        playerName={screen.playerName}
        difficulty={screen.difficulty}
        onExit={goMenu}
      />
    );
  }

  if (screen.name === 'multi') {
    return <Multiplayer playerName={screen.playerName} onExit={goMenu} />;
  }

  return (
    <Menu
      initialName={localStorage.getItem(NAME_KEY) || ''}
      onStartSingle={(playerName, difficulty) => {
        localStorage.setItem(NAME_KEY, playerName);
        setScreen({ name: 'single', playerName, difficulty, gameId: Date.now() });
      }}
      onGoMultiplayer={(playerName) => {
        localStorage.setItem(NAME_KEY, playerName);
        setScreen({ name: 'multi', playerName });
      }}
    />
  );
}
