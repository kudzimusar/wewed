package pro.wewed.app;

import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ActivityInfo;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.util.Log;

import com.android.installreferrer.api.InstallReferrerClient;
import com.android.installreferrer.api.InstallReferrerStateListener;
import com.android.installreferrer.api.ReferrerDetails;

public class LauncherActivity
        extends com.google.androidbrowserhelper.trusted.LauncherActivity {

    private static final String INVITATION_LOG_TAG = "WewedInvitation";
    private static final String INVITATION_CHECKPOINT_PREFS = "wewed_invitation_checkpoints";
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
        if (!deferredLaunchPending || deferredTwaLaunchRequested) return;
        closeInstallReferrerConnection();
        launchDeferredTwa(null);
    };

    @Override
    protected Uri getLaunchingUrl() {
        Intent intent = getIntent();
        if (intent != null) {
            Uri data = intent.getData();
            if (data != null
                    && "wewed".equals(data.getScheme())
                    && "invite".equals(data.getHost())
                    && "/resume".equals(data.getPath())) {
                Log.i(INVITATION_LOG_TAG, "checkpoint=native_intent_received");
                String handoff = intent.getStringExtra("wewed_handoff");
                try {
                    Uri resumeUri = InstallReferrerHandoff.buildResumeUri(handoff);
                    Log.i(
                            INVITATION_LOG_TAG,
                            "checkpoint=native_resume_uri_ready host="
                                    + resumeUri.getHost()
                                    + " path="
                                    + resumeUri.getPath());
                    recordDebugInvitationCheckpoint(resumeUri);
                    return resumeUri;
                } catch (IllegalArgumentException ignored) {
                    Log.w(INVITATION_LOG_TAG, "checkpoint=native_intent_rejected");
                    // Never forward malformed or attacker-controlled values into the web session.
                    return super.getLaunchingUrl();
                }
            }
        }
        return super.getLaunchingUrl();
    }

    private void recordDebugInvitationCheckpoint(Uri resumeUri) {
        if (!BuildConfig.DEBUG) return;
        SharedPreferences checkpoints =
                getSharedPreferences(INVITATION_CHECKPOINT_PREFS, MODE_PRIVATE);
        int nextCount = checkpoints.getInt("native_intent_count", 0) + 1;
        checkpoints.edit()
                .putInt("native_intent_count", nextCount)
                .putString("last_resume_host", resumeUri.getHost())
                .putString("last_resume_path", resumeUri.getPath())
                .commit();
    }

    @Override
    protected boolean shouldLaunchImmediately() {
        SharedPreferences preferences = getSharedPreferences(REFERRER_PREFS, MODE_PRIVATE);
        Uri explicitLaunchUri = getIntent() == null ? null : getIntent().getData();
        if (explicitLaunchUri != null) return true;
        if (preferences.getBoolean(REFERRER_PROCESSED_KEY, false)) return true;
        return preferences.getInt(REFERRER_ATTEMPTS_KEY, 0) >= MAX_REFERRER_ATTEMPTS;
    }

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        setRequestedOrientation(ActivityInfo.SCREEN_ORIENTATION_UNSPECIFIED);
        maybeResumeDeferredInvitation();
    }

    private void maybeResumeDeferredInvitation() {
        if (isFinishing() || isDestroyed()) return;

        SharedPreferences preferences = getSharedPreferences(REFERRER_PREFS, MODE_PRIVATE);
        Uri explicitLaunchUri = getIntent() == null ? null : getIntent().getData();
        if (explicitLaunchUri != null) {
            markReferrerProcessed(preferences);
            return;
        }
        if (preferences.getBoolean(REFERRER_PROCESSED_KEY, false)) return;

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
        String personalHandoff;
        String physicalHandoff;
        try {
            ReferrerDetails details = installReferrerClient.getInstallReferrer();
            String referrer = details.getInstallReferrer();
            physicalHandoff = InstallReferrerHandoff.parsePhysicalHandoff(referrer);
            personalHandoff = physicalHandoff == null
                    ? InstallReferrerHandoff.parseHandoff(referrer)
                    : null;
        } catch (Exception ignored) {
            closeInstallReferrerConnection();
            launchDeferredTwa(null);
            return;
        }

        markReferrerProcessed(preferences);
        closeInstallReferrerConnection();

        Uri resumeUri = null;
        if (physicalHandoff != null) {
            resumeUri = InstallReferrerHandoff.buildPhysicalResumeUri(physicalHandoff);
        } else if (personalHandoff != null) {
            resumeUri = InstallReferrerHandoff.buildResumeUri(personalHandoff);
        }
        launchDeferredTwa(resumeUri);
    }

    private void launchDeferredTwa(Uri overrideUri) {
        if (deferredTwaLaunchRequested || isFinishing() || isDestroyed()) return;
        deferredTwaLaunchRequested = true;
        deferredLaunchPending = false;
        mainHandler.removeCallbacks(referrerBootstrapTimeout);
        if (overrideUri != null && getIntent() != null) getIntent().setData(overrideUri);
        launchTwa();
    }

    private void markReferrerProcessed(SharedPreferences preferences) {
        preferences.edit()
                .putBoolean(REFERRER_PROCESSED_KEY, true)
                .remove(REFERRER_ATTEMPTS_KEY)
                .apply();
    }

    private void closeInstallReferrerConnection() {
        if (installReferrerClient == null) return;
        try {
            installReferrerClient.endConnection();
        } catch (RuntimeException ignored) {
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
