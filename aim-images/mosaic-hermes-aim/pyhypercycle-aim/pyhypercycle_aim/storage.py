import json
import hashlib
from pathlib import Path
from filelock import FileLock

class StorageManager:
    _storage_dir = Path("/container_mount/storage_manager")

    @classmethod
    def _safe_key(cls, key: str) -> str:
        # Hash the key to create a safe filename
        return hashlib.sha256(key.encode()).hexdigest()

    @classmethod
    def _file_path(cls, key: str) -> Path:
        cls._storage_dir.mkdir(exist_ok=True)
        return cls._storage_dir / f"{cls._safe_key(key)}.json"

    @classmethod
    def _lock_path(cls, key: str) -> Path:
        return cls._file_path(key).with_suffix(".lock")

    @classmethod
    def _load(cls, key: str) -> dict:
        path = cls._file_path(key)
        if not path.exists():
            return {}
        with open(path, "r") as f:
            return json.load(f)

    @classmethod
    def _save(cls, key: str, data: dict):
        # Ensure original key is stored
        data["_original_key"] = key
        with open(cls._file_path(key), "w") as f:
            json.dump(data, f, indent=2)

    @classmethod
    def store(cls, key: str, field: str, value):
        with FileLock(str(cls._lock_path(key))):
            data = cls._load(key)
            data[field] = value
            cls._save(key, data)

    @classmethod
    def get(cls, key: str, field: str, default=None):
        with FileLock(str(cls._lock_path(key))):
            data = cls._load(key)
            return data.get(field, default)

    @classmethod
    def delete(cls, key: str, field: str):
        with FileLock(str(cls._lock_path(key))):
            data = cls._load(key)
            if field in data:
                del data[field]
                if len(data) == 1 and "_original_key" in data:
                    # Only _original_key left — delete file
                    cls._file_path(key).unlink(missing_ok=True)
                else:
                    cls._save(key, data)
