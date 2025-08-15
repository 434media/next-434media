// Shared pure scraping core (no DB writes) to be used by Next.js API and Lambda worker.
import { chromium } from 'playwright';
const emailRegex = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const phoneRegex = /(\+?\d[\d\s().-]{8,}\d)/g;
export async function scrapeCore(input) {
    const { urls, industry, location } = input;
    if (!urls?.length)
        throw new Error('urls required');
    const errors = [];
    const candidates = [];
    let browser = null;
    try {
        browser = await chromium.launch({ headless: true });
        const context = await browser.newContext({ userAgent: 'Mozilla/5.0 (LeadScraperBot)' });
        for (const target of urls.slice(0, input.limit || 20)) {
            const rootUrl = normalizeRoot(target);
            const visited = new Set();
            const toVisit = [rootUrl];
            const maxExtra = input.deep === false ? 0 : (input.perSitePageLimit ?? 5);
            let aggregateHtml = '';
            let baseCompanyName;
            let primarySource = rootUrl;
            while (toVisit.length && visited.size < (1 + maxExtra)) {
                const nextUrl = toVisit.shift();
                if (visited.has(nextUrl))
                    continue;
                visited.add(nextUrl);
                let page = null;
                try {
                    page = await context.newPage();
                    await page.goto(nextUrl, { timeout: 35000, waitUntil: 'domcontentloaded' });
                    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight / 2));
                    const html = await page.content();
                    aggregateHtml += `\n<!-- PAGE:${nextUrl} -->\n` + html;
                    if (!baseCompanyName) {
                        const title = (await page.title())?.trim() || '';
                        const metaSiteName = await page.locator('meta[property="og:site_name"]').getAttribute('content');
                        const metaTitle = await page.locator('meta[property="og:title"]').getAttribute('content');
                        baseCompanyName = simplifyName(metaSiteName || metaTitle || title || new URL(nextUrl).hostname);
                        primarySource = nextUrl;
                    }
                    if (visited.size === 1 && maxExtra > 0) {
                        const anchors = await page.$$eval('a', els => els.map(e => ({ href: e.href, text: (e.textContent || '').toLowerCase() })));
                        const keywords = ['about', 'team', 'contact', 'company', 'who-we-are', 'people'];
                        const rootOrigin = new URL(rootUrl).origin;
                        const internal = anchors
                            .filter(a => a.href.startsWith(rootOrigin))
                            .filter(a => keywords.some(k => a.href.toLowerCase().includes(k) || a.text.includes(k)))
                            .map(a => stripHash(a.href));
                        for (const candidate of arrayUnique(internal).slice(0, maxExtra)) {
                            if (!visited.has(candidate))
                                toVisit.push(candidate);
                        }
                    }
                }
                catch (err) {
                    errors.push({ url: nextUrl, message: err.message || 'Unknown error' });
                }
                finally {
                    await page?.close().catch(() => { });
                }
            }
            try {
                if (!baseCompanyName) {
                    try {
                        baseCompanyName = new URL(rootUrl).hostname.replace(/^www\./, '');
                    }
                    catch { }
                }
                if (baseCompanyName) {
                    const emails = arrayUnique(matchAll(aggregateHtml, emailRegex)).filter(e => !e.toLowerCase().includes('example'));
                    const phones = arrayUnique(matchAll(aggregateHtml, phoneRegex)).map(normalizePhone);
                    const locationGuess = extractLocation(aggregateHtml) || location;
                    const person = extractPersonAndTitle(aggregateHtml);
                    const socials = extractSocialProfiles(aggregateHtml);
                    const multiContacts = extractMultipleContacts(aggregateHtml, emails);
                    candidates.push({
                        company_name: baseCompanyName,
                        website_url: canonicalizeUrl(rootUrl),
                        industry,
                        location: locationGuess,
                        email: emails[0],
                        phone: phones[0],
                        source_url: primarySource,
                        contact_name: person?.name,
                        contact_title: person?.title,
                        contacts: multiContacts.map(c => ({ ...c, linkedin_url: socials.linkedin, twitter_url: socials.twitter }))
                    });
                }
                else {
                    errors.push({ url: target, message: 'Company name not detected' });
                }
            }
            catch (err) {
                errors.push({ url: target, message: err.message || 'Post-process error' });
            }
        }
    }
    finally {
        await browser?.close().catch(() => { });
    }
    // Deduplicate
    const dedupedMap = new Map();
    for (const c of candidates)
        if (!dedupedMap.has(c.company_name))
            dedupedMap.set(c.company_name, c);
    return { candidates: Array.from(dedupedMap.values()), errors, processedPages: urls.length };
}
// Utility & extraction helpers (copied from original, kept pure)
function matchAll(text, regex) { const out = []; let m; const r = new RegExp(regex.source, regex.flags); while ((m = r.exec(text)) !== null)
    out.push(m[0]); return out; }
