import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { copyFile, lstat, mkdir, readdir } from 'node:fs/promises';
import path from 'node:path';

const home = process.env.HOME || process.env.USERPROFILE || process.cwd();
const sourceRoot = path.resolve(
  process.env.LEGACY_MEDIA_SOURCE_DIR || path.join(home, 'domains/fuddins.com/public_html/wp-content/uploads')
);
const destinationRoot = path.resolve(
  process.env.LEGACY_MEDIA_DEST_DIR || process.env.LEGACY_UPLOADS_DIR || path.join(home, 'fuddins-backend-media')
);

async function sha256(filePath: string) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(filePath)) hash.update(chunk);
  return hash.digest('hex');
}

async function copyDirectory(source: string, destination: string) {
  await mkdir(destination, { recursive: true });
  const entries = await readdir(source, { withFileTypes: true });
  let files = 0;
  let bytes = 0;

  for (const entry of entries) {
    const sourcePath = path.join(source, entry.name);
    const destinationPath = path.join(destination, entry.name);
    if (entry.isDirectory()) {
      const nested = await copyDirectory(sourcePath, destinationPath);
      files += nested.files;
      bytes += nested.bytes;
      continue;
    }

    const info = await lstat(sourcePath);
    if (!info.isFile()) {
      throw new Error(`Unsupported non-regular item in media source: ${sourcePath}`);
    }

    await mkdir(path.dirname(destinationPath), { recursive: true });
    await copyFile(sourcePath, destinationPath);
    const [sourceHash, destinationHash] = await Promise.all([sha256(sourcePath), sha256(destinationPath)]);
    if (sourceHash !== destinationHash) {
      throw new Error(`Checksum mismatch after copy: ${path.relative(sourceRoot, sourcePath)}`);
    }
    files += 1;
    bytes += info.size;
  }

  return { files, bytes };
}

async function migrate() {
  const sourceStat = await lstat(sourceRoot).catch(() => null);
  if (!sourceStat?.isDirectory()) {
    throw new Error(`Legacy media source folder is missing or not a directory: ${sourceRoot}`);
  }
  if (sourceRoot === destinationRoot || destinationRoot.startsWith(`${sourceRoot}${path.sep}`)) {
    throw new Error('Media destination must be outside the legacy source folder.');
  }

  console.log(`Copying legacy media from ${sourceRoot}`);
  console.log(`Into persistent backend media folder ${destinationRoot}`);
  console.log('Original WordPress files will be left untouched.');
  const { files, bytes } = await copyDirectory(sourceRoot, destinationRoot);
  if (files === 0) {
    throw new Error('No media files were found; the backend media directory was not verified.');
  }
  console.log(`Migration complete: ${files} files copied and checksum-verified (${bytes} bytes).`);
  console.log('Configure the backend LEGACY_UPLOADS_DIR to this destination before relying on it.');
}

migrate().catch((error: unknown) => {
  console.error('Legacy media migration failed:', error);
  process.exitCode = 1;
});
