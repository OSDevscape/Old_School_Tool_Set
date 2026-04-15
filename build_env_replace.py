from pathlib import Path
import os

replacements = {
    "__FIREBASE_API_KEY__": os.environ.get("FIREBASE_API_KEY", ""),
    "__FIREBASE_AUTH_DOMAIN__": os.environ.get("FIREBASE_AUTH_DOMAIN", ""),
    "__FIREBASE_PROJECT_ID__": os.environ.get("FIREBASE_PROJECT_ID", ""),
    "__FIREBASE_STORAGE_BUCKET__": os.environ.get("FIREBASE_STORAGE_BUCKET", ""),
    "__FIREBASE_MESSAGING_SENDER_ID__": os.environ.get("FIREBASE_MESSAGING_SENDER_ID", ""),
    "__FIREBASE_APP_ID__": os.environ.get("FIREBASE_APP_ID", ""),
    "__FIREBASE_MEASUREMENT_ID__": os.environ.get("FIREBASE_MEASUREMENT_ID", ""),
    "__VAPID_KEY__": os.environ.get("VAPID_KEY", ""),
}

for name in ["bootstrap.js", "sw.js"]:
    p = Path(name)
    txt = p.read_text(encoding="utf-8")
    for k, v in replacements.items():
        txt = txt.replace(k, v)
    p.write_text(txt, encoding="utf-8")