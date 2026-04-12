import { getDailyResetsAt } from './game/challenges';
import { adminDb } from './db/core';
import { sendPushNotification } from './pushService';
import { logger } from './logger';

export class ChallengeNotifier {
  private interval: NodeJS.Timeout | null = null;

  start() {
    // Run every hour
    this.interval = setInterval(() => this.checkAndNotify(), 60 * 60 * 1000);
    // Also run once on startup (with a delay to let server settle)
    setTimeout(() => this.checkAndNotify(), 10000);
  }

  stop() {
    if (this.interval) clearInterval(this.interval);
  }

  private async checkAndNotify() {
    try {
      const now = new Date();
      
      // We want to find users whose dailyResetsAt has passed
      // and who haven't been notified for the 'current' day yet.
      // For simplicity, we'll look for users who haven't updated their challengeData in the last 24h
      // and explicitly check if their dailyResetsAt < now.
      
      // Since challenges are lazy-loaded, we check the 'challenges_data' JSONB.
      const { data: users, error } = await adminDb
        .from('users')
        .select('id, username, challenges_data')
        .not('challenges_data', 'is', null);

      if (error) throw error;

      for (const user of users) {
        const data = user.challenges_data as any;
        if (!data || !data.dailyResetsAt) continue;

        const resetsAt = new Date(data.dailyResetsAt);
        if (now > resetsAt) {
          // Send notification
          // We mark the notification as sent by updating a flag? 
          // Or we just let refreshChallenges handle the new period assignment on next app open.
          // To prevent double notification, we can use a temporary flag or hash.
          // For now, let's just push - it will drive them to open and trigger the lazy refresh.
          
          await sendPushNotification(user.id, {
            title: 'New Challenges Available',
            body: `Your daily challenges for ${user.username} have refreshed. Earn IP and XP now!`,
            data: { url: '/?openTab=challenges' }
          });
          
          // To prevent spamming every hour until they open the app, 
          // we update the local resetsAt to 'future' in the DB tentatively or use a notified flag.
          // Let's add 'last_notified_reset' to challenges_data.
          if (data.lastNotifiedReset === data.dailyResetsAt) continue;

          data.lastNotifiedReset = data.dailyResetsAt;
          await adminDb
            .from('users')
            .update({ challenges_data: data })
            .eq('id', user.id);
        }
      }
    } catch (err) {
      logger.error({ err }, 'ChallengeNotifier failed');
    }
  }
}

export const challengeNotifier = new ChallengeNotifier();
