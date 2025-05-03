const express = require('express');
const puppeteer = require('puppeteer');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/parse', async (req, res) => {
  const url = req.query.url;

  if (!url) {
    return res.status(400).json({ error: 'Missing URL parameter' });
  }

  try {
    const browser = await puppeteer.launch({
      headless: 'new',
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: 'domcontentloaded' });

    // Пример: достаём заголовки заказов
    const data = await page.evaluate(() => {
      const titles = Array.from(document.querySelectorAll('h1, h2, h3'))
        .map(el => el.innerText)
        .filter(Boolean);
      return titles.slice(0, 5); // первые 5 заголовков
    });

    await browser.close();
    res.json({ url, titles: data });
  } catch (err) {
    console.error('Parsing error:', err);
    res.status(500).json({ error: 'Failed to parse page' });
  }
});

app.get('/', (req, res) => {
  res.send('Parser is running');
});

app.listen(PORT, () => {
  console.log(`Parser service listening at http://localhost:${PORT}`);
});
