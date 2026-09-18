package com.osts.website;

import android.Manifest;
import android.app.PendingIntent;
import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.os.Build;

import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;

public class TimerNotificationReceiver extends BroadcastReceiver {

    private static final String CHANNEL_ID = "osts_timer_alerts";

    @Override
    public void onReceive(Context context, Intent intent) {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            context.checkSelfPermission(Manifest.permission.POST_NOTIFICATIONS)
                    != PackageManager.PERMISSION_GRANTED) {
            return;
        }

        int notificationId = intent.getIntExtra("notificationId", 1);
        String title = intent.getStringExtra("title");
        String body = intent.getStringExtra("body");

        Intent launchIntent = context.getPackageManager()
                .getLaunchIntentForPackage(context.getPackageName());

        PendingIntent tapIntent = null;

        if (launchIntent != null) {
            tapIntent = PendingIntent.getActivity(
                    context,
                    notificationId,
                    launchIntent,
                    PendingIntent.FLAG_UPDATE_CURRENT | PendingIntent.FLAG_IMMUTABLE
            );
        }

        NotificationCompat.Builder builder =
                new NotificationCompat.Builder(context, CHANNEL_ID)
                        .setSmallIcon(com.osts.website.R.mipmap.ic_launcher)
                        .setContentTitle(title == null ? "OSTS Timer Ready" : title)
                        .setContentText(body == null ? "Your timer is ready." : body)
                        .setPriority(NotificationCompat.PRIORITY_HIGH)
                        .setAutoCancel(true);

        if (tapIntent != null) {
            builder.setContentIntent(tapIntent);
        }

        NotificationManagerCompat.from(context)
                .notify(notificationId, builder.build());
    }
}