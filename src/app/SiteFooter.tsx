import type { RefObject } from "react";
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
      </p>
    </footer>
  );
}
