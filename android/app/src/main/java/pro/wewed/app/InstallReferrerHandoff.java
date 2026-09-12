package pro.wewed.app;

import android.net.Uri;

import java.util.regex.Pattern;

final class InstallReferrerHandoff {
    private static final Pattern HANDOFF_PATTERN = Pattern.compile("^[A-Za-z0-9_-]{43}$");
    private static final String PERSONAL_RESUME_URL = BuildConfig.UAT
            ? "https://uat.wewed.pro/invite/resume"
            : "https://wewed.pro/invite/resume";
    private static final String PHYSICAL_RESUME_URL = BuildConfig.UAT
            ? "https://uat.wewed.pro/invite/physical-resume"
            : "https://wewed.pro/invite/physical-resume";

    private InstallReferrerHandoff() {}

    static String parseHandoff(String installReferrer) {
        return parseKey(installReferrer, "handoff");
    }

    static String parsePhysicalHandoff(String installReferrer) {
        return parseKey(installReferrer, "physical_handoff");
    }

    private static String parseKey(String installReferrer, String key) {
        if (installReferrer == null || installReferrer.trim().isEmpty()) {
            return null;
        }

        String handoff = queryParameter(installReferrer, key);
        if (isValid(handoff)) {
            return handoff;
        }

        String decoded = Uri.decode(installReferrer);
        if (!decoded.equals(installReferrer)) {
            handoff = queryParameter(decoded, key);
            if (isValid(handoff)) {
                return handoff;
            }
        }
        return null;
    }

    static Uri buildResumeUri(String handoff) {
        return buildResumeUri(PERSONAL_RESUME_URL, handoff);
    }

    static Uri buildPhysicalResumeUri(String handoff) {
        return buildResumeUri(PHYSICAL_RESUME_URL, handoff);
    }

    private static Uri buildResumeUri(String base, String handoff) {
        if (!isValid(handoff)) {
            throw new IllegalArgumentException("Invalid Wewed invitation handoff");
        }
        return Uri.parse(base)
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
