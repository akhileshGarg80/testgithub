/**
 * Exclusion rules for Groq Repo Scanner:
 * Ensures node_modules, package-lock.json, and other non-source/lock/binary files
 * are automatically disabled from selection and skipped during scans.
 */

export function isGroqExemptFile(filePath: string): boolean {
  if (!filePath) return false;
  const normalized = filePath.replace(/\\/g, '/');
  const lower = normalized.toLowerCase();
  const fileName = lower.split('/').pop() || '';

  // 1. node_modules (Never scan node_modules under any circumstance)
  if (
    lower.startsWith('node_modules/') ||
    lower.includes('/node_modules/') ||
    lower === 'node_modules' ||
    fileName === 'node_modules'
  ) {
    return true;
  }

  // 2. Lock files (package-lock.json, yarn.lock, pnpm-lock, etc.)
  if (
    fileName === 'package-lock.json' ||
    fileName === 'yarn.lock' ||
    fileName === 'pnpm-lock.yaml' ||
    fileName === 'pnpm-lock.yml' ||
    fileName === 'bun.lockb' ||
    fileName === 'composer.lock' ||
    fileName === 'cargo.lock' ||
    fileName === 'gemfile.lock' ||
    fileName === 'poetry.lock' ||
    fileName === 'mix.lock'
  ) {
    return true;
  }

  // 3. Git internals and system metadata
  if (
    lower.startsWith('.git/') ||
    lower.includes('/.git/') ||
    lower === '.git' ||
    fileName === '.ds_store' ||
    fileName === 'thumbs.db'
  ) {
    return true;
  }

  // 4. Bulky build/distribution folders
  if (
    lower.startsWith('dist/') ||
    lower.includes('/dist/') ||
    lower.startsWith('build/') ||
    lower.includes('/build/') ||
    lower.startsWith('.next/') ||
    lower.includes('/.next/') ||
    lower.startsWith('.nuxt/') ||
    lower.includes('/.nuxt/') ||
    lower.startsWith('.turbo/') ||
    lower.includes('/.turbo/') ||
    lower.startsWith('out/') ||
    lower.includes('/out/') ||
    lower.startsWith('.cache/') ||
    lower.includes('/.cache/')
  ) {
    return true;
  }

  // 5. Binary, media, and font files
  const binaryExtensions = [
    '.png', '.jpg', '.jpeg', '.gif', '.ico', '.webp', '.svg', '.bmp', '.tiff',
    '.woff', '.woff2', '.ttf', '.eot', '.otf',
    '.mp4', '.webm', '.avi', '.mov', '.mkv',
    '.mp3', '.wav', '.ogg', '.flac',
    '.zip', '.tar', '.gz', '.rar', '.7z',
    '.pdf', '.exe', '.dll', '.so', '.dylib', '.bin',
    '.iso', '.dmg', '.map'
  ];

  if (binaryExtensions.some((ext) => fileName.endsWith(ext))) {
    return true;
  }

  return false;
}

export function getGroqExemptReason(filePath: string): string | null {
  if (!filePath) return null;
  const lower = filePath.toLowerCase();
  const fileName = lower.split('/').pop() || '';

  if (lower.includes('node_modules')) {
    return 'node_modules (auto-disabled)';
  }
  if (
    fileName === 'package-lock.json' ||
    fileName === 'yarn.lock' ||
    fileName === 'pnpm-lock.yaml' ||
    fileName === 'bun.lockb'
  ) {
    return 'Lock file (auto-disabled)';
  }
  if (lower.includes('.git')) {
    return 'Git directory';
  }
  if (lower.includes('dist/') || lower.includes('build/')) {
    return 'Build artifact';
  }
  return 'Ignored by default';
}
