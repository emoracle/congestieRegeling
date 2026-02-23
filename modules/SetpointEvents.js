// @ts-check
const { EventEmitter } = require("node:events");
const dgram = require("node:dgram");

const EVENT_NAME = "participant.setpoint.changed";
const DEFAULT_HOST = "127.0.0.1";
const DEFAULT_PORT = 41234;
const bus = new EventEmitter();

/**
 * Parse integer env var with fallback.
 * @param {string | undefined} value
 * @param {number} fallback
 * @returns {number}
 */
function parseEnvInt(value, fallback) {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

/**
 * Emit event in-process and over UDP (best effort).
 * @param {Object} event
 * @returns {void}
 */
function emitSetpointChanged(event) {
  const payload = {
    type: EVENT_NAME,
    emittedAt: Date.now(),
    ...event,
  };

  bus.emit(EVENT_NAME, payload);

  if (process.env.PARTICIPANT_EVENTS_UDP_DISABLED === "1") {
    return;
  }

  const host = process.env.PARTICIPANT_EVENTS_HOST || DEFAULT_HOST;
  const port = parseEnvInt(process.env.PARTICIPANT_EVENTS_PORT, DEFAULT_PORT);

  try {
    const socket = dgram.createSocket("udp4");
    const message = Buffer.from(JSON.stringify(payload));
    socket.send(message, port, host, () => socket.close());
    socket.on("error", () => socket.close());
  } catch {
    // Best effort: event emission must not break the control loop.
  }
}

/**
 * Subscribe to in-process setpoint-change events.
 * @param {(event: Object) => void} listener
 * @returns {() => void}
 */
function onSetpointChanged(listener) {
  bus.on(EVENT_NAME, listener);
  return () => bus.off(EVENT_NAME, listener);
}

module.exports = {
  EVENT_NAME,
  DEFAULT_HOST,
  DEFAULT_PORT,
  emitSetpointChanged,
  onSetpointChanged,
};
