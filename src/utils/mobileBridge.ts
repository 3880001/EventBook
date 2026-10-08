import { Capacitor } from '@capacitor/core';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { BarcodeScanner } from '@capacitor-mlkit/barcode-scanning';
import { PushNotifications } from '@capacitor/push-notifications';
import { logError } from './telemetry';

export const isNativePlatform = (): boolean => Capacitor.isNativePlatform();

/**
 * 1. Physical Haptic Vibrations
 */
export async function triggerHaptic(type: 'success' | 'warning' | 'error' | 'light'): Promise<void> {
  if (!isNativePlatform()) return;
  try {
    if (type === 'light') {
      await Haptics.impact({ style: ImpactStyle.Light });
    } else if (type === 'success') {
      await Haptics.notification({ type: NotificationType.Success });
    } else if (type === 'warning') {
      await Haptics.notification({ type: NotificationType.Warning });
    } else if (type === 'error') {
      await Haptics.notification({ type: NotificationType.Error });
    }
  } catch (err) {
    // Non-blocking fallback
  }
}

/**
 * 2. Native Camera QR Code Scanning (Event Door Check-In)
 */
export async function scanTicketQrCode(): Promise<string | null> {
  if (!isNativePlatform()) {
    const manualPrompt = prompt('Desktop Mode: Enter or paste the Booking Reference (e.g. EB-XXXXXX):');
    return manualPrompt ? manualPrompt.trim() : null;
  }

  try {
    // Check & request camera permission
    const { camera } = await BarcodeScanner.requestPermissions();
    if (camera !== 'granted') {
      alert('Camera access is required to scan attendee entry passes.');
      return null;
    }

    // Prepare scanner overlay
    document.body.classList.add('barcode-scanner-active');
    await BarcodeScanner.hideBackground();

    const result = await BarcodeScanner.startScan();
    document.body.classList.remove('barcode-scanner-active');

    if (result.barcodes && result.barcodes.length > 0) {
      await triggerHaptic('success');
      const rawVal = result.barcodes[0].rawValue || '';
      // Extract EB-XXXXXX reference whether it's raw text or a full URL
      const match = rawVal.match(/EB-[A-Z0-9]{6}/i);
      return match ? match[0].toUpperCase() : rawVal;
    }

    return null;
  } catch (err) {
    document.body.classList.remove('barcode-scanner-active');
    logError(err, { context: 'scanTicketQrCode' });
    return null;
  }
}

/**
 * 3. Native Push Notification Registration
 */
export async function initPushNotifications(): Promise<string | null> {
  if (!isNativePlatform()) return null;

  try {
    let permStatus = await PushNotifications.checkPermissions();
    if (permStatus.receive === 'prompt') {
      permStatus = await PushNotifications.requestPermissions();
    }

    if (permStatus.receive !== 'granted') {
      return null;
    }

    await PushNotifications.register();

    return new Promise((resolve) => {
      PushNotifications.addListener('registration', (token) => {
        resolve(token.value);
      });
      PushNotifications.addListener('registrationError', (err) => {
        logError(err, { context: 'push_registration' });
        resolve(null);
      });
    });
  } catch (err) {
    logError(err, { context: 'initPushNotifications' });
    return null;
  }
}
