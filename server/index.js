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

// Define o baralho base do Bohnanza
const baralhoBase = [
  { tipo: "Feijão Vermelho", quantidade: 24 },
  { tipo: "Feijão Preto", quantidade: 22 },
  { tipo: "Feijão Verde", quantidade: 20 },
  { tipo: "Feijão Amarelo", quantidade: 18 },
  { tipo: "Feijão Marrom", quantidade: 16 },
  { tipo: "Feijão Azul", quantidade: 14 },
  { tipo: "Feijão Roxo", quantidade: 12 },
  { tipo: "Feijão Branco", quantidade: 10 }
];

const salas = {}; // Aqui ficam os dados das partidas

// Função para criar e embaralhar o baralho
function criarBaralho() {
  const baralho = [];

  baralhoBase.forEach(({ tipo, quantidade }) => {
    for (let i = 0; i < quantidade; i++) {
      baralho.push({ tipo });
    }
  });

  // Embaralhar (Fisher-Yates)
  for (let i = baralho.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [baralho[i], baralho[j]] = [baralho[j], baralho[i]];
  }

  return baralho;
}

io.on("connection", (socket) => {

  socket.on("entrarNaSala", ({ salaId, nome }) => {
    if (!salas[salaId]) {
      salas[salaId] = {
        jogadores: [],
        baralho: criarBaralho(), // já cria o baralho na criação da sala
        estado: "esperando",
        turnoAtual: null, // ID do jogador da vez
      };
    }

    const sala = salas[salaId];

    // Evita adicionar o mesmo jogador duas vezes
    if (!sala.jogadores.find(j => j.id === socket.id)) {
      const jogador = { id: socket.id, nome, mao: [], campos: [[], []] };

      // Dá 5 cartas ao jogador novo
      for (let i = 0; i < 5; i++) {
        const carta = sala.baralho.pop();
        if (carta) jogador.mao.push(carta);
      }

      sala.jogadores.push(jogador);
      socket.join(salaId);
    }

    // Marca que o jogo começou se ainda estiver como "esperando"
    if (sala.estado === "esperando") {
      sala.estado = "em andamento";
      sala.turnoAtual = sala.jogadores[0].id;
    }

    sala.jogadores.forEach((jogador) => {
      const estadoPersonalizado = {
        jogadores: sala.jogadores.map(j => ({
          id: j.id,
          nome: j.nome,
          mao: j.id === jogador.id ? j.mao : [], // só mostra a própria mão
          campos: [[], []]
        })),
        estado: sala.estado,
        cartasRestantes: sala.baralho.length,
        turnoAtual: sala.turnoAtual
      };

      io.to(jogador.id).emit("estadoAtualizado", estadoPersonalizado);
    });
  });

  socket.on("passarTurno", (salaId) => {
    const sala = salas[salaId];
    if (!sala) return;

    if (socket.id !== sala.turnoAtual) return; // segurança

    const idxAtual = sala.jogadores.findIndex(j => j.id === sala.turnoAtual);
    const proximo = (idxAtual + 1) % sala.jogadores.length;

    sala.turnoAtual = sala.jogadores[proximo].id;

    io.to(salaId).emit("estadoAtualizado", sala);
  });

  socket.on("plantarCarta", ({ salaId, campoIndex }) => {
    const sala = salas[salaId];
    const jogador = sala?.jogadores.find(j => j.id === socket.id);
    if (!sala || !jogador) return;

    if (typeof jogador.plantiosRealizados === "undefined") {
      jogador.plantiosRealizados = 0;
    }

    // Impede plantar mais que 2 vezes
    if (jogador.plantiosRealizados >= 2) return;

    const carta = jogador.mao[0];
    if (!carta) return;

    const campo = jogador.campos[campoIndex];
    if (!campo) return;

    // Verifica se pode plantar no campo
    if (campo.length === 0 || campo[0].tipo === carta.tipo) {
      campo.push(carta);
      jogador.mao.shift();
      jogador.plantiosRealizados += 1;
      io.to(salaId).emit("estadoAtualizado", sala);
    } else {
      console.log("Tipo incompatível com o campo.");
    }
  });

  socket.on("disconnect", () => {
    console.log("Jogador desconectou:", socket.id);

    for (const salaId in salas) {
      const sala = salas[salaId];
      const idx = sala.jogadores.findIndex((j) => j.id === socket.id);
      if (idx !== -1) {
        sala.jogadores.splice(idx, 1);
        io.to(salaId).emit("estadoAtualizado", sala);
      }
    }
  });
});


server.listen(3001, () => {
  console.log("Servidor rodando na porta 3001");
});
