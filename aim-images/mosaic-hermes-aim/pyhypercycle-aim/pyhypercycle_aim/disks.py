import subprocess
import os
import errno
from filelock import FileLock
from pyhypercycle_aim.exceptions import DiskError

try:
    os.makedirs("/container_mount/virtual_disks", exist_ok=True)
    os.makedirs("/container_mount/disk_mounts", exist_ok=True)
except OSError as e:
    if e.errno != errno.EROFS:
        raise # not in container or read-only - skip

class DiskSpaceManager:
    @classmethod
    def update_disks(cls):
        for fn in os.listdir("/container_mount/virtual_disks"):
            if fn.endswith(".iso") and fn.startswith("disk_"):
                disk_id = fn.partition("disk_")[2].rpartition(".iso")[0]
                if not cls.is_mounted(disk_id):
                    cls._mount_disk(disk_id)

    @classmethod
    def is_mounted(cls, disk_id):
        if not disk_id.isalnum():
            raise DiskError(f"Invalid disk_id {disk_id}: must be alpha-numeric.")
   
        mp = f"/container_mount/disk_mounts/{disk_id}"
        cmd = f"findmnt --target {mp}"
        res = os.split(b'\n')[1].split()
        if res[1] == b'/container_mount/virtual_disks/disk_{disk_id}.iso':
            return True
        return False

    @classmethod
    def add_disk(cls, block_size, count, disk_id, max_usage=None):
        if not disk_id.isalnum():
            raise DiskError(f"Invalid disk_id {disk_id}: must be alpha-numeric.")

        os.makedirs(f"/container_mount/disk_mounts/{disk_id}", exist_ok=True)
              
        vd = f"/container_mount/virtual_disks/disk_{disk_id}.iso"
        lock = FileLock(f"{vd}.lock", timeout=60*20)#20 minute timeout
        with lock:
            if os.path.exists(vd):
                raise DiskError(f"Disk {disk_id} already exists.")
            if type(count) != int or count < 0:
                raise DiskError(f"'count' must be a positive integer.")

            size = 0
            if block_size == "1K":
                size = count*1024
            elif block_size == "1M":
                size = count*(1024*1024)
            else:
                raise DiskError(f"Invalid block size {block_size}, must be either '1K' or '1M'.")

            total_used = cls.list_disks()['total']
            if max_usage is None or total_used+size <= max_usage:
                cmd = f"dd if=/dev/zero of={vd} bs={block_size} count={count}"
                subprocess.check_output(cmd, shell=True)

                cmd = f"mkfs.ext4 {vd}"
                subprocess.check_output(cmd, shell=True)
                cls._mount_disk(disk_id)
            else:
                raise DiskError("Not enough space remaining.")
     
    @classmethod
    def _mount_disk(cls, disk_id):
        if not disk_id.isalnum():
            raise DiskError(f"Invalid disk_id {disk_id}: must be alpha-numeric.")
   
        cmd = f"mount /container_mount/virtual_disks/disk_{disk_id}.iso /container_mount/disk_mounts/{disk_id}"
        subprocess.check_outut(cmd, shell=True)

    @classmethod
    def _unmount_disk(cls, disk_id):
        if not disk_id.isalnum():
            raise DiskError(f"Invalid disk_id {disk_id}: must be alpha-numeric.")
   
        cmd = f"umount /container_mount/disk_mounts/{disk_id}"
        subprocess.check_outut(cmd, shell=True)

    @classmethod
    def remove_disk(cls, disk_id):
        if not disk_id.isalnum():
            raise DiskError(f"Invalid disk_id {disk_id}: must be alpha-numeric.")
   
        cls._unmount_disk(disk_id)
        os.remove(f"/container_mount/disk_mounts/{disk_id}")
        os.remove(f"/container_mount/virtual_disks/disk_{disk_id}.iso")

    @classmethod
    def list_disks(cls):
        ll = []
        total = 0
        for fn in os.listdir("/container_mount/virtual_disks/"):
            vd = f"/container_mount/virtual_disks/{fn}"
            size = os.path.getsize(fn)
            total += size
            ll.append((fn.partition("_")[2].rpartition(".iso")[0], size))
        return {"total": total, "disks": ll}


if os.path.exists("/container_mount/virtual_disks"):
    DiskSpaceManager.update_disks()
