import { createContext, useContext, useEffect, useState } from 'react'
import {
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  updateProfile,
} from 'firebase/auth'
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore'
import { auth, db } from '../firebase'

const ADMIN_EMAIL = 'sellerlw30@gmail.com'
const GP_KEY = 'trader_gp_verified'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [userDoc, setUserDoc] = useState(null)
  const [loading, setLoading] = useState(true)
  const [gpVerified, setGpVerified] = useState(() => !!localStorage.getItem(GP_KEY))

  const isAdmin = user?.email === ADMIN_EMAIL

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const ref = doc(db, 'users', firebaseUser.uid)
        const snap = await getDoc(ref)
        if (!snap.exists()) {
          const newDoc = {
            displayName: firebaseUser.displayName || firebaseUser.email.split('@')[0],
            email: firebaseUser.email,
            photoURL: firebaseUser.photoURL || null,
            role: 'member',
            joinDate: serverTimestamp(),
            theme: null,
            permissions: {
              canPost: true,
              canCreateTopic: true,
              canPin: false,
              canFormalAnnounce: false,
              canCrossPost: true,
              muted: false,
              restricted: false,
              banned: false,
            },
          }
          await setDoc(ref, newDoc)
          setUserDoc(newDoc)
        } else {
          setUserDoc(snap.data())
        }
        setUser(firebaseUser)
      } else {
        setUser(null)
        setUserDoc(null)
      }
      setLoading(false)
    })
    return unsub
  }, [])

  async function loginWithGoogle() {
    const provider = new GoogleAuthProvider()
    await signInWithPopup(auth, provider)
  }

  async function loginWithEmail(email, password) {
    await signInWithEmailAndPassword(auth, email, password)
  }

  async function registerWithEmail(email, password, displayName) {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    await updateProfile(cred.user, { displayName })
  }

  async function logout() {
    await signOut(auth)
  }

  function verifyGroupPassword() {
    localStorage.setItem(GP_KEY, '1')
    setGpVerified(true)
  }

  function revokeGroupPassword() {
    localStorage.removeItem(GP_KEY)
    setGpVerified(false)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        userDoc,
        loading,
        isAdmin,
        gpVerified,
        loginWithGoogle,
        loginWithEmail,
        registerWithEmail,
        logout,
        verifyGroupPassword,
        revokeGroupPassword,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
