const chromium = require('@sparticuz/chromium');
const puppeteer = require('puppeteer-core');

// Retry configuration
const MAX_RETRIES = 2;
const RETRY_DELAY = 500;

// Helper function to delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Main scraper function with retry logic
async function scrapePlayerStats(name, retryCount = 0) {
    let browser = null;

    try {
        console.log(`[Attempt ${retryCount + 1}/${MAX_RETRIES}] Starting scrape for: ${name}`);

        // Configure browser for Vercel environment
        browser = await puppeteer.launch({
            args: [...chromium.args, '--hide-scrollbars', '--disable-web-security'],
            defaultViewport: chromium.defaultViewport,
            executablePath: await chromium.executablePath(),
            headless: true,
            ignoreHTTPSErrors: true,
        });

        const page = await browser.newPage();

        // Set User-Agent to avoid bot detection
        await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

        // Block resources to speed up loading
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['image', 'stylesheet', 'font', 'media', 'other'].includes(req.resourceType())) {
                req.abort();
            } else {
                req.continue();
            }
        });

        // Navigate to search page
        console.log('Navigating to ChivalryStats...');
        await page.goto('https://chivalry2stats.com/player', {
            waitUntil: 'domcontentloaded',
            timeout: 15000
        });

        // Check if input is already available (skip tab click if so)
        const inputSelector = 'input[placeholder*="Username"], input[type="text"]';
        let input = await page.$(inputSelector);

        if (!input) {
            console.log('Input not found, looking for tab...');
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

            if (tabClicked) {
                await delay(200);
                input = await page.$(inputSelector);
            }
        }

        if (!input) {
            throw new Error('Search input not found');
        }

        // Type username
        console.log('Typing username...');
        await input.click({ clickCount: 3 });
        await input.type(name);
        await page.keyboard.press('Enter');

        // Wait for results
        console.log('Waiting for results...');
        try {
            await page.waitForFunction(
                () => {
                    const text = document.body.textContent;
                    return document.querySelector('.player-card') ||
                        document.querySelector('.stats-card') ||
                        document.querySelector('.profile-card') ||
                        text.includes('No players found') ||
                        text.includes('Player not found');
                },
                { timeout: 8000 }
            );
        } catch (e) {
            console.log('Wait for results timed out, checking content anyway...');
        }

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
            const findByLabel = (labelText) => {
                const labels = Array.from(document.querySelectorAll('div, span, p, h3, h4, td, th, label'));
                const label = labels.find(el => {
                    const text = el.textContent.trim().toLowerCase();
                    return text === labelText.toLowerCase() || text.includes(labelText.toLowerCase());
                });

                if (label) {
                    if (label.nextElementSibling) {
                        return label.nextElementSibling.textContent.trim();
                    }
                    if (label.parentElement && label.parentElement.nextElementSibling) {
                        return label.parentElement.nextElementSibling.textContent.trim();
                    }
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

            const extractStat = (...possibleLabels) => {
                for (const label of possibleLabels) {
                    const value = findByLabel(label);
                    if (value) return value;
                }
                return null;
            };

            return {
                globalRank: extractStat('Global Rank', 'Rank', 'global rank'),
                level: extractStat('Level', 'Player Level', 'LVL'),
                kdRatio: extractStat('K/D Ratio', 'K/D', 'KD Ratio', 'Kill/Death'),
                winRate: extractStat('Win %', 'Win Rate', 'Win Percentage', 'Wins %'),
                timePlayed: extractStat('Time Played', 'Playtime', 'Hours Played', 'Total Time'),
                kills: extractStat('Kills', 'Total Kills'),
                deaths: extractStat('Deaths', 'Total Deaths'),
                wins: extractStat('Wins', 'Total Wins'),
                losses: extractStat('Losses', 'Total Losses'),
                matches: extractStat('Matches Played', 'Total Matches', 'Games Played'),
                favoriteClass: extractStat('Favorite Class', 'Main Class', 'Most Played Class'),
                scrapedAt: new Date().toISOString()
            };
        });

        console.log('Stats extracted:', stats);

        const hasData = Object.values(stats).some(val =>
            val !== null && val !== undefined && val !== ''
        );

        if (!hasData) {
            throw new Error('No stats data extracted - page structure may have changed');
        }

        return { success: true, stats };

    } catch (error) {
        console.error(`[Attempt ${retryCount + 1}] Scraping error:`, error.message);

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

module.exports = async (req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

    const { name } = req.query;
    if (!name || name.trim() === '') return res.status(400).json({ error: 'Missing name' });

    try {
        const result = await scrapePlayerStats(name.trim());

        if (result.notFound) return res.status(404).json({ error: 'Player not found' });
        if (result.success) return res.status(200).json(result.stats);

        return res.status(500).json({ error: 'Unexpected scraper response' });

    } catch (error) {
        console.error('Final error:', error);
        return res.status(500).json({
            error: 'Failed to fetch stats',
            details: error.message
        });
    }
};
