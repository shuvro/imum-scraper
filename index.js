const puppeteer = require('puppeteer');
const cheerio = require('cheerio')
const fs = require('fs')

const baseUrl = 'https://www.otomoto.pl/ciezarowe/uzytkowe/mercedes-benz/%20od-2014/q-actros?%20search%5Bfilter_enum_damaged%5D=0&search%5Border%5D=created_at%20%3Adesc'
let targetUrl = baseUrl
let totalAds = 0
let allAds = []

const getNextPageUrl = (currentPage = 1) => {
  return `${baseUrl}&page=${currentPage + 1}`
}


const addItems = (ad) => {
  const $ = cheerio.load(ad);
  const id = $('article').attr('id')
  const itemUrl = $('[data-testid="ad-title"] > a').attr('href')
  return {id, itemUrl}
}

const getTotalAdsCount = (ads) => {
  totalAds = totalAds + ads.length
  return totalAds
}

const scrapeTruckItem = (ad) => {
  const $ = cheerio.load(ad);
  const title = $('div:nth-of-type(1) > h2 > a').text()
  const price = $('div:nth-of-type(3) > span').text()
  const regYear = $('div:nth-of-type(1) > div > ul > li:nth-of-type(1)').text()
  const mileage = $('div:nth-of-type(1) > div > ul > li:nth-of-type(2)').text()
  const power = $('div:nth-of-type(1) > div > ul > li:nth-of-type(3)').text()
  return { title, price, regYear, mileage, power }
}

const fetchPage = async (page) => {
  const ads = await page.evaluate(() => { return  Array.from(document.querySelectorAll('[data-testid="search-results"] article'), element => element.outerHTML)});
  getTotalAdsCount(ads)
  const items = []
  for (const ad of ads) {
    const item = addItems(ad)
    const truckItem = scrapeTruckItem(ad)
    items.push({...item, ...truckItem})
  }
  return items
}

const scrapeAllPageAndAds = async () => {
  const browser = await puppeteer.launch();
  const [page] = await browser.pages();
  await page.goto(`${targetUrl}`, {waitUntil: "networkidle0"});

  const currentPage = await page.evaluate(() => {return document.querySelector('.pagination-item__active a > span').textContent})

  if (parseInt(currentPage)) {
    const parsedAds = await fetchPage(page)
    if (parsedAds.length) {
      allAds.push(...parsedAds)
    }
  }

  const isLastPage = await page.evaluate(() => {return document.querySelector('[data-testid="pagination-step-forwards"]').ariaDisabled})
  let nextPageUrl = '';
  if (isLastPage === 'false') {
    nextPageUrl = getNextPageUrl(parseInt(currentPage))
  }
  await browser.close()
  return nextPageUrl

}
(async function() {
  while (targetUrl !== '') {
    targetUrl = await scrapeAllPageAndAds()
    console.log(totalAds)
    console.log(targetUrl)
  }
  fs.writeFileSync('ads.json', JSON.stringify(allAds), 'utf-8')
  console.log('completed')
  return allAds
})();
