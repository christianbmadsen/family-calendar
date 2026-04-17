import firebase_admin
from firebase_admin import credentials, firestore
from config import settings

cred = credentials.Certificate(settings.firebase_credentials_path)
firebase_admin.initialize_app(cred)
db: firestore.Client = firestore.client()
