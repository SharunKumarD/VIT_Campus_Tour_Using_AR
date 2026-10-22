package dev.sainikhil.immersivear.ar;

import android.content.Intent;
import android.graphics.Color;
import android.opengl.GLES20;
import android.opengl.GLSurfaceView;
import android.opengl.Matrix;
import android.os.Bundle;
import android.os.SystemClock;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.TextView;

import androidx.activity.OnBackPressedCallback;
import androidx.appcompat.app.AlertDialog;
import androidx.appcompat.app.AppCompatActivity;

import com.google.ar.core.ArCoreApk;
import com.google.ar.core.Camera;
import com.google.ar.core.Config;
import com.google.ar.core.Frame;
import com.google.ar.core.Plane;
import com.google.ar.core.Pose;
import com.google.ar.core.Session;
import com.google.ar.core.TrackingFailureReason;
import com.google.ar.core.TrackingState;
import com.google.ar.core.exceptions.CameraNotAvailableException;
import com.google.ar.core.exceptions.UnavailableApkTooOldException;
import com.google.ar.core.exceptions.UnavailableArcoreNotInstalledException;
import com.google.ar.core.exceptions.UnavailableDeviceNotCompatibleException;
import com.google.ar.core.exceptions.UnavailableSdkTooOldException;
import com.google.ar.core.exceptions.UnavailableUserDeclinedInstallationException;

import org.json.JSONArray;
import org.json.JSONException;
import org.json.JSONObject;

import java.util.ArrayList;
import java.util.List;
import java.util.Locale;

import javax.microedition.khronos.egl.EGLConfig;
import javax.microedition.khronos.opengles.GL10;

/**
 * AR route guidance (Phase 5, step 2).
 *
 * 1. The user stands on a surveyed checkpoint, faces its marked direction and
 *    taps "Align here". That creates an Alignment between the campus map and
 *    the ARCore world.
 * 2. Arrows are drawn on the floor along the computed route, fixed in the world.
 * 3. RouteGuide decides, every frame, whether the position is trustworthy.
 *    When it is not, arrows are HIDDEN and the screen falls back to text
 *    directions, with a way to re-align or switch to the map.
 *
 * The navigation engine (web) computed the route; this screen only follows it.
 */
public class ArNavActivity extends AppCompatActivity implements GLSurfaceView.Renderer {

    static final String EXTRA_PAYLOAD = "payload";
    static final String EXTRA_OUTCOME = "outcome";
    static final String EXTRA_RESULT_JSON = "resultJson";

    /** Arrows are placed every ARROW_SPACING_M along the route, up to LOOKAHEAD_M ahead. */
    private static final double ARROW_SPACING_M = 1.5;
    private static final double LOOKAHEAD_M = 25;
    /** Fallback eye height if no floor plane is detected when aligning. */
    private static final float DEFAULT_PHONE_HEIGHT_M = 1.4f;

    private GLSurfaceView surfaceView;
    private TextView banner;
    private TextView status;
    private Button primary;

    private final CameraBackgroundRenderer background = new CameraBackgroundRenderer();
    private final ArrowRenderer arrows = new ArrowRenderer();

    private NavPayload payload;
    private RouteGuide guide;

    private volatile Session session;
    private boolean installRequested;
    private boolean cameraTextureSet;
    private volatile boolean finishing;
    private int viewportWidth, viewportHeight;
    private boolean viewportChanged;

    // Alignment state (GL thread owns `alignment`; UI thread only sets requests).
    private Alignment alignment;
    private volatile NavPayload.Checkpoint alignTarget; // checkpoint the user is about to align at, or null
    private volatile boolean alignRequested;
    private volatile String transientNote = "";
    private volatile int nextLevel;

    private double lastCx = Double.NaN, lastCy = Double.NaN;
    private double lastArX = Double.NaN, lastArZ = Double.NaN;
    private double walkedM;
    private long startedMs;

