package dev.sainikhil.immersivear.ar;

import android.Manifest;
import android.app.Activity;
import android.content.Intent;
import android.os.Handler;
import android.os.Looper;

import androidx.activity.result.ActivityResult;

import com.getcapacitor.JSObject;
import com.getcapacitor.PermissionState;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.ActivityCallback;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.google.ar.core.ArCoreApk;
import com.google.ar.core.exceptions.UnavailableDeviceNotCompatibleException;
import com.google.ar.core.exceptions.UnavailableUserDeclinedInstallationException;

/**
 * Bridge between the Next.js interface and native ARCore.
 *
 * JavaScript name: "ImmersiveAr" (see src/lib/native/ar.ts for the typed interface).
 * Every failure is reported back to JavaScript with a stable error code;
 * nothing fails silently.
 */
@CapacitorPlugin(
    name = "ImmersiveAr",
    permissions = { @Permission(strings = { Manifest.permission.CAMERA }, alias = ImmersiveArPlugin.CAMERA) }
)
public class ImmersiveArPlugin extends Plugin {

    static final String CAMERA = "camera";
    private static final int MAX_AVAILABILITY_POLLS = 25; // 25 x 200 ms = 5 s
    private final Handler main = new Handler(Looper.getMainLooper());

    /** Does this phone support ARCore, and is Google Play Services for AR installed? */
    @PluginMethod
    public void checkAvailability(PluginCall call) {
        pollAvailability(call, 0);
    }

    private void pollAvailability(PluginCall call, int attempt) {
        ArCoreApk.Availability a;
        try {
            a = ArCoreApk.getInstance().checkAvailability(getContext());
        } catch (Exception e) {
            call.reject("Could not check ARCore availability: " + e.getMessage(), "AVAILABILITY_ERROR", e);
            return;
        }
        // The first check can be "still checking"; ask again shortly.
        if (a.isTransient() && attempt < MAX_AVAILABILITY_POLLS) {
            main.postDelayed(() -> pollAvailability(call, attempt + 1), 200);
            return;
        }
        JSObject ret = new JSObject();
        ret.put("status", a.name());
        ret.put("supported", a.isSupported());
        ret.put("installed", a == ArCoreApk.Availability.SUPPORTED_INSTALLED);
        ret.put("cameraPermission", getPermissionState(CAMERA).toString());
        call.resolve(ret);
    }

    /** Ask Google Play to install or update Google Play Services for AR. */
    @PluginMethod
    public void requestInstall(PluginCall call) {
        try {
            ArCoreApk.InstallStatus s = ArCoreApk.getInstance().requestInstall(getActivity(), true);
            JSObject ret = new JSObject();
            ret.put("status", s.name()); // INSTALLED or INSTALL_REQUESTED
            call.resolve(ret);
        } catch (UnavailableDeviceNotCompatibleException e) {
            call.reject("This phone does not support ARCore.", "DEVICE_NOT_COMPATIBLE", e);
        } catch (UnavailableUserDeclinedInstallationException e) {
            call.reject("Installation of Google Play Services for AR was declined.", "INSTALL_DECLINED", e);
        } catch (Exception e) {
            call.reject("Could not request ARCore installation: " + e.getMessage(), "INSTALL_ERROR", e);
        }
    }

    /** Open the native AR camera test screen. Asks for camera permission first. */
    @PluginMethod
    public void openArTest(PluginCall call) {
        if (getPermissionState(CAMERA) != PermissionState.GRANTED) {
            requestPermissionForAlias(CAMERA, call, "cameraPermissionResult");
            return;
        }
        launchArTest(call);
    }

    @PermissionCallback
    private void cameraPermissionResult(PluginCall call) {
        if (getPermissionState(CAMERA) == PermissionState.GRANTED) {
            launchArTest(call);
        } else {
            call.reject("Camera permission is needed for AR. You can allow it in Android Settings > Apps.", "CAMERA_DENIED");
        }
    }

    private void launchArTest(PluginCall call) {
        Intent intent = new Intent(getContext(), ArTestActivity.class);
        startActivityForResult(call, intent, "arTestResult");
    }

    @ActivityCallback
    private void arTestResult(PluginCall call, ActivityResult result) {
        if (call == null) return;
        Intent data = result.getData();
        if (data != null && data.hasExtra(ArTestActivity.EXTRA_ERROR_CODE)) {
            call.reject(
                data.getStringExtra(ArTestActivity.EXTRA_ERROR_MESSAGE),
                data.getStringExtra(ArTestActivity.EXTRA_ERROR_CODE)
            );
            return;
        }
        JSObject ret = new JSObject();
        ret.put("completed", result.getResultCode() == Activity.RESULT_OK);
        ret.put("arrowPlaced", data != null && data.getBooleanExtra(ArTestActivity.EXTRA_ARROW_PLACED, false));
        ret.put("maxPlanes", data != null ? data.getIntExtra(ArTestActivity.EXTRA_MAX_PLANES, 0) : 0);
        ret.put("trackingLossCount", data != null ? data.getIntExtra(ArTestActivity.EXTRA_TRACKING_LOSSES, 0) : 0);
        ret.put("secondsTracking", data != null ? data.getDoubleExtra(ArTestActivity.EXTRA_SECONDS_TRACKING, 0) : 0);
        call.resolve(ret);
    }
}
