import { Gamepad2, Keyboard, Smartphone, Swords, Zap } from "lucide-react";
import { Modal } from "./Modal";

export function Help({ onClose }: { onClose: () => void }) {
  return (
    <Modal title="El manual del pana" wide onClose={onClose}>
      <p className="modal-intro">
        Fácil de empezar. Con suficientes trucos para pedir una revancha.
      </p>
      <div className="rules-grid">
        <div>
          <Swords />
          <h3>Dos vidas. Una victoria.</h3>
          <p>
            Deja al rival sin vida o sácalo de la arena. Cada caída cuesta una
            vida. Gana quien elimine las dos; a los 90 segundos, decide la vida
            restante.
          </p>
        </div>
        <div>
          <Zap />
          <h3>Salta, esquiva, conecta.</h3>
          <p>
            Puedes saltar dos veces. Un rival con poca vida sale lanzado más
            lejos. El especial usa 25 de energía; golpear y recibir golpes
            recarga la barra.
          </p>
        </div>
      </div>
      <h3 className="help-section">
        <Smartphone size={18} /> En el teléfono
      </h3>
      <p className="help-note">
        Juega en horizontal. Usa las flechas con el pulgar izquierdo y los
        ataques con el derecho; puedes mover y golpear al mismo tiempo. Saltar
        permite un segundo salto en el aire. Bajar te deja atravesar una
        plataforma, Esquiva te saca del peligro y Bloqueo funciona al mantenerlo
        pulsado. Especial necesita 25 de energía; Súper se desbloquea con tres
        victorias y necesita 75. Los botones iluminados responden a cada toque.
      </p>
      <h3 className="help-section">
        <Keyboard size={18} /> Controles de teclado
      </h3>
      <div className="controls-table">
        <div className="table-heading">
          <span>ACCIÓN</span>
          <span>JUGADOR 1 / EN LÍNEA</span>
          <span>JUGADOR 2 LOCAL</span>
        </div>
        {[
          ["Mover", "A / D", "← / →"],
          ["Saltar (doble salto)", "W", "↑"],
          ["Bajar de plataforma", "S", "↓"],
          ["Golpe ligero", "J", "1"],
          ["Golpe fuerte", "K", "2"],
          ["Ataque especial", "L", "3"],
          ["Bloquear", "U (mantener)", "0 (mantener)"],
          ["Esquivar", "Shift izquierdo", "Enter"],
          ["Definitiva", "I", "5"],
          ["Pausa / menú", "Esc", "Esc"],
        ].map(([action, first, second]) => (
          <div key={action}>
            <span>{action}</span>
            <span>
              <kbd>{first}</kbd>
            </span>
            <span>
              <kbd>{second}</kbd>
            </span>
          </div>
        ))}
      </div>
      <p className="help-note">
        Los números del jugador 2 funcionan tanto en la fila superior como en el
        teclado numérico.
      </p>
      <div className="gamepad-note">
        <Gamepad2 size={22} />
        <div>
          <strong>También puedes conectar un mando.</strong>
          <p>
            Stick: mover · A: saltar · X: ligero · B: fuerte · Y: especial · LB:
            bloquear · RB: esquivar · RT: definitiva.
          </p>
        </div>
      </div>
      <h3 className="help-section">
        <Zap size={18} /> Aprende los combos
      </h3>
      <p className="help-note">
        J → K está disponible desde el inicio. Gana una pelea con un personaje
        para desbloquear J → J → K. Con tres victorias desbloqueas su
        definitiva: I, con 75 de energía. Ejecuta cada golpe al terminar la
        recuperación anterior y completa la secuencia en 2,5 segundos.
      </p>
      <p className="help-note">
        En el celular aparecen controles táctiles. Para dos jugadores en el
        mismo equipo, usa teclado o dos mandos.
      </p>
    </Modal>
  );
}
