// lib/modrinth.ts
import { prisma } from "@/lib/prisma"

const MODRINTH_API_URL = 'https://api.modrinth.com/v2';

export interface ModrinthProject {
  project_id: string;
  title: string;
  description: string;
  icon_url: string;
  server_side: 'required' | 'optional' | 'unsupported';
  client_side: 'required' | 'optional' | 'unsupported';
  categories: string[];
}

export interface ModDownloadFile {
  url: string;
  filename: string;
}

export async function fetchWeeklyCandidates(limit: number = 300): Promise<ModrinthProject[]> {
  const settings = await prisma.systemSettings.findUnique({ where: { id: "default" } });
  if (!settings) throw new Error("System settings not configured. Please visit the Admin panel.");

  const { serverVersion, modLoader, allowedCategories } = settings;
  const installedMods = await prisma.installedMod.findMany({ where: { isActive: true } });
  const installedModIds = installedMods.map(m => m.modrinthId);
  const categoryArray = allowedCategories.split(",").map(c => c.trim().toLowerCase());
  const categoryFacets = categoryArray.map(c => `categories:${c}`);

  const facets = [
    [`versions:${serverVersion}`],
    [`categories:${modLoader}`],
    [`project_type:mod`],
    categoryFacets 
  ];

  const bannedCategories = ['library', 'api', 'optimization', 'utility'];
  const fullyCompatibleMods: ModrinthProject[] = [];

  // Loop 3 times to get up to 300 mods (offsets: 0, 100, 200)
  for (let offset = 0; offset < 300; offset += 100) {
    if (fullyCompatibleMods.length >= limit) break;

    const searchParams = new URLSearchParams({
      facets: JSON.stringify(facets),
      index: 'downloads',
      limit: "100",
      offset: offset.toString()
    });

    const response = await fetch(`${MODRINTH_API_URL}/search?${searchParams.toString()}`, { cache: 'no-store' });
    if (!response.ok) continue;
    const data = await response.json();

    const validMods = data.hits.filter((mod: any) => {
      if (mod.server_side === 'unsupported') return false;
      if (installedModIds.includes(mod.project_id)) return false;
      const hasBanned = mod.categories.some((cat: string) => bannedCategories.includes(cat));
      if (hasBanned) return false;
      return true;
    });

    for (const mod of validMods) {
      if (fullyCompatibleMods.length >= limit) break;
      
      const vRes = await fetch(`${MODRINTH_API_URL}/project/${mod.project_id}/version`);
      if (!vRes.ok) continue;
      const versions = await vRes.json();
      const validVersion = versions.find((v: any) => v.loaders.includes(modLoader) && v.game_versions.includes(serverVersion));
      if (!validVersion) continue;

      let isIncompatible = false;
      if (validVersion.dependencies) {
        for (const dep of validVersion.dependencies) {
          if (dep.dependency_type === 'incompatible' && installedModIds.includes(dep.project_id)) {
            isIncompatible = true; break;
          }
        }
      }

      if (!isIncompatible) fullyCompatibleMods.push(mod);
    }
  }

  return fullyCompatibleMods;
}

export async function resolveModAndDependencies(
  projectId: string,
  version: string,
  loader: string,
  visited: Set<string> = new Set()
): Promise<ModDownloadFile[]> {
  
  if (visited.has(projectId)) return [];
  visited.add(projectId);

  const response = await fetch(`${MODRINTH_API_URL}/project/${projectId}/version`);
  if (!response.ok) throw new Error(`Failed to fetch versions for mod ${projectId}`);
  const versions = await response.json();

  const validVersion = versions.find((v: any) => v.loaders.includes(loader) && v.game_versions.includes(version));
  if (!validVersion) return [];

  const primaryFile = validVersion.files.find((f: any) => f.primary) || validVersion.files[0];
  const downloadQueue: ModDownloadFile[] = [{ url: primaryFile.url, filename: primaryFile.filename }];

  if (validVersion.dependencies) {
    for (const dep of validVersion.dependencies) {
      if (dep.dependency_type === 'required' && dep.project_id) {
        const depFiles = await resolveModAndDependencies(dep.project_id, version, loader, visited);
        downloadQueue.push(...depFiles);
      }
    }
  }

  return downloadQueue;
}