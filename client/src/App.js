import { useEffect, useState } from "react";
import { io } from "socket.io-client";

const socket = io("http://localhost:3001");


function App() {
  const [nome, setNome] = useState("");
  const [salaId, setSalaId] = useState("sala123");
  const [socketId, setSocketId] = useState();
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
  
  console.log(estado);
  console.log(socketId);

  useEffect(() => {
    socket.on("connect", () => {
      setSocketId(socket.id);
    });
  },[])

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
                {jogador.nome}
                {jogador.id === socketId && " (Você)"}
                {jogador.id === estado.turnoAtual && " 🎯 Turno"}
              </li>
            ))}
          </ul>

          <h2>Minhas cartas:</h2>
          <ul>
            {estado.jogadores.find(j => j.id === socketId)?.mao.map((carta, i) => (
              <div key={i}>{carta.tipo}</div>
            ))}
          </ul>

          {socketId === estado.turnoAtual && (
            <div>
              <button onClick={() => socket.emit("plantarCarta", { salaId, campoIndex: 0 })}>
                Plantar no Campo 1
              </button>
              <button onClick={() => socket.emit("plantarCarta", { salaId, campoIndex: 1 })}>
                Plantar no Campo 2
              </button>
            </div>
          )}

          <div>
            <h3>Seus Campos</h3>
            {estado.jogadores.find(j => j.id === socketId)?.campos.map((campo, i) => (
              <div key={i}>
                <strong>Campo {i + 1}:</strong>
                {campo.length === 0
                  ? "Vazio"
                  : `${campo[0].tipo} (${campo.length} cartas)`}
              </div>
            ))}
          </div>

          {socketId === estado.turnoAtual && (
            <button onClick={() => socket.emit("passarTurno", salaId)}>
              Passar Turno
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default App;
