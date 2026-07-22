import { chromium } from 'playwright';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');
const outputDir = path.join(projectRoot, 'public', 'screenshots');

fs.mkdirSync(outputDir, { recursive: true });

const PORT = 4173;
const BASE_URL = `http://localhost:${PORT}`;

const routes = [
  { name: '01_landing_page', url: '/' },
  { name: '02_pitch_deck', url: '/pitch-deck' },
  { name: '03_rhythm_arcade_home', url: '/arcade' },
  { name: '04_song_select_wheel', url: '/songs' },
  { name: '05_song_detail_view', url: '/song/day-1' },
  { name: '06_rhythm_gameplay', url: '/play/day-1' },
  { name: '07_game_results', url: '/results/day-1' },
  { name: '08_audio_jukebox', url: '/listen/day-1' },
  { name: '09_rhythm_tutorial', url: '/tutorial' },
  { name: '10_vault_dashboard', url: '/vault' },
  { name: '11_card_collection', url: '/vault/collection' },
  { name: '12_card_forge', url: '/vault/forge' },
  { name: '13_lore_codex', url: '/vault/codex' },
  { name: '14_daily_claim', url: '/vault/claim' },
  { name: '15_earn_quests', url: '/vault/earn' },
  { name: '16_leaderboards', url: '/vault/leaderboard' },
  { name: '17_campaign_map', url: '/campaign' },
  { name: '18_chapter_tree', url: '/chapter/1' },
  { name: '19_user_profile', url: '/profile' },
  { name: '20_beatmap_editor', url: '/admin/editor' },
  { name: '21_card_design_showcase', url: '/admin/card-designs' },
  { name: '22_admin_panel', url: '/admin' },
  { name: '23_pack_reveal', url: '/vault/reveal' },
  { name: '24_voyeur_profile', url: '/vault/demo-user' }
];

async function main() {
  console.log('🚀 Starting Vite preview server...');
  const server = spawn('npx', ['vite', 'preview', '--port', PORT.toString(), '--host', '127.0.0.1'], {
    cwd: projectRoot,
    stdio: 'inherit'
  });

  // Wait for server to boot up
  await new Promise((resolve) => setTimeout(resolve, 3000));

  console.log('🌐 Launching headless browser...');
  const browser = await chromium.launch({
    headless: true
  });
  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
    deviceScaleFactor: 1
  });

  // Seed localStorage on domain
  const page = await context.newPage();
  await page.goto(`${BASE_URL}/`, { waitUntil: 'domcontentloaded' });
  await page.evaluate(() => {
    localStorage.setItem('pim_tutorial_completed', 'true');
    localStorage.setItem('th3vault_dev_mode', 'true');
    localStorage.setItem('pim_has_onboarded', 'true');
  });

  for (const item of routes) {
    console.log(`📸 Capturing screenshot for [${item.name}] (${item.url})...`);
    try {
      await page.goto(`${BASE_URL}${item.url}`, { waitUntil: 'networkidle' });
      await page.waitForTimeout(1500); // Allow animations to settle

      const filename = `${item.name}.png`;
      const pubPath = path.join(outputDir, filename);

      await page.screenshot({ path: pubPath, fullPage: false });
      console.log(`  ✓ Saved: ${filename}`);
    } catch (err) {
      console.error(`  ❌ Failed capturing ${item.name}:`, err.message);
    }
  }

  await browser.close();
  server.kill();
  console.log('🎉 Screenshot capture complete!');
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
