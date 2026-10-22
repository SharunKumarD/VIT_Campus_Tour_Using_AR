package dev.sainikhil.immersivear.ar;

import static org.junit.Assert.assertEquals;

import java.nio.ByteBuffer;

import org.junit.Test;

public class QrScannerTest {

    @Test
    public void copiesTightlyPackedPlaneDirectly() {
        byte[] src = { 1, 2, 3, 4, 5, 6 };
        byte[] out = QrScanner.copyPlane(ByteBuffer.wrap(src), 3, 1, 3, 2);
        for (int i = 0; i < src.length; i++) assertEquals(src[i], out[i]);
    }

    @Test
    public void dropsRowPaddingFromStridedPlanes() {
        // width 3, rowStride 5: two padding bytes (9) at the end of each row
        byte[] src = { 1, 2, 3, 9, 9, 4, 5, 6, 9, 9 };
        byte[] out = QrScanner.copyPlane(ByteBuffer.wrap(src), 5, 1, 3, 2);
        byte[] expected = { 1, 2, 3, 4, 5, 6 };
        assertEquals(expected.length, out.length);
        for (int i = 0; i < expected.length; i++) assertEquals(expected[i], out[i]);
    }

    @Test
    public void handlesLastRowShorterThanStride() {
        // Camera buffers often omit the padding after the final row.
        byte[] src = { 1, 2, 3, 9, 4, 5, 6 };
        byte[] out = QrScanner.copyPlane(ByteBuffer.wrap(src), 4, 1, 3, 2);
        byte[] expected = { 1, 2, 3, 4, 5, 6 };
        for (int i = 0; i < expected.length; i++) assertEquals(expected[i], out[i]);
    }

    @Test
    public void readsWithPixelStride() {
        byte[] src = { 1, 0, 2, 0, 3, 0, 4, 0 };
        byte[] out = QrScanner.copyPlane(ByteBuffer.wrap(src), 4, 2, 2, 2);
        byte[] expected = { 1, 2, 3, 4 };
        for (int i = 0; i < expected.length; i++) assertEquals(expected[i], out[i]);
    }

    @Test
    public void luminanceSourceReturnsRows() {
        byte[] data = { 10, 20, 30, 40, 50, 60 };
        QrScanner.GrayLuminanceSource s = new QrScanner.GrayLuminanceSource(data, 3, 2);
        byte[] row = s.getRow(1, null);
        assertEquals(40, row[0]);
        assertEquals(60, row[2]);
        assertEquals(6, s.getMatrix().length);
    }
}
