// @ts-check
const dgram = require("node:dgram");
const { DEFAULT_HOST, DEFAULT_PORT, EVENT_NAME } = require("./modules/SetpointEvents");

const host = process.env.PARTICIPANT_EVENTS_HOST || DEFAULT_HOST;
const port = Number.parseInt(process.env.PARTICIPANT_EVENTS_PORT || String(DEFAULT_PORT), 10);
const socket = dgram.createSocket("udp4");

socket.on("listening", () => {
  const address = socket.address();
  console.log(`Participants listener actief op udp://${address.address}:${address.port}`);
  console.log(`Wacht op events van type: ${EVENT_NAME}`);
});

socket.on("message", (message, remote) => {
  try {
    const event = JSON.parse(message.toString("utf8"));
    console.log(`[${new Date().toISOString()}] ${remote.address}:${remote.port} ${JSON.stringify(event)}`);
  } catch (error) {
    console.error("Ongeldig event ontvangen:", error?.message || error);
  }
});

socket.on("error", (error) => {
  console.error("Listener fout:", error.message);
});

socket.bind(port, host);
