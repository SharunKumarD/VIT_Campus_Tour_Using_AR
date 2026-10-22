package dev.sainikhil.immersivear.ar;

import android.media.Image;

import com.google.ar.core.Frame;
import com.google.zxing.BarcodeFormat;
import com.google.zxing.BinaryBitmap;
import com.google.zxing.DecodeHintType;
import com.google.zxing.LuminanceSource;
import com.google.zxing.ReaderException;
import com.google.zxing.Result;
import com.google.zxing.common.HybridBinarizer;
import com.google.zxing.qrcode.QRCodeReader;

import java.nio.ByteBuffer;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.atomic.AtomicBoolean;

/**
 * Reads checkpoint QR markers from the ARCore camera image, off the render thread.
 *
 * Only the brightness (Y) plane is copied, at most every SCAN_INTERVAL_MS, and
 * decoding runs on one background thread so the AR view stays smooth.
 * Decoded text is only ever compared with known marker IDs; it is never
 * opened as a link or treated as an instruction.
 */
final class QrScanner {
    interface Listener {
        /** Called on the scanner thread. */
        void onQr(String text);
    }

    private static final long SCAN_INTERVAL_MS = 400;

    private final ExecutorService executor = Executors.newSingleThreadExecutor();
    private final AtomicBoolean busy = new AtomicBoolean(false);
    private final Listener listener;
    private final Map<DecodeHintType, Object> hints = new EnumMap<>(DecodeHintType.class);
    private long lastScanMs;
    private volatile boolean closed;

    QrScanner(Listener listener) {
        this.listener = listener;
        hints.put(DecodeHintType.POSSIBLE_FORMATS, EnumSet.of(BarcodeFormat.QR_CODE));
        hints.put(DecodeHintType.TRY_HARDER, Boolean.TRUE);
    }

    /** Call from the GL thread after Session.update(). Cheap when it decides not to scan. */
    void offer(Frame frame, long nowMs) {
        if (closed || nowMs - lastScanMs < SCAN_INTERVAL_MS || busy.get()) return;
        lastScanMs = nowMs;
        byte[] luminance;
        int width, height;
        Image image = null;
        try {
            image = frame.acquireCameraImage(); // YUV_420_888; may not be ready yet
            width = image.getWidth();
            height = image.getHeight();
            Image.Plane y = image.getPlanes()[0];
            luminance = copyPlane(y.getBuffer(), y.getRowStride(), y.getPixelStride(), width, height);
        } catch (Exception e) {
            return; // no image this frame (NotYetAvailable, resources exhausted): try again later
        } finally {
            if (image != null) image.close();
        }
        busy.set(true);
        final byte[] data = luminance;
        final int w = width, h = height;
        try {
            executor.execute(() -> {
                try {
                    String text = decode(data, w, h);
                    if (text != null && !closed) listener.onQr(text);
                } finally {
                    busy.set(false);
                }
            });
        } catch (RuntimeException rejected) {
            busy.set(false); // executor shut down
        }
    }

    void close() {
        closed = true;
        executor.shutdownNow();
    }

    private String decode(byte[] data, int w, int h) {
        try {
            BinaryBitmap bitmap = new BinaryBitmap(new HybridBinarizer(new GrayLuminanceSource(data, w, h)));
            Result r = new QRCodeReader().decode(bitmap, hints);
            return r.getText();
        } catch (ReaderException e) {
            return null; // no QR code in view
        } catch (RuntimeException e) {
            return null;
        }
    }

    /** Copy a camera plane into a tightly packed width x height array. */
    static byte[] copyPlane(ByteBuffer buf, int rowStride, int pixelStride, int width, int height) {
        byte[] out = new byte[width * height];
        ByteBuffer b = buf.duplicate();
        if (pixelStride == 1 && rowStride == width) {
            b.position(0);
            b.get(out, 0, Math.min(out.length, b.remaining()));
            return out;
        }
        for (int row = 0; row < height; row++) {
            int base = row * rowStride;
            for (int col = 0; col < width; col++) {
                int idx = base + col * pixelStride;
                if (idx < b.limit()) out[row * width + col] = b.get(idx);
            }
        }
        return out;
    }

    /** ZXing luminance source over a packed 8-bit grey image. */
    static final class GrayLuminanceSource extends LuminanceSource {
        private final byte[] data;

        GrayLuminanceSource(byte[] data, int width, int height) {
            super(width, height);
            this.data = data;
        }

        @Override
        public byte[] getRow(int y, byte[] row) {
            int w = getWidth();
            if (row == null || row.length < w) row = new byte[w];
            System.arraycopy(data, y * w, row, 0, w);
            return row;
        }

        @Override
        public byte[] getMatrix() {
            return data;
        }
    }
}
