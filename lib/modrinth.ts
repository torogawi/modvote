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

export async function fetchWeeklyCandidates(limit: number = 10): Promise<ModrinthProject[]> {
  // 1. Get dynamic settings from Admin Panel
  const settings = await prisma.systemSettings.findUnique({ where: { id: "default" } });
  if (!settings) throw new Error("System settings not configured. Please visit the Admin panel.");

  const { serverVersion, modLoader, allowedCategories } = settings;
  
  // 2. Get list of currently installed mods (so we don't fetch them again)
  const installedMods = await prisma.installedMod.findMany({ where: { isActive: true } });
  const installedModIds = installedMods.map(m => m.modrinthId);

  // 3. Format allowed categories (e.g. "adventure", "magic") for the API
  const categoryArray = allowedCategories.split(",").map(c => c.trim().toLowerCase());
  const categoryFacets = categoryArray.map(c => `categories:${c}`);

  // Modrinth Facets: Must match version AND loader AND be a mod AND match at least one allowed category
  const facets = [
    [`versions:${serverVersion}`],
    [`categories:${modLoader}`],
    [`project_type:mod`],
    categoryFacets 
  ];

  // INSIDE lib/modrinth.ts -> fetchWeeklyCandidates function

  // Change this block to fetch the top 100 all-time highest downloaded mods
  const searchParams = new URLSearchParams({
    facets: JSON.stringify(facets),
    index: 'downloads', // Changed from 'relevance' to 'downloads' (All-time popular)
    limit: "100",       // Fetch 100 so we have plenty to shuffle and pick from
  });

  const response = await fetch(`${MODRINTH_API_URL}/search?${searchParams.toString()}`, { cache: 'no-store' });
  if (!response.ok) throw new Error('Failed to fetch from Modrinth API');
  const data = await response.json();

  const bannedCategories = ['library', 'api', 'optimization', 'utility'];

  // 4. Initial filtering (Remove client-only, banned categories, and already installed mods)
  let validMods = data.hits.filter((mod: any) => {
    if (mod.server_side === 'unsupported') return false;
    if (installedModIds.includes(mod.project_id)) return false;
    
    // If the mod is tagged as a library/api, throw it out!
    const hasBanned = mod.categories.some((cat: string) => bannedCategories.includes(cat));
    if (hasBanned) return false;

    return true;
  });

  // 5. Strict Compatibility Check
  const fullyCompatibleMods: ModrinthProject[] = [];

  for (const mod of validMods) {
    if (fullyCompatibleMods.length >= limit) break; // Stop once we have our 10 perfect mods

    // Fetch the specific version info for this mod
    const vRes = await fetch(`${MODRINTH_API_URL}/project/${mod.project_id}/version`);
    if (!vRes.ok) continue;
    const versions = await vRes.json();
    
    // Find the latest file that matches our version & loader
    const validVersion = versions.find((v: any) => 
      v.loaders.includes(modLoader) && v.game_versions.includes(serverVersion)
    );
    if (!validVersion) continue;

    // Check against installed mods for fatal conflicts
    let isIncompatible = false;
    if (validVersion.dependencies) {
      for (const dep of validVersion.dependencies) {
        if (dep.dependency_type === 'incompatible' && installedModIds.includes(dep.project_id)) {
          isIncompatible = true;
          break; // Conflict found! Skip this mod.
        }
      }
    }

    if (!isIncompatible) {
      fullyCompatibleMods.push(mod);
    }
  }

  return fullyCompatibleMods;
}

// ... Keep your existing resolveModAndDependencies function exactly as it is below this line! ...
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