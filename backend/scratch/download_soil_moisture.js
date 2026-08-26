const fs = require('fs');
const path = require('path');

const API_KEY = '579b464db66ec23bdd00000110ef4535b502480b6acf3b0912cb10cc';
const RESOURCE_ID = '4554a3c8-74e3-4f93-8727-8fd92161e345';
const OUTPUT_FILE = path.join(__dirname, '../Dataset/soil_moisture_haryana_2018_2025.csv');

async function download() {
  console.log("=== Soil Moisture Standalone Downloader Starting ===");
  let allRecords = [];
  let offset = 0;
  const limit = 5000;
  let hasMore = true;

  const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

  try {
    while (hasMore) {
      console.log(`Fetching offset ${offset}...`);
      const url = `https://api.data.gov.in/resource/${RESOURCE_ID}?api-key=${API_KEY}&format=json&filters[State]=Haryana&limit=${limit}&offset=${offset}`;

      let res;
      let retries = 3;
      while (retries > 0) {
        try {
          res = await fetch(url);
          if (res.ok) break;
          console.warn(`API error (HTTP ${res.status}). Retrying in 3s...`);
          await sleep(3000);
          retries--;
        } catch (fetchErr) {
          console.warn(`Network error: ${fetchErr.message}. Retrying in 3s...`);
          await sleep(3000);
          retries--;
        }
      }

      if (!res || !res.ok) {
        throw new Error(`Failed to fetch offset ${offset} after multiple retries.`);
      }

      const contentType = res.headers.get('content-type') || '';
      if (!contentType.includes('json')) {
        const text = await res.text();
        throw new Error(`Expected JSON but got content-type "${contentType}". Snippet: ${text.substring(0, 150)}`);
      }

      const data = await res.json();
      if (data && data.records && data.records.length > 0) {
        const matching = data.records.filter(r => {
          const yr = parseInt(r.Year || r.year, 10);
          return yr >= 2018 && yr <= 2025;
        });

        allRecords = allRecords.concat(matching);
        console.log(`Fetched ${data.records.length} records. Found ${matching.length} Haryana 2018-2025 records. Total: ${allRecords.length}`);

        offset += limit;
        if (offset >= data.total) {
          hasMore = false;
        }
      } else {
        hasMore = false;
      }

      // Polite rate limit sleep
      await sleep(1500);
    }

    console.log(`Finished downloading. Total Haryana records: ${allRecords.length}`);
    if (allRecords.length === 0) {
      console.log("No records to save.");
      return;
    }

    const headers = Object.keys(allRecords[0]);
    let csvContent = headers.join(',') + '\n';

    allRecords.forEach(rec => {
      const row = headers.map(h => {
        let val = rec[h];
        if (val === null || val === undefined) return '';
        val = String(val).replace(/"/g, '""');
        if (val.includes(',') || val.includes('"') || val.includes('\n')) {
          val = `"${val}"`;
        }
        return val;
      });
      csvContent += row.join(',') + '\n';
    });

    fs.mkdirSync(path.dirname(OUTPUT_FILE), { recursive: true });
    fs.writeFileSync(OUTPUT_FILE, csvContent, 'utf8');
    console.log(`SUCCESS! Saved ${allRecords.length} records to ${OUTPUT_FILE}`);
  } catch (err) {
    console.error(`Download failed: ${err.message}`);
  }
}

download();