    private final float[] view = new float[16];
    private final float[] projection = new float[16];
    private final float[] model = new float[16];
    private String lastBanner = "", lastStatus = "", lastPrimary = "";

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        try {
            payload = NavPayload.parse(getIntent().getStringExtra(EXTRA_PAYLOAD));
            guide = new RouteGuide(payload.points, payload.instructions);
        } catch (IllegalArgumentException e) {
            finishWithError("BAD_ROUTE", e.getMessage());
            return;
        }
        startedMs = SystemClock.elapsedRealtime();
        guide.begin(startedMs);
        alignTarget = payload.start;
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        buildUi();

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                finishWithOutcome("ended");
            }
        });
    }

    private void buildUi() {
        FrameLayout root = new FrameLayout(this);
        surfaceView = new GLSurfaceView(this);
        surfaceView.setPreserveEGLContextOnPause(true);
        surfaceView.setEGLContextClientVersion(2);
        surfaceView.setEGLConfigChooser(8, 8, 8, 8, 16, 0);
        surfaceView.setRenderer(this);
        surfaceView.setRenderMode(GLSurfaceView.RENDERMODE_CONTINUOUSLY);
        root.addView(surfaceView, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));

        banner = new TextView(this);
        banner.setTextColor(Color.WHITE);
        banner.setTextSize(TypedValue.COMPLEX_UNIT_SP, 20);
        banner.setBackgroundColor(0xE60E5A3C); // signboard green
        banner.setPadding(dp(16), dp(44), dp(16), dp(16));
        root.addView(banner, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT, Gravity.TOP));

        LinearLayout bottom = new LinearLayout(this);
        bottom.setOrientation(LinearLayout.VERTICAL);
        bottom.setBackgroundColor(0xE615211B);
        bottom.setPadding(dp(16), dp(12), dp(16), dp(28));

        status = new TextView(this);
        status.setTextColor(Color.WHITE);
        status.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        bottom.addView(status, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));

        LinearLayout buttons = new LinearLayout(this);
        buttons.setOrientation(LinearLayout.HORIZONTAL);
        primary = new Button(this);
        primary.setOnClickListener(v -> onPrimary());
        Button map = new Button(this);
        map.setText("Map");
        map.setContentDescription("Switch to the map");
        map.setOnClickListener(v -> finishWithOutcome("map"));
        Button end = new Button(this);
        end.setText("End");
        end.setContentDescription("End AR guidance");
        end.setOnClickListener(v -> finishWithOutcome(guide.getMode() == RouteGuide.Mode.ARRIVED ? "arrived" : "ended"));
        buttons.addView(primary, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 2f));
        buttons.addView(map, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));
        buttons.addView(end, new LinearLayout.LayoutParams(0, LinearLayout.LayoutParams.WRAP_CONTENT, 1f));
        bottom.addView(buttons, new LinearLayout.LayoutParams(
            LinearLayout.LayoutParams.MATCH_PARENT, LinearLayout.LayoutParams.WRAP_CONTENT));

        root.addView(bottom, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT, Gravity.BOTTOM));
        setContentView(root);
        render(alignPrompt(payload.start), "Waiting for AR tracking…", "Align here");
    }

    /** Primary button: "Align here" while waiting to align, otherwise "Re-align". */
    private void onPrimary() {
        if (alignTarget != null) {
            alignRequested = true;
            return;
        }
        chooseCheckpoint();
    }

    private void chooseCheckpoint() {
        List<NavPayload.Checkpoint> options = new ArrayList<>();
        boolean needFloor = guide.getMode() == RouteGuide.Mode.NEED_REALIGN;
        for (NavPayload.Checkpoint c : payload.checkpoints) {
            if (!needFloor || c.level == nextLevel) options.add(c);
        }
        if (options.isEmpty()) {
            transientNote = needFloor
                ? "No marker on floor " + nextLevel + " is mapped for this route. Use Map to continue."
                : "No markers are mapped on this route.";
            return;
        }
        String[] names = new String[options.size()];
        for (int i = 0; i < names.length; i++) {
            NavPayload.Checkpoint c = options.get(i);
            names[i] = c.name + (c.level != 0 ? " (floor " + c.level + ")" : "");
        }
        new AlertDialog.Builder(this)
            .setTitle("Which marker are you at?")
            .setItems(names, (d, which) -> alignTarget = options.get(which))
            .setNegativeButton("Cancel", null)
            .show();
    }

    // ---- Lifecycle (same pattern as ArTestActivity) ----

    @Override
    protected void onResume() {
        super.onResume();
        if (finishing || payload == null) return;
        if (session == null) {
            try {
                ArCoreApk.InstallStatus install = ArCoreApk.getInstance().requestInstall(this, !installRequested);
                if (install == ArCoreApk.InstallStatus.INSTALL_REQUESTED) {
                    installRequested = true;
                    return;
                }
                Session s = new Session(this);
                Config config = new Config(s);
                config.setPlaneFindingMode(Config.PlaneFindingMode.HORIZONTAL);
                config.setUpdateMode(Config.UpdateMode.LATEST_CAMERA_IMAGE);
                config.setFocusMode(Config.FocusMode.AUTO);
                s.configure(config);
                session = s;
            } catch (UnavailableArcoreNotInstalledException | UnavailableUserDeclinedInstallationException e) {
                finishWithError("ARCORE_NOT_INSTALLED", "Google Play Services for AR is not installed.");
                return;
            } catch (UnavailableApkTooOldException e) {
                finishWithError("ARCORE_TOO_OLD", "Please update Google Play Services for AR.");
                return;
            } catch (UnavailableSdkTooOldException e) {
                finishWithError("APP_TOO_OLD", "This app needs updating to use AR.");
                return;
            } catch (UnavailableDeviceNotCompatibleException e) {
                finishWithError("DEVICE_NOT_COMPATIBLE", "This phone does not support ARCore.");
                return;
            } catch (Exception e) {
                finishWithError("SESSION_FAILED", "Could not start AR: " + e.getMessage());
                return;
            }
        }
        try {
            session.resume();
        } catch (CameraNotAvailableException e) {
            session = null;
            finishWithError("CAMERA_UNAVAILABLE", "The camera is in use by another app or unavailable.");
            return;
        }
        surfaceView.onResume();
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (session != null) {
            surfaceView.onPause();
            session.pause();
        }
    }

    @Override
    protected void onDestroy() {
        if (session != null) {
            session.close();
            session = null;
        }
        super.onDestroy();
    }

    // ---- Rendering (GL thread) ----

    @Override
    public void onSurfaceCreated(GL10 gl, EGLConfig config) {
        GLES20.glClearColor(0f, 0f, 0f, 1f);
        try {
            background.createOnGlThread();
            arrows.createOnGlThread();
        } catch (RuntimeException e) {
            runOnUiThread(() -> finishWithError("RENDER_INIT_FAILED", e.getMessage()));
        }
        cameraTextureSet = false;
    }

    @Override
    public void onSurfaceChanged(GL10 gl, int width, int height) {
        GLES20.glViewport(0, 0, width, height);
        viewportWidth = width;
        viewportHeight = height;
        viewportChanged = true;
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onDrawFrame(GL10 gl) {
        GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT | GLES20.GL_DEPTH_BUFFER_BIT);
        Session s = session;
        if (s == null || finishing) return;
        if (!cameraTextureSet) {
            s.setCameraTextureName(background.getTextureId());
            cameraTextureSet = true;
        }
        if (viewportChanged) {
            s.setDisplayGeometry(getWindowManager().getDefaultDisplay().getRotation(), viewportWidth, viewportHeight);
            viewportChanged = false;
        }

        Frame frame;
        try {
            frame = s.update();
        } catch (CameraNotAvailableException e) {
            runOnUiThread(() -> finishWithError("CAMERA_UNAVAILABLE", "The camera stopped working."));
            return;
        } catch (RuntimeException e) {
            runOnUiThread(() -> finishWithError("FRAME_FAILED", "AR frame update failed: " + e.getMessage()));
            return;
        }
        Camera camera = frame.getCamera();
        background.draw(frame);
        boolean tracking = camera.getTrackingState() == TrackingState.TRACKING;
        long now = SystemClock.elapsedRealtime();

        // Track distance walked (for the session log), whatever the guidance state.
        Pose cam = camera.getPose();
        if (tracking) {
            if (!Double.isNaN(lastArX)) {
                double step = Math.hypot(cam.tx() - lastArX, cam.tz() - lastArZ);
                if (step > 0.02 && step < 2) walkedM += step; // ignore jitter and relocalisation jumps
            }
            lastArX = cam.tx();
            lastArZ = cam.tz();
        }

        if (alignRequested) {
            alignRequested = false;
            tryAlign(s, camera, now);
        }

        if (alignment != null && alignTarget == null) {
            double moved = 0;
            if (tracking) {
                double[] c = alignment.toCampus(cam.tx(), cam.tz());
                if (!Double.isNaN(lastCx)) moved = Math.hypot(c[0] - lastCx, c[1] - lastCy);
                lastCx = c[0];
                lastCy = c[1];
            }
            guide.update(lastCx, lastCy, tracking, moved, now);
            nextLevel = guide.levelAfterCurrentSpan();

            RouteGuide.Mode m = guide.getMode();
            if (tracking && (m == RouteGuide.Mode.GUIDING || m == RouteGuide.Mode.DEGRADED)) {
                camera.getProjectionMatrix(projection, 0, 0.05f, 100f);
                camera.getViewMatrix(view, 0);
                drawRouteArrows(m == RouteGuide.Mode.DEGRADED);
            }
        }
        updateTexts(camera, tracking);
    }

    private void tryAlign(Session s, Camera camera, long now) {
        NavPayload.Checkpoint cp = alignTarget;
        if (cp == null) return;
        if (camera.getTrackingState() != TrackingState.TRACKING) {
            transientNote = "Wait until tracking starts, then tap Align here again.";
            return;
        }
        Pose cam = camera.getPose();
        float[] z = cam.getZAxis(); // camera looks along -Z
        float floorY = findFloorY(s, cam.ty());
        try {
            Alignment a = new Alignment(cam.tx(), cam.tz(), -z[0], -z[2], floorY, cp.x, cp.y, cp.facingDeg);
            if (!guide.alignAt(cp.nodeId, now)) {
                transientNote = "That marker is not on this route.";
                return;
            }
            alignment = a;
            alignTarget = null;
            lastCx = cp.x;
            lastCy = cp.y;
            transientNote = "";
        } catch (IllegalArgumentException e) {
            transientNote = "Hold the phone upright, pointing straight ahead, then tap Align here.";
        }
    }

    /** Height of the floor: the highest detected floor plane at least 30 cm below the phone. */
    private static float findFloorY(Session s, float cameraY) {
        float best = Float.NaN;
        for (Plane p : s.getAllTrackables(Plane.class)) {
            if (p.getTrackingState() != TrackingState.TRACKING || p.getSubsumedBy() != null) continue;
            if (p.getType() != Plane.Type.HORIZONTAL_UPWARD_FACING) continue;
            float y = p.getCenterPose().ty();
            if (y < cameraY - 0.3f && (Float.isNaN(best) || y > best)) best = y;
        }
        return Float.isNaN(best) ? cameraY - DEFAULT_PHONE_HEIGHT_M : best;
    }

    /** Arrows at fixed route distances (multiples of the spacing) so they stay put as you walk. */
    private void drawRouteArrows(boolean degraded) {
        List<RouteGuide.Point> pts = guide.getPoints();
        double from = guide.getAlongM();
        double to = from + LOOKAHEAD_M;
        int last = pts.size() - 1;
        for (int i = guide.getSegment(); i < guide.getSpanEnd(); i++) {
            RouteGuide.Point a = pts.get(i), b = pts.get(i + 1);
            double s0 = guide.cumulativeAt(i), s1 = guide.cumulativeAt(i + 1);
            if (s1 <= s0 || s0 > to) continue;
            double[] arA = alignment.toAr(a.x, a.y);
            double[] arB = alignment.toAr(b.x, b.y);
            double theta = Math.toDegrees(Math.atan2(-(arB[0] - arA[0]), -(arB[1] - arA[1])));
            double first = Math.ceil(Math.max(from + 0.5, s0) / ARROW_SPACING_M) * ARROW_SPACING_M;
            for (double d = first; d <= Math.min(s1, to); d += ARROW_SPACING_M) {
                double t = (d - s0) / (s1 - s0);
                double x = arA[0] + t * (arB[0] - arA[0]);
                double z = arA[1] + t * (arB[1] - arA[1]);
                Matrix.setIdentityM(model, 0);
                Matrix.translateM(model, 0, (float) x, (float) alignment.floorY(), (float) z);
                Matrix.rotateM(model, 0, (float) theta, 0f, 1f, 0f);
                boolean nearEnd = i + 1 == last && s1 - d < 3;
                if (nearEnd) arrows.draw(model, view, projection, 0.10f, 0.62f, 0.32f);      // destination: green
                else if (degraded) arrows.draw(model, view, projection, 0.98f, 0.86f, 0.55f); // pale: lower confidence
                else arrows.draw(model, view, projection);                                     // amber
            }
        }
    }

    // ---- Text (computed on GL thread, shown on UI thread) ----

    private void updateTexts(Camera camera, boolean tracking) {
        String note = transientNote;
        NavPayload.Checkpoint target = alignTarget;
        if (target != null) {
            String st = tracking ? "Tracking ready." : trackingHint(camera.getTrackingFailureReason());
            render(alignPrompt(target), note.isEmpty() ? st : note, "Align here");
            return;
        }
        RouteGuide.Mode m = guide.getMode();
        String left = formatM(guide.getRemainingM()) + " to " + payload.destinationName + ".";
        RouteGuide.Instruction next = guide.nextInstruction();
        String nextText = next == null ? "" : next.text;
        double dNext = guide.distanceToNextInstruction();
        String head = dNext < 5 ? nextText : "In " + formatM(dNext) + ": " + nextText;
        String off = guide.isOffRoute() ? " You may be off the route." : "";

        switch (m) {
            case GUIDING:
                render(head, "Follow the arrows. " + left + off + suffix(note), "Re-align");
                break;
            case DEGRADED:
                render(head, String.format(Locale.ROOT,
                    "Accuracy dropping: %s walked since aligning. If the arrows look wrong, re-align at a marker. %s%s",
                    formatM(guide.getSinceAlignM()), left, off) + suffix(note), "Re-align");
                break;
            case LOST:
                if ("tracking".equals(guide.getLostReason())) {
                    render("AR paused. Text directions: " + nextText,
                        trackingHint(camera.getTrackingFailureReason()) + " Arrows return when tracking recovers." + suffix(note), "Re-align");
                } else {
                    render("AR paused. Text directions: " + nextText,
                        "Position is no longer reliable. Re-align at a marker on the route, or tap Map." + suffix(note), "Re-align");
                }
                break;
            case NEED_REALIGN:
                render(nextText,
                    "Change floor to " + floorName(nextLevel) + ", then re-align at a marker there." + suffix(note), "Re-align");
                break;
            case ARRIVED:
                render("You have arrived at " + payload.destinationName, "Tap End to finish.", "Re-align");
                break;
            default:
                render(alignPrompt(payload.start), note, "Align here");
        }
    }

    private static String suffix(String note) {
        return note.isEmpty() ? "" : " " + note;
    }

    private String alignPrompt(NavPayload.Checkpoint cp) {
        return "Stand on the marker at " + cp.name + ". Face " + compass(cp.facingDeg)
            + " (the marker's arrow), hold the phone upright, then tap Align here.";
    }

    private void render(String b, String s, String p) {
        if (b.equals(lastBanner) && s.equals(lastStatus) && p.equals(lastPrimary)) return;
        lastBanner = b;
        lastStatus = s;
        lastPrimary = p;
        runOnUiThread(() -> {
            banner.setText(b);
            status.setText(s);
            primary.setText(p);
            primary.setVisibility(guide.getMode() == RouteGuide.Mode.ARRIVED ? View.GONE : View.VISIBLE);
        });
    }

    private static String trackingHint(TrackingFailureReason r) {
        if (r == null) return "Starting AR. Move the phone slowly.";
        switch (r) {
            case INSUFFICIENT_LIGHT: return "Too dark to track. Move somewhere brighter.";
            case EXCESSIVE_MOTION: return "Moving too fast. Hold the phone steadier.";
            case INSUFFICIENT_FEATURES: return "Can't see enough detail. Point at the floor or a textured wall.";
            case CAMERA_UNAVAILABLE: return "Camera unavailable.";
            case BAD_STATE: return "AR had a problem. Try re-aligning.";
            default: return "Starting AR. Move the phone slowly.";
        }
    }

    private static String compass(double deg) {
        String[] names = { "north", "north-east", "east", "south-east", "south", "south-west", "west", "north-west" };
        return names[(int) Math.round(deg / 45.0) % 8];
    }

    private static String floorName(int level) {
        return level == 0 ? "the ground floor" : level < 0 ? "basement " + (-level) : "floor " + level;
    }

    private static String formatM(double m) {
        if (m < 20) return Math.max(1, Math.round(m)) + " m";
        return (Math.round(m / 5.0) * 5) + " m";
    }

    // ---- Results back to the web app ----

    private void finishWithOutcome(String outcome) {
        if (finishing) return;
        finishing = true;
        long now = SystemClock.elapsedRealtime();
        Intent data = new Intent();
        data.putExtra(EXTRA_OUTCOME, outcome);
        data.putExtra(EXTRA_RESULT_JSON, resultJson(outcome, now));
        setResult(RESULT_OK, data);
        finish();
    }

    private String resultJson(String outcome, long now) {
        try {
            guide.close(now);
            JSONObject o = new JSONObject();
            o.put("outcome", outcome);
            o.put("durationS", (now - startedMs) / 1000.0);
            o.put("walkedM", Math.round(walkedM * 10) / 10.0);
            o.put("remainingM", Math.round(guide.getRemainingM() * 10) / 10.0);
            o.put("realigns", guide.getRealigns());
            JSONObject modes = new JSONObject();
            for (RouteGuide.Mode m : RouteGuide.Mode.values()) modes.put(m.name(), guide.getModeMs(m) / 1000.0);
            o.put("modeSeconds", modes);
            JSONArray ev = new JSONArray();
            for (RouteGuide.Event e : guide.getEvents()) {
                JSONObject j = new JSONObject();
                j.put("t", e.tMs / 1000.0);
                j.put("type", e.type);
                j.put("detail", e.detail);
                ev.put(j);
            }
            o.put("events", ev);
            JSONObject th = new JSONObject();
            th.put("degradedAfterM", RouteGuide.DEGRADED_AFTER_M);
            th.put("lostAfterM", RouteGuide.LOST_AFTER_M);
            th.put("trackingGraceMs", RouteGuide.TRACKING_GRACE_MS);
            th.put("recoveryMs", RouteGuide.RECOVERY_MS);
            o.put("thresholds", th);
            return o.toString();
        } catch (JSONException e) {
            return "{\"outcome\":\"" + outcome + "\"}";
        }
    }

    private void finishWithError(String code, String message) {
        if (finishing) return;
        finishing = true;
        Intent data = new Intent();
        data.putExtra(ArTestActivity.EXTRA_ERROR_CODE, code);
        data.putExtra(ArTestActivity.EXTRA_ERROR_MESSAGE, message != null ? message : code);
        setResult(RESULT_CANCELED, data);
        finish();
    }

    private int dp(int v) {
        return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics()));
    }
}
