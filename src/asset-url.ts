import versions from "../shared/asset-versions.json";

export function assetUrl(path: string): string {
  const version = (versions as Record<string, string>)[path];
  return version ? `${path}?v=${version}` : path;
}
