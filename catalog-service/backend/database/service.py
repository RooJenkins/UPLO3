"""Database service for querying product data"""

import os
import psycopg2
from psycopg2.extras import RealDictCursor
from typing import List, Optional, Dict, Any
import logging

logger = logging.getLogger('uplo-db-api.database')


class DatabaseService:
    """Service for querying product catalog from PostgreSQL"""

    def __init__(self, database_url: str = None):
        self.database_url = database_url or os.getenv('DATABASE_URL')
        if not self.database_url:
            raise ValueError("DATABASE_URL environment variable is required")

    def _get_connection(self):
        """Get database connection"""
        return psycopg2.connect(self.database_url, cursor_factory=RealDictCursor)

    def get_feed(
        self,
        limit: int = 100,
        cursor: Optional[str] = None,
        category: Optional[str] = None,
        brand: Optional[str] = None,
        in_stock: bool = True
    ) -> Dict[str, Any]:
        """
        Get paginated product feed

        Args:
            limit: Number of products to return
            cursor: Pagination cursor (product_id)
            category: Filter by category
            brand: Filter by brand name
            in_stock: Filter by stock status

        Returns:
            Dictionary with items and next_cursor
        """
        conn = None
        try:
            conn = self._get_connection()
            cur = conn.cursor()

            # Build query
            query = """
                SELECT
                    p.id as product_id,
                    b.name as brand_name,
                    s.name as store_name,
                    p.name,
                    p.description,
                    p.category,
                    p.product_url,
                    p.buy_url,
                    p.updated_at,
                    COALESCE(
                        (SELECT json_agg(pi.src_url ORDER BY pi.position)
                         FROM product_images pi
                         WHERE pi.product_id = p.id
                         LIMIT 3),
                        '[]'::json
                    ) as image_urls,
                    COALESCE(
                        (SELECT MIN(v.price_cents) FROM variants v WHERE v.product_id = p.id),
                        0
                    ) as min_price_cents,
                    COALESCE(
                        (SELECT MAX(v.price_cents) FROM variants v WHERE v.product_id = p.id),
                        0
                    ) as max_price_cents,
                    COALESCE(
                        (SELECT json_agg(DISTINCT v.color) FROM variants v WHERE v.product_id = p.id AND v.color IS NOT NULL),
                        '[]'::json
                    ) as available_colors,
                    COALESCE(
                        (SELECT json_agg(DISTINCT v.size) FROM variants v WHERE v.product_id = p.id AND v.size IS NOT NULL),
                        '[]'::json
                    ) as available_sizes,
                    COALESCE(
                        (SELECT bool_or(v.in_stock) FROM variants v WHERE v.product_id = p.id),
                        true
                    ) as in_stock
                FROM products p
                JOIN brands b ON p.brand_id = b.id
                JOIN stores s ON p.store_id = s.id
                WHERE 1=1
            """

            params = []

            if cursor:
                query += " AND p.id > %s"
                params.append(int(cursor))

            if category:
                query += " AND p.category = %s"
                params.append(category)

            if brand:
                query += " AND b.name = %s"
                params.append(brand)

            if in_stock:
                query += """ AND EXISTS (
                    SELECT 1 FROM variants v
                    WHERE v.product_id = p.id AND v.in_stock = true
                )"""

            query += " ORDER BY p.id ASC LIMIT %s"
            params.append(limit + 1)  # Fetch one extra to determine if there's more

            cur.execute(query, params)
            rows = cur.fetchall()

            # Determine if there's a next page
            has_more = len(rows) > limit
            items = rows[:limit]
            next_cursor = str(items[-1]['product_id']) if has_more and items else None

            # Convert RealDictRow objects to regular dicts for JSON serialization
            items_list = [dict(item) for item in items]

            return {
                'items': items_list,
                'next_cursor': next_cursor
            }

        except Exception as e:
            logger.error(f"Error fetching feed: {e}")
            raise
        finally:
            if conn:
                conn.close()

    def get_product(self, product_id: int) -> Optional[Dict[str, Any]]:
        """
        Get single product with full details

        Args:
            product_id: Product ID

        Returns:
            Product dictionary or None
        """
        conn = None
        try:
            conn = self._get_connection()
            cur = conn.cursor()

            # Get product with images and variants
            cur.execute("""
                SELECT
                    p.id as product_id,
                    b.name as brand_name,
                    s.name as store_name,
                    p.name,
                    p.description,
                    p.category,
                    p.product_url,
                    p.buy_url,
                    p.created_at,
                    p.updated_at
                FROM products p
                JOIN brands b ON p.brand_id = b.id
                JOIN stores s ON p.store_id = s.id
                WHERE p.id = %s
            """, (product_id,))

            product = cur.fetchone()
            if not product:
                return None

            # Get images
            cur.execute("""
                SELECT src_url, cdn_url, position
                FROM product_images
                WHERE product_id = %s
                ORDER BY position
            """, (product_id,))
            images = cur.fetchall()

            # Get variants
            cur.execute("""
                SELECT color, size, sku, price_cents, in_stock
                FROM variants
                WHERE product_id = %s
                ORDER BY color, size
            """, (product_id,))
            variants = cur.fetchall()

            product['images'] = images
            product['variants'] = variants

            return product

        except Exception as e:
            logger.error(f"Error fetching product {product_id}: {e}")
            raise
        finally:
            if conn:
                conn.close()

    def get_stats(self) -> Dict[str, Any]:
        """
        Get catalog statistics

        Returns:
            Statistics dictionary
        """
        conn = None
        try:
            conn = self._get_connection()
            cur = conn.cursor()

            # Total products
            cur.execute("SELECT COUNT(*) as total FROM products")
            total_products = cur.fetchone()['total']

            # Total brands
            cur.execute("SELECT COUNT(*) as total FROM brands WHERE is_active = true")
            total_brands = cur.fetchone()['total']

            # Products by brand
            cur.execute("""
                SELECT b.name, COUNT(p.id) as count
                FROM brands b
                LEFT JOIN products p ON b.id = p.brand_id
                WHERE b.is_active = true
                GROUP BY b.name
                ORDER BY count DESC
            """)
            by_brand = {row['name']: row['count'] for row in cur.fetchall()}

            # Products by category
            cur.execute("""
                SELECT category, COUNT(*) as count
                FROM products
                WHERE category IS NOT NULL
                GROUP BY category
                ORDER BY count DESC
            """)
            by_category = {row['category']: row['count'] for row in cur.fetchall()}

            return {
                'total_products': total_products,
                'total_brands': total_brands,
                'by_brand': by_brand,
                'by_category': by_category
            }

        except Exception as e:
            logger.error(f"Error fetching stats: {e}")
            return {
                'total_products': 0,
                'total_brands': 0,
                'by_brand': {},
                'by_category': {}
            }
        finally:
            if conn:
                conn.close()


# Singleton instance
_db_service = None


def getDatabaseService() -> DatabaseService:
    """Get or create singleton database service instance"""
    global _db_service
    if _db_service is None:
        _db_service = DatabaseService()
    return _db_service
