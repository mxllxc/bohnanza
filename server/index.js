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

function removerCartas(jogador, cartas, sala) {
  for (const carta of cartas) {
    if (carta.origem === "mao") {
      const index = jogador.mao.findIndex(c => c.tipo === carta.carta.tipo);
      if (index !== -1) jogador.mao.splice(index, 1);
    } else if (carta.origem === "mesa") {
      const index = sala.cartasViradas.findIndex(c => c.tipo === carta.carta.tipo);
      if (index !== -1) sala.cartasViradas.splice(index, 1);
    }
  }
}

function plantarCartas(jogador, cartas) {
  cartas.forEach(carta => {
    const campo1 = jogador.campos[0];
    const campo2 = jogador.campos[1];
    
    const podePlantarNoCampo1 = campo1.length === 0 || campo1.every(c => c.tipo === carta.carta.tipo);
    const podePlantarNoCampo2 = campo2.length === 0 || campo2.every(c => c.tipo === carta.carta.tipo);

    if (podePlantarNoCampo1) {
      campo1.push(carta.carta);
    } else if (podePlantarNoCampo2) {
      campo2.push(carta.carta);
    } else {
      // Vender o campo com menos cartas
      const campoParaVender = campo1.length >= campo2.length ? campo1 : campo2;

      // Aqui você pode adicionar lógica de pontuação se quiser TODO
      campoParaVender.length = 0; // limpa o campo (vende)
      campoParaVender.push(carta.carta); // planta a nova carta no campo limpo
    }
  });
}

io.on("connection", (socket) => {

  socket.on("entrarNaSala", ({ salaId, nome }) => {
    if (!salas[salaId]) {
      salas[salaId] = {
        jogadores: [],
        baralho: criarBaralho(), // já cria o baralho na criação da sala
        estado: "esperando",
        turnoAtual: null, // ID do jogador da vez
        cartasViradas: [],
        trocasPendentes: []
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
          campos: j.id === jogador.id ? j.campos : [[],[]],
          plantiosRealizados: j.plantiosRealizados || 0
        })),
        estado: sala.estado,
        cartasRestantes: sala.baralho.length,
        turnoAtual: sala.turnoAtual,
        cartasViradas: sala.cartasViradas,
        trocasPendentes: sala.trocasPendentes,
      };

      io.to(jogador.id).emit("estadoAtualizado", estadoPersonalizado);
    });
  });

  socket.on("passarTurno", (salaId) => {
    const sala = salas[salaId];
    if (!sala) return;

    if (socket.id !== sala.turnoAtual) return; // segurança

    const idxAtual = sala.jogadores.findIndex(j => j.id === sala.turnoAtual);
    const jogadorAtual = sala.jogadores[idxAtual];

    // 🃏 Dá 3 cartas do topo do baralho para o jogador atual
    for (let i = 0; i < 3; i++) {
      const carta = sala.baralho.shift();
      if (carta) {
        jogadorAtual.mao.push(carta);
      }
    }

    // 🔁 Passa o turno
    const proximo = (idxAtual + 1) % sala.jogadores.length;
    sala.turnoAtual = sala.jogadores[proximo].id;

    // 🧹 Limpa mesa e reset de plantios
    sala.cartasViradas = [];
    sala.jogadores.forEach(j => {
      j.plantiosRealizados = 0;
    });

    // 📡 Envia novo estado
    io.to(salaId).emit("estadoAtualizado", sala);
  });

  socket.on("plantarCarta", ({ salaId, campoIndex }) => {
    const sala = salas[salaId];
    const jogador = sala?.jogadores.find(j => j.id === socket.id);
    if (!sala || !jogador || sala.cartasViradas.length > 0) return;

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

  socket.on("plantarCartasMesa", ({ salaId, cartas }) => {
    const sala = salas[salaId];
    const jogador = sala.jogadores.find(j => j.id === socket.id)
    console.log(jogador)
    removerCartas(jogador, cartas, sala);
    plantarCartas(jogador, cartas)
    io.to(salaId).emit("estadoAtualizado", sala);
  });

  socket.on("virarCartas", (salaId) => {
    const sala = salas[salaId];
    const jogador = sala?.jogadores.find(j => j.id === socket.id);
    if (!sala || !jogador || sala.cartasViradas.length > 0) return;

    if (socket.id !== sala.turnoAtual) return; // Apenas quem está no turno

    if ((jogador.plantiosRealizados || 0) < 1) return; // Precisa ter plantado ao menos 1x

    // Virar 2 cartas do topo do baralho
    sala.cartasViradas = [];
    for (let i = 0; i < 2; i++) {
      const carta = sala.baralho.pop();
      if (carta) sala.cartasViradas.push(carta);
    }

    io.to(salaId).emit("estadoAtualizado", sala);
  });

  socket.on("proporTroca", ({ salaId, paraJogadorId, cartasEnviadas, cartasRecebidas }) => {
    const sala = salas[salaId];
    const de = sala.jogadores.find(j => j.id === socket.id);
    const para = sala.jogadores.find(j => j.id === paraJogadorId);

    if (!sala || !de || !para) return;
    if (socket.id !== sala.turnoAtual) return;

    // Ex: validar se cartas fazem parte das 2 cartas da mesa
    // ou de cartas extras permitidas
    sala.trocasPendentes.push({
      de: de.id,
      para: para.id,
      cartasEnviadas,
      cartasRecebidas,
      status: "pendente"
    });

    // Notificar os dois envolvidos
    io.to(para.id).emit("trocaProposta", {
      ...sala,
      de: de.nome,
      cartasEnviadas,
      cartasRecebidas
    });
  });

  socket.on("responderTroca", ({ salaId, aceita, deJogadorId }) => {
    const sala = salas[salaId];
    const proposta = sala.trocasPendentes.find(t => t.de === deJogadorId && t.para === socket.id && t.status === 'pendente');
    const para = sala.jogadores.find(j => j.id === socket.id);
    const de = sala.jogadores.find(j => j.id === deJogadorId);

    if (!sala || !proposta || !para || !de) return;
    if (aceita) {
      // Remover cartas de cada jogador
      removerCartas(de, proposta.cartasEnviadas.filter(c => c.origem === "mao"), sala);
      removerCartas(de, proposta.cartasEnviadas.filter(c => c.origem === "mesa"), sala);
      removerCartas(para, proposta.cartasRecebidas.filter(c => c.origem === "mao"), sala);
      removerCartas(para, proposta.cartasRecebidas.filter(c => c.origem === "mesa"), sala);

      // Plantar diretamente no campo do outro
      plantarCartas(para, proposta.cartasEnviadas);
      plantarCartas(de, proposta.cartasRecebidas);

      proposta.status = "aceita";
    } else {
      proposta.status = "recusada";
    }
    io.to(salaId).emit("estadoAtualizado", sala);
  });

  socket.on("disconnect", () => {
    console.log("Jogador desconectou:", socket.id);

    for (const salaId in salas) {
      const sala = salas[salaId];
      const idx = sala.jogadores.findIndex((j) => j.id === socket.id);

      if (idx !== -1) {
        sala.jogadores.splice(idx, 1);

        if (sala.jogadores.length === 0) {
          delete salas[salaId];
        } else {
          io.to(salaId).emit("estadoAtualizado", sala);
        }
      }
    }
  });
});


server.listen(3001, () => {
  console.log("Servidor rodando na porta 3001");
});
