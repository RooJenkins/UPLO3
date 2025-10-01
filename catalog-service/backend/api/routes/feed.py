"""
Feed API Routes
Paginated product feed with filtering and caching
"""

from fastapi import APIRouter, Query, HTTPException
from typing import Optional, List
from pydantic import BaseModel, Field
from datetime import datetime
import logging
import os
import sys

# Add parent directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../..'))

from backend.database import getDatabaseService

logger = logging.getLogger('uplo-db-api.feed')

router = APIRouter(tags=["feed"])

# Response models
class FeedItem(BaseModel):
    """Product feed item with denormalized data for fast loading"""
    product_id: int
    brand_name: str
    store_name: str
    name: str
    description: Optional[str]
    category: str
    image_urls: List[str] = Field(description="First 3 product images")
    min_price_cents: int
    max_price_cents: Optional[int]
    available_colors: List[str]
    available_sizes: List[str]
    in_stock: bool
    product_url: str
    buy_url: str
    updated_at: datetime

class FeedResponse(BaseModel):
    """Paginated feed response"""
    items: List[FeedItem]
    next_cursor: Optional[str] = Field(description="Opaque cursor for next page")
    catalog_version: str = Field(description="Catalog version for cache invalidation")
    total_count: Optional[int] = Field(description="Total products matching filter (optional)")

@router.get("/feed", response_model=FeedResponse)
async def get_feed(
    cursor: Optional[str] = Query(None, description="Pagination cursor from previous response"),
    limit: int = Query(100, ge=1, le=100, description="Items per page (max 100)"),
    brand: Optional[str] = Query(None, description="Filter by brand name"),
    category: Optional[str] = Query(None, description="Filter by category slug"),
    in_stock: bool = Query(True, description="Only show in-stock items"),
    price_min: Optional[int] = Query(None, description="Minimum price in cents"),
    price_max: Optional[int] = Query(None, description="Maximum price in cents"),
):
    """
    Get paginated product feed with optional filtering

    Performance targets:
    - Cached response: <50ms
    - Cold query: <150ms

    Caching:
    - CDN caches for 60 minutes
    - Use X-Catalog-Version header for cache invalidation
    """
    try:
        db = getDatabaseService()

        # Build search parameters
        search_params = {
            "brand": brand,
            "category": category,
            "in_stock": in_stock,
            "limit": limit,
            "offset": 0  # TODO: Implement cursor-based pagination
        }

        if price_min is not None or price_max is not None:
            search_params["price_range"] = {
                "min": price_min or 0,
                "max": price_max or 999999999
            }

        # Search products from database
        result = db.search_products(**search_params)

        # Transform to feed items
        feed_items = []
        for product in result.get("products", []):
            # Extract first 3 image URLs
            images = []
            if hasattr(product, 'images') and product.images:
                images = [img.get("cdnUrl") or img.get("url") for img in product.images[:3]]

            # Extract colors and sizes from variants
            colors = list(set(v.get("color") for v in product.get("variants", []) if v.get("color")))
            sizes = list(set(v.get("size") for v in product.get("variants", []) if v.get("size")))

            # Get price range from variants
            variant_prices = [v.get("price", 0) for v in product.get("variants", []) if v.get("available")]
            min_price = min(variant_prices) if variant_prices else product.get("basePrice", 0)
            max_price = max(variant_prices) if len(variant_prices) > 1 else None

            feed_items.append(FeedItem(
                product_id=product.get("id"),
                brand_name=product.get("brand", "Unknown"),
                store_name=product.get("brand", "Unknown"),  # TODO: Separate store from brand
                name=product.get("name", ""),
                description=product.get("description"),
                category=product.get("category", "other"),
                image_urls=images,
                min_price_cents=min_price,
                max_price_cents=max_price,
                available_colors=colors,
                available_sizes=sizes,
                in_stock=any(v.get("available") for v in product.get("variants", [])),
                product_url=product.get("url", ""),
                buy_url=product.get("url", ""),
                updated_at=product.get("lastScraped", datetime.utcnow())
            ))

        logger.info(f"✅ Feed query returned {len(feed_items)} items (brand={brand}, category={category})")

        # Build response
        response = FeedResponse(
            items=feed_items,
            next_cursor=None,  # TODO: Implement cursor pagination
            catalog_version=datetime.utcnow().isoformat(),
            total_count=result.get("total", len(feed_items))
        )

        return response

    except Exception as e:
        logger.error(f"❌ Feed query failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Feed query failed")