function arrayUnique(arr) { return Array.from(new Set(arr)); }
function normalizePhone(p) { return p.replace(/[^+\d]/g, '').slice(0, 18); }
function stripHash(u) { try {
    const x = new URL(u);
    x.hash = '';
    return x.toString();
}
catch {
    return u;
} }
function normalizeRoot(u) { try {
    const url = new URL(u);
    if (url.pathname.split('/').filter(Boolean).length > 2) {
        url.pathname = '/';
        url.search = '';
    }
    url.hash = '';
    return url.toString();
}
catch {
    return u;
} }
function canonicalizeUrl(u) { try {
    const url = new URL(u);
    url.hash = '';
    return url.toString();
}
catch {
    return u;
} }
function simplifyName(name) { return name.replace(/\s+\|.*$/, '').replace(/•.*$/, '').trim().slice(0, 120); }
function extractLocation(html) { const lower = html.toLowerCase(); const markers = ['address', 'location', 'headquarters']; const idx = markers.map(m => lower.indexOf(m)).filter(i => i > -1).sort()[0]; if (idx === undefined)
    return undefined; const snippet = lower.slice(idx, idx + 400); const cityState = /\b([a-zA-Z .'-]{3,}),\s*(?:[A-Z]{2})\b/.exec(snippet); if (cityState)
    return capitalizeWords(cityState[0]); return undefined; }
function capitalizeWords(str) { return str.replace(/\b([a-z])/g, c => c.toUpperCase()); }
function extractPersonAndTitle(html) { const cleaned = html.replace(/<script[\s\S]*?<\/script>/gi, '').replace(/<style[\s\S]*?<\/style>/gi, ''); const titleWords = ['Founder', 'Co-Founder', 'CEO', 'Chief', 'Officer', 'CTO', 'CFO', 'COO', 'CMO', 'President', 'Director', 'Manager', 'Lead', 'Head', 'Owner', 'Partner']; const headingRegex = /<(h[1-4])[^>]*>([^<]{3,120})<\/\1>/gi; let m; while ((m = headingRegex.exec(cleaned)) !== null) {
    const text = m[2].replace(/&amp;/g, '&').trim();
    if (text.split(/\s+/).length > 12)
        continue;
    const parts = text.split(/[–\-\u2013\u2014,:|]/).map(p => p.trim()).filter(Boolean);
    if (parts.length >= 2) {
        const maybeName = parts[0];
        const maybeTitle = parts.slice(1).join(' ').replace(/\s+/g, ' ');
        if (looksLikeName(maybeName) && containsTitleWord(maybeTitle, titleWords)) {
            return { name: sanitizeName(maybeName), title: shortenTitle(maybeTitle) };
        }
    }
    if (containsTitleWord(text, titleWords)) {
        const tokens = text.split(/[,]/)[0];
        const nameGuess = tokens.replace(/\b(CEO|CTO|CFO|COO|CMO)\b.*$/i, '').trim();
        if (looksLikeName(nameGuess)) {
            const title = text.replace(nameGuess, '').replace(/^[\s,\-–]+/, '').trim();
            if (title)
                return { name: sanitizeName(nameGuess), title: shortenTitle(title) };
        }
    }
} return undefined; }
function looksLikeName(str) { const words = str.split(/\s+/); return words.length <= 4 && words.every(w => /^[A-Za-z'\.]{2,}$/.test(w)) && /[A-Za-z]/.test(str); }
function containsTitleWord(text, words) { const lower = text.toLowerCase(); return words.some(w => lower.includes(w.toLowerCase())); }
function sanitizeName(n) { return n.replace(/\s+/g, ' ').trim(); }
function shortenTitle(t) { return t.split(/\s+/).slice(0, eightWordCap(t)).join(' '); }
function eightWordCap(t) { return Math.min(8, t.split(/\s+/).length); }
function extractSocialProfiles(html) { const linkedinMatch = /https?:\/\/([a-z]{2,3}\.)?linkedin\.com\/[a-z0-9_\-/]+/i.exec(html); const twitterMatch = /https?:\/\/(?:www\.)?twitter\.com\/[a-z0-9_]+/i.exec(html) || /https?:\/\/(?:www\.)?x\.com\/[a-z0-9_]+/i.exec(html); return { linkedin: linkedinMatch?.[0], twitter: twitterMatch?.[0] }; }
function extractMultipleContacts(html, foundEmails) { const blocks = html.split(/<h[1-4][^>]*>/i).slice(1).map(b => b.slice(0, 500)); const contacts = []; for (const block of blocks) {
    const text = block.replace(/<[^>]+>/g, ' ').replace(/&amp;/g, '&').trim();
    if (!text)
        continue;
    const line = text.split(/\n|\r/)[0].slice(0, 160);
    const m = /([A-Z][A-Za-z'\.]+\s+[A-Z][A-Za-z'\.]+)(?:\s*[–\-\u2013\u2014:,|]+\s*([^\n]{2,80}))?/.exec(line);
    if (m) {
        const name = sanitizeName(m[1]);
        if (looksLikeName(name)) {
            const title = m[2]?.trim();
            const email = foundEmails.find(e => line.includes(e.split('@')[0]));
            contacts.push({ name, title: title && shortenTitle(title), email });
        }
    }
    if (contacts.length >= 10)
        break;
} return dedupeContacts(contacts); }
function dedupeContacts(arr) { const seen = new Set(); const out = []; for (const c of arr) {
    const key = c.name.toLowerCase();
    if (seen.has(key))
        continue;
    seen.add(key);
    out.push(c);
} return out; }
