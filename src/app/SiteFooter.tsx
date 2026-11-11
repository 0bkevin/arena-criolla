import type { RefObject } from "react";
import { Github } from "lucide-react";
import { assetUrl } from "../game/assets/asset-url";

export function SiteFooter({ ref }: { ref: RefObject<HTMLElement | null> }) {
  return (
    <footer className="site-footer page-width" ref={ref}>
      <span className="footer-brand">
        <img
          src={assetUrl("/assets/arena-icon.svg")}
          width="26"
          height="26"
          alt=""
        />
        <span className="footer-brand-name">
          ARENA <span>CRIOLLA</span>
        </span>
      </span>
      <a className="footer-acknowledgements" href="/agradecimientos">
        Agradecimientos
      </a>
      <p className="footer-credit">
        Hecho por{" "}
        <a
          href="https://kevinbravo.com"
          target="_blank"
          rel="noopener noreferrer"
        >
          Kevin Bravo
        </a>
        <a
          className="footer-github-link"
          href="https://github.com/0bkevin/arena-criolla"
          target="_blank"
          rel="noopener noreferrer"
          aria-label="Repositorio de Arena Criolla en GitHub"
        >
          <Github aria-hidden="true" size={16} />
        </a>
      </p>
    </footer>
  );
}
