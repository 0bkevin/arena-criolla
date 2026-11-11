import type { preloadAssets } from "../../assets/assets";

export type Assets = Awaited<ReturnType<typeof preloadAssets>>;
