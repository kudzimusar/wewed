package pro.wewed.app.models

enum class NativeDataEnvironment(val title: String) {
    FIXTURE("Fixture"),
    SHADOW("Shadow"),
    SANITIZED_SHADOW("Sanitized Shadow"),
    PRIVATE_REAL_SHADOW("Private Real Shadow"),
    PRODUCTION_READ_VERIFY("Production Read Verify"),
    PRODUCTION("Production");

    val allowsMutableNativeDevelopment: Boolean
        get() = this == FIXTURE || this == SHADOW || this == SANITIZED_SHADOW || this == PRIVATE_REAL_SHADOW
}
