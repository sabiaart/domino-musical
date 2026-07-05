import { io } from 'socket.io-client';

// URL do servidor multiplayer: VITE_SERVER_URL ou o mesmo host na porta 3210.
export function getServerUrl() {
  return (
    import.meta.env.VITE_SERVER_URL ||
    `${window.location.protocol}//${window.location.hostname}:3210`
  );
}

// Em hospedagem estática (ex.: GitHub Pages) sem VITE_SERVER_URL definido,
// não existe servidor multiplayer para conectar — a UI avisa em vez de
// ficar "conectando" para sempre.
export function isMultiplayerConfigured() {
  if (import.meta.env.VITE_SERVER_URL) return true;
  const host = window.location.hostname;
  return (
    host === 'localhost' ||
    host === '127.0.0.1' ||
    /^192\.168\./.test(host) ||
    /^10\./.test(host)
  );
}

let socket = null;

export function getSocket() {
  if (!socket) {
    socket = io(getServerUrl(), { autoConnect: false });
  }
  return socket;
}

// Sessão persistida para reconexão (código da sala + identidade do jogador).
const SESSION_KEY = 'domino.session';

export function saveSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function loadSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY));
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY);
}
