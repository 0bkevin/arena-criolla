// Production no longer exposes /create. Mount the real editor only in an
// isolated deterministic QA tab before running the account/creator probes.
let remount;
export async function mountCreatorForQa() {
  const fixture = await (await fetch("/api/qa/fixture")).json();
  if (fixture.provider !== "deterministic")
    throw new Error("Requires the isolated deterministic creator QA server");
  if (remount) return { remount };
  const [{ default: React }, { createRoot }, { flushSync }, { CreatorStudio }] =
    await Promise.all([
      import("react"),
      import("react-dom/client"),
      import("react-dom"),
      import("../src/components/CreatorStudio"),
    ]);
  const appRoot = document.getElementById("root");
  appRoot.id = "arena-app-before-creator-regressions";
  appRoot.hidden = true;
  const fixtureRoot = document.createElement("div");
  fixtureRoot.id = "root";
  document.body.append(fixtureRoot);
  const root = createRoot(fixtureRoot);
  const render = () =>
    root.render(
      React.createElement(
        React.StrictMode,
        null,
        React.createElement(CreatorStudio, {
          onBack: () => location.reload(),
          onCatalogChange: async () => {},
        }),
      ),
    );
  remount = () => {
    flushSync(() => root.render(null));
    render();
  };
  render();
  return { remount };
}
