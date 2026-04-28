import { initializeApp } from 'firebase/app'
import { getAuth } from 'firebase/auth'
import { getFirestore } from 'firebase/firestore'
import { getStorage } from 'firebase/storage'

const firebaseConfig = {
  apiKey: 'AIzaSyAIZbTmaig0C4Xz4xyZMqIYTK-9OETyxdA',
  authDomain: 'traders-2aff7.firebaseapp.com',
  projectId: 'traders-2aff7',
  storageBucket: 'traders-2aff7.firebasestorage.app',
  messagingSenderId: '921119097909',
  appId: '1:921119097909:web:6606ce966ffb3e694c5d7c',
  measurementId: 'G-ZSPJXT0PXH',
}

const app = initializeApp(firebaseConfig)

export const auth = getAuth(app)
export const db = getFirestore(app)
export const storage = getStorage(app)
export default app
