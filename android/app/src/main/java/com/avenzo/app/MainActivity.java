package com.avenzo.app;

import android.os.Bundle;
import android.util.Base64;
import android.webkit.WebView;

import androidx.activity.OnBackPressedCallback;

import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;

import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;

public class MainActivity extends BridgeActivity {

    private String mobileScript = "";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        mobileScript = buildMobileScript();

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
            byte[] logoBytes = readAssetBytes("public/avenzo-logo.webp");

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
                .replace("__LOGO__", logo64);
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
