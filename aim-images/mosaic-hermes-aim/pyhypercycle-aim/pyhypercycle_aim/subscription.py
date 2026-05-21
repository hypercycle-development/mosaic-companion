import os
import time
import hashlib
import json
import asyncio
from filelock import FileLock
from pyhypercycle_aim.exceptions import SubscriptionError


class SubscriptionManager:
    """
        Subscription helper for AIMs.
        *Is not threadsafe. Wrap in a threadsafe mechanism if calling from
         multiple threads/processes.
    """
    @classmethod
    def add_subscription(cls, key, metadata=None, delete_on_expire=True, years=0, months=0,
                              weeks=0, days=0, hours=0, minutes=0, seconds=0):
        deadline = seconds+minutes*60+hours*60*60+days*24*60*60+\
                   weeks*7*24*60*60+months*30*24*60*60+years*365*24*60*60
        if deadline ==0:
            raise SubscriptionError("Invalid deadline: time must be set.")
        if metadata and not isinstance(metadata,dict):
            raise SubscriptionError("Invalid metadata: must be instance of dict.")

        data  = cls.get_subscription(key)
        data['metadata'] = metadata

        data['delete_on_expire'] = delete_on_expire
        data['exists'] = True
        if data['expired']:
            data['expired'] = False
            data['deadline'] = time.time()
        data['deadline'] += deadline
        cls.save_subscription(data)

    @classmethod
    def get_subscription(cls, key):
        os.makedirs("/container_mount/subscriptions", exist_ok=True)
        key_hash = hashlib.sha256(key.encode('utf-8')).hexdigest()
        key_path = f"/container_mount/subscriptions/{key_hash}.json"

        try: 
            data = json.loads(open(key_path).read())
        except:
            data = {"key": key, "metadata": {}, "deadline": time.time(),
                    "delete_on_expire": True, "expired": True, "exists": False}
        return data

    @classmethod
    def save_subscription(cls, data):
        os.makedirs("/container_mount/subscriptions", exist_ok=True)
        key = data['key']
        key_hash = hashlib.sha256(key.encode('utf-8')).hexdigest()
        key_path = f"/container_mount/subscriptions/{key_hash}.json"
        open(key_path, "w").write(json.dumps(data))
        
    @classmethod
    def update_subscription(cls, *args, **kwargs):
        cls.add_subscription(*args, **kwargs)
    
    @classmethod
    def get_all_subscriptions(cls):
        os.makedirs("/container_mount/subscriptions", exist_ok=True)
        for filename in os.listdir("/container_mount/subscriptions"):
            if filename.endswith(".json"):
                yield json.loads(open(f"/container_mount/subscriptions/{filename}").read())

    @classmethod
    def remove_subscription(cls, key):
        os.makedirs("/container_mount/subscriptions", exist_ok=True)
        key_hash = hashlib.sha256(key.encode('utf-8')).hexdigest()
        key_path = f"/container_mount/subscriptions/{key_hash}.json"
        try:
            os.remove(key_path)
        except:
            pass

    @classmethod
    def check_subscription(cls, key):
        data = cls.get_subscription(key)
        if data['deadline'] < time.time():
            if data['delete_on_expire']:
                cls.remove_subscription(key)
                try:
                    cls.remove_callback(key)
                except NotImplementedError:
                    pass
            else:
                data['expired'] = True
                try:
                    cls.expired_callback(key)
                except NotImplementedError:
                    pass

                cls.save_subscription(data)

    @classmethod
    def check_all_subscriptions(cls):
        for subscription in cls.get_all_subscriptions():
            cls.check_subscription(subscription['key'])

    @classmethod
    async def subscription_loop(cls):
        while True:
            cls.check_all_subscriptions()
            await asyncio.sleep(1)

    @classmethod
    def remove_callback(cls):
        raise NotImplementedError()

    @classmethod
    def expired_callback(cls):
        raise NotImplementedError()
