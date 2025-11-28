const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

module.exports = async (req, res) => {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { name } = req.query;
    if (!name) {
        return res.status(400).json({ error: 'Missing name parameter' });
    }

    let browser = null;

    try {
        // Configure browser for Vercel environment
        browser = await puppeteer.launch({
            args: chromium.args,
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: chromium.headless,
            ignoreHTTPSErrors: true,
        });

        const page = await browser.newPage();

        // Block resources to speed up loading
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'stylesheet', 'font'].includes(req.resourceType())) {
                req.abort();
            } else {
                req.continue();
            }
        });

        // Navigate to search page
        await page.goto('https://chivalry2stats.com/player', { waitUntil: 'domcontentloaded', timeout: 8000 });

        // Click "Username Search"
        // We search for elements that might be the tab
        const clicked = await page.evaluate(() => {
            const elements = Array.from(document.querySelectorAll('button, div, span, a'));
            const tab = elements.find(el => el.textContent && el.textContent.trim() === 'Username Search');
            if (tab) {
                tab.click();
                return true;
            }
            return false;
        });

        if (!clicked) {
            throw new Error('Username Search tab not found');
        }

        // Type username
        await page.waitForSelector('input[placeholder="Enter Username"]', { timeout: 2000 });
        await page.type('input[placeholder="Enter Username"]', name);
        await page.keyboard.press('Enter');

        // Wait for results
        // We look for either a player card or "No players found"
        try {
            await page.waitForFunction(
                () => document.querySelector('.player-card') || document.body.textContent.includes('No players found'),
                { timeout: 5000 }
            );
        } catch (e) {
            // Timeout waiting for results
        }

        // Check for "No players found"
        const noResults = await page.evaluate(() => document.body.textContent.includes('No players found'));
        if (noResults) {
            return res.status(404).json({ error: 'Player not found' });
        }

        // Extract data from the first result
        // We assume the first result is the most relevant
        const playerData = await page.evaluate(() => {
            const card = document.querySelector('.player-card'); // Adjust selector based on actual site structure if needed
            // If we are on the search results list, we might need to click the player first.
            // However, the search usually shows a list. Let's assume we want the first one.

            // Wait, if we are on the search list, we need to click the player to get details?
            // Or maybe the list has enough info?
            // Let's try to click the first result if it exists.
            const firstResult = document.querySelector('div[class*="grid"] > div'); // Heuristic selector
            if (firstResult) firstResult.click();
            return null;
        });

        // Wait for profile page to load
        await page.waitForSelector('.profile-header', { timeout: 5000 }).catch(() => { });

        // Scrape stats
        const stats = await page.evaluate(() => {
            const getText = (text) => {
                const el = Array.from(document.querySelectorAll('div')).find(d => d.textContent.includes(text));
                return el ? el.nextElementSibling?.textContent?.trim() : null;
            };

            return {
                level: getText('Global Rank'),
                kd: getText('K/D Ratio'),
                winRate: getText('Win %'),
                hours: getText('Time Played'),
                platform: 'Unknown' // Hard to detect without icon analysis
            };
        });

        res.status(200).json(stats);

    } catch (error) {
        console.error('Scraping error:', error);
        res.status(500).json({ error: 'Failed to fetch stats', details: error.message });
    } finally {
        if (browser) {
            await browser.close();
        }
    }
};
