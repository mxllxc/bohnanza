import { useEffect, useState } from "react";
import { io } from "socket.io-client";

const socket = io("http://localhost:3001");

function App() {
  const [nome, setNome] = useState("");
  const [salaId, setSalaId] = useState("sala123");
  const [entrando, setEntrando] = useState(false);
  const [estado, setEstado] = useState(null);

  useEffect(() => {
    if (entrando) {
      socket.emit("entrarNaSala", { salaId, nome });

      socket.on("estadoAtualizado", (dados) => {
        setEstado(dados);
      });

      // Cleanup
      return () => {
        socket.off("estadoAtualizado");
      };
    }
  }, [entrando, nome]);

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

  console.log(estado);
  
  return (
    <div>
      <h1>Bohnanza Online - Sala: {salaId}</h1>

      {estado && (
        <div>
          <h2>Jogadores na sala:</h2>
          <ul>
            {estado.jogadores.map((jogador) => (
              <li key={jogador.id}>
                <strong>{jogador.nome}</strong>
                <br />
                Cartas na mão:
                <ul>
                  {jogador.mao && jogador.mao.length > 0 ? (
                    jogador.mao.map((carta, idx) => (
                      <li key={idx}>{carta.tipo}</li>
                    ))
                  ) : (
                    <li>Sem cartas</li>
                  )}
                </ul>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default App;
