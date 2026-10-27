import { ArrowUpRight, Heart } from "lucide-react";
import { assetUrl } from "../asset-url";
import "../acknowledgements.css";

export function Acknowledgements() {
  return (
    <div className="acknowledgements-page">
      <header className="acknowledgements-header">
        <a
          className="acknowledgements-brand"
          href="/"
          aria-label="Arena Criolla, inicio"
        >
          <img
            src={assetUrl("/assets/arena-icon.svg")}
            width="32"
            height="32"
            alt=""
          />
          <span>
            ARENA <span>CRIOLLA</span>
          </span>
        </a>
        <a href="/">Volver al juego</a>
      </header>

      <main className="acknowledgements-content">
        <h1>Agradecimientos</h1>
        <p className="acknowledgements-intro">
          <strong>Arena Criolla</strong> también es de quienes le han dado una
          mano. Gracias a todas las personas y comunidades que, de una forma u
          otra, han contribuido a que este juego siga creciendo.
        </p>

        <section aria-labelledby="asilo-digital-heading">
          <h2 id="asilo-digital-heading">
            <a
              href="https://builders.asilodigital.com/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Comunidad de Asilo Digital
              <ArrowUpRight size={18} aria-hidden="true" />
            </a>
          </h2>
          <p>
            Gracias a los chicos de Asilo Digital por darle difusión a Arena
            Criolla y ser los primeros testers. Gracias por sumarse desde el
            principio y ayudar a poner el juego a prueba.
          </p>
        </section>

        <section aria-labelledby="giuseppe-heading">
          <h2 id="giuseppe-heading">
            <a
              href="https://twitter.com/ggangix"
              target="_blank"
              rel="noopener noreferrer"
            >
              Giuseppe Gangi
              <ArrowUpRight size={18} aria-hidden="true" />
            </a>
          </h2>
          <p>
            Gracias por donar el dominio <strong>arenacriolla.com</strong> y
            darle una casa propia a este proyecto. Un aporte que hoy forma parte
            de cada visita al juego.
          </p>
        </section>

        <p className="acknowledgements-closing">
          <Heart size={19} aria-hidden="true" />
          Gracias por ser parte de Arena Criolla.
        </p>
      </main>

      <footer className="acknowledgements-footer">
        Hecho por{" "}
        <a
          href="https://kevinbravo.com"
          target="_blank"
          rel="noopener noreferrer"
        >
          Kevin Bravo
        </a>
      </footer>
    </div>
  );
}
