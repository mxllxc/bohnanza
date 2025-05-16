import { useEffect, useState } from "react";
import { io } from "socket.io-client";

const socket = io("http://localhost:3001");


function App() {
  const [nome, setNome] = useState("");
  const [salaId, setSalaId] = useState("sala123");
  const [socketId, setSocketId] = useState();
  const [entrando, setEntrando] = useState(false);
  const [estado, setEstado] = useState(null);
  const [jogadorTrocaId, setJogadorTrocaId] = useState("");
  const [cartasEnviadas, setCartasEnviadas] = useState([]);
  const [cartasRecebidasTexto, setCartasRecebidasTexto] = useState("");
  const [trocaRecebida, setTrocaRecebida] = useState(null);
  
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

  useEffect(() => {
    const handleTroca = ({ de, cartasEnviadas, cartasRecebidas }) => {
      setTrocaRecebida({ de, cartasEnviadas, cartasRecebidas });
    };

    socket.on("trocaProposta", handleTroca);

    return () => {
      socket.off("trocaProposta", handleTroca);
    };
  }, []);
  
  console.log(estado);

  useEffect(() => {
    socket.on("connect", () => {
      setSocketId(socket.id);
    });
  },[])

  useEffect(() => {
    if (!trocaRecebida) return;
    
    const { de, cartasEnviadas, cartasRecebidas } = trocaRecebida;
    
    const aceitar = window.confirm(
      `${de} quer trocar:\n` +
      `Dar: ${cartasRecebidas.map(c => c.carta.tipo).join(", ")}\n` +
      `Receber: ${cartasEnviadas.map(c => c.carta.tipo).join(", ")}\n\n` +
      `Você aceita?`
    );

    const deJogadorId = estado?.jogadores?.find(j => j.nome === de)?.id;

    if (deJogadorId) {
      socket.emit("responderTroca", {
        salaId,
        aceita: aceitar,
        deJogadorId
      });
    } else {
      console.warn("Não achei o id do jogador que propôs a troca.");
    }

    // Limpa para evitar múltiplos alerts
    setTrocaRecebida(null);
  }, [trocaRecebida]);

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
        <button onClick={() => nome && setEntrando(true)}>Entrar</button>
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

          {estado.cartasViradas?.length > 0 && (
            <div>
              <h3>Cartas Viradas</h3>
              <ul>
                {estado.cartasViradas.map((carta, index) => (
                  <li key={index}>{carta.tipo}</li>
                ))}
              </ul>
            </div>
          )}
          {socketId === estado.turnoAtual && estado.cartasViradas?.length > 0 && (
            <div>
              <h3>Propor Troca</h3>
              <select
                value={jogadorTrocaId}
                onChange={(e) => setJogadorTrocaId(e.target.value)}
              >
                <option value="">Selecione o jogador</option>
                {estado.jogadores
                  .filter((j) => j.id !== socketId)
                  .map((j) => (
                    <option key={j.id} value={j.id}>
                      {j.nome}
                    </option>
                  ))}
              </select>

              <h4>Enviar essas cartas (da mesa e da mão):</h4>
              <div>
                <h5>Cartas Viradas (Mesa):</h5>
                {estado.cartasViradas?.map((carta, index) => (
                  <label key={"mesa-" + index}>
                    <input
                      type="checkbox"
                      checked={cartasEnviadas.some(c => c.origem === "mesa" && c.index === index)}
                      onChange={() => {
                        const existe = cartasEnviadas.some(c => c.origem === "mesa" && c.index === index);
                        if (existe) {
                          setCartasEnviadas(prev => prev.filter(c => !(c.origem === "mesa" && c.index === index)));
                        } else {
                          setCartasEnviadas(prev => [...prev, { origem: "mesa", index, carta: estado.cartasViradas[index] }]);
                        }
                      }}
                    />
                    {estado.cartasViradas[index].tipo}
                  </label>
                ))}
              </div>

              <h4>Pedir essas cartas:</h4>
              <input
                type="text"
                placeholder="Ex: feijao,feijao-verde"
                value={cartasRecebidasTexto}
                onChange={(e) => setCartasRecebidasTexto(e.target.value)}
              />

              <button
                disabled={!jogadorTrocaId || (cartasEnviadas.length === 0 && cartasRecebidasTexto?.trim()?.length === 0)}
                onClick={() => {
                  const cartasRecebidas = cartasRecebidasTexto
                    .split(",")
                    .map((t, index) => ({ origem: "mao", index, carta: {tipo: t} }));

                  socket.emit("proporTroca", {
                    salaId,
                    paraJogadorId: jogadorTrocaId,
                    cartasEnviadas: cartasEnviadas,
                    cartasRecebidas // continua igual
                  });

                  setCartasEnviadas([]);
                  setCartasRecebidasTexto("");
                  setJogadorTrocaId("");
                }}
              >
                Enviar Proposta
              </button>
            </div>
          )}

          {socketId === estado.turnoAtual &&
            estado.jogadores.find(j => j.id === socketId)?.plantiosRealizados >= 1 && (
              <button onClick={() => socket.emit("virarCartas", salaId)}>
                Virar 2 cartas
              </button>
          )}

          <div style={{display: 'flex', flexDirection: 'column'}}>
            <h5>Cartas da Sua Mão:</h5>
            {estado.jogadores.find(j => j.id === socketId)?.mao?.map((carta, index) => (
              <label key={"mao-" + index}>
                <input
                  type="checkbox"
                  checked={cartasEnviadas.some(c => c.origem === "mao" && c.index === index)}
                  onChange={() => {
                    const existe = cartasEnviadas.some(c => c.origem === "mao" && c.index === index);
                    if (existe) {
                      setCartasEnviadas(prev => prev.filter(c => !(c.origem === "mao" && c.index === index)));
                    } else {
                      setCartasEnviadas(prev => [...prev, { origem: "mao", index, carta }]);
                    }
                  }}
                />
                {carta.tipo}
              </label>
            ))}
          </div>

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
                  : `${campo[0]?.tipo} (${campo.length} cartas)`}
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
