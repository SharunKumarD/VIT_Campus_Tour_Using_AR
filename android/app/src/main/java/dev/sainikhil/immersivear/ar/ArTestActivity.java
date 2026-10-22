package dev.sainikhil.immersivear.ar;

import android.content.Intent;
import android.graphics.Color;
import android.opengl.GLES20;
import android.opengl.GLSurfaceView;
import android.os.Bundle;
import android.os.SystemClock;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.TextView;

import androidx.activity.OnBackPressedCallback;
import androidx.appcompat.app.AppCompatActivity;

import com.google.ar.core.Anchor;
import com.google.ar.core.ArCoreApk;
import com.google.ar.core.Camera;
import com.google.ar.core.Config;
import com.google.ar.core.Frame;
import com.google.ar.core.HitResult;
import com.google.ar.core.Plane;
import com.google.ar.core.Pose;
import com.google.ar.core.Session;
import com.google.ar.core.Trackable;
import com.google.ar.core.TrackingFailureReason;
import com.google.ar.core.TrackingState;
import com.google.ar.core.exceptions.CameraNotAvailableException;
import com.google.ar.core.exceptions.UnavailableApkTooOldException;
import com.google.ar.core.exceptions.UnavailableArcoreNotInstalledException;
import com.google.ar.core.exceptions.UnavailableDeviceNotCompatibleException;
import com.google.ar.core.exceptions.UnavailableSdkTooOldException;
import com.google.ar.core.exceptions.UnavailableUserDeclinedInstallationException;

import java.util.concurrent.ArrayBlockingQueue;

import javax.microedition.khronos.egl.EGLConfig;
import javax.microedition.khronos.opengles.GL10;

/**
 * AR foundation test (Phase 5, step 1).
 *
 * Proves genuine world-anchored AR on this device: the live camera image,
 * ARCore floor detection, and an arrow fixed to a real-world ARCore Anchor.
 * Walk around the arrow: it should stay put on the floor. That is the
 * difference between AR and an arrow painted on the screen.
 *
 * Results (or a stable error code) are returned to ImmersiveArPlugin.
 */
public class ArTestActivity extends AppCompatActivity implements GLSurfaceView.Renderer {

    static final String EXTRA_ARROW_PLACED = "arrowPlaced";
    static final String EXTRA_MAX_PLANES = "maxPlanes";
    static final String EXTRA_TRACKING_LOSSES = "trackingLosses";
    static final String EXTRA_SECONDS_TRACKING = "secondsTracking";
    static final String EXTRA_ERROR_CODE = "errorCode";
    static final String EXTRA_ERROR_MESSAGE = "errorMessage";

    private GLSurfaceView surfaceView;
    private TextView status;

    private final CameraBackgroundRenderer background = new CameraBackgroundRenderer();
    private final ArrowRenderer arrowRenderer = new ArrowRenderer();

    private volatile Session session;
    private boolean installRequested;
    private boolean cameraTextureSet;
    private volatile boolean finishing;
    private int viewportWidth;
    private int viewportHeight;
    private boolean viewportChanged;

    private final ArrayBlockingQueue<MotionEvent> taps = new ArrayBlockingQueue<>(8);
    private Anchor arrowAnchor;

    // Measurements returned to the app (useful later for the research logs).
    private int maxPlanes;
    private int trackingLosses;
    private long trackingSinceMs = -1;
    private long trackedMs;
    private TrackingState lastCameraState = TrackingState.STOPPED;
    private String lastMessage = "";

