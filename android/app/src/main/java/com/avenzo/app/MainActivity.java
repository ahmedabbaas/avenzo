package com.avenzo.app;

import android.Manifest;
import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Bitmap;
import android.graphics.BitmapFactory;
import android.graphics.Color;
import android.media.AudioManager;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.util.Base64;
import android.view.Display;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.WebView;
import android.webkit.WebSettings;
import android.widget.Toast;
import androidx.activity.OnBackPressedCallback;
import androidx.core.view.WindowCompat;
import androidx.core.view.WindowInsetsControllerCompat;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.BridgeWebViewClient;
import com.getcapacitor.BridgeWebChromeClient;
import com.google.android.gms.tasks.Task;
import com.google.android.gms.tasks.Tasks;
import com.google.mlkit.vision.common.InputImage;
import com.google.mlkit.vision.face.Face;
import com.google.mlkit.vision.face.FaceDetection;
import com.google.mlkit.vision.face.FaceDetector;
import com.google.mlkit.vision.face.FaceDetectorOptions;
import com.google.mlkit.vision.label.ImageLabel;
import com.google.mlkit.vision.label.ImageLabeler;
import com.google.mlkit.vision.label.ImageLabeling;
import com.google.mlkit.vision.label.defaults.ImageLabelerOptions;
import com.google.mlkit.vision.text.TextRecognition;
import com.google.mlkit.vision.text.TextRecognizer;
import com.google.mlkit.vision.text.latin.TextRecognizerOptions;
import com.google.mlkit.vision.text.chinese.ChineseTextRecognizerOptions;
import com.google.mlkit.vision.text.devanagari.DevanagariTextRecognizerOptions;
import com.google.mlkit.vision.text.japanese.JapaneseTextRecognizerOptions;
import com.google.mlkit.vision.text.korean.KoreanTextRecognizerOptions;
import java.io.BufferedReader;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URLEncoder;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.json.JSONArray;
import org.json.JSONObject;

public class MainActivity extends BridgeActivity {
  private static final String MESSAGE_CHANNEL_ID = "avenzo_messages";
  private static final String SUPABASE_URL =
    "https://ltlxynrssgpqgzbdpliv.supabase.co";
  private static final String SUPABASE_KEY =
    "sb_publishable_tAxyIZKlwXyeGI7627SFSQ_VJvaSR0d";

  private boolean avenzoClientInstalled = false;
  private boolean activityVisible = false;
  private PermissionRequest pendingMediaPermissionRequest = null;
  private String[] pendingMediaResources = null;
  private long lastRootBackPress = 0L;
  private String supabaseAccessToken = "";
  private String supabaseUserId = "";
  private String lastNotificationAt = "";
  private String lastIncomingCallId = "";
  private boolean callAudioModeActive = false;
  private int previousAudioMode = AudioManager.MODE_NORMAL;
  private boolean previousSpeakerphone = false;
  private final Handler notificationHandler =
    new Handler(Looper.getMainLooper());
  private final ExecutorService notificationExecutor =
    Executors.newSingleThreadExecutor();
  private volatile boolean notificationPollInFlight = false;

  private final Runnable notificationPoller = new Runnable() {
    @Override
    public void run() {
      if (
        !activityVisible &&
        !notificationPollInFlight &&
        !supabaseAccessToken.isEmpty() &&
        !supabaseUserId.isEmpty()
      ) {
        notificationPollInFlight = true;
        notificationExecutor.execute(() -> {
          try {
            pollMessageNotifications();
            pollIncomingCalls();
          } finally {
            notificationPollInFlight = false;
          }
        });
      }
      notificationHandler.postDelayed(this, 5000L);
    }
  };

  @Override
  public void onCreate(Bundle savedInstanceState) {
    super.onCreate(savedInstanceState);

    getWindow().setSoftInputMode(
      WindowManager.LayoutParams.SOFT_INPUT_ADJUST_RESIZE
    );
    applySystemTheme("dark");

    preferHighRefreshRate();

    createMessageNotificationChannel();
    requestNotificationPermission();

    getOnBackPressedDispatcher().addCallback(
      this,
      new OnBackPressedCallback(true) {
        @Override
        public void handleOnBackPressed() {
          handleAvenzoBack();
        }
      }
    );

    configureWebView();
    handleIntentRoute(getIntent());
    notificationHandler.postDelayed(notificationPoller, 3500L);
  }

