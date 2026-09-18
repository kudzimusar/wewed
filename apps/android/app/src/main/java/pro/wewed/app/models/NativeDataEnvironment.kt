package pro.wewed.app.models

enum class NativeDataEnvironment(val title: String) {
    FIXTURE("Fixture"),
    SHADOW("Shadow"),
    PRODUCTION_READ_VERIFY("Production Read Verify"),
    PRODUCTION("Production");

    val allowsMutableNativeDevelopment: Boolean
        get() = this == FIXTURE || this == SHADOW
}
