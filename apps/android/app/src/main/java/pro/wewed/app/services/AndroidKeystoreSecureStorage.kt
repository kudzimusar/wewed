package pro.wewed.app.services

import android.content.Context
import android.security.keystore.KeyGenParameterSpec
import android.security.keystore.KeyProperties
import android.util.Base64
import java.security.KeyStore
import javax.crypto.Cipher
import javax.crypto.KeyGenerator
import javax.crypto.SecretKey
import javax.crypto.spec.GCMParameterSpec

/**
 * Session credentials at rest, encrypted by a key the app cannot export.
 *
 * Sessions previously lived in [InMemorySecureStorage] — a HashMap. Closing the app lost the
 * session, so "restore session" restored nothing and the app fell back to an assumed identity. A
 * development stand-in is fine for a development build; shipping it means a person signs in every
 * cold start, and the app has nowhere safe to keep a real token.
 *
 * The key is generated inside the Android Keystore and is never readable by this process or any
 * other: encryption and decryption happen inside the keystore, and only ciphertext reaches
 * SharedPreferences. This is the mechanism `EncryptedSharedPreferences` is built on, implemented
 * directly so the app takes no dependency it cannot resolve offline.
 *
 * Each value carries its own random IV, prefixed to the ciphertext. Reusing an IV with AES-GCM
 * would compromise every value encrypted under the same key, so it is never derived or fixed.
 */
class AndroidKeystoreSecureStorage(
    context: Context,
    private val preferencesName: String = "wewed_secure_session"
) : SecureStorage {

    private val prefs = context.getSharedPreferences(preferencesName, Context.MODE_PRIVATE)

    private companion object {
        const val KEYSTORE = "AndroidKeyStore"
        const val KEY_ALIAS = "wewed.session.v1"
        const val TRANSFORMATION = "AES/GCM/NoPadding"
        const val GCM_TAG_BITS = 128
        const val IV_BYTES = 12
    }

    private fun secretKey(): SecretKey {
        val keyStore = KeyStore.getInstance(KEYSTORE).apply { load(null) }
        (keyStore.getEntry(KEY_ALIAS, null) as? KeyStore.SecretKeyEntry)?.let { return it.secretKey }

        val generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, KEYSTORE)
        generator.init(
            KeyGenParameterSpec.Builder(
                KEY_ALIAS,
                KeyProperties.PURPOSE_ENCRYPT or KeyProperties.PURPOSE_DECRYPT
            )
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM)
                .setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                // Deliberately NOT user-authentication-bound: a wedding-day gate operator must be
                // able to admit guests without unlocking the device for every scan.
                .setUserAuthenticationRequired(false)
                .build()
        )
        return generator.generateKey()
    }

    override fun save(key: String, value: String) {
        val cipher = Cipher.getInstance(TRANSFORMATION).apply { init(Cipher.ENCRYPT_MODE, secretKey()) }
        val iv = cipher.iv
        val ciphertext = cipher.doFinal(value.toByteArray(Charsets.UTF_8))
        val packed = ByteArray(iv.size + ciphertext.size)
        iv.copyInto(packed)
        ciphertext.copyInto(packed, iv.size)
        prefs.edit().putString(key, Base64.encodeToString(packed, Base64.NO_WRAP)).apply()
    }

    override fun get(key: String): String? {
        val stored = prefs.getString(key, null) ?: return null
        return runCatching {
            val packed = Base64.decode(stored, Base64.NO_WRAP)
            if (packed.size <= IV_BYTES) return null
            val iv = packed.copyOfRange(0, IV_BYTES)
            val ciphertext = packed.copyOfRange(IV_BYTES, packed.size)
            val cipher = Cipher.getInstance(TRANSFORMATION).apply {
                init(Cipher.DECRYPT_MODE, secretKey(), GCMParameterSpec(GCM_TAG_BITS, iv))
            }
            String(cipher.doFinal(ciphertext), Charsets.UTF_8)
        }.getOrElse {
            // A value that will not decrypt is unusable — the keystore key was invalidated, or the
            // record predates this format. Drop it so the app asks for a fresh sign-in rather than
            // failing on every read.
            prefs.edit().remove(key).apply()
            null
        }
    }

    override fun delete(key: String) {
        prefs.edit().remove(key).apply()
    }

    override fun clear() {
        prefs.edit().clear().apply()
    }
}
