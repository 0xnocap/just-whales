import fs from 'fs';
import path from 'path';

const METADATA_DIR = path.join(process.cwd(), 'public/whale-town-metadata');
const CACHE_FILE = path.join(process.cwd(), 'public/metadata-cache.json');
const TOTAL_SUPPLY = 3333;

async function main() {
  console.log('Generating metadata cache...');

  const cache = [];
  for (let i = 0; i < TOTAL_SUPPLY; i++) {
    const filePath = path.join(METADATA_DIR, `${i}.json`);
    if (!fs.existsSync(filePath)) {
      console.warn(`Missing metadata for token #${i}`);
      continue;
    }

    try {
      const metadata = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      // We only need the attributes for rate calculation.
      // The frontend can fetch the full metadata for images if needed.
      cache.push({
        id: i,
        attributes: metadata.attributes,
      });
    } catch (e) {
      console.error(`Error parsing token #${i}:`, e);
    }
  }

  fs.writeFileSync(CACHE_FILE, JSON.stringify(cache));
  console.log(`Successfully generated metadata cache for ${cache.length} tokens.`);
  console.log(`Cache file written to: ${CACHE_FILE}`);
}

main().catch(console.error);
