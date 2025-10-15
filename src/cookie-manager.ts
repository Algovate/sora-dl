import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import puppeteer, { Browser, Page } from 'puppeteer';
import { open, Database } from 'sqlite';
import sqlite3 from 'sqlite3';

export interface BrowserProfile {
  name: string;
  platform: string;
  cookiePaths: string[];
}

export interface CookieString {
  cookies: string;
  source: string;
}

export class CookieManager {
  private configPath: string;

  constructor() {
    this.configPath = path.join(os.homedir(), '.sora-dl-config.json');
  }

  /**
   * Get the absolute path to the cookies/config file
   */
  getConfigPath(): string {
    return this.configPath;
  }

  /**
   * Save cookies to configuration file
   */
  async saveCookies(cookies: string, source: string = 'manual'): Promise<void> {
    const config = this.loadConfig();
    config.cookies = {
      string: cookies,
      source,
      savedAt: new Date().toISOString()
    };

    try {
      fs.writeFileSync(this.configPath, JSON.stringify(config, null, 2));
      console.log(`✅ Cookies saved to: ${this.configPath}`);
    } catch (error) {
      throw new Error(`Failed to save cookies: ${error}`);
    }
  }

  /**
   * Load cookies from configuration file
   */
  loadCookies(): string | null {
    try {
      if (!fs.existsSync(this.configPath)) {
        return null;
      }

      const config = JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
      return config.cookies?.string || null;
    } catch (error) {
      console.warn(`Warning: Could not load saved cookies: ${error}`);
      return null;
    }
  }

  /**
   * Load configuration file
   */
  private loadConfig(): any {
    try {
      if (fs.existsSync(this.configPath)) {
        return JSON.parse(fs.readFileSync(this.configPath, 'utf8'));
      }
    } catch (error) {
      console.warn(`Warning: Could not load config file: ${error}`);
    }
    return {};
  }

  /**
   * Return saved cookies metadata (if available)
   */
  getSavedCookiesInfo(): { string: string; source?: string; savedAt?: string } | null {
    const cfg = this.loadConfig();
    if (cfg && cfg.cookies && typeof cfg.cookies.string === 'string') {
      return {
        string: cfg.cookies.string,
        source: cfg.cookies.source,
        savedAt: cfg.cookies.savedAt
      };
    }
    return null;
  }

