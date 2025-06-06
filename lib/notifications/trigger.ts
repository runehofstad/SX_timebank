import { Timebank } from '@/types';

export async function checkTimebankNotifications(timebankId?: string) {
  try {
    // Call the notifications API endpoint
    const response = await fetch('/api/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ timebankId }), // Optional: check specific timebank
    });

    if (!response.ok) {
      console.error('Failed to trigger notifications:', response.statusText);
    }

    const result = await response.json();
    console.log('Notification check result:', result);
  } catch (error) {
    console.error('Error triggering notifications:', error);
  }
}

// This function can be called after any time entry is logged
export async function onTimeEntryLogged(timebankId: string) {
  // Trigger notification check for the specific timebank
  // Using setTimeout to not block the UI
  setTimeout(() => {
    checkTimebankNotifications(timebankId);
  }, 1000);
}

// This function can be called periodically (e.g., via cron job)
export async function checkAllTimebankNotifications() {
  try {
    const response = await fetch('/api/notifications', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      console.error('Failed to trigger notifications:', response.statusText);
    }

    const result = await response.json();
    console.log('Notification check result:', result);
  } catch (error) {
    console.error('Error triggering notifications:', error);
  }
}