    private final float[] view = new float[16];
    private final float[] projection = new float[16];
    private final float[] model = new float[16];

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);

        FrameLayout root = new FrameLayout(this);
        surfaceView = new GLSurfaceView(this);
        surfaceView.setPreserveEGLContextOnPause(true);
        surfaceView.setEGLContextClientVersion(2);
        surfaceView.setEGLConfigChooser(8, 8, 8, 8, 16, 0);
        surfaceView.setRenderer(this);
        surfaceView.setRenderMode(GLSurfaceView.RENDERMODE_CONTINUOUSLY);
        surfaceView.setOnTouchListener((v, event) -> {
            if (event.getAction() == MotionEvent.ACTION_UP) {
                MotionEvent copy = MotionEvent.obtain(event);
                if (!taps.offer(copy)) copy.recycle();
                v.performClick();
            }
            return true;
        });
        root.addView(surfaceView, new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));

        status = new TextView(this);
        status.setTextColor(Color.WHITE);
        status.setTextSize(TypedValue.COMPLEX_UNIT_SP, 17);
        status.setBackgroundColor(0xCC0E5A3C); // signboard green, slightly transparent
        int pad = dp(16);
        status.setPadding(pad, pad, pad, pad + dp(24));
        status.setText("Starting camera…");
        FrameLayout.LayoutParams statusLp = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.WRAP_CONTENT, Gravity.BOTTOM);
        root.addView(status, statusLp);

        Button close = new Button(this);
        close.setText("Close");
        close.setContentDescription("Close AR test");
        close.setOnClickListener(v -> finishWithResult());
        FrameLayout.LayoutParams closeLp = new FrameLayout.LayoutParams(
            FrameLayout.LayoutParams.WRAP_CONTENT, FrameLayout.LayoutParams.WRAP_CONTENT, Gravity.TOP | Gravity.START);
        closeLp.setMargins(dp(12), dp(40), 0, 0);
        root.addView(close, closeLp);

        setContentView(root);

        getOnBackPressedDispatcher().addCallback(this, new OnBackPressedCallback(true) {
            @Override
            public void handleOnBackPressed() {
                finishWithResult();
            }
        });
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (session == null) {
            try {
                ArCoreApk.InstallStatus install = ArCoreApk.getInstance().requestInstall(this, !installRequested);
                if (install == ArCoreApk.InstallStatus.INSTALL_REQUESTED) {
                    installRequested = true;
                    return; // Play Store opens; we come back here afterwards.
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

    // ---- GLSurfaceView.Renderer (runs on the GL thread) ----

    @Override
    public void onSurfaceCreated(GL10 gl, EGLConfig config) {
        GLES20.glClearColor(0f, 0f, 0f, 1f);
        try {
            background.createOnGlThread();
            arrowRenderer.createOnGlThread();
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
    public void onDrawFrame(GL10 gl) {
        GLES20.glClear(GLES20.GL_COLOR_BUFFER_BIT | GLES20.GL_DEPTH_BUFFER_BIT);
        Session s = session;
        if (s == null || finishing) return;

        if (!cameraTextureSet) {
            s.setCameraTextureName(background.getTextureId());
            cameraTextureSet = true;
        }
        if (viewportChanged) {
            s.setDisplayGeometry(displayRotation(), viewportWidth, viewportHeight);
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
        trackStats(camera.getTrackingState());

        int planes = countTrackedPlanes(s);
        maxPlanes = Math.max(maxPlanes, planes);

        if (camera.getTrackingState() == TrackingState.TRACKING) {
            handleTap(s, frame, camera);
        } else {
            drainTaps();
        }

        if (arrowAnchor != null && arrowAnchor.getTrackingState() == TrackingState.TRACKING
            && camera.getTrackingState() == TrackingState.TRACKING) {
            camera.getProjectionMatrix(projection, 0, 0.05f, 100f);
            camera.getViewMatrix(view, 0);
            arrowAnchor.getPose().toMatrix(model, 0);
            arrowRenderer.draw(model, view, projection);
        }

        showStatus(statusMessage(camera, planes));
    }

    // ---- Interaction ----

    private void handleTap(Session s, Frame frame, Camera camera) {
        MotionEvent tap = taps.poll();
        if (tap == null) return;
        try {
            for (HitResult hit : frame.hitTest(tap)) {
                Trackable t = hit.getTrackable();
                if (t instanceof Plane
                    && ((Plane) t).getType() == Plane.Type.HORIZONTAL_UPWARD_FACING
                    && ((Plane) t).isPoseInPolygon(hit.getHitPose())) {
                    placeArrow(s, hit.getHitPose(), camera.getPose());
                    break;
                }
            }
        } finally {
            tap.recycle();
        }
    }

    /** Anchor the arrow where the user tapped, pointing away from the user. */
    private void placeArrow(Session s, Pose hitPose, Pose cameraPose) {
        float dx = hitPose.tx() - cameraPose.tx();
        float dz = hitPose.tz() - cameraPose.tz();
        // Rotate about the vertical axis so the arrow's -Z points along (dx, dz).
        double theta = Math.atan2(-dx, -dz);
        float half = (float) (theta / 2.0);
        Pose pose = new Pose(
            new float[] { hitPose.tx(), hitPose.ty(), hitPose.tz() },
            new float[] { 0f, (float) Math.sin(half), 0f, (float) Math.cos(half) });
        if (arrowAnchor != null) arrowAnchor.detach();
        arrowAnchor = s.createAnchor(pose);
    }

    private void drainTaps() {
        MotionEvent e;
        while ((e = taps.poll()) != null) e.recycle();
    }

    // ---- Status and measurements ----

    private static int countTrackedPlanes(Session s) {
        int n = 0;
        for (Plane p : s.getAllTrackables(Plane.class)) {
            if (p.getTrackingState() == TrackingState.TRACKING && p.getSubsumedBy() == null) n++;
        }
        return n;
    }

    private void trackStats(TrackingState state) {
        long now = SystemClock.elapsedRealtime();
        if (state == TrackingState.TRACKING && trackingSinceMs < 0) trackingSinceMs = now;
        if (state != TrackingState.TRACKING && trackingSinceMs >= 0) {
            trackedMs += now - trackingSinceMs;
            trackingSinceMs = -1;
        }
        if (lastCameraState == TrackingState.TRACKING && state == TrackingState.PAUSED) trackingLosses++;
        lastCameraState = state;
    }

    private String statusMessage(Camera camera, int planes) {
        if (camera.getTrackingState() != TrackingState.TRACKING) {
            TrackingFailureReason r = camera.getTrackingFailureReason();
            switch (r) {
                case INSUFFICIENT_LIGHT: return "Too dark to track. Move somewhere brighter.";
                case EXCESSIVE_MOTION: return "Moving too fast. Hold the phone steadier.";
                case INSUFFICIENT_FEATURES: return "Can't see enough detail. Point at a textured floor or wall.";
                case CAMERA_UNAVAILABLE: return "Camera unavailable. Close other camera apps.";
                case BAD_STATE: return "AR had a problem. Close and try again.";
                default: return "Starting AR… move the phone slowly.";
            }
        }
        if (arrowAnchor != null && arrowAnchor.getTrackingState() == TrackingState.TRACKING) {
            return "Arrow placed. Walk around it: it should stay fixed on the floor. Tap elsewhere to move it.";
        }
        if (planes == 0) return "Looking for the floor. Point the camera down and move it slowly.";
        return "Floor found. Tap the floor to place an arrow.";
    }

    private void showStatus(String message) {
        if (message.equals(lastMessage)) return;
        lastMessage = message;
        runOnUiThread(() -> status.setText(message));
    }

    // ---- Finishing ----

    private void finishWithResult() {
        if (finishing) return;
        finishing = true;
        if (trackingSinceMs >= 0) trackedMs += SystemClock.elapsedRealtime() - trackingSinceMs;
        Intent data = new Intent();
        data.putExtra(EXTRA_ARROW_PLACED, arrowAnchor != null);
        data.putExtra(EXTRA_MAX_PLANES, maxPlanes);
        data.putExtra(EXTRA_TRACKING_LOSSES, trackingLosses);
        data.putExtra(EXTRA_SECONDS_TRACKING, trackedMs / 1000.0);
        setResult(RESULT_OK, data);
        finish();
    }

    private void finishWithError(String code, String message) {
        if (finishing) return;
        finishing = true;
        Intent data = new Intent();
        data.putExtra(EXTRA_ERROR_CODE, code);
        data.putExtra(EXTRA_ERROR_MESSAGE, message != null ? message : code);
        setResult(RESULT_CANCELED, data);
        finish();
    }

    @SuppressWarnings("deprecation")
    private int displayRotation() {
        // Portrait is locked in the manifest, but read the real value anyway.
        return getWindowManager().getDefaultDisplay().getRotation();
    }

    private int dp(int v) {
        return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, getResources().getDisplayMetrics()));
    }
}
