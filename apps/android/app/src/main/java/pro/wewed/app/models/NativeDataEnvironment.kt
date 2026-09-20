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

    /**
     * Whether development persona switching may be offered (P0-16).
     *
     * Persona switching hands an actor an arbitrary role. That is a development and Shadow
     * qualification affordance only: in production the available roles must come from the actor's
     * real authorizations, never from a picker.
     */
    val allowsDevelopmentPersonaSwitching: Boolean
        get() = allowsMutableNativeDevelopment
}
