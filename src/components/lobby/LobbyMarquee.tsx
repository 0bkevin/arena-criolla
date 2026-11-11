const desktopBanner = new URL(
  "../../assets/lobby-cast-banner.webp",
  import.meta.url,
).href;
const tabletBanner = new URL(
  "../../assets/lobby-cast-banner-tablet.webp",
  import.meta.url,
).href;
const mobileBanner = new URL(
  "../../assets/lobby-cast-banner-mobile.webp",
  import.meta.url,
).href;

export function LobbyMarquee() {
  return (
    <section className="arcade-marquee" aria-labelledby="lobby-banner-title">
      <h1 id="lobby-banner-title" className="sr-only">
        Elige tus luchadores
      </h1>
      <picture className="marquee-art" aria-hidden="true">
        <source
          media="(max-width: 600px)"
          srcSet={mobileBanner}
          width="1280"
          height="427"
        />
        <source
          media="(max-width: 1100px)"
          srcSet={tabletBanner}
          width="1983"
          height="308"
        />
        <img
          src={desktopBanner}
          alt=""
          width="2172"
          height="248"
          loading="eager"
          fetchPriority="high"
          decoding="async"
        />
      </picture>
    </section>
  );
}
