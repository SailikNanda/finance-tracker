package com.financetracker.app;

import android.app.DownloadManager;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.content.pm.Signature;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.provider.Settings;
import android.util.Base64;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.FileInputStream;
import java.io.OutputStream;
import java.security.MessageDigest;
import java.util.Arrays;

/**
 * Downloads a new APK from a URL and triggers the Android installer.
 * The APK is saved into the app's own external files dir (no permissions needed).
 */
@CapacitorPlugin(name = "ApkUpdater")
public class ApkUpdaterPlugin extends Plugin {

    private File updatesDir() {
        File dir = new File(getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), "updates");
        if (!dir.exists()) dir.mkdirs();
        return dir;
    }

    @PluginMethod
    public void download(PluginCall call) {
        String url = call.getString("url");
        if (url == null || url.trim().isEmpty()) {
            call.reject("No download URL provided");
            return;
        }
        url = url.trim();
        Uri source = Uri.parse(url);
        if (!"https".equals(source.getScheme()) || !"github.com".equals(source.getHost()) || source.getUserInfo() != null ||
            source.getQuery() != null || source.getFragment() != null || source.getPort() != -1 ||
            source.getPath() == null || !source.getPath().startsWith("/SailikNanda/finance-tracker/releases/download/") || !source.getPath().endsWith(".apk")) {
            call.reject("APK updates must come from this project's HTTPS GitHub releases");
            return;
        }
        try {
            File dest = new File(updatesDir(), "finera-update.apk");
            if (dest.exists()) dest.delete();

            DownloadManager.Request request = new DownloadManager.Request(Uri.parse(url));
            request.setDestinationUri(Uri.fromFile(dest));
            request.setTitle("Finera Update");
            request.setDescription("Downloading new version...");
            request.setNotificationVisibility(DownloadManager.Request.VISIBILITY_VISIBLE_NOTIFY_COMPLETED);
            request.setMimeType("application/vnd.android.package-archive");

            DownloadManager dm = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
            long id = dm.enqueue(request);

            JSObject ret = new JSObject();
            ret.put("downloadId", String.valueOf(id));
            ret.put("filePath", dest.getAbsolutePath());
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Download failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getDownloadStatus(PluginCall call) {
        Long id = null;
        try { String value = call.getString("downloadId"); if (value != null) id = Long.parseLong(value); } catch (Exception ignored) {}
        if (id == null) try { id = call.getLong("downloadId"); } catch (Exception ignored) {}
        if (id == null) {
            try { Double d = call.getDouble("downloadId"); if (d != null) id = d.longValue(); } catch (Exception ignored) {}
        }
        if (id == null) {
            try { Integer i = call.getInt("downloadId"); if (i != null) id = i.longValue(); } catch (Exception ignored) {}
        }
        if (id == null) {
            call.reject("Missing downloadId");
            return;
        }
        try {
            DownloadManager dm = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
            DownloadManager.Query q = new DownloadManager.Query();
            q.setFilterById(id);
            JSObject ret = new JSObject();
            try (Cursor c = dm.query(q)) {
            if (c != null && c.moveToFirst()) {
                int status = c.getInt(c.getColumnIndexOrThrow(DownloadManager.COLUMN_STATUS));
                long bytesDownloaded = c.getLong(c.getColumnIndexOrThrow(DownloadManager.COLUMN_BYTES_DOWNLOADED_SO_FAR));
                long totalSize = c.getLong(c.getColumnIndexOrThrow(DownloadManager.COLUMN_TOTAL_SIZE_BYTES));
                String statusText = "running";
                boolean finished = false;
                switch (status) {
                    case DownloadManager.STATUS_SUCCESSFUL: statusText = "successful"; finished = true; break;
                    case DownloadManager.STATUS_FAILED: statusText = "failed"; finished = true; break;
                    case DownloadManager.STATUS_PAUSED: statusText = "paused"; break;
                    default: statusText = "running";
                }
                ret.put("status", statusText);
                ret.put("finished", finished);
                ret.put("bytesDownloaded", bytesDownloaded);
                ret.put("totalSize", totalSize);
            } else {
                ret.put("status", "unknown");
                ret.put("finished", true);
            }
            }
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Status query failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void cancelDownload(PluginCall call) {
        try {
            String id = call.getString("downloadId");
            DownloadManager manager = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
            manager.remove(Long.parseLong(id));
            call.resolve();
        } catch (Exception error) { call.reject("Could not cancel download"); }
    }

    @PluginMethod
    public void saveFile(PluginCall call) {
        String base64 = call.getString("base64");
        String fileName = call.getString("fileName");
        String mimeType = call.getString("mimeType", "application/pdf");
        if (base64 == null || fileName == null || fileName.isEmpty()) {
            call.reject("Missing base64 or fileName");
            return;
        }
        if (!fileName.matches("[A-Za-z0-9._-]{1,180}") || (!mimeType.equals("application/pdf") && !mimeType.equals("application/json")) || base64.length() > 28 * 1024 * 1024) {
            call.reject("Invalid export name, type or size (maximum 20 MB)");
            return;
        }
        try {
            byte[] data = Base64.decode(base64, Base64.DEFAULT);
            if (Build.VERSION.SDK_INT >= 29) {
                ContentValues values = new ContentValues();
                values.put(MediaStore.Downloads.DISPLAY_NAME, fileName);
                values.put(MediaStore.Downloads.MIME_TYPE, mimeType);
                values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                values.put(MediaStore.Downloads.IS_PENDING, 1);
                Uri uri = getContext().getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                if (uri == null) {
                    call.reject("Could not create file in Downloads");
                    return;
                }
                try (OutputStream os = getContext().getContentResolver().openOutputStream(uri)) {
                    if (os == null) throw new IllegalStateException("Downloads stream unavailable");
                    os.write(data);
                } catch (Exception error) {
                    getContext().getContentResolver().delete(uri, null, null);
                    throw error;
                }
                values.clear();
                values.put(MediaStore.Downloads.IS_PENDING, 0);
                getContext().getContentResolver().update(uri, values, null, null);
                JSObject ret = new JSObject();
                ret.put("path", uri.toString());
                call.resolve(ret);
            } else {
                File dir = new File(getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), "exports");
                if (!dir.exists()) dir.mkdirs();
                File f = new File(dir, fileName);
                try (FileOutputStream fos = new FileOutputStream(f)) { fos.write(data); }
                JSObject ret = new JSObject();
                ret.put("path", f.getAbsolutePath());
                call.resolve(ret);
            }
        } catch (Exception e) {
            call.reject("Save failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void canInstallUnknownApps(PluginCall call) {
        JSObject ret = new JSObject();
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            ret.put("allowed", getContext().getPackageManager().canRequestPackageInstalls());
        } else {
            ret.put("allowed", true);
        }
        call.resolve(ret);
    }

    @PluginMethod
    public void install(PluginCall call) {
        String filePath = call.getString("filePath");
        String checksum = call.getString("sha256", "");
        if (filePath == null || filePath.trim().isEmpty()) {
            call.reject("Missing file path");
            return;
        }
        if (!checksum.matches("(?i)[a-f0-9]{64}")) { call.reject("A valid SHA-256 checksum is required"); return; }
        getBridge().execute(() -> {
        try {
            File file = new File(filePath);
            if (!file.exists()) {
                call.reject("APK file not found");
                return;
            }

            // Security check: ensure file is strictly inside updatesDir
            String fileCanonical = file.getCanonicalPath();
            String updatesCanonical = updatesDir().getCanonicalPath();
            if (!fileCanonical.startsWith(updatesCanonical + File.separator)) {
                call.reject("Invalid APK file location");
                return;
            }

            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            try (FileInputStream stream = new FileInputStream(file)) {
                byte[] buffer = new byte[65536];
                int size;
                while ((size = stream.read(buffer)) != -1) digest.update(buffer, 0, size);
            }
            StringBuilder actual = new StringBuilder();
            for (byte value : digest.digest()) actual.append(String.format("%02x", value & 0xff));
            if (!actual.toString().equalsIgnoreCase(checksum)) { call.reject("APK checksum mismatch. Delete the download and retry."); return; }
            PackageManager pm = getContext().getPackageManager();
            int flags = Build.VERSION.SDK_INT >= 28 ? PackageManager.GET_SIGNING_CERTIFICATES : PackageManager.GET_SIGNATURES;
            PackageInfo candidate = pm.getPackageArchiveInfo(file.getAbsolutePath(), flags);
            PackageInfo installed = pm.getPackageInfo(getContext().getPackageName(), flags);
            if (candidate == null || !getContext().getPackageName().equals(candidate.packageName)) { call.reject("The downloaded APK is not Finera"); return; }
            Signature[] incoming = Build.VERSION.SDK_INT >= 28 ? candidate.signingInfo.getApkContentsSigners() : candidate.signatures;
            Signature[] current = Build.VERSION.SDK_INT >= 28 ? installed.signingInfo.getApkContentsSigners() : installed.signatures;
            if (incoming == null || current == null || incoming.length != current.length) { call.reject("Update signing key differs. Keep the installed app and export a JSON backup; contact the developer."); return; }
            for (Signature signature : current) {
                boolean found = false;
                for (Signature other : incoming) if (Arrays.equals(signature.toByteArray(), other.toByteArray())) found = true;
                if (!found) { call.reject("Update signing key differs. Your existing app and ledger are safe."); return; }
            }
            long newVersion = Build.VERSION.SDK_INT >= 28 ? candidate.getLongVersionCode() : candidate.versionCode;
            long oldVersion = Build.VERSION.SDK_INT >= 28 ? installed.getLongVersionCode() : installed.versionCode;
            if (newVersion <= oldVersion) { call.reject("Update version must be newer than the installed version"); return; }

            Context ctx = getContext();
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
                if (!ctx.getPackageManager().canRequestPackageInstalls()) {
                    Intent manageIntent = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES);
                    manageIntent.setData(Uri.parse("package:" + ctx.getPackageName()));
                    manageIntent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                    ctx.startActivity(manageIntent);
                    call.reject("Please allow 'Install unknown apps' permission in Settings, then tap Update now again.");
                    return;
                }
            }

            Uri contentUri = FileProvider.getUriForFile(
                ctx,
                ctx.getPackageName() + ".fileprovider",
                file
            );
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(contentUri, "application/vnd.android.package-archive");
            intent.setFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            ctx.startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Install failed: " + e.getMessage());
        }
        });
    }
}
