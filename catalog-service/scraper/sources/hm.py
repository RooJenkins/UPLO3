"""H&M product scraper"""

from typing import List, Optional
from playwright.async_api import async_playwright
from .base import BaseScraper
from ..models import ScrapedProduct, ProductVariant
import logging
import asyncio


logger = logging.getLogger(__name__)


class HMScraper(BaseScraper):
    """Scraper for H&M products"""

    def __init__(self, config: dict):
        super().__init__(config)
        self.brand = "H&M"
        self.store = "H&M"

    async def scrape_listing_page(self, url: str) -> List[str]:
        """
        Extract product URLs from H&M listing page

        Args:
            url: H&M category page URL

        Returns:
            List of product URLs
        """
        product_urls = []

        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()

            try:
                await page.goto(url, wait_until='networkidle', timeout=30000)

                # Wait for product items to load
                await page.wait_for_selector('.product-item', timeout=10000)

                # Extract product links
                links = await page.eval_on_selector_all(
                    '.product-item a',
                    """elements => elements.map(el => {
                        const href = el.getAttribute('href');
                        return href && href.startsWith('/') ? 'https://www2.hm.com' + href : href;
                    }).filter(href => href && href.includes('/productpage'))"""
                )

                product_urls = list(set(links))  # Remove duplicates
                logger.info(f"Found {len(product_urls)} unique product URLs")

            except Exception as e:
                logger.error(f"Error scraping H&M listing page: {e}")

            finally:
                await browser.close()

        return product_urls

    async def scrape_product_detail(self, url: str) -> Optional[ScrapedProduct]:
        """
        Extract product details from H&M product page

        Args:
            url: H&M product page URL

        Returns:
            ScrapedProduct or None if scraping failed
        """
        async with async_playwright() as p:
            browser = await p.chromium.launch(headless=True)
            page = await browser.new_page()

            try:
                await page.goto(url, wait_until='networkidle', timeout=30000)

                # Wait for product details to load
                await page.wait_for_selector('.product-detail', timeout=10000)

                # Extract product data
                data = await page.evaluate("""() => {
                    // Extract product name
                    const nameEl = document.querySelector('h1.product-item-headline');
                    const name = nameEl ? nameEl.textContent.trim() : '';

                    // Extract description
                    const descEl = document.querySelector('.product-description');
                    const description = descEl ? descEl.textContent.trim() : '';

                    // Extract price
                    const priceEl = document.querySelector('.price-value');
                    const priceText = priceEl ? priceEl.textContent.trim() : '0';
                    const priceMatch = priceText.match(/[\\d.]+/);
                    const price = priceMatch ? parseFloat(priceMatch[0]) : 0;

                    // Extract images
                    const imageElements = document.querySelectorAll('.product-detail-main-image-container img');
                    const images = Array.from(imageElements)
                        .map(img => img.getAttribute('src'))
                        .filter(src => src && src.startsWith('http'))
                        .slice(0, 5);

                    // Extract product ID from URL or data attribute
                    const productIdMatch = window.location.href.match(/\\.([0-9]+)\\.html/);
                    const productId = productIdMatch ? productIdMatch[1] : Date.now().toString();

                    // Extract available sizes
                    const sizeElements = document.querySelectorAll('.product-size-list .size-list-item');
                    const sizes = Array.from(sizeElements).map(el => {
                        const sizeText = el.textContent.trim();
                        const available = !el.classList.contains('out-of-stock');
                        return { size: sizeText, available };
                    });

                    return {
                        name,
                        description,
                        price,
                        images,
                        productId,
                        sizes
                    };
                }""")

                # Create product variants
                variants = []
                if data.get('sizes'):
                    for size_info in data['sizes']:
                        variants.append(ProductVariant(
                            size=size_info['size'],
                            price_cents=int(data['price'] * 100),
                            in_stock=size_info['available']
                        ))
                else:
                    # Default variant if no sizes found
                    variants.append(ProductVariant(
                        price_cents=int(data['price'] * 100),
                        in_stock=True
                    ))

                # Determine category from URL
                category = 'other'
                if '/men/' in url:
                    category = 'mens'
                elif '/women/' in url or '/ladies/' in url:
                    category = 'womens'
                if 't-shirts' in url or 'tops' in url:
                    category += '-tops'
                elif 'dress' in url:
                    category = 'dresses'
                elif 'jeans' in url or 'pants' in url:
                    category += '-bottoms'

                # Create ScrapedProduct
                product = ScrapedProduct(
                    external_id=data['productId'],
                    name=data['name'],
                    description=data['description'],
                    category=category,
                    brand=self.brand,
                    store=self.store,
                    product_url=url,
                    buy_url=url,
                    images=data['images'],
                    variants=variants
                )

                await browser.close()
                return product

            except Exception as e:
                logger.error(f"Error scraping H&M product {url}: {e}")
                await browser.close()
                return None


# Default configuration for H&M scraper
HM_CONFIG = {
    'brand': 'H&M',
    'store': 'H&M',
    'urls': [
        'https://www2.hm.com/en_us/men/products/t-shirts-tank-tops.html',
        'https://www2.hm.com/en_us/women/products/dresses.html',
        'https://www2.hm.com/en_us/men/products/jeans.html',
        'https://www2.hm.com/en_us/women/products/tops.html'
    ],
    'rate_limit': '1/2s',  # 1 request per 2 seconds
    'max_products': 500
}
