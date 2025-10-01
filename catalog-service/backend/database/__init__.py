"""Database service module for UPLO-DB API"""

from .service import DatabaseService, getDatabaseService


class SyncManager:
    """Manages database synchronization metadata"""

    def get_stats(self):
        """Get sync statistics"""
        import datetime
        return {
            "last_sync": datetime.datetime.now().isoformat(),
            "total_syncs": 0,
            "status": "active"
        }


_sync_manager = None


def getSyncManager():
    """Get or create singleton sync manager instance"""
    global _sync_manager
    if _sync_manager is None:
        _sync_manager = SyncManager()
    return _sync_manager


__all__ = ['DatabaseService', 'getDatabaseService', 'SyncManager', 'getSyncManager']