  /**
   * Extract cookies automatically using Puppeteer
   */
  async extractWithPuppeteer(headless: boolean = false): Promise<string> {
    console.log('🚀 Opening browser to extract cookies automatically...');
    console.log('📍 Please log in to Sora if prompted');

    let browser: Browser | null = null;

    try {
      browser = await puppeteer.launch({
        headless: headless,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      const page = await browser.newPage();

      // Navigate to Sora
      await page.goto('https://sora.chatgpt.com/', {
        waitUntil: 'networkidle2'
      });

      // Wait for user to log in if needed
      console.log('⏳ Waiting for page to load...');
      await new Promise(resolve => setTimeout(resolve, 3000));

      // Check if user is logged in by looking for feed elements
      const isLoggedIn = await page.evaluate(() => {
        return !!document.querySelector('[data-testid="feed"]') ||
               !!document.querySelector('main') ||
               window.location.href.includes('/feed');
      });

      if (!isLoggedIn) {
        console.log('❌ Please log in to Sora in the browser window...');
        console.log('⏳ Waiting for login...');

        // Wait for login or manual intervention
        await page.waitForFunction(
          () => {
            return !!document.querySelector('[data-testid="feed"]') ||
                   !!document.querySelector('main') ||
                   window.location.href.includes('/feed');
          },
          { timeout: 120000 } // 2 minutes timeout
        );
      }

      // Extract cookies
      const cookies = await page.cookies();

      if (cookies.length === 0) {
        throw new Error('No cookies found. Please ensure you are logged in.');
      }

      // Format cookies as header string
      const cookieString = cookies
        .map((cookie: any) => `${cookie.name}=${cookie.value}`)
        .join('; ');

      console.log('✅ Successfully extracted cookies!');
      return cookieString;

    } catch (error) {
      if (error instanceof Error && error.message.includes('timeout')) {
        throw new Error('Login timeout. Please try again or use manual method.');
      }
      throw error;
    } finally {
      if (browser) {
        await browser.close();
      }
    }
  }

  /**
   * Import cookies from browser cookie database
   */
  async importFromBrowser(browserName: string): Promise<string> {
    const profiles = this.getBrowserProfiles();
    const profile = profiles.find(p => p.name.toLowerCase() === browserName.toLowerCase());

    if (!profile) {
      throw new Error(`Browser "${browserName}" not found. Available browsers: ${profiles.map(p => p.name).join(', ')}`);
    }

    for (const cookiePath of profile.cookiePaths) {
      try {
        const expandedPath = this.expandPath(cookiePath);

        if (fs.existsSync(expandedPath)) {
          console.log(`🔍 Found ${browserName} cookies at: ${expandedPath}`);
          // Attempt extraction regardless of extension; Chrome stores as 'Cookies' without extension
          return await this.extractFromSQLite(expandedPath, 'sora.chatgpt.com');
        }
      } catch (error) {
        console.warn(`Could not access ${cookiePath}: ${error}`);
        continue;
      }
    }

    throw new Error(`Could not find ${browserName} cookie database. Make sure the browser is closed.`);
  }

  /**
   * Get available browser profiles for current platform
   */
  private getBrowserProfiles(): BrowserProfile[] {
    const platform = os.platform();
    const home = os.homedir();

    const profiles: BrowserProfile[] = [];

    if (platform === 'darwin') { // macOS
      profiles.push(
        {
          name: 'Chrome',
          platform: 'darwin',
          cookiePaths: [
            `${home}/Library/Application Support/Google/Chrome/Default/Cookies`,
            `${home}/Library/Application Support/Google/Chrome/Profile */Cookies`
          ]
        },
        {
          name: 'Firefox',
          platform: 'darwin',
          cookiePaths: [
            `${home}/Library/Application Support/Firefox/Profiles */cookies.sqlite`
          ]
        },
        {
          name: 'Safari',
          platform: 'darwin',
          cookiePaths: [
            `${home}/Library/Cookies/Cookies.binarycookies`
          ]
        },
        {
          name: 'Edge',
          platform: 'darwin',
          cookiePaths: [
            `${home}/Library/Application Support/Microsoft Edge/Default/Cookies`
          ]
        }
      );
    } else if (platform === 'win32') { // Windows
      profiles.push(
        {
          name: 'Chrome',
          platform: 'win32',
          cookiePaths: [
            `${home}/AppData/Local/Google/Chrome/User Data/Default/Cookies`,
            `${home}/AppData/Local/Google/Chrome/User Data/Profile */Cookies`
          ]
        },
        {
          name: 'Firefox',
          platform: 'win32',
          cookiePaths: [
            `${home}/AppData/Roaming/Mozilla/Firefox/Profiles */cookies.sqlite`
          ]
        },
        {
          name: 'Edge',
          platform: 'win32',
          cookiePaths: [
            `${home}/AppData/Local/Microsoft/Edge/User Data/Default/Cookies`
          ]
        }
      );
    } else { // Linux
      profiles.push(
        {
          name: 'Chrome',
          platform: 'linux',
          cookiePaths: [
            `${home}/.config/google-chrome/Default/Cookies`,
            `${home}/.config/google-chrome/Profile */Cookies`
          ]
        },
        {
          name: 'Firefox',
          platform: 'linux',
          cookiePaths: [
            `${home}/.mozilla/firefox */cookies.sqlite`
          ]
        },
        {
          name: 'Edge',
          platform: 'linux',
          cookiePaths: [
            `${home}/.config/microsoft-edge/Default/Cookies`
          ]
        }
      );
    }

    return profiles;
  }

  /**
   * Expand path with wildcards
   */
  private expandPath(pathPattern: string): string {
    if (pathPattern.includes('*')) {
      const basePath = pathPattern.substring(0, pathPattern.indexOf('*'));
      const dir = path.dirname(basePath);
      const prefix = path.basename(basePath);

      if (fs.existsSync(dir)) {
        const items = fs.readdirSync(dir);
        const match = items.find(item => item.startsWith(prefix));
        if (match) {
          return path.join(dir, match, pathPattern.substring(pathPattern.indexOf('*') + 1));
        }
      }
    }

    return pathPattern;
  }

  /**
   * Extract cookies from SQLite database
   */
  private async extractFromSQLite(dbPath: string, domainHost: string): Promise<string> {
    try {
      const db = await open({
        filename: dbPath,
        driver: sqlite3.Database
      });

      // Chrome/Edge SQLite format
      const cookies = await db.all(
        `SELECT name, value FROM cookies
         WHERE host_key LIKE ? OR host_key = ?`,
        [`%.${domainHost}`, domainHost]
      );

      await db.close();

      if (cookies.length === 0) {
        throw new Error('No cookies found for Sora domain in browser database.');
      }

      const cookieString = cookies
        .map((cookie: any) => `${cookie.name}=${cookie.value}`)
        .join('; ');

      return cookieString;

    } catch (error) {
      throw new Error(`Failed to extract cookies from SQLite: ${error}`);
    }
  }

  /**
   * List available browsers for cookie import
   */
  listAvailableBrowsers(): BrowserProfile[] {
    const profiles = this.getBrowserProfiles();
    const availableBrowsers: BrowserProfile[] = [];

    for (const profile of profiles) {
      for (const cookiePath of profile.cookiePaths) {
        try {
          const expandedPath = this.expandPath(cookiePath);
          if (fs.existsSync(expandedPath)) {
            availableBrowsers.push(profile);
            break; // Add browser once if any path exists
          }
        } catch (error) {
          continue;
        }
      }
    }

    return availableBrowsers;
  }

  /**
   * Validate cookie string by making a test request
   */
  async validateCookies(cookies: string): Promise<boolean> {
    try {
      const axios = require('axios');

      const response = await axios.get('https://sora.chatgpt.com/backend/public/nf2/feed', {
        headers: {
          'Cookie': cookies,
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36'
        },
        timeout: 10000
      });

      return response.status === 200;
    } catch (error) {
      return false;
    }
  }
}