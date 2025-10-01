"""
Product Detail API Routes
Individual product information with full variant and image data
"""

from fastapi import APIRouter, HTTPException, Path
from typing import Optional, List
from pydantic import BaseModel, Field
from datetime import datetime
import logging
import os
import sys

# Add parent directory to path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '../../..'))

from backend.database import getDatabaseService

logger = logging.getLogger('uplo-db-api.products')

router = APIRouter(tags=["products"])

# Response models
class ProductBrand(BaseModel):
    name: str
    logo_url: Optional[str]

class ProductStore(BaseModel):
    name: str
    domain: Optional[str]

class ProductImage(BaseModel):
    src_url: str
    cdn_url: Optional[str]
    position: int

class ProductVariant(BaseModel):
    id: int
    color: Optional[str]
    size: Optional[str]
    sku: Optional[str]
    price_cents: int
    in_stock: bool

class ProductDetail(BaseModel):
    """Complete product information"""
    id: int
    brand: ProductBrand
    store: ProductStore
    name: str
    description: Optional[str]
    category: str
    images: List[ProductImage]
    variants: List[ProductVariant]
    product_url: str
    buy_url: str
    materials: Optional[List[str]]
    care_instructions: Optional[List[str]]
    tags: Optional[List[str]]
    gender: Optional[str]
    season: Optional[str]
    updated_at: datetime

@router.get("/product/{product_id}", response_model=ProductDetail)
async def get_product_detail(
    product_id: int = Path(..., description="Product ID", ge=1)
):
    """
    Get detailed product information

    Performance targets:
    - Cached response: <30ms
    - Cold query: <100ms

    Returns:
    - Full product details with all variants and images
    - Complete size/color availability
    - Buy URL for in-app browser
    """
    try:
        db = getDatabaseService()

        # Get product from database
        product = db.get_product_by_id(product_id)

        if not product:
            logger.warning(f"⚠️  Product not found: {product_id}")
            raise HTTPException(status_code=404, detail=f"Product {product_id} not found")

        # Transform to API format
        # Brand
        brand = ProductBrand(
            name=product.get("brand", "Unknown"),
            logo_url=f"https://logo.clearbit.com/{product.get('brand', '').lower().replace(' ', '')}.com"
        )

        # Store (same as brand for now)
        store = ProductStore(
            name=product.get("brand", "Unknown"),
            domain=extract_domain(product.get("url", ""))
        )

        # Images
        images = []
        for i, img in enumerate(product.get("images", [])):
            images.append(ProductImage(
                src_url=img.get("url", ""),
                cdn_url=img.get("cdnUrl"),
                position=i
            ))

        # Variants
        variants = []
        for v in product.get("variants", []):
            variants.append(ProductVariant(
                id=v.get("id"),
                color=v.get("color"),
                size=v.get("size"),
                sku=v.get("sku"),
                price_cents=v.get("price", 0),
                in_stock=v.get("available", False)
            ))

        # Build detail response
        detail = ProductDetail(
            id=product.get("id"),
            brand=brand,
            store=store,
            name=product.get("name", ""),
            description=product.get("description"),
            category=product.get("category", "other"),
            images=images,
            variants=variants,
            product_url=product.get("url", ""),
            buy_url=product.get("url", ""),
            materials=product.get("materials", []),
            care_instructions=product.get("careInstructions", []),
            tags=product.get("tags", []),
            gender=product.get("gender"),
            season=product.get("season"),
            updated_at=product.get("lastScraped", datetime.utcnow())
        )

        logger.info(f"✅ Product detail returned: {product_id} - {product.get('name')}")

        return detail

    except HTTPException:
        raise  # Re-raise HTTP exceptions
    except Exception as e:
        logger.error(f"❌ Product detail query failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail="Product query failed")

def extract_domain(url: str) -> str:
    """Extract domain from URL"""
    if not url:
        return ""

    # Remove protocol
    if "://" in url:
        url = url.split("://")[1]

    # Get domain part
    domain = url.split("/")[0]

    return domain
