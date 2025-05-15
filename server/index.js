const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "http://localhost:3000", // Porta do React
    methods: ["GET", "POST"]
  }
});

const salas = {}; // Aqui ficam os dados das partidas

io.on("connection", (socket) => {
  console.log("Novo jogador conectado:", socket.id);

  socket.on("entrarNaSala", ({ salaId, nome }) => {
    if (!salas[salaId]) {
      salas[salaId] = {
        jogadores: [],
        baralho: [],
        estado: "esperando",
      };
    }

    salas[salaId].jogadores.push({ id: socket.id, nome });
    socket.join(salaId);

    io.to(salaId).emit("estadoAtualizado", salas[salaId]);
  });

  socket.on("disconnect", () => {
    // Remover o jogador da sala
    for (const salaId in salas) {
      salas[salaId].jogadores = salas[salaId].jogadores.filter(j => j.id !== socket.id);

      // Se a sala ficar vazia, apaga
      if (salas[salaId].jogadores.length === 0) {
        delete salas[salaId];
      } else {
        io.to(salaId).emit("estadoAtualizado", salas[salaId]);
      }
    }
  });
});

server.listen(3001, () => {
  console.log("Servidor rodando na porta 3001");
});
