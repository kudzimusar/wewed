package pro.wewed.app;

import android.net.Uri;

import java.util.regex.Pattern;

final class InstallReferrerHandoff {
    private static final Pattern PERSONAL_HANDOFF_PATTERN = Pattern.compile("^[A-Za-z0-9_-]{43}$");
    private static final Pattern PHYSICAL_HANDOFF_PATTERN = Pattern.compile("^p1\\.[A-Za-z0-9_-]{80,512}$");
    private static final String PERSONAL_RESUME_URL = BuildConfig.UAT
            ? "https://uat.wewed.pro/invite/resume"
            : "https://wewed.pro/invite/resume";
    private static final String PHYSICAL_RESUME_URL = BuildConfig.UAT
            ? "https://uat.wewed.pro/invite/physical-resume"
            : "https://wewed.pro/invite/physical-resume";

    private InstallReferrerHandoff() {}

    static String parseHandoff(String installReferrer) {
        return parseKey(installReferrer, "handoff", PERSONAL_HANDOFF_PATTERN);
    }

    static String parsePhysicalHandoff(String installReferrer) {
        return parseKey(installReferrer, "physical_handoff", PHYSICAL_HANDOFF_PATTERN);
    }

    private static String parseKey(String installReferrer, String key, Pattern pattern) {
        if (installReferrer == null || installReferrer.trim().isEmpty()) {
            return null;
        }

        String handoff = queryParameter(installReferrer, key);
        if (isValid(handoff, pattern)) {
            return handoff;
        }

        String decoded = Uri.decode(installReferrer);
        if (!decoded.equals(installReferrer)) {
            handoff = queryParameter(decoded, key);
            if (isValid(handoff, pattern)) {
                return handoff;
            }
        }
        return null;
    }

    static Uri buildResumeUri(String handoff) {
        if (!isValid(handoff, PERSONAL_HANDOFF_PATTERN)) {
            throw new IllegalArgumentException("Invalid Wewed invitation handoff");
        }
        return buildResumeUri(PERSONAL_RESUME_URL, handoff);
    }

    static Uri buildPhysicalResumeUri(String handoff) {
        if (!isValid(handoff, PHYSICAL_HANDOFF_PATTERN)) {
            throw new IllegalArgumentException("Invalid Wewed physical invitation handoff");
        }
        return buildResumeUri(PHYSICAL_RESUME_URL, handoff);
    }

    private static Uri buildResumeUri(String base, String handoff) {
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

    private static boolean isValid(String handoff, Pattern pattern) {
        return handoff != null && pattern.matcher(handoff).matches();
    }
}
