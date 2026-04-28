"""
Klient Pusher Channels — singleton inicjalizowany raz przy starcie aplikacji.
Używany do wysyłania eventów real-time (czat P2P).
"""
import os
import pusher

pusher_client = pusher.Pusher(
    app_id=os.getenv("PUSHER_APP_ID", "2147829"),
    key=os.getenv("PUSHER_KEY", "bd08de491433f589a091"),
    secret=os.getenv("PUSHER_SECRET", "7cc3f2bae306dda4dfb0"),
    cluster=os.getenv("PUSHER_CLUSTER", "eu"),
    ssl=True,
)
