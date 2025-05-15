import { useEffect, useState } from "react";
import { io } from "socket.io-client";

const socket = io("http://localhost:3001");

function App() {
  const [estado, setEstado] = useState(null);

  useEffect(() => {
    socket.connect(); // Garante que reconecte se estiver desconectado

    socket.emit("entrarNaSala", { salaId: "sala123", nome: "Robson" });

    socket.on("estadoAtualizado", (dados) => {
      setEstado(dados);
    });

    return () => {
      socket.off("estadoAtualizado");
      socket.disconnect();
    };
  }, []);

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
