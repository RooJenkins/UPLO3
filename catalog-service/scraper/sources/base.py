"""Base scraper class for all retailer scrapers"""

from abc import ABC, abstractmethod
from typing import List, Optional
import logging
from ..models import ScrapedProduct


logger = logging.getLogger(__name__)


class BaseScraper(ABC):
    """Base class for all product scrapers"""

    def __init__(self, config: dict):
        """
        Initialize scraper with configuration

        Args:
            config: Dictionary with scraper configuration
                - urls: List of URLs to scrape
                - rate_limit: Rate limit (e.g., '1/2s' = 1 request per 2 seconds)
                - max_products: Maximum products to scrape
        """
        self.config = config
        self.brand = self.config.get('brand', 'Unknown')
        self.store = self.config.get('store', 'Unknown')
        self.max_products = self.config.get('max_products', 500)

    @abstractmethod
    async def scrape_listing_page(self, url: str) -> List[str]:
        """
        Extract product URLs from a listing page

        Args:
            url: Listing page URL

        Returns:
            List of product URLs
        """
        pass

    @abstractmethod
    async def scrape_product_detail(self, url: str) -> Optional[ScrapedProduct]:
        """
        Extract product details from a product page

        Args:
            url: Product page URL

        Returns:
            ScrapedProduct or None if scraping failed
        """
        pass

    async def scrape_all(self, limit: Optional[int] = None) -> List[ScrapedProduct]:
        """
        Main scraping orchestration method

        Args:
            limit: Override max_products with custom limit

        Returns:
            List of scraped products
        """
        max_to_scrape = limit if limit is not None else self.max_products
        products = []

        logger.info(f"Starting scrape for {self.store} (limit: {max_to_scrape})")

        for listing_url in self.config.get('urls', []):
            if len(products) >= max_to_scrape:
                break

            try:
                logger.info(f"Scraping listing page: {listing_url}")
                product_urls = await self.scrape_listing_page(listing_url)
                logger.info(f"Found {len(product_urls)} product URLs")

                for product_url in product_urls:
                    if len(products) >= max_to_scrape:
                        break

                    try:
                        product = await self.scrape_product_detail(product_url)
                        if product:
                            products.append(product)
                            logger.debug(f"Scraped product: {product.name}")
                        else:
                            logger.warning(f"Failed to scrape product: {product_url}")

                    except Exception as e:
                        logger.error(f"Error scraping product {product_url}: {e}")
                        continue

            except Exception as e:
                logger.error(f"Error scraping listing page {listing_url}: {e}")
                continue

        logger.info(f"Scrape completed: {len(products)} products from {self.store}")
        return products

    def log_error(self, message: str):
        """Log scraping error"""
        logger.error(f"[{self.store}] {message}")
