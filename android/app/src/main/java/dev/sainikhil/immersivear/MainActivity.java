package dev.sainikhil.immersivear;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

import dev.sainikhil.immersivear.ar.ImmersiveArPlugin;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        // Custom plugins must be registered before super.onCreate.
        registerPlugin(ImmersiveArPlugin.class);
        super.onCreate(savedInstanceState);
    }
}
