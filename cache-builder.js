#!/usr/bin/env node

/**
 * F1 Live Updates - Data Cache Builder
 * 
 * Generates pre-cached JSON files for GitHub Pages to avoid API bottlenecks.
 * Run periodically (e.g., after each race) to update the cache.
 * 
 * Usage: node cache-builder.js [year]
 * Example: node cache-builder.js 2024
 */

const fs = require('fs');
const path = require('path');
const https = require('https');

const API_BASE = 'https://api.openf1.org/v1';
const CACHE_DIR = path.join(__dirname, 'data-cache');
const RATE_LIMIT_DELAY = 100; // ms between requests

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
  fs.mkdirSync(CACHE_DIR, { recursive: true });
}

/**
 * Fetch data from OpenF1 API
 */
function fetchAPI(endpoint) {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      const url = `${API_BASE}${endpoint}`;
      console.log(`📥 Fetching: ${endpoint}`);
      
      https.get(url, { headers: { 'Accept-Encoding': 'gzip' } }, (res) => {
        let data = '';
        
        if (res.statusCode === 429) {
          reject(new Error('Rate limited by OpenF1'));
          return;
        }
        
        if (res.statusCode !== 200) {
          reject(new Error(`HTTP ${res.statusCode}`));
          return;
        }
        
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(e);
          }
        });
      }).on('error', reject);
    }, RATE_LIMIT_DELAY);
  });
}

/**
 * Save data to cache file
 */
function saveCache(filename, data) {
  const filepath = path.join(CACHE_DIR, filename);
  fs.writeFileSync(filepath, JSON.stringify(data, null, 2));
  console.log(`✅ Saved: ${filename} (${JSON.stringify(data).length} bytes)`);
}

/**
 * Build cache for a specific year
 */
async function buildYearCache(year) {
  console.log(`\n🏁 Building cache for F1 ${year}...\n`);
  
  try {
    // Fetch all races for the year
    const races = await fetchAPI(`/races?year=${year}`);
    saveCache(`races-${year}.json`, races);
    
    // Fetch data for each race
    for (const race of races) {
      console.log(`\n📍 Race ${race.round}: ${race.name}`);
      
      try {
        // Fetch sessions
        const sessions = await fetchAPI(`/sessions?year=${year}&round=${race.round}`);
        saveCache(`sessions-${year}-r${race.round}.json`, sessions);
        
        // Fetch drivers for each session
        for (const session of sessions) {
          try {
            const drivers = await fetchAPI(`/drivers?session_key=${session.session_key}`);
            saveCache(`drivers-${session.session_key}.json`, drivers);
            
            // Fetch positions if race/quali/practice
            if (['Race', 'Qualifying', 'Practice'].includes(session.session_type)) {
              const positions = await fetchAPI(`/positions?session_key=${session.session_key}`);
              saveCache(`positions-${session.session_key}.json`, positions);
              
              const laps = await fetchAPI(`/laps?session_key=${session.session_key}`);
              saveCache(`laps-${session.session_key}.json`, laps);
            }
          } catch (e) {
            console.warn(`⚠️  Could not fetch data for session ${session.session_key}: ${e.message}`);
          }
        }
      } catch (e) {
        console.warn(`⚠️  Could not fetch data for race ${race.round}: ${e.message}`);
      }
    }
    
    console.log(`\n✨ Cache build complete for ${year}!`);
    console.log(`📁 Cache directory: ${CACHE_DIR}`);
    console.log(`💾 Commit these files to your GitHub Pages repo.`);
    
  } catch (error) {
    console.error(`❌ Cache build failed: ${error.message}`);
    process.exit(1);
  }
}

/**
 * Main entry point
 */
async function main() {
  const year = process.argv[2] || new Date().getFullYear();
  
  console.log(`
╔══════════════════════════════════════╗
║  F1 Live Updates - Data Cache Builder ║
╚══════════════════════════════════════╝
  `);
  
  await buildYearCache(year);
}

main().catch(e => {
  console.error(e);
  process.exit(1);
});
