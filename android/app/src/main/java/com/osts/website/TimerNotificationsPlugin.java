package com.osts.website;

import android.Manifest;
import android.app.AlarmManager;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.annotation.CapacitorPlugin;
import com.getcapacitor.PluginMethod;

import com.getcapacitor.annotation.Permission;
import com.getcapacitor.annotation.PermissionCallback;
import com.getcapacitor.PermissionState;

@CapacitorPlugin(
    name = "TimerNotifications",
    permissions = {
        @Permission(
            alias = "notifications",
            strings = { Manifest.permission.POST_NOTIFICATIONS }
        )
    }
)
public class TimerNotificationsPlugin extends Plugin {

    private static final String CHANNEL_ID = "osts_timer_alerts";
    private static final String ACTION_TIMER_READY =
            "com.osts.website.TIMER_READY";

    @Override
    public void load() {
        createNotificationChannel();
    }

    @PluginMethod
public void getPermissionStatus(PluginCall call) {
    JSObject result = new JSObject();

    boolean granted =
            Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU ||
            getPermissionState("notifications") == PermissionState.GRANTED;

    result.put("granted", granted);
    call.resolve(result);
}

    @PluginMethod
public void requestPermission(PluginCall call) {
    if (Build.VERSION.SDK_INT < Build.VERSION_CODES.TIRAMISU) {
        JSObject result = new JSObject();
        result.put("granted", true);
        call.resolve(result);
        return;
    }

    if (getPermissionState("notifications") ==
            com.getcapacitor.PermissionState.GRANTED) {
        JSObject result = new JSObject();
        result.put("granted", true);
        call.resolve(result);
        return;
    }

    requestPermissionForAlias("notifications", call, "notificationPermission");
}

@PermissionCallback
private void notificationPermission(PluginCall call) {
    JSObject result = new JSObject();

    boolean granted =
            getPermissionState("notifications") ==
            com.getcapacitor.PermissionState.GRANTED;

    result.put("granted", granted);
    call.resolve(result);
}

    @PluginMethod
    public void schedule(PluginCall call) {
        String id = call.getString("id");
        String title = call.getString("title", "OSTS Timer Ready");
        String body = call.getString("body", "Your timer is ready.");
        Long at = call.getLong("at");

        if (id == null || id.isEmpty() || at == null || at <= System.currentTimeMillis()) {
            call.reject("A notification ID and future time are required.");
            return;
        }

        AlarmManager alarmManager =
                (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);

        if (alarmManager == null) {
            call.reject("Alarm service unavailable.");
            return;
        }

        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S &&
            !alarmManager.canScheduleExactAlarms()) {
            call.reject("Exact alarms are disabled. Enable Alarms & reminders for OSTS in Android settings.");
            return;
        }

        Intent intent = new Intent(getContext(), TimerNotificationReceiver.class);
        intent.setAction(ACTION_TIMER_READY);
        intent.putExtra("notificationId", notificationId(id));
        intent.putExtra("title", title);
        intent.putExtra("body", body);

        PendingIntent pendingIntent = PendingIntent.getBroadcast(
                getContext(),
                requestCode(id),
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        alarmManager.setExactAndAllowWhileIdle(
                AlarmManager.RTC_WAKEUP,
                at,
                pendingIntent
        );

        JSObject result = new JSObject();
        result.put("scheduled", true);
        call.resolve(result);
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        String id = call.getString("id");

        if (id == null || id.isEmpty()) {
            call.reject("A notification ID is required.");
            return;
        }

        AlarmManager alarmManager =
                (AlarmManager) getContext().getSystemService(Context.ALARM_SERVICE);

        Intent intent = new Intent(getContext(), TimerNotificationReceiver.class);
        intent.setAction(ACTION_TIMER_READY);

        PendingIntent pendingIntent = PendingIntent.getBroadcast(
                getContext(),
                requestCode(id),
                intent,
                PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
        );

        if (alarmManager != null) {
            alarmManager.cancel(pendingIntent);
        }
        pendingIntent.cancel();

        JSObject result = new JSObject();
        result.put("cancelled", true);
        call.resolve(result);
    }

    private int requestCode(String id) {
        return 10000 + Math.abs(id.hashCode() % 900000);
    }

    private int notificationId(String id) {
        return Math.abs(id.hashCode() % Integer.MAX_VALUE);
    }

    private void createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            NotificationChannel channel = new NotificationChannel(
                    CHANNEL_ID,
                    "Timer alerts",
                    NotificationManager.IMPORTANCE_HIGH
            );
            channel.setDescription(
                    "Notifications when Old School Tool Set timers finish."
            );

            NotificationManager notificationManager =
                    getContext().getSystemService(NotificationManager.class);

            if (notificationManager != null) {
                notificationManager.createNotificationChannel(channel);
            }
        }
    }
}