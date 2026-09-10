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

import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ActivityInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;

import com.android.installreferrer.api.InstallReferrerClient;
import com.android.installreferrer.api.InstallReferrerStateListener;
import com.android.installreferrer.api.ReferrerDetails;

public class LauncherActivity
        extends com.google.androidbrowserhelper.trusted.LauncherActivity {

    private static final String REFERRER_PREFS = "wewed_install_referrer";
    private static final String REFERRER_PROCESSED_KEY = "invitation_handoff_processed_v1";

    private InstallReferrerClient installReferrerClient;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        // Keep the Bubblewrap-generated splash behavior safe on older Android versions.
        if (Build.VERSION.SDK_INT > Build.VERSION_CODES.O) {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
        } else {
            setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
        }

        maybeResumeDeferredInvitation();
    }

    private void maybeResumeDeferredInvitation() {
        SharedPreferences preferences = getSharedPreferences(REFERRER_PREFS, MODE_PRIVATE);
        Intent launchIntent = getIntent();
        Uri explicitLaunchUri = launchIntent == null ? null : launchIntent.getData();

        // A deliberate App Link/shortcut is newer user intent than an install referrer.
        // Never let an old deferred invitation override it.
        if (explicitLaunchUri != null) {
            markReferrerProcessed(preferences);
            return;
        }

        if (preferences.getBoolean(REFERRER_PROCESSED_KEY, false)) {
            return;
        }

        installReferrerClient = InstallReferrerClient.newBuilder(this).build();
        installReferrerClient.startConnection(new InstallReferrerStateListener() {
            @Override
            public void onInstallReferrerSetupFinished(int responseCode) {
                if (responseCode == InstallReferrerClient.InstallReferrerResponse.OK) {
                    handleInstallReferrer(preferences);
                    return;
                }

                // FEATURE_NOT_SUPPORTED and DEVELOPER_ERROR are terminal for this install.
                // Service-unavailable/disconnected cases remain retryable on a future launch.
                if (responseCode == InstallReferrerClient.InstallReferrerResponse.FEATURE_NOT_SUPPORTED
                        || responseCode == InstallReferrerClient.InstallReferrerResponse.DEVELOPER_ERROR) {
                    markReferrerProcessed(preferences);
                }
                closeInstallReferrerConnection();
            }

            @Override
            public void onInstallReferrerServiceDisconnected() {
                closeInstallReferrerConnection();
            }
        });
    }

    private void handleInstallReferrer(SharedPreferences preferences) {
        String handoff = null;
        try {
            ReferrerDetails details = installReferrerClient.getInstallReferrer();
            handoff = InstallReferrerHandoff.parseHandoff(details.getInstallReferrer());
        } catch (Exception ignored) {
            // Retrieval failed after connection. Leave the marker unset so a later launch can retry.
            closeInstallReferrerConnection();
            return;
        }

        // Google recommends reading install referrer once. Mark it before navigation so an
        // interrupted TWA launch cannot create a repeated resume loop.
        markReferrerProcessed(preferences);
        closeInstallReferrerConnection();

        if (handoff == null || isFinishing() || isDestroyed()) {
            return;
        }

        Uri resumeUri = InstallReferrerHandoff.buildResumeUri(handoff);
        Intent resumeIntent = new Intent(this, LauncherActivity.class);
        resumeIntent.setAction(Intent.ACTION_VIEW);
        resumeIntent.setData(resumeUri);
        resumeIntent.addFlags(Intent.FLAG_ACTIVITY_CLEAR_TOP | Intent.FLAG_ACTIVITY_NEW_TASK);
        startActivity(resumeIntent);
        finish();
    }

    private void markReferrerProcessed(SharedPreferences preferences) {
        preferences.edit().putBoolean(REFERRER_PROCESSED_KEY, true).apply();
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
        closeInstallReferrerConnection();
        super.onDestroy();
    }

    @Override
    protected Uri getLaunchingUrl() {
        return super.getLaunchingUrl();
    }
}
