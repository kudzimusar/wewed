package pro.wewed.app.services

interface SecureStorage {
    fun save(key: String, value: String)
    fun get(key: String): String?
    fun delete(key: String)
    fun clear()
}

class InMemorySecureStorage : SecureStorage {
    private val storage = mutableMapOf<String, String>()

    @Synchronized
    override fun save(key: String, value: String) {
        storage[key] = value
    }

    @Synchronized
    override fun get(key: String): String? {
        return storage[key]
    }

    @Synchronized
    override fun delete(key: String) {
        storage.remove(key)
    }

    @Synchronized
    override fun clear() {
        storage.clear()
    }
}
