import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as admin from 'firebase-admin';

@Injectable()
export class FirebaseAdminService implements OnModuleInit {
  private readonly logger = new Logger(FirebaseAdminService.name);
  private enabled = false;

  constructor(private cfg: ConfigService) {}

  onModuleInit() {
    const projectId = this.cfg.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.cfg.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = this.cfg.get<string>('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n');
    if (projectId && clientEmail && privateKey && !admin.apps.length) {
      admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });
      this.enabled = true;
      this.logger.log('Firebase Admin initialized');
    } else {
      this.logger.warn('Firebase Admin disabled — social/phone auth unavailable');
    }
  }

  async verifyIdToken(idToken: string) {
    if (!this.enabled) throw new Error('Firebase not configured');
    return admin.auth().verifyIdToken(idToken);
  }
}
