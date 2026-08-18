package com.financetracker.app;

import android.app.DownloadManager;
import android.content.ContentValues;
import android.content.Context;
import android.content.Intent;
import android.database.Cursor;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;

import androidx.core.content.FileProvider;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

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
        if (url == null || url.isEmpty()) {
            call.reject("No download URL provided");
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
            ret.put("downloadId", id);
            ret.put("filePath", dest.getAbsolutePath());
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Download failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void getDownloadStatus(PluginCall call) {
        Long id = call.getLong("downloadId");
        if (id == null) {
            call.reject("Missing downloadId");
            return;
        }
        try {
            DownloadManager dm = (DownloadManager) getContext().getSystemService(Context.DOWNLOAD_SERVICE);
            DownloadManager.Query q = new DownloadManager.Query();
            q.setFilterById(id);
            Cursor c = dm.query(q);
            JSObject ret = new JSObject();
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
                c.close();
            } else {
                ret.put("status", "unknown");
                ret.put("finished", false);
            }
            call.resolve(ret);
        } catch (Exception e) {
            call.reject("Status query failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void saveFile(PluginCall call) {
        String base64 = call.getString("base64");
        String fileName = call.getString("fileName");
        if (base64 == null || fileName == null || fileName.isEmpty()) {
            call.reject("Missing base64 or fileName");
            return;
        }
        try {
            byte[] data = Base64.decode(base64, Base64.DEFAULT);
            if (Build.VERSION.SDK_INT >= 29) {
                ContentValues values = new ContentValues();
                values.put(MediaStore.Downloads.DISPLAY_NAME, fileName);
                values.put(MediaStore.Downloads.MIME_TYPE, "application/pdf");
                values.put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS);
                Uri uri = getContext().getContentResolver().insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values);
                if (uri == null) {
                    call.reject("Could not create file in Downloads");
                    return;
                }
                OutputStream os = getContext().getContentResolver().openOutputStream(uri);
                os.write(data);
                os.close();
                JSObject ret = new JSObject();
                ret.put("path", uri.toString());
                call.resolve(ret);
            } else {
                File dir = new File(getContext().getExternalFilesDir(Environment.DIRECTORY_DOWNLOADS), "exports");
                if (!dir.exists()) dir.mkdirs();
                File f = new File(dir, fileName);
                FileOutputStream fos = new FileOutputStream(f);
                fos.write(data);
                fos.close();
                JSObject ret = new JSObject();
                ret.put("path", f.getAbsolutePath());
                call.resolve(ret);
            }
        } catch (Exception e) {
            call.reject("Save failed: " + e.getMessage());
        }
    }

    @PluginMethod
    public void install(PluginCall call) {
        String filePath = call.getString("filePath");
        if (filePath == null || filePath.isEmpty()) {
            call.reject("Missing file path");
            return;
        }
        try {
            File file = new File(filePath);
            if (!file.exists()) {
                call.reject("APK file not found");
                return;
            }
            Uri contentUri = FileProvider.getUriForFile(
                getContext(),
                getContext().getPackageName() + ".fileprovider",
                file
            );
            Intent intent = new Intent(Intent.ACTION_VIEW);
            intent.setDataAndType(contentUri, "application/vnd.android.package-archive");
            intent.setFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
            intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(intent);
            call.resolve();
        } catch (Exception e) {
            call.reject("Install failed: " + e.getMessage());
        }
    }
}