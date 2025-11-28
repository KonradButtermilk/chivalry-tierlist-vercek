const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

// Retry configuration
const MAX_RETRIES = 3;
const RETRY_DELAY = 1000; // 1 second

// Helper function to delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Main scraper function with retry logic
async function scrapePlayerStats(name, retryCount = 0) {
    let browser = null;

    try {
        console.log(`[Attempt ${retryCount + 1}/${MAX_RETRIES}] Starting scrape for: ${name}`);

        // Configure browser for Vercel environment
        browser = await puppeteer.launch({
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
            ignoreHTTPSErrors: true,
        });

        const page = await browser.newPage();

        // Set user agent to be polite
        await page.setUserAgent('ChivalryTierlist/1.0 (Player Stats Integration)');

        // Block resources to speed up loading
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'stylesheet', 'font', 'media'].includes(req.resourceType())) {
                req.abort();
            } else {
                req.continue();
            }
        });

        // Navigate to search page
        console.log('Navigating to ChivalryStats...');
        await page.goto('https://chivalry2stats.com/player', {
            waitUntil: 'domcontentloaded',
            timeout: 30000
        });

        // Click "Username Search" tab
        console.log('Looking for Username Search tab...');
        const tabClicked = await page.evaluate(() => {
            const elements = Array.from(document.querySelectorAll('button, div[role="button"], span, a'));
            const tab = elements.find(el =>
                el.textContent && el.textContent.trim().toLowerCase().includes('username search')
            );
            if (tab) {
                tab.click();
                return true;
            }
            return false;
        });

        if (!tabClicked) {
            throw new Error('Username Search tab not found');
        }

        // Wait a bit for tab content to load
        await delay(500);

        // Type username
        console.log('Typing username...');
        await page.waitForSelector('input[placeholder*="Username"], input[type="text"]', { timeout: 5000 });

        const input = await page.$('input[placeholder*="Username"], input[type="text"]');
        await input.click({ clickCount: 3 }); // Select all existing text
        await input.type(name);
        await page.keyboard.press('Enter');

        // Wait for results
        console.log('Waiting for results...');
        await page.waitForFunction(
            () => {
                return document.querySelector('.player-card, .stats-card, .profile-card') ||
                    document.body.textContent.includes('No players found') ||
                    document.body.textContent.includes('Player not found');
            },
            { timeout: 10000 }
        );

        // Check for "No players found"
        const noResults = await page.evaluate(() => {
            const text = document.body.textContent.toLowerCase();
            return text.includes('no players found') || text.includes('player not found');
        });

        if (noResults) {
            console.log('Player not found');
            return { error: 'Player not found', notFound: true };
        }

        // Extract comprehensive data
        console.log('Extracting comprehensive player data...');
        const stats = await page.evaluate(() => {
            // Helper to find element by label text
            const findByLabel = (labelText) => {
                const labels = Array.from(document.querySelectorAll('div, span, p, h3, h4, td, th, label'));
                const label = labels.find(el => {
                    const text = el.textContent.trim().toLowerCase();
                    return text === labelText.toLowerCase() || text.includes(labelText.toLowerCase());
                });

                if (label) {
                    // Try next sibling
                    if (label.nextElementSibling) {
                        return label.nextElementSibling.textContent.trim();
                    }
                    // Try parent's next sibling
                    if (label.parentElement && label.parentElement.nextElementSibling) {
                        return label.parentElement.nextElementSibling.textContent.trim();
                    }
                    // Try looking for value in same parent
                    const parent = label.parentElement;
                    if (parent && parent.children.length > 1) {
                        for (let child of parent.children) {
                            if (child !== label && child.textContent.trim() !== labelText) {
                                return child.textContent.trim();
                            }
                        }
                    }
                }
                return null;
            };

            // Extract stats with multiple strategies
            const extractStat = (...possibleLabels) => {
                for (const label of possibleLabels) {
                    const value = findByLabel(label);
                    if (value) return value;
                }
                return null;
            };

            // Core stats
            const globalRank = extractStat('Global Rank', 'Rank', 'global rank');
            const level = extractStat('Level', 'Player Level', 'LVL');
            const kdRatio = extractStat('K/D Ratio', 'K/D', 'KD Ratio', 'Kill/Death');
            const winRate = extractStat('Win %', 'Win Rate', 'Win Percentage', 'Wins %');
            const timePlayed = extractStat('Time Played', 'Playtime', 'Hours Played', 'Total Time');

            // Additional stats
            const kills = extractStat('Kills', 'Total Kills');
            const deaths = extractStat('Deaths', 'Total Deaths');
            const wins = extractStat('Wins', 'Total Wins');
            const losses = extractStat('Losses', 'Total Losses');
            const matches = extractStat('Matches Played', 'Total Matches', 'Games Played');
            const favoriteClass = extractStat('Favorite Class', 'Main Class', 'Most Played Class');

            // Get raw page text for debugging (first 500 chars)
            const rawPageText = document.body.textContent.substring(0, 500);

            return {
                // Core stats
                globalRank,
                level,
                kdRatio,
                winRate,
                timePlayed,

                // Additional stats
                kills,
                deaths,
                wins,
                losses,
                matches,
                favoriteClass,

                // Metadata
                scrapedAt: new Date().toISOString(),
                rawPageText // For debugging
            };
        });

        console.log('Stats extracted:', stats);

        // Validate that we got at least some data
        const hasData = Object.values(stats).some(val =>
            val !== null && val !== undefined && val !== ''
        );

        if (!hasData) {
            throw new Error('No stats data extracted - page structure may have changed');
        }

        return { success: true, stats };

    } catch (error) {
        console.error(`[Attempt ${retryCount + 1}] Scraping error:`, error.message);

        // Retry logic
        if (retryCount < MAX_RETRIES - 1) {
            console.log(`Retrying in ${RETRY_DELAY}ms...`);
            await delay(RETRY_DELAY);
            return scrapePlayerStats(name, retryCount + 1);
        }

        throw error;
    } finally {
        if (browser) {
            await browser.close();
        }
    }
}

// Vercel serverless function handler
module.exports = async (req, res) => {
    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { name } = req.query;
    if (!name || name.trim() === '') {
        return res.status(400).json({ error: 'Missing or empty name parameter' });
    }

    try {
        const result = await scrapePlayerStats(name.trim());

        if (result.notFound) {
            return res.status(404).json({ error: 'Player not found' });
        }

        if (result.success) {
            return res.status(200).json(result.stats);
        }

        return res.status(500).json({ error: 'Unexpected scraper response' });

    } catch (error) {
        console.error('Final error after all retries:', error);
        return res.status(500).json({
            error: 'Failed to fetch stats after multiple attempts',
            details: error.message
        });
    }
};
