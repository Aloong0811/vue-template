const AUTH_ENCRYPTED_KEY_PREFIX = 'enc-v2:'
const AUTH_ENCRYPTION_KEY_LENGTH = 32
const AUTH_PBKDF2_ITERATIONS = 120000
const AUTH_STORAGE_KEY = 'hongxinglin-authenticated'

const AUTH_USERNAME_ENCRYPTED = import.meta.env.VITE_APP_AUTH_USERNAME_ENCRYPTED || ''
const AUTH_PASSWORD_ENCRYPTED = import.meta.env.VITE_APP_AUTH_PASSWORD_ENCRYPTED || ''
const AUTH_SECRET = import.meta.env.VITE_APP_AUTH_SECRET || ''

const decodeBase64ToBytes = (value = '') => Uint8Array.from(atob(String(value || '')), char => char.charCodeAt(0))

const decodeBase64Json = (value = '') => {
  const bytes = decodeBase64ToBytes(value)
  return JSON.parse(new TextDecoder().decode(bytes))
}

const decryptEncryptedValue = async (encryptedPayload, secret) => {
  const normalizedPayload = String(encryptedPayload || '').trim()
  const normalizedSecret = String(secret || '').trim()

  if (!normalizedPayload || !normalizedSecret) {
    return ''
  }

  if (!normalizedPayload.startsWith(AUTH_ENCRYPTED_KEY_PREFIX)) {
    throw new Error('登录凭证加密格式不正确')
  }

  if (typeof window === 'undefined' || !window.crypto?.subtle) {
    throw new Error('当前环境不支持浏览器解密能力')
  }

  const payload = decodeBase64Json(normalizedPayload.slice(AUTH_ENCRYPTED_KEY_PREFIX.length))
  const textEncoder = new TextEncoder()
  const passwordKey = await window.crypto.subtle.importKey(
    'raw',
    textEncoder.encode(normalizedSecret),
    'PBKDF2',
    false,
    ['deriveKey']
  )

  const derivedKey = await window.crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: decodeBase64ToBytes(payload.salt),
      iterations: Number(payload.iterations) || AUTH_PBKDF2_ITERATIONS,
      hash: 'SHA-256'
    },
    passwordKey,
    {
      name: 'AES-GCM',
      length: AUTH_ENCRYPTION_KEY_LENGTH * 8
    },
    false,
    ['decrypt']
  )

  const encryptedBytes = decodeBase64ToBytes(payload.data)
  const authTagBytes = decodeBase64ToBytes(payload.tag)
  const cipherBytes = new Uint8Array(encryptedBytes.length + authTagBytes.length)

  cipherBytes.set(encryptedBytes, 0)
  cipherBytes.set(authTagBytes, encryptedBytes.length)

  const decrypted = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: decodeBase64ToBytes(payload.iv),
      tagLength: authTagBytes.length * 8
    },
    derivedKey,
    cipherBytes
  )

  return new TextDecoder().decode(decrypted)
}

export const verifyCredentials = async ({ username, password }) => {
  if (!AUTH_USERNAME_ENCRYPTED || !AUTH_PASSWORD_ENCRYPTED || !AUTH_SECRET) {
    throw new Error('缺少登录配置，请先在 .env.local 中配置加密后的账号密码')
  }

  const [resolvedUsername, resolvedPassword] = await Promise.all([
    decryptEncryptedValue(AUTH_USERNAME_ENCRYPTED, AUTH_SECRET),
    decryptEncryptedValue(AUTH_PASSWORD_ENCRYPTED, AUTH_SECRET)
  ])

  return String(username || '').trim() === resolvedUsername && String(password || '') === resolvedPassword
}

export const getStoredLoginState = () => {
  if (typeof window === 'undefined') {
    return false
  }

  return window.localStorage.getItem(AUTH_STORAGE_KEY) === 'true'
}

export const persistLoginState = () => {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.setItem(AUTH_STORAGE_KEY, 'true')
}

export const clearLoginState = () => {
  if (typeof window === 'undefined') {
    return
  }

  window.localStorage.removeItem(AUTH_STORAGE_KEY)
}
