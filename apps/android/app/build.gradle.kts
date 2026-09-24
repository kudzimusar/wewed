plugins {
    id("com.android.application")
    id("org.jetbrains.kotlin.android")
}

val uploadStorePath = System.getenv("WEWED_UPLOAD_STORE_FILE")
val uploadStorePassword = System.getenv("WEWED_UPLOAD_STORE_PASSWORD")
val uploadKeyAlias = System.getenv("WEWED_UPLOAD_KEY_ALIAS")
val uploadKeyPassword = System.getenv("WEWED_UPLOAD_KEY_PASSWORD")
val hasUploadSigning = !uploadStorePath.isNullOrBlank() &&
    !uploadStorePassword.isNullOrBlank() &&
    !uploadKeyAlias.isNullOrBlank() &&
    !uploadKeyPassword.isNullOrBlank()

android {
    sourceSets.getByName("androidTest").assets.srcDir("../../../mobile/fixtures")
    namespace = "pro.wewed.app"
    compileSdk = 36

    defaultConfig {
        applicationId = "pro.wewed.app"
        minSdk = 24
        targetSdk = 36
        // Must exceed the highest version already uploaded to Google Play.
        // Legacy versionCode 8 / 2.0.5 was already active, and the first Compose versionCode 9
        // upload was consumed while Play exposed the API-36 submission requirement. The corrected
        // API-36 Compose convergence candidate therefore advances to versionCode 10.
        versionCode = 10
        versionName = "2.1.0"

        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
        vectorDrawables {
            useSupportLibrary = true
        }
    }


    signingConfigs {
        if (hasUploadSigning) {
            create("release") {
                storeFile = file(uploadStorePath!!)
                storePassword = uploadStorePassword
                keyAlias = uploadKeyAlias
                keyPassword = uploadKeyPassword
            }
        }
    }

    buildTypes {
        debug {
            applicationIdSuffix = ".dev"
            versionNameSuffix = "-dev"
            resValue("string", "app_name", "Wewed Dev")
        }
        release {
            resValue("string", "app_name", "Wewed")
            isMinifyEnabled = false
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
            if (hasUploadSigning) {
                signingConfig = signingConfigs.getByName("release")
            }
        }
        // Simulator/device UAT counterpart to iOS's UAT configuration. It inherits Release so
        // BuildConfig.DEBUG stays false and NativeLaunchConfiguration therefore uses PRODUCTION,
        // but it has a distinct package and debug signing so it can live beside the Play app and
        // can never be mistaken for a store artifact.
        create("uat") {
            initWith(getByName("release"))
            applicationIdSuffix = ".uatdev"
            versionNameSuffix = "-uatdev"
            resValue("string", "app_name", "Wewed UAT")
            signingConfig = signingConfigs.getByName("debug")
            matchingFallbacks += listOf("release")
        }
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }

    kotlinOptions {
        jvmTarget = "17"
        freeCompilerArgs += listOf("-opt-in=androidx.compose.material3.ExperimentalMaterial3Api")
    }

    buildFeatures {
        compose = true
        buildConfig = true
    }

    composeOptions {
        kotlinCompilerExtensionVersion = "1.5.14"
    }

    packaging {
        resources {
            excludes += "/META-INF/{AL2.0,LGPL2.1}"
        }
    }
}

// A production artifact must never be silently emitted unsigned. Unit tests and ordinary
// debug work remain independent of release credentials, while assemble/bundle/package Release
// refuse to run unless the upload signer is explicitly supplied.
tasks.matching {
    it.name == "assembleRelease" || it.name == "bundleRelease" || it.name == "packageRelease"
}.configureEach {
    doFirst {
        val releaseSigningPresent =
            !System.getenv("WEWED_UPLOAD_STORE_FILE").isNullOrBlank() &&
            !System.getenv("WEWED_UPLOAD_STORE_PASSWORD").isNullOrBlank() &&
            !System.getenv("WEWED_UPLOAD_KEY_ALIAS").isNullOrBlank() &&
            !System.getenv("WEWED_UPLOAD_KEY_PASSWORD").isNullOrBlank()
        if (!releaseSigningPresent) {
            throw GradleException(
                "Release packaging requires WEWED_UPLOAD_STORE_FILE, WEWED_UPLOAD_STORE_PASSWORD, " +
                    "WEWED_UPLOAD_KEY_ALIAS and WEWED_UPLOAD_KEY_PASSWORD."
            )
        }
    }
}

androidComponents {
    onVariants { variant ->
        val resolvedApplicationId = variant.applicationId.get()
        if (resolvedApplicationId == "pro.wewed.app" && variant.buildType != "release") {
            throw GradleException(
                "Refusing to build ${variant.name}: pro.wewed.app is reserved for signed release distribution."
            )
        }
    }
}

dependencies {
    implementation("androidx.core:core-ktx:1.13.1")
    implementation("androidx.lifecycle:lifecycle-runtime-ktx:2.8.4")
    implementation("androidx.lifecycle:lifecycle-viewmodel-compose:2.8.4")
    implementation("androidx.activity:activity-compose:1.9.1")

    val composeBom = platform("androidx.compose:compose-bom:2024.06.00")
    implementation(composeBom)
    androidTestImplementation(composeBom)
    androidTestImplementation("androidx.compose.ui:ui-test-junit4")
    androidTestImplementation("androidx.test:runner:1.6.2")
    androidTestImplementation("androidx.test.ext:junit:1.2.1")
    debugImplementation("androidx.compose.ui:ui-test-manifest")
    implementation("androidx.compose.ui:ui")
    implementation("androidx.compose.ui:ui-graphics")
    implementation("androidx.compose.ui:ui-tooling-preview")
    implementation("androidx.compose.material3:material3")
    implementation("androidx.compose.material:material-icons-extended")
    implementation("androidx.navigation:navigation-compose:2.7.7")
    implementation("org.jetbrains.kotlinx:kotlinx-coroutines-android:1.8.1")
    implementation("com.google.code.gson:gson:2.11.0")
    implementation("com.google.zxing:core:3.5.3")

    testImplementation("junit:junit:4.13.2")
    testImplementation("org.json:json:20240303")
    testImplementation("org.jetbrains.kotlinx:kotlinx-coroutines-test:1.8.1")
}
