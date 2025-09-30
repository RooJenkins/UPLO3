"""Data models for scraped products"""

from pydantic import BaseModel, HttpUrl
from typing import List, Optional


class ProductVariant(BaseModel):
    """Represents a product variant (color/size combination)"""
    color: Optional[str] = None
    size: Optional[str] = None
    sku: Optional[str] = None
    price_cents: int
    in_stock: bool = True


class ScrapedProduct(BaseModel):
    """Represents a scraped product with all details"""
    external_id: str
    name: str
    description: Optional[str] = None
    category: str
    brand: str
    store: str
    product_url: str
    buy_url: str
    images: List[str]  # Image URLs
    variants: List[ProductVariant]

    class Config:
        json_schema_extra = {
            "example": {
                "external_id": "123456",
                "name": "Classic White T-Shirt",
                "description": "100% cotton, relaxed fit",
                "category": "tops",
                "brand": "H&M",
                "store": "H&M",
                "product_url": "https://www2.hm.com/product/123456",
                "buy_url": "https://www2.hm.com/product/123456",
                "images": [
                    "https://images.hm.com/img1.jpg",
                    "https://images.hm.com/img2.jpg"
                ],
                "variants": [
                    {
                        "color": "White",
                        "size": "M",
                        "sku": "HM-TS-001-M",
                        "price_cents": 1999,
                        "in_stock": True
                    }
                ]
            }
        }