  @Override
  protected void onNewIntent(Intent intent) {
    super.onNewIntent(intent);
    setIntent(intent);
    handleIntentRoute(intent);
  }

  @Override
  public void onResume() {
    super.onResume();
    activityVisible = true;
    preferHighRefreshRate();
    configureWebView();

    if (getBridge() != null && getBridge().getWebView() != null) {
      WebView webView = getBridge().getWebView();
      webView.postDelayed(() -> injectAvenzoShell(webView), 120);
      webView.postDelayed(() -> injectAvenzoShell(webView), 700);
    }
  }

  @Override
  public void onPause() {
    activityVisible = false;
    super.onPause();
  }

  @Override
  public void onDestroy() {
    photoStudio.close();
    notificationHandler.removeCallbacks(notificationPoller);
    notificationExecutor.shutdownNow();
    setCallAudioMode(false, false);
    super.onDestroy();
  }

  private void createMessageNotificationChannel() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) return;

    NotificationChannel channel = new NotificationChannel(
      MESSAGE_CHANNEL_ID,
      "Messages",
      NotificationManager.IMPORTANCE_HIGH
    );
    channel.setDescription("AVENZO messages and incoming calls");
    channel.enableVibration(true);

    NotificationManager manager =
      (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
    manager.createNotificationChannel(channel);
  }

  private void requestNotificationPermission() {
    if (
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
      checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
        != PackageManager.PERMISSION_GRANTED
    ) {
      requestPermissions(
        new String[]{Manifest.permission.POST_NOTIFICATIONS},
        4201
      );
    }
  }

  private boolean mediaResourcesGranted(String[] resources) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return true;

    for (String resource : resources) {
      if (
        PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource) &&
        checkSelfPermission(Manifest.permission.RECORD_AUDIO)
          != PackageManager.PERMISSION_GRANTED
      ) {
        return false;
      }

      if (
        PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource) &&
        checkSelfPermission(Manifest.permission.CAMERA)
          != PackageManager.PERMISSION_GRANTED
      ) {
        return false;
      }
    }

    return true;
  }

  private void requestRuntimeMediaPermissions(String[] resources) {
    boolean needsAudio = false;
    boolean needsCamera = false;

    for (String resource : resources) {
      if (
        PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource) &&
        checkSelfPermission(Manifest.permission.RECORD_AUDIO)
          != PackageManager.PERMISSION_GRANTED
      ) {
        needsAudio = true;
      }

      if (
        PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource) &&
        checkSelfPermission(Manifest.permission.CAMERA)
          != PackageManager.PERMISSION_GRANTED
      ) {
        needsCamera = true;
      }
    }

    if (needsAudio && needsCamera) {
      requestPermissions(
        new String[]{
          Manifest.permission.RECORD_AUDIO,
          Manifest.permission.CAMERA
        },
        4202
      );
    } else if (needsAudio) {
      requestPermissions(
        new String[]{Manifest.permission.RECORD_AUDIO},
        4202
      );
    } else if (needsCamera) {
      requestPermissions(
        new String[]{Manifest.permission.CAMERA},
        4202
      );
    }
  }

  @Override
  public void onRequestPermissionsResult(
    int requestCode,
    String[] permissions,
    int[] grantResults
  ) {
    super.onRequestPermissionsResult(
      requestCode,
      permissions,
      grantResults
    );

    if (requestCode != 4202) return;

    PermissionRequest pending = pendingMediaPermissionRequest;
    String[] resources = pendingMediaResources;
    pendingMediaPermissionRequest = null;
    pendingMediaResources = null;

    if (pending == null || resources == null) return;

    if (mediaResourcesGranted(resources)) {
      pending.grant(resources);
    } else {
      pending.deny();
    }
  }

  private void showMessageNotification(
    String title,
    String body,
    String route
  ) {
    if (
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
      checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
        != PackageManager.PERMISSION_GRANTED
    ) {
      return;
    }

    String safeRoute =
      route != null && route.startsWith("/") ? route : "/messages";

    Intent intent = new Intent(this, MainActivity.class);
    intent.putExtra("avenzo_route", safeRoute);
    intent.addFlags(
      Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP
    );

    int flags = PendingIntent.FLAG_UPDATE_CURRENT;
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M) {
      flags |= PendingIntent.FLAG_IMMUTABLE;
    }

    PendingIntent pendingIntent = PendingIntent.getActivity(
      this,
      Math.abs(safeRoute.hashCode()),
      intent,
      flags
    );

    Notification.Builder builder =
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.O
        ? new Notification.Builder(this, MESSAGE_CHANNEL_ID)
        : new Notification.Builder(this);

    builder
      .setSmallIcon(R.drawable.avenzo_notification_icon)
      .setLargeIcon(
        BitmapFactory.decodeResource(
          getResources(),
          R.drawable.avenzo_logo_premium
        )
      )
      .setContentTitle(
        title == null || title.trim().isEmpty() ? "AVENZO" : title
      )
      .setContentText(
        body == null || body.trim().isEmpty()
          ? "New message"
          : body
      )
      .setStyle(
        new Notification.BigTextStyle().bigText(
          body == null || body.trim().isEmpty()
            ? "New message"
            : body
        )
      )
      .setAutoCancel(true)
      .setContentIntent(pendingIntent)
      .setCategory(Notification.CATEGORY_MESSAGE);

    NotificationManager manager =
      (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
    manager.notify(
      (int) (System.currentTimeMillis() & 0x0fffffff),
      builder.build()
    );
  }

  private boolean isMessagesScreenVisible() {
    if (!activityVisible) return false;
    if (getBridge() == null || getBridge().getWebView() == null) {
      return false;
    }
    String url = getBridge().getWebView().getUrl();
    return url != null && url.contains("/messages");
  }

  private String notificationBody(String type) {
    if ("message_request".equals(type)) {
      return "You have a new message request";
    }
    if ("message_reply".equals(type)) {
      return "Someone replied to your message";
    }
    return "You have a new message";
  }

  private void pollMessageNotifications() {
    String token = supabaseAccessToken;
    String userId = supabaseUserId;
    String cursor = lastNotificationAt;

    if (
      token.isEmpty() ||
      userId.isEmpty() ||
      cursor.isEmpty()
    ) {
      return;
    }

    HttpURLConnection connection = null;
    try {
      String encodedCursor = URLEncoder.encode(
        cursor,
        StandardCharsets.UTF_8.name()
      );

      String endpoint =
        SUPABASE_URL +
        "/rest/v1/notifications" +
        "?recipient_id=eq." + userId +
        "&type=in.(message,message_request,message_reply)" +
        "&created_at=gt." + encodedCursor +
        "&select=id,type,created_at" +
        "&order=created_at.asc" +
        "&limit=20";

      connection = (HttpURLConnection) new URL(endpoint).openConnection();
      connection.setRequestMethod("GET");
      connection.setConnectTimeout(8000);
      connection.setReadTimeout(8000);
      connection.setRequestProperty("apikey", SUPABASE_KEY);
      connection.setRequestProperty(
        "Authorization",
        "Bearer " + token
      );
      connection.setRequestProperty("Accept", "application/json");

      int code = connection.getResponseCode();
      if (code != 200) return;

      StringBuilder body = new StringBuilder();
      try (
        BufferedReader reader = new BufferedReader(
          new InputStreamReader(
            connection.getInputStream(),
            StandardCharsets.UTF_8
          )
        )
      ) {
        String line;
        while ((line = reader.readLine()) != null) {
          body.append(line);
        }
      }

      JSONArray rows = new JSONArray(body.toString());
      for (int i = 0; i < rows.length(); i++) {
        JSONObject row = rows.getJSONObject(i);
        String type = row.optString("type", "message");
        String createdAt = row.optString("created_at", cursor);

        if (!isMessagesScreenVisible()) {
          runOnUiThread(
            () -> showMessageNotification(
              "AVENZO",
              notificationBody(type),
              "/messages"
            )
          );
        }

        if (!createdAt.isEmpty()) {
          lastNotificationAt = createdAt;
        }
      }
    } catch (Exception ignored) {
    } finally {
      if (connection != null) connection.disconnect();
    }
  }

  private void pollIncomingCalls() {
    String token = supabaseAccessToken;
    String userId = supabaseUserId;
    if (token.isEmpty() || userId.isEmpty()) return;

    HttpURLConnection connection = null;
    try {
      String endpoint =
        SUPABASE_URL +
        "/rest/v1/call_sessions" +
        "?callee_id=eq." + userId +
        "&status=eq.ringing" +
        "&select=id,call_type,created_at" +
        "&order=created_at.desc" +
        "&limit=1";

      connection = (HttpURLConnection) new URL(endpoint).openConnection();
      connection.setRequestMethod("GET");
      connection.setConnectTimeout(8000);
      connection.setReadTimeout(8000);
      connection.setRequestProperty("apikey", SUPABASE_KEY);
      connection.setRequestProperty(
        "Authorization",
        "Bearer " + token
      );
      connection.setRequestProperty("Accept", "application/json");

      if (connection.getResponseCode() != 200) return;

      StringBuilder body = new StringBuilder();
      try (
        BufferedReader reader = new BufferedReader(
          new InputStreamReader(
            connection.getInputStream(),
            StandardCharsets.UTF_8
          )
        )
      ) {
        String line;
        while ((line = reader.readLine()) != null) {
          body.append(line);
        }
      }

      JSONArray rows = new JSONArray(body.toString());
      if (rows.length() == 0) return;

      JSONObject row = rows.getJSONObject(0);
      String callId = row.optString("id", "");
      if (callId.isEmpty() || callId.equals(lastIncomingCallId)) return;

      lastIncomingCallId = callId;
      String callType = row.optString("call_type", "audio");
      String message =
        "video".equals(callType)
          ? "Incoming video call · Open AVENZO to answer"
          : "Incoming voice call · Open AVENZO to answer";

      runOnUiThread(
        () -> showMessageNotification(
          "Incoming AVENZO call",
          message,
          "/messages"
        )
      );
    } catch (Exception ignored) {
    } finally {
      if (connection != null) connection.disconnect();
    }
  }

  private void registerNotificationSession(
    String accessToken,
    String userId
  ) {
    if (
      accessToken == null ||
      accessToken.trim().isEmpty() ||
      userId == null ||
      userId.trim().isEmpty()
    ) {
      supabaseAccessToken = "";
      supabaseUserId = "";
      lastNotificationAt = "";
      lastIncomingCallId = "";
      return;
    }

    boolean userChanged = !userId.equals(supabaseUserId);
    supabaseAccessToken = accessToken;
    supabaseUserId = userId;

    if (userChanged || lastNotificationAt.isEmpty()) {
      lastNotificationAt = Instant.now().toString();
    }
    if (userChanged) {
      lastIncomingCallId = "";
    }
  }

  private void setCallAudioMode(boolean active, boolean speaker) {
    AudioManager audioManager =
      (AudioManager) getSystemService(Context.AUDIO_SERVICE);
    if (audioManager == null) return;

    if (active) {
      if (!callAudioModeActive) {
        previousAudioMode = audioManager.getMode();
        previousSpeakerphone = audioManager.isSpeakerphoneOn();
        callAudioModeActive = true;
      }
      audioManager.setMode(AudioManager.MODE_IN_COMMUNICATION);
      audioManager.setSpeakerphoneOn(speaker);
      return;
    }

    if (!callAudioModeActive) return;
    audioManager.setSpeakerphoneOn(previousSpeakerphone);
    audioManager.setMode(previousAudioMode);
    callAudioModeActive = false;
  }

  private void handleIntentRoute(Intent intent) {
    if (intent == null) return;
    String route = intent.getStringExtra("avenzo_route");
    if (route == null || !route.startsWith("/")) return;

    if (getBridge() != null && getBridge().getWebView() != null) {
      WebView webView = getBridge().getWebView();
      String target = "https://avenzo-ivory.vercel.app" + route;
      webView.post(() -> webView.loadUrl(target));
    }
  }

  private void applySystemTheme(String theme) {
    final boolean light = "light".equalsIgnoreCase(theme);
    final View decor = getWindow().getDecorView();

    WindowCompat.setDecorFitsSystemWindows(getWindow(), false);
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

    decor.setSystemUiVisibility(flags);

    WindowInsetsControllerCompat controller =
      WindowCompat.getInsetsController(getWindow(), decor);
    controller.setAppearanceLightStatusBars(light);
    controller.setAppearanceLightNavigationBars(light);

    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
      getWindow().setStatusBarContrastEnforced(false);
      getWindow().setNavigationBarContrastEnforced(false);
    }
  }

  private void preferHighRefreshRate() {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.M) return;

    Display display = getDisplay();
    if (display == null) return;

    Display.Mode current = display.getMode();
    Display.Mode best = current;

    for (Display.Mode mode : display.getSupportedModes()) {
      boolean sameResolution =
        mode.getPhysicalWidth() == current.getPhysicalWidth() &&
        mode.getPhysicalHeight() == current.getPhysicalHeight();

      if (sameResolution && mode.getRefreshRate() > best.getRefreshRate()) {
        best = mode;
      }
    }

    WindowManager.LayoutParams params = getWindow().getAttributes();
    params.preferredDisplayModeId = best.getModeId();
    params.preferredRefreshRate = best.getRefreshRate();
    getWindow().setAttributes(params);
  }

  private void configureWebView() {
    if (
      avenzoClientInstalled ||
      getBridge() == null ||
      getBridge().getWebView() == null
    ) {
      return;
    }

    final WebView webView = getBridge().getWebView();
    webView.setOverScrollMode(WebView.OVER_SCROLL_IF_CONTENT_SCROLLS);
    webView.setNestedScrollingEnabled(true);
    webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
      webView.setRendererPriorityPolicy(
        WebView.RENDERER_PRIORITY_IMPORTANT,
        false
      );
    }
    webView.setVerticalScrollBarEnabled(false);
    webView.setHorizontalScrollBarEnabled(false);
    WebSettings settings = webView.getSettings();
    settings.setTextZoom(100);
    settings.setBuiltInZoomControls(false);
    settings.setDisplayZoomControls(false);
    settings.setMediaPlaybackRequiresUserGesture(false);
    settings.setDomStorageEnabled(true);
    settings.setDatabaseEnabled(true);
    settings.setCacheMode(WebSettings.LOAD_DEFAULT);
    webView.addJavascriptInterface(
      new AvenzoNativeBridge(),
      "AvenzoNative"
    );

    webView.setWebChromeClient(new BridgeWebChromeClient(getBridge()) {
      @Override
      public void onPermissionRequest(PermissionRequest request) {
        runOnUiThread(() -> {
          String host =
            request.getOrigin() == null
              ? ""
              : request.getOrigin().getHost();

          if (!"avenzo-ivory.vercel.app".equalsIgnoreCase(host)) {
            request.deny();
            return;
          }

          String[] resources = request.getResources();
          if (mediaResourcesGranted(resources)) {
            request.grant(resources);
            return;
          }

          if (pendingMediaPermissionRequest != null) {
            pendingMediaPermissionRequest.deny();
          }

          pendingMediaPermissionRequest = request;
          pendingMediaResources = resources;
          requestRuntimeMediaPermissions(resources);
        });
      }

      @Override
      public void onPermissionRequestCanceled(
        PermissionRequest request
      ) {
        if (pendingMediaPermissionRequest == request) {
          pendingMediaPermissionRequest = null;
          pendingMediaResources = null;
        }
        super.onPermissionRequestCanceled(request);
      }
    });

    webView.setWebViewClient(new BridgeWebViewClient(getBridge()) {
      @Override
      public void onPageFinished(WebView view, String url) {
        super.onPageFinished(view, url);
        injectAvenzoShell(view);
        view.postDelayed(() -> injectAvenzoShell(view), 180);
        view.postDelayed(() -> injectAvenzoShell(view), 800);
      }

      @Override
      public void doUpdateVisitedHistory(
        WebView view,
        String url,
        boolean isReload
      ) {
        super.doUpdateVisitedHistory(view, url, isReload);
        view.postDelayed(() -> injectAvenzoShell(view), 80);
        view.postDelayed(() -> injectAvenzoShell(view), 350);
      }
    });

    avenzoClientInstalled = true;
    webView.postDelayed(() -> injectAvenzoShell(webView), 100);
    webView.postDelayed(() -> injectAvenzoShell(webView), 500);
    webView.postDelayed(() -> injectAvenzoShell(webView), 1500);
  }

  private final OfflinePhotoStudio photoStudio = new OfflinePhotoStudio(this::deliverMediaSense);

  private class AvenzoNativeBridge {
    @JavascriptInterface
    public void processStudioImage(String dataUrl, String action, String callback) {
      photoStudio.process(dataUrl, action, callback);
    }

    @JavascriptInterface
    public void notifyMessage(
      String title,
      String body,
      String route
    ) {
      runOnUiThread(
        () -> showMessageNotification(title, body, route)
      );
    }

    @JavascriptInterface
    public void registerSession(
      String accessToken,
      String userId
    ) {
      registerNotificationSession(accessToken, userId);
    }

    @JavascriptInterface
    public void setSystemTheme(String theme) {
      runOnUiThread(() -> applySystemTheme(theme));
    }

    @JavascriptInterface
    public void haptic(String level) {
      runOnUiThread(() -> {
        Vibrator vibrator =
          (Vibrator) getSystemService(Context.VIBRATOR_SERVICE);
        if (vibrator == null || !vibrator.hasVibrator()) return;

        long duration =
          "heavy".equalsIgnoreCase(level)
            ? 42L
            : "medium".equalsIgnoreCase(level)
              ? 28L
              : 16L;

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
          vibrator.vibrate(
            VibrationEffect.createOneShot(
              duration,
              VibrationEffect.DEFAULT_AMPLITUDE
            )
          );
        } else {
          vibrator.vibrate(duration);
        }
      });
    }

    @JavascriptInterface
    public void shareContent(String title, String text, String url) {
      runOnUiThread(() -> {
        Intent share = new Intent(Intent.ACTION_SEND);
        share.setType("text/plain");
        share.putExtra(
          Intent.EXTRA_SUBJECT,
          title == null || title.trim().isEmpty() ? "AVENZO" : title
        );
        String message =
          (text == null ? "" : text.trim()) +
          (url == null || url.trim().isEmpty() ? "" : "\n" + url.trim());
        share.putExtra(Intent.EXTRA_TEXT, message.trim());
        startActivity(Intent.createChooser(share, "Share from AVENZO"));
      });
    }

    @JavascriptInterface
    public void analyzeImage(String dataUrl, String callbackName) {
      if (
        dataUrl == null ||
        callbackName == null ||
        !callbackName.matches("[A-Za-z0-9_$]+")
      ) {
        return;
      }

      notificationExecutor.execute(() -> analyzeImageInternal(dataUrl, callbackName));
    }

    @JavascriptInterface
    public void extractImageText(String dataUrl, String script, String callbackName) {
      if (callbackName == null || !callbackName.matches("[A-Za-z0-9_$]{1,100}")) return;
      if (dataUrl == null || dataUrl.length() > 12000000 || script == null ||
          !script.matches("latin|chinese|devanagari|japanese|korean")) {
        deliverMediaSense(callbackName, "");
        return;
      }
      notificationExecutor.execute(() -> extractImageTextInternal(dataUrl, script, callbackName));
    }

    @JavascriptInterface
    public void setCallAudioMode(boolean active, boolean speaker) {
      runOnUiThread(() -> MainActivity.this.setCallAudioMode(active, speaker));
    }
  }

  private void extractImageTextInternal(String dataUrl, String script, String callbackName) {
    Bitmap bitmap = null;
    TextRecognizer recognizer = null;
    try {
      int comma = dataUrl.indexOf(',');
      byte[] bytes = Base64.decode(comma >= 0 ? dataUrl.substring(comma + 1) : dataUrl, Base64.DEFAULT);
      BitmapFactory.Options bounds = new BitmapFactory.Options();
      bounds.inJustDecodeBounds = true;
      BitmapFactory.decodeByteArray(bytes, 0, bytes.length, bounds);
      if (bounds.outWidth <= 0 || bounds.outHeight <= 0) throw new IllegalArgumentException("Invalid image");
      BitmapFactory.Options options = new BitmapFactory.Options();
      options.inSampleSize = 1;
      while (Math.max(bounds.outWidth, bounds.outHeight) / options.inSampleSize > 2048) options.inSampleSize *= 2;
      bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.length, options);
      if (bitmap == null) throw new IllegalArgumentException("Invalid image");
      switch (script) {
        case "chinese": recognizer = TextRecognition.getClient(new ChineseTextRecognizerOptions.Builder().build()); break;
        case "devanagari": recognizer = TextRecognition.getClient(new DevanagariTextRecognizerOptions.Builder().build()); break;
        case "japanese": recognizer = TextRecognition.getClient(new JapaneseTextRecognizerOptions.Builder().build()); break;
        case "korean": recognizer = TextRecognition.getClient(new KoreanTextRecognizerOptions.Builder().build()); break;
        default: recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS);
      }
      final Bitmap image = bitmap;
      final TextRecognizer scanner = recognizer;
      scanner.process(InputImage.fromBitmap(image, 0))
        .addOnSuccessListener(result -> deliverMediaSense(callbackName, result.getText()))
        .addOnFailureListener(error -> deliverMediaSense(callbackName, ""))
        .addOnCompleteListener(task -> { scanner.close(); image.recycle(); });
    } catch (Exception ignored) {
      if (recognizer != null) recognizer.close();
      if (bitmap != null) bitmap.recycle();
      deliverMediaSense(callbackName, "");
    }
  }

  private void analyzeImageInternal(
    String dataUrl,
    String callbackName
  ) {
    ImageLabeler labeler = null;
    FaceDetector faceDetector = null;

    try {
      int comma = dataUrl.indexOf(',');
      String encoded = comma >= 0 ? dataUrl.substring(comma + 1) : dataUrl;
      byte[] bytes = Base64.decode(encoded, Base64.DEFAULT);
      Bitmap bitmap = BitmapFactory.decodeByteArray(bytes, 0, bytes.length);
      if (bitmap == null) {
        deliverMediaSense(callbackName, "");
        return;
      }

      InputImage image = InputImage.fromBitmap(bitmap, 0);
      labeler = ImageLabeling.getClient(ImageLabelerOptions.DEFAULT_OPTIONS);
      faceDetector = FaceDetection.getClient(
        new FaceDetectorOptions.Builder()
          .setPerformanceMode(FaceDetectorOptions.PERFORMANCE_MODE_FAST)
          .build()
      );
      final ImageLabeler activeLabeler = labeler;
      final FaceDetector activeFaceDetector = faceDetector;

      Task<List<ImageLabel>> labelsTask = activeLabeler.process(image);
      Task<List<Face>> facesTask = activeFaceDetector.process(image);
      Tasks.whenAllComplete(labelsTask, facesTask)
        .addOnCompleteListener(ignored -> {
          try {
            ArrayList<String> parts = new ArrayList<>();

            if (facesTask.isSuccessful()) {
              List<Face> faces = facesTask.getResult();
              int faceCount = faces == null ? 0 : faces.size();
              if (faceCount == 1) {
                parts.add("1 person");
              } else if (faceCount > 1) {
                parts.add(faceCount + " people");
              }
            }

            if (labelsTask.isSuccessful()) {
              List<ImageLabel> labels = labelsTask.getResult();
              ArrayList<String> strongLabels = new ArrayList<>();
              if (labels != null) {
                for (ImageLabel label : labels) {
                  if (label.getConfidence() < 0.56f) continue;
                  String value = label.getText();
                  if (value == null || value.trim().isEmpty()) continue;
                  strongLabels.add(value.trim().toLowerCase());
                  if (strongLabels.size() >= 5) break;
                }
              }
              if (!strongLabels.isEmpty()) {
                parts.add(String.join(", ", strongLabels));
              }
            }

            String result = String.join("; ", parts);
            deliverMediaSense(callbackName, result);
          } catch (Exception ignoredResult) {
            deliverMediaSense(callbackName, "");
          } finally {
            activeLabeler.close();
            activeFaceDetector.close();
            bitmap.recycle();
          }
        });
    } catch (Exception ignored) {
      if (labeler != null) labeler.close();
      if (faceDetector != null) faceDetector.close();
      deliverMediaSense(callbackName, "");
    }
  }

  private void deliverMediaSense(String callbackName, String value) {
    if (
      callbackName == null ||
      !callbackName.matches("[A-Za-z0-9_$]+") ||
      getBridge() == null ||
      getBridge().getWebView() == null
    ) {
      return;
    }

    WebView webView = getBridge().getWebView();
    String callbackJson = JSONObject.quote(callbackName);
    String valueJson = JSONObject.quote(value == null ? "" : value);
    String script =
      "(function(){var n=" + callbackJson +
      ";var cb=window[n];if(typeof cb==='function'){cb(" + valueJson +
      ");delete window[n];}})();";

    runOnUiThread(() -> webView.evaluateJavascript(script, null));
  }

  private void handleAvenzoBack() {
    if (getBridge() == null || getBridge().getWebView() == null) {
      handleRootExit();
      return;
    }

    final WebView webView = getBridge().getWebView();
    webView.evaluateJavascript(
      "(function(){try{return window.__avenzoHandleBack?window.__avenzoHandleBack():'history';}catch(e){return 'history';}})();",
      result -> {
        if ("\"handled\"".equals(result)) {
          lastRootBackPress = 0L;
          return;
        }

        if ("\"history\"".equals(result)) {
          lastRootBackPress = 0L;
          if (webView.canGoBack()) {
            webView.goBack();
          } else {
            webView.loadUrl("https://avenzo-ivory.vercel.app/home");
          }
          return;
        }

        handleRootExit();
      }
    );
  }

  private void handleRootExit() {
    long now = System.currentTimeMillis();
    if (now - lastRootBackPress <= 2000L) {
      lastRootBackPress = 0L;
      moveTaskToBack(true);
      return;
    }

    lastRootBackPress = now;
    Toast.makeText(
      this,
      "Press back again to exit",
      Toast.LENGTH_SHORT
    ).show();
  }

  private String readAssetText(String path) throws Exception {
    try (
      InputStream input = getAssets().open(path);
      ByteArrayOutputStream output = new ByteArrayOutputStream()
    ) {
      byte[] buffer = new byte[8192];
      int read;
      while ((read = input.read(buffer)) != -1) {
        output.write(buffer, 0, read);
      }
      return output.toString(StandardCharsets.UTF_8.name());
    }
  }

  private String readAssetBase64(String path) throws Exception {
    try (
      InputStream input = getAssets().open(path);
      ByteArrayOutputStream output = new ByteArrayOutputStream()
    ) {
      byte[] buffer = new byte[8192];
      int read;
      while ((read = input.read(buffer)) != -1) {
        output.write(buffer, 0, read);
      }
      return Base64.encodeToString(
        output.toByteArray(),
        Base64.NO_WRAP
      );
    }
  }

  private void injectAvenzoShell(WebView view) {
    try {
      String script = readAssetText("avenzo/native-inject.js");
      script = script.replace(
        "__CSS__",
        readAssetBase64("avenzo/app-mobile.css")
      );
      script = script.replace(
        "__LOGO_PNG__",
        readAssetBase64("avenzo/avenzo-logo-premium.png")
      );
      view.evaluateJavascript(script, null);
    } catch (Exception ignored) {
    }
  }
}