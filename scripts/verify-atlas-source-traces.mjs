import fs from 'node:fs';
import path from 'node:path';

const repoRoot = process.cwd();
const sourceRoots = ['plans', path.join('atlas', 'items')];
const tracePaths = [
  path.join('.next', 'server', 'app', 'page.js.nft.json'),
  path.join('.next', 'server', 'app', 'runtime', 'route.js.nft.json'),
  path.join('.next', 'server', 'app', 'api', 'ingress', '[...path]', 'route.js.nft.json'),
];

const walkFiles = directory =>
  fs
    .readdirSync(directory, { withFileTypes: true })
    .flatMap(entry => {
      const filePath = path.join(directory, entry.name);

      if (entry.isDirectory()) {
        return walkFiles(filePath);
      }

      return entry.isFile() && entry.name.endsWith('.md') ? [path.resolve(filePath)] : [];
    });

const sourceFiles = sourceRoots.flatMap(sourceRoot => walkFiles(path.join(repoRoot, sourceRoot)));

for (const relativeTracePath of tracePaths) {
  const tracePath = path.join(repoRoot, relativeTracePath);

  if (!fs.existsSync(tracePath)) {
    throw new Error(`Missing Next.js server trace: ${relativeTracePath}`);
  }

  const trace = JSON.parse(fs.readFileSync(tracePath, 'utf8'));
  const tracedFiles = new Set(
    trace.files.map(filePath => path.resolve(path.dirname(tracePath), filePath)),
  );
  const missingFiles = sourceFiles.filter(filePath => !tracedFiles.has(filePath));

  if (missingFiles.length > 0) {
    throw new Error(
      `${relativeTracePath} omits ${missingFiles.length} Atlas source files, including ${path.relative(repoRoot, missingFiles[0])}`,
    );
  }
}

process.stdout.write(
  `Verified ${sourceFiles.length} Atlas-owned Markdown files in ${tracePaths.length} server traces.\n`,
);
