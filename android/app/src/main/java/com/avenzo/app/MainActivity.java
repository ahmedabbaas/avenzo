package com.avenzo.app;

import android.Manifest;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.util.Base64;
import android.view.View;
import android.webkit.WebView;
import android.webkit.WebSettings;

import androidx.activity.OnBackPressedCallback;
import androidx.core.app.ActivityCompat;
import androidx.core.content.ContextCompat;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

public class MainActivity extends BridgeActivity {

    private static final int AVENZO_MEDIA_PERMISSION_REQUEST = 4201;
    private String mobileScript = "";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        mobileScript = buildMobileScript();
        applySystemTheme("dark");

        // The web app uses getUserMedia for calls. Ensure Android grants the
        // native microphone permission before WebView/Capacitor handles the
        // corresponding web permission request.
        if (ContextCompat.checkSelfPermission(this, Manifest.permission.RECORD_AUDIO)
                != PackageManager.PERMISSION_GRANTED) {
            ActivityCompat.requestPermissions(
                this,
                new String[] { Manifest.permission.RECORD_AUDIO },
                AVENZO_MEDIA_PERMISSION_REQUEST
            );
        }

        if (bridge != null) {
            bridge.setWebViewClient(new BridgeWebViewClient(bridge) {
                @Override
                public void onPageFinished(WebView view, String url) {
                    super.onPageFinished(view, url);
                    injectMobileShell(view);
                }
            });

            WebView webView = bridge.getWebView();
            if (webView != null) {
                WebSettings settings = webView.getSettings();
                settings.setMediaPlaybackRequiresUserGesture(false);
                settings.setDomStorageEnabled(true);
                settings.setDatabaseEnabled(true);
                settings.setCacheMode(WebSettings.LOAD_DEFAULT);
                webView.postDelayed(() -> injectMobileShell(webView), 350);
            }
        }

        getOnBackPressedDispatcher().addCallback(
            this,
            new OnBackPressedCallback(true) {
                @Override
                public void handleOnBackPressed() {
                    handleAvenzoBack();
                }
            }
        );
    }

    private void applySystemTheme(String theme) {
        boolean light = "light".equalsIgnoreCase(theme);

        getWindow().setStatusBarColor(Color.TRANSPARENT);
        getWindow().setNavigationBarColor(Color.TRANSPARENT);

        int flags =
            View.SYSTEM_UI_FLAG_LAYOUT_STABLE |
            View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN |
            View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION;

        if (light && Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
            flags |= View.SYSTEM_UI_FLAG_LIGHT_STATUS_BAR;
        }

        if (light && Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            flags |= View.SYSTEM_UI_FLAG_LIGHT_NAVIGATION_BAR;
        }

        getWindow().getDecorView().setSystemUiVisibility(flags);

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            getWindow().setStatusBarContrastEnforced(false);
            getWindow().setNavigationBarContrastEnforced(false);
        }
    }

    private void injectMobileShell(WebView webView) {
        if (webView == null || mobileScript.isEmpty()) return;
        webView.evaluateJavascript(mobileScript, null);
    }

    private void handleAvenzoBack() {
        if (bridge == null || bridge.getWebView() == null) {
            finish();
            return;
        }

        WebView webView = bridge.getWebView();
        String script =
            "(function(){" +
            "try{" +
            "return window.__avenzoHandleBack" +
            "?window.__avenzoHandleBack()" +
            ":(window.history.length>1?'history':'root');" +
            "}catch(e){return 'root';}" +
            "})();";

        webView.evaluateJavascript(script, result -> runOnUiThread(() -> {
            String normalized = result == null
                ? ""
                : result.replace("\"", "").trim();

            if ("handled".equals(normalized)) {
                return;
            }

            if ("history".equals(normalized)) {
                webView.evaluateJavascript("window.history.back();", null);
                return;
            }

            finish();
        }));
    }

    private String buildMobileScript() {
        try {
            String script = readAssetText("public/native-inject.js");
            String css = readAssetText("public/app-mobile.css");
            byte[] logoBytes = readAssetBytes("avenzo/avenzo-logo-premium.png");

            String css64 = Base64.encodeToString(
                css.getBytes(StandardCharsets.UTF_8),
                Base64.NO_WRAP
            );
            String logo64 = Base64.encodeToString(
                logoBytes,
                Base64.NO_WRAP
            );

            return script
                .replace("__CSS__", css64)
                .replace("__LOGO_PNG__", logo64);
        } catch (Exception ignored) {
            return "";
        }
    }

    private String readAssetText(String path) throws Exception {
        return new String(readAssetBytes(path), StandardCharsets.UTF_8);
    }

    private byte[] readAssetBytes(String path) throws Exception {
        try (
            InputStream input = getAssets().open(path);
            ByteArrayOutputStream output = new ByteArrayOutputStream()
        ) {
            byte[] buffer = new byte[8192];
            int read;

            while ((read = input.read(buffer)) != -1) {
                output.write(buffer, 0, read);
            }

            return output.toByteArray();
        }
    }
}
