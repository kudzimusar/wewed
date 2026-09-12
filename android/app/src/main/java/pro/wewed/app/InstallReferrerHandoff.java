package pro.wewed.app;

import android.net.Uri;

import java.util.regex.Pattern;

final class InstallReferrerHandoff {
    private static final Pattern HANDOFF_PATTERN = Pattern.compile("^[A-Za-z0-9_-]{43}$");
    private static final String RESUME_URL = BuildConfig.UAT
            ? "https://wewed-pr202-uat.vercel.app/invite/resume"
            : "https://wewed.pro/invite/resume";

    private InstallReferrerHandoff() {}

    static String parseHandoff(String installReferrer) {
        if (installReferrer == null || installReferrer.trim().isEmpty()) {
            return null;
        }

        String handoff = queryParameter(installReferrer, "handoff");
        if (isValid(handoff)) {
            return handoff;
        }

        // Google Play normally returns the decoded referrer string. Decode once as a
        // defensive fallback for Play/browser variants that preserve URL encoding.
        String decoded = Uri.decode(installReferrer);
        if (!decoded.equals(installReferrer)) {
            handoff = queryParameter(decoded, "handoff");
            if (isValid(handoff)) {
                return handoff;
            }
        }

        return null;
    }

    static Uri buildResumeUri(String handoff) {
        if (!isValid(handoff)) {
            throw new IllegalArgumentException("Invalid Wewed invitation handoff");
        }
        return Uri.parse(RESUME_URL)
                .buildUpon()
                .appendQueryParameter("h", handoff)
                .build();
    }

    private static String queryParameter(String query, String key) {
        try {
            return Uri.parse("https://wewed.pro/?" + query).getQueryParameter(key);
        } catch (RuntimeException ignored) {
            return null;
        }
    }

    private static boolean isValid(String handoff) {
        return handoff != null && HANDOFF_PATTERN.matcher(handoff).matches();
    }
}
