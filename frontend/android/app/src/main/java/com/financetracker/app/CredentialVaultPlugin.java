package com.financetracker.app;

import android.content.Context;
import android.content.SharedPreferences;
import android.os.Build;
import android.security.keystore.KeyGenParameterSpec;
import android.security.keystore.KeyProperties;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.nio.charset.StandardCharsets;
import java.security.KeyStore;
import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;

/** API keys encrypted at rest with a device-local, non-exportable Keystore key. */
@CapacitorPlugin(name = "CredentialVault")
public class CredentialVaultPlugin extends Plugin {
    private static final String ALIAS = "finera.provider.keys.v1";
    private SharedPreferences prefs() {
        return getContext().getSharedPreferences("finera_credentials", Context.MODE_PRIVATE);
    }
    private SecretKey key() throws Exception {
        KeyStore store = KeyStore.getInstance("AndroidKeyStore");
        store.load(null);
        if (!store.containsAlias(ALIAS)) {
            KeyGenerator generator = KeyGenerator.getInstance(KeyProperties.KEY_ALGORITHM_AES, "AndroidKeyStore");
            generator.init(new KeyGenParameterSpec.Builder(ALIAS, KeyProperties.PURPOSE_ENCRYPT | KeyProperties.PURPOSE_DECRYPT)
                .setBlockModes(KeyProperties.BLOCK_MODE_GCM).setEncryptionPaddings(KeyProperties.ENCRYPTION_PADDING_NONE)
                .setKeySize(256).build());
            generator.generateKey();
        }
        return (SecretKey) store.getKey(ALIAS, null);
    }
    @PluginMethod
    public void read(PluginCall call) {
        getBridge().execute(() -> {
            try {
                JSObject values = new JSObject();
                if (Build.VERSION.SDK_INT >= 23) {
                    for (String provider : new String[] { "groq", "tavily" }) {
                        String stored = prefs().getString(provider, "");
                        if (stored.isEmpty()) continue;
                        String[] parts = stored.split(":", 2);
                        if (parts.length != 2) throw new IllegalStateException("Invalid encrypted credential");
                        Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
                        cipher.init(Cipher.DECRYPT_MODE, key(), new GCMParameterSpec(128, Base64.decode(parts[0], Base64.NO_WRAP)));
                        cipher.updateAAD(provider.getBytes(StandardCharsets.UTF_8));
                        values.put(provider, new String(cipher.doFinal(Base64.decode(parts[1], Base64.NO_WRAP)), StandardCharsets.UTF_8));
                    }
                }
                JSObject result = new JSObject();
                result.put("values", values);
                result.put("sessionOnly", Build.VERSION.SDK_INT < 23);
                call.resolve(result);
            } catch (Exception error) { call.reject("Could not decrypt saved keys. Retry after unlocking your device."); }
        });
    }
    @PluginMethod
    public void write(PluginCall call) {
        String provider = call.getString("provider", "");
        String value = call.getString("value", "");
        if (!provider.equals("groq") && !provider.equals("tavily")) { call.reject("Unknown provider"); return; }
        if (Build.VERSION.SDK_INT < 23) { call.reject("Encrypted key storage requires Android 6 or newer"); return; }
        getBridge().execute(() -> {
            try {
                SharedPreferences.Editor edit = prefs().edit();
                if (value.isEmpty()) edit.remove(provider);
                else {
                    Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
                    cipher.init(Cipher.ENCRYPT_MODE, key());
                    cipher.updateAAD(provider.getBytes(StandardCharsets.UTF_8));
                    String encrypted = Base64.encodeToString(cipher.getIV(), Base64.NO_WRAP) + ":" +
                        Base64.encodeToString(cipher.doFinal(value.getBytes(StandardCharsets.UTF_8)), Base64.NO_WRAP);
                    edit.putString(provider, encrypted);
                }
                if (!edit.commit()) throw new IllegalStateException("Credential save failed");
                call.resolve();
            } catch (Exception error) { call.reject("Could not save encrypted key. Please retry."); }
        });
    }
}
