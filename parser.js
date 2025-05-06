const express = require('express');
const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');
const fs = require('fs');
const axios = require('axios');

const app = express();
const PORT = process.env.PORT || 3000;


// Загрузка cookies
async function loadCookies(page) {
  const cookies = JSON.parse(fs.readFileSync('./cookies.json', 'utf-8'));
  await page.setCookie(...cookies);
}


app.get('/check', async (req, res) => {
  try {
    const browser = await puppeteer.launch({
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      args: [
        ...chromium.args,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--start-maximized',
        '--disable-infobars'
      ]
    });

    const page = await browser.newPage();

    // Маскировка под обычного пользователя
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    );
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9'
    });

    // Подгрузка cookies
    const cookies = JSON.parse(fs.readFileSync('./cookies.json', 'utf-8'));
    await page.setCookie(...cookies);
    await page.waitForTimeout(1000)
    await page.goto('https://kwork.ru', { waitUntil: 'networkidle2' });

    // Получаем заголовок, чтобы убедиться, что страница открылась
    const title = await page.title();
    await browser.close();

    res.json({ status: 'ok', title });
  } catch (err) {
    console.error('Ошибка проверки входа:', err);
    res.status(500).json({ error: 'Не удалось зайти на сайт' });
  }
});



app.get('/parse', async (req, res) => {
  const targetUrl = req.query.url;

  if (!targetUrl) {
    return res.status(400).json({ error: 'Missing URL parameter' });
  }

  try {
    const browser = await puppeteer.launch({
      defaultViewport: chromium.defaultViewport,
      executablePath: await chromium.executablePath(),
      headless: chromium.headless,
      args: [
        ...chromium.args,
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-blink-features=AutomationControlled',
        '--start-maximized',
        '--disable-infobars'
      ]
    });

    const page = await browser.newPage();

    // Маскировка под человека
    await page.evaluateOnNewDocument(() => {
      Object.defineProperty(navigator, 'webdriver', { get: () => false });
    });
    await page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'
    );
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'en-US,en;q=0.9'
    });

    // Загрузка cookies
    await loadCookies(page);
    await page.waitForTimeout(1000)
    await page.goto(targetUrl, { waitUntil: 'networkidle2' });

    // Извлекаем заказ и телегу
    const order = await page.evaluate(() => {
      const title = document.querySelector('h1, h2')?.innerText || '';
      const desc = document.querySelector('p, .description')?.innerText || '';
      const tgContact = Array.from(document.querySelectorAll('a, span'))
        .map(e => e.innerText)
        .find(t => t.includes('@'));
      return { title, desc, contact: tgContact || null };
    });

    await browser.close();

    // Отправляем заказ в бэк
    await axios.post('http://backend:8000/orders', order);

    res.json({ status: 'ok', sent: order });
  } catch (err) {
    console.error('Parsing error:', err);
    res.status(500).json({ error: 'Failed to parse page' });
  }
});


app.listen(PORT, () => {
  console.log(`Parser service listening on http://localhost:${PORT}`);
});


app.get('/', (req, res) => {
  res.send('Parser is running ✅');
});

