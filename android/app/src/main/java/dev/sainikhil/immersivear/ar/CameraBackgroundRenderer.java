package dev.sainikhil.immersivear.ar;

import android.opengl.GLES11Ext;
import android.opengl.GLES20;

import com.google.ar.core.Coordinates2d;
import com.google.ar.core.Frame;

import java.nio.FloatBuffer;

/**
 * Draws the live camera image full-screen. ARCore writes each camera frame
 * into an external OES texture; we draw it on a screen-sized quad, using
 * ARCore's own coordinate transform so it matches the display rotation and aspect.
 */
final class CameraBackgroundRenderer {
    private static final String VERTEX =
        "attribute vec4 a_Position;\n" +
        "attribute vec2 a_TexCoord;\n" +
        "varying vec2 v_TexCoord;\n" +
        "void main() { gl_Position = a_Position; v_TexCoord = a_TexCoord; }\n";

    private static final String FRAGMENT =
        "#extension GL_OES_EGL_image_external : require\n" +
        "precision mediump float;\n" +
        "uniform samplerExternalOES u_Texture;\n" +
        "varying vec2 v_TexCoord;\n" +
        "void main() { gl_FragColor = texture2D(u_Texture, v_TexCoord); }\n";

    /** Full-screen quad in normalized device coordinates, as a triangle strip. */
    private static final float[] QUAD = { -1f, -1f, 1f, -1f, -1f, 1f, 1f, 1f };

    private final FloatBuffer quad = GlUtil.floats(QUAD);
    private final FloatBuffer texCoords = GlUtil.floats(QUAD.length);
    private int textureId = -1;
    private int program;
    private int aPosition;
    private int aTexCoord;
    private int uTexture;

    /** Must be called on the GL thread after the surface is created. */
    void createOnGlThread() {
        int[] tex = new int[1];
        GLES20.glGenTextures(1, tex, 0);
        textureId = tex[0];
        int target = GLES11Ext.GL_TEXTURE_EXTERNAL_OES;
        GLES20.glBindTexture(target, textureId);
        GLES20.glTexParameteri(target, GLES20.GL_TEXTURE_WRAP_S, GLES20.GL_CLAMP_TO_EDGE);
        GLES20.glTexParameteri(target, GLES20.GL_TEXTURE_WRAP_T, GLES20.GL_CLAMP_TO_EDGE);
        GLES20.glTexParameteri(target, GLES20.GL_TEXTURE_MIN_FILTER, GLES20.GL_LINEAR);
        GLES20.glTexParameteri(target, GLES20.GL_TEXTURE_MAG_FILTER, GLES20.GL_LINEAR);

        program = GlUtil.program(VERTEX, FRAGMENT);
        aPosition = GLES20.glGetAttribLocation(program, "a_Position");
        aTexCoord = GLES20.glGetAttribLocation(program, "a_TexCoord");
        uTexture = GLES20.glGetUniformLocation(program, "u_Texture");
    }

    int getTextureId() {
        return textureId;
    }

    void draw(Frame frame) {
        if (frame.hasDisplayGeometryChanged()) {
            quad.position(0);
            texCoords.position(0);
            frame.transformCoordinates2d(
                Coordinates2d.OPENGL_NORMALIZED_DEVICE_COORDINATES, quad,
                Coordinates2d.TEXTURE_NORMALIZED, texCoords);
            quad.position(0);
            texCoords.position(0);
        }
        // No image yet (first frames after resume): nothing to draw.
        if (frame.getTimestamp() == 0) return;

        GLES20.glDisable(GLES20.GL_DEPTH_TEST);
        GLES20.glDepthMask(false);

        GLES20.glUseProgram(program);
        GLES20.glActiveTexture(GLES20.GL_TEXTURE0);
        GLES20.glBindTexture(GLES11Ext.GL_TEXTURE_EXTERNAL_OES, textureId);
        GLES20.glUniform1i(uTexture, 0);

        GLES20.glVertexAttribPointer(aPosition, 2, GLES20.GL_FLOAT, false, 0, quad);
        GLES20.glVertexAttribPointer(aTexCoord, 2, GLES20.GL_FLOAT, false, 0, texCoords);
        GLES20.glEnableVertexAttribArray(aPosition);
        GLES20.glEnableVertexAttribArray(aTexCoord);
        GLES20.glDrawArrays(GLES20.GL_TRIANGLE_STRIP, 0, 4);
        GLES20.glDisableVertexAttribArray(aPosition);
        GLES20.glDisableVertexAttribArray(aTexCoord);

        GLES20.glDepthMask(true);
        GLES20.glEnable(GLES20.GL_DEPTH_TEST);
    }
}
