/*
 * Copyright 2020 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *      http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package pro.wewed.app;

import android.content.SharedPreferences;
import android.content.pm.ActivityInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;

import com.android.installreferrer.api.InstallReferrerClient;
import com.android.installreferrer.api.InstallReferrerStateListener;
import com.android.installreferrer.api.ReferrerDetails;

public class LauncherActivity
        extends com.google.androidbrowserhelper.trusted.LauncherActivity {

    private static final String REFERRER_PREFS = "wewed_install_referrer";
    private static final String REFERRER_PROCESSED_KEY = "invitation_handoff_processed_v1";
    private static final String REFERRER_ATTEMPTS_KEY = "invitation_handoff_attempts_v1";
    private static final int MAX_REFERRER_ATTEMPTS = 3;
    private static final long REFERRER_BOOTSTRAP_TIMEOUT_MS = 2500L;

    private final Handler mainHandler = new Handler(Looper.getMainLooper());
    private InstallReferrerClient installReferrerClient;
    private boolean deferredLaunchPending;
    private boolean deferredTwaLaunchRequested;

    private final Runnable referrerBootstrapTimeout = () -> {
        if (!deferredLaunchPending || deferredTwaLaunchRequested) {
            return;
        }
        closeInstallReferrerConnection();
        launchDeferredTwa(null);
    };

    @Override
    protected boolean shouldLaunchImmediately() {
        SharedPreferences preferences = getSharedPreferences(REFERRER_PREFS, MODE_PRIVATE);
        Uri explicitLaunchUri = getIntent() == null ? null : getIntent().getData();

        // Explicit App Links and shortcuts represent newer user intent and must never be
        // delayed or overridden by a historical install referrer.
        if (explicitLaunchUri != null) {
            return true;
        }

        if (preferences.getBoolean(REFERRER_PROCESSED_KEY, false)) {
            return true;
        }

        // Avoid adding bootstrap latency forever on devices where the Play referrer service
        // is persistently unavailable. Three ordinary launches are sufficient retry budget.
        return preferences.getInt(REFERRER_ATTEMPTS_KEY, 0) >= MAX_REFERRER_ATTEMPTS;
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Keep Bubblewrap's generated orientation behavior safe on older Android versions.
        if (Build.VERSION.SDK_INT > Build.VERSION_CODES.O) {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
        } else {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
        }

        maybeResumeDeferredInvitation();
    }

    private void maybeResumeDeferredInvitation() {
        if (isFinishing() || isDestroyed()) {
            return;
        }

        SharedPreferences preferences = getSharedPreferences(REFERRER_PREFS, MODE_PRIVATE);
        Uri explicitLaunchUri = getIntent() == null ? null : getIntent().getData();

        if (explicitLaunchUri != null) {
            markReferrerProcessed(preferences);
            return;
        }

        if (preferences.getBoolean(REFERRER_PROCESSED_KEY, false)) {
            return;
        }

        int previousAttempts = preferences.getInt(REFERRER_ATTEMPTS_KEY, 0);
        if (previousAttempts >= MAX_REFERRER_ATTEMPTS) {
            markReferrerProcessed(preferences);
            return;
        }

        preferences.edit().putInt(REFERRER_ATTEMPTS_KEY, previousAttempts + 1).apply();
        deferredLaunchPending = true;
        mainHandler.postDelayed(referrerBootstrapTimeout, REFERRER_BOOTSTRAP_TIMEOUT_MS);

        try {
            installReferrerClient = InstallReferrerClient.newBuilder(this).build();
            installReferrerClient.startConnection(new InstallReferrerStateListener() {
                @Override
                public void onInstallReferrerSetupFinished(int responseCode) {
                    if (deferredTwaLaunchRequested) {
                        closeInstallReferrerConnection();
                        return;
                    }

                    if (responseCode == InstallReferrerClient.InstallReferrerResponse.OK) {
                        handleInstallReferrer(preferences);
                        return;
                    }

                    // Unsupported/developer errors are terminal for this installation.
                    // Service-unavailable cases remain retryable on a later ordinary launch.
                    if (responseCode == InstallReferrerClient.InstallReferrerResponse.FEATURE_NOT_SUPPORTED
                            || responseCode == InstallReferrerClient.InstallReferrerResponse.DEVELOPER_ERROR) {
                        markReferrerProcessed(preferences);
                    }
                    closeInstallReferrerConnection();
                    launchDeferredTwa(null);
                }

                @Override
                public void onInstallReferrerServiceDisconnected() {
                    closeInstallReferrerConnection();
                    launchDeferredTwa(null);
                }
            });
        } catch (RuntimeException ignored) {
            closeInstallReferrerConnection();
            launchDeferredTwa(null);
        }
    }

    private void handleInstallReferrer(SharedPreferences preferences) {
        String handoff;
        try {
            ReferrerDetails details = installReferrerClient.getInstallReferrer();
            handoff = InstallReferrerHandoff.parseHandoff(details.getInstallReferrer());
        } catch (Exception ignored) {
            // Retrieval failed after connection. Keep the processed marker unset so a later
            // launch may retry, but never block this launch from opening Wewed normally.
            closeInstallReferrerConnection();
            launchDeferredTwa(null);
            return;
        }

        // Google recommends retrieving the install referrer once. Mark it before web launch so
        // process interruption cannot create a repeated invitation-resume loop.
        markReferrerProcessed(preferences);
        closeInstallReferrerConnection();

        Uri resumeUri = handoff == null ? null : InstallReferrerHandoff.buildResumeUri(handoff);
        launchDeferredTwa(resumeUri);
    }

    private void launchDeferredTwa(Uri overrideUri) {
        if (deferredTwaLaunchRequested || isFinishing() || isDestroyed()) {
            return;
        }

        deferredTwaLaunchRequested = true;
        deferredLaunchPending = false;
        mainHandler.removeCallbacks(referrerBootstrapTimeout);

        if (overrideUri != null && getIntent() != null) {
            getIntent().setData(overrideUri);
        }

        // android-browser-helper explicitly exposes launchTwa() for asynchronous pre-launch
        // work when shouldLaunchImmediately() returns false.
        launchTwa();
    }

    private void markReferrerProcessed(SharedPreferences preferences) {
        preferences.edit()
                .putBoolean(REFERRER_PROCESSED_KEY, true)
                .remove(REFERRER_ATTEMPTS_KEY)
                .apply();
    }

    private void closeInstallReferrerConnection() {
        if (installReferrerClient == null) {
            return;
        }
        try {
            installReferrerClient.endConnection();
        } catch (RuntimeException ignored) {
            // Best-effort cleanup only; never block normal app launch.
        } finally {
            installReferrerClient = null;
        }
    }

    @Override
    protected void onDestroy() {
        mainHandler.removeCallbacks(referrerBootstrapTimeout);
        closeInstallReferrerConnection();
        super.onDestroy();
    }
}
