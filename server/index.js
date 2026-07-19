require("dotenv").config();
const http = require("http");
const { Server } = require("socket.io");
const { createApp } = require("./src/app");
const { attachSocketHandlers } = require("./src/sockets");

const app = createApp();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: "*" } });

attachSocketHandlers(io);

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => console.log(`StudyRoom server listening on port ${PORT}`));
