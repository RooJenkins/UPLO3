"""Main entry point for running scrapers"""

import asyncio
import argparse
import logging
import sys
from typing import List
from sources.hm import HMScraper, HM_CONFIG
from models import ScrapedProduct


# Setup logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler('scraper.log')
    ]
)
logger = logging.getLogger(__name__)


# Scraper registry
SCRAPERS = {
    'hm': (HMScraper, HM_CONFIG),
    # Add more scrapers here as they're implemented
    # 'asos': (ASOSScraper, ASOS_CONFIG),
    # 'zara': (ZaraScraper, ZARA_CONFIG),
}


async def run_scraper(source: str, limit: int = None) -> List[ScrapedProduct]:
    """
    Run a specific scraper

    Args:
        source: Scraper source ID (e.g., 'hm', 'asos')
        limit: Maximum products to scrape (overrides config)

    Returns:
        List of scraped products
    """
    if source not in SCRAPERS:
        logger.error(f"Unknown scraper source: {source}")
        logger.info(f"Available sources: {', '.join(SCRAPERS.keys())}")
        return []

    scraper_class, config = SCRAPERS[source]
    logger.info(f"Initializing {source} scraper...")

    scraper = scraper_class(config)
    products = await scraper.scrape_all(limit=limit)

    logger.info(f"Scraping completed: {len(products)} products from {source}")
    return products


async def run_all_scrapers(limit: int = None) -> dict:
    """
    Run all available scrapers

    Args:
        limit: Maximum products per scraper

    Returns:
        Dictionary mapping source to list of products
    """
    results = {}

    for source in SCRAPERS.keys():
        logger.info(f"\n{'='*60}")
        logger.info(f"Starting scraper: {source}")
        logger.info(f"{'='*60}\n")

        products = await run_scraper(source, limit)
        results[source] = products

        logger.info(f"\n{source}: {len(products)} products scraped\n")

    return results


def main():
    """Main CLI entry point"""
    parser = argparse.ArgumentParser(
        description='UPLO-DB Product Scraper',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Scrape H&M with default limit
  python run.py --source hm

  # Scrape H&M with custom limit
  python run.py --source hm --limit 50

  # Scrape all sources
  python run.py --all

  # Scrape all sources with limit
  python run.py --all --limit 100
        """
    )

    parser.add_argument(
        '--source',
        type=str,
        choices=list(SCRAPERS.keys()),
        help='Scraper source to run'
    )

    parser.add_argument(
        '--all',
        action='store_true',
        help='Run all available scrapers'
    )

    parser.add_argument(
        '--limit',
        type=int,
        help='Maximum products to scrape (overrides config)'
    )

    parser.add_argument(
        '--list',
        action='store_true',
        help='List available scrapers and exit'
    )

    parser.add_argument(
        '--verbose',
        '-v',
        action='store_true',
        help='Enable verbose logging'
    )

    args = parser.parse_args()

    # Set log level
    if args.verbose:
        logging.getLogger().setLevel(logging.DEBUG)

    # List available scrapers
    if args.list:
        print("\nAvailable scrapers:")
        for source_id, (scraper_class, config) in SCRAPERS.items():
            print(f"  - {source_id}: {config.get('store', 'Unknown')}")
        print()
        sys.exit(0)

    # Validate arguments
    if not args.source and not args.all:
        parser.error('Either --source or --all must be specified')

    # Run scrapers
    logger.info("UPLO-DB Scraper Starting...")

    try:
        if args.all:
            logger.info(f"Running ALL scrapers (limit: {args.limit or 'default'})")
            results = asyncio.run(run_all_scrapers(limit=args.limit))

            # Print summary
            print("\n" + "="*60)
            print("SCRAPING SUMMARY")
            print("="*60)
            total = 0
            for source, products in results.items():
                count = len(products)
                total += count
                print(f"{source:10s}: {count:4d} products")
            print("-"*60)
            print(f"{'TOTAL':10s}: {total:4d} products")
            print("="*60 + "\n")

        else:
            logger.info(f"Running {args.source} scraper (limit: {args.limit or 'default'})")
            products = asyncio.run(run_scraper(args.source, limit=args.limit))

            print(f"\nScraped {len(products)} products from {args.source}\n")

        logger.info("Scraping completed successfully")

    except KeyboardInterrupt:
        logger.info("\nScraping interrupted by user")
        sys.exit(1)

    except Exception as e:
        logger.error(f"Scraping failed: {e}", exc_info=True)
        sys.exit(1)


if __name__ == "__main__":
    main()
