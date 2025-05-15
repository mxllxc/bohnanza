import { useEffect, useState } from "react";
import { io } from "socket.io-client";

const socket = io("http://localhost:3001");

function App() {
  const [nome, setNome] = useState("");
  const [salaId, setSalaId] = useState("sala123");
  const [entrando, setEntrando] = useState(false);
  const [estado, setEstado] = useState(null);
  const [meuId, setMeuId] = useState("");

  useEffect(() => {
    if (entrando) {
      socket.emit("entrarNaSala", { salaId, nome });

      socket.on("estadoAtualizado", (dados) => {
        setEstado(dados);
        setMeuId(socket.id);
      });

      // Cleanup
      return () => {
        socket.off("estadoAtualizado");
      };
    }
  }, [entrando, nome]);

  const meuJogador = estado?.jogadores.find(j => j.id === meuId)
  
  console.log(estado);

  if (!entrando) {
    return (
      <div>
        <h2>Digite seu nome para entrar na sala</h2>
        <input
          type="text"
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          placeholder="Seu nome"
        />
        <input
          type="text"
          value={salaId}
          onChange={(e) => setSalaId(e.target.value)}
          placeholder="Seu nome"
        />
        <button onClick={() => nome.trim() && setEntrando(true)}>Entrar</button>
      </div>
    );
  }
  
  return (
    <div>
      <h1>Bohnanza Online - Sala: {salaId}</h1>

      {estado && (
        <div>
          <h2>Jogadores na sala:</h2>
          <ul>
            {estado.jogadores.map((jogador) => (
              <li key={jogador.id}>
                {jogador.id === meuId ? jogador.nome + " (Você)" : jogador.nome}
              </li>
            ))}
          </ul>

          {/* MOSTRA APENAS SUAS CARTAS */}
          {meuJogador && (
            <div>
              <h2>Suas cartas:</h2>
              <ul>
                {meuJogador.mao.map((carta, index) => (
                  <li key={index}>{carta.tipo}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
