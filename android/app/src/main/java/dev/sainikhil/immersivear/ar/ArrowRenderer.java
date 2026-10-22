package dev.sainikhil.immersivear.ar;

import android.opengl.GLES20;
import android.opengl.Matrix;

import java.nio.FloatBuffer;

/**
 * A flat route arrow lying on the floor, about 65 cm long, pointing along -Z
 * of the anchor it is drawn at. Drawn in road-marking amber with a darker
 * edge so it stays visible on light floors.
 */
final class ArrowRenderer {
    private static final String VERTEX =
        "uniform mat4 u_Mvp;\n" +
        "attribute vec4 a_Position;\n" +
        "void main() { gl_Position = u_Mvp * a_Position; }\n";

    private static final String FRAGMENT =
        "precision mediump float;\n" +
        "uniform vec4 u_Color;\n" +
        "void main() { gl_FragColor = u_Color; }\n";

    /** Arrow outline in metres on the floor plane (x, y=0, z). Forward is -Z. */
    private static float[] arrow(float s, float lift) {
        float hw = 0.06f * s, len = 0.20f * s, headW = 0.18f * s, tip = -0.45f * s;
        return new float[] {
            // shaft: two triangles
            -hw, lift,  len,   hw, lift,  len,   hw, lift, -len,
            -hw, lift,  len,   hw, lift, -len,  -hw, lift, -len,
            // head
            -headW, lift, -len,   headW, lift, -len,   0f, lift, tip,
        };
    }

    private static final float[] FILL = arrow(1f, 0.012f);
    private static final float[] EDGE = arrow(1.18f, 0.006f);

    private final FloatBuffer fill = GlUtil.floats(FILL);
    private final FloatBuffer edge = GlUtil.floats(EDGE);
    private final float[] mvp = new float[16];
    private final float[] modelView = new float[16];
    private int program;
    private int aPosition;
    private int uMvp;
    private int uColor;

    void createOnGlThread() {
        program = GlUtil.program(VERTEX, FRAGMENT);
        aPosition = GLES20.glGetAttribLocation(program, "a_Position");
        uMvp = GLES20.glGetUniformLocation(program, "u_Mvp");
        uColor = GLES20.glGetUniformLocation(program, "u_Color");
    }

    void draw(float[] model, float[] view, float[] projection) {
        draw(model, view, projection, 0.96f, 0.70f, 0.0f);
    }

    /** Draw with a custom fill colour (e.g. green for the destination). */
    void draw(float[] model, float[] view, float[] projection, float r, float g, float b) {
        Matrix.multiplyMM(modelView, 0, view, 0, model, 0);
        Matrix.multiplyMM(mvp, 0, projection, 0, modelView, 0);

        GLES20.glUseProgram(program);
        GLES20.glDisable(GLES20.GL_CULL_FACE); // visible from above and below
        GLES20.glUniformMatrix4fv(uMvp, 1, false, mvp, 0);
        GLES20.glEnableVertexAttribArray(aPosition);

        GLES20.glUniform4f(uColor, 0.36f, 0.26f, 0.0f, 1f); // dark edge
        GLES20.glVertexAttribPointer(aPosition, 3, GLES20.GL_FLOAT, false, 0, edge);
        GLES20.glDrawArrays(GLES20.GL_TRIANGLES, 0, EDGE.length / 3);

        GLES20.glUniform4f(uColor, r, g, b, 1f); // fill
        GLES20.glVertexAttribPointer(aPosition, 3, GLES20.GL_FLOAT, false, 0, fill);
        GLES20.glDrawArrays(GLES20.GL_TRIANGLES, 0, FILL.length / 3);

        GLES20.glDisableVertexAttribArray(aPosition);
    }
}
