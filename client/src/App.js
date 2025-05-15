import { useEffect, useState } from "react";
import { io } from "socket.io-client";

const socket = io("http://localhost:3001");

function App() {
  const [nome, setNome] = useState("");
  const [entrando, setEntrando] = useState(false);
  const [estado, setEstado] = useState(null);

  useEffect(() => {
    if (entrando) {
      socket.emit("entrarNaSala", { salaId: "sala123", nome });

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
        <button onClick={() => nome.trim() && setEntrando(true)}>Entrar</button>
      </div>
    );
  }
  return (
    <div>
      <h1>Bohnanza Online</h1>
      {estado && (
        <div>
          Jogadores na sala:
          <ul>
            {estado.jogadores.map((jogador) => (
              <li key={jogador.id}>{jogador.nome}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

export default App;
