import { readdir, rm } from 'node:fs/promises';
async function clean(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const path = `${dir}/${entry.name}`;
    if (entry.name === '.DS_Store') await rm(path);
    else if (entry.isDirectory()) await clean(path);
  }
}
await clean('dist');
