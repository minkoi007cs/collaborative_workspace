import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { loadConfig } from '../config';

export const maxAttachmentSize = 10 * 1024 * 1024;
export const allowedAttachmentTypes = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/plain',
] as const;

@Injectable()
export class StorageService {
  private readonly config = loadConfig();
  private readonly client?: SupabaseClient;

  constructor() {
    if (this.config.SUPABASE_URL && this.config.SUPABASE_SERVICE_ROLE_KEY)
      this.client = createClient(
        this.config.SUPABASE_URL,
        this.config.SUPABASE_SERVICE_ROLE_KEY,
        { auth: { autoRefreshToken: false, persistSession: false } },
      );
  }

  private requireClient() {
    if (!this.client)
      throw new ServiceUnavailableException('Private storage unavailable');
    return this.client;
  }

  private async privateBucket() {
    const client = this.requireClient();
    const { data, error } = await client.storage.getBucket(
      this.config.STORAGE_BUCKET,
    );
    if (
      error ||
      !data ||
      data.public ||
      !data.file_size_limit ||
      data.file_size_limit > maxAttachmentSize ||
      !data.allowed_mime_types?.length ||
      data.allowed_mime_types.some(
        (type) =>
          !allowedAttachmentTypes.includes(
            type as (typeof allowedAttachmentTypes)[number],
          ),
      )
    )
      throw new ServiceUnavailableException(
        'Private storage bucket is not configured safely',
      );
    return client.storage.from(this.config.STORAGE_BUCKET);
  }

  async signUpload(path: string) {
    const bucket = await this.privateBucket();
    const { data, error } = await bucket.createSignedUploadUrl(path, {
      upsert: false,
    });
    if (error || !data)
      throw new ServiceUnavailableException(
        'Could not prepare attachment upload',
      );
    return data.signedUrl;
  }

  async info(path: string) {
    const bucket = await this.privateBucket();
    const { data, error } = await bucket.info(path);
    if (error || !data)
      throw new ServiceUnavailableException(
        'Could not verify attachment upload',
      );
    return { size: data.size, contentType: data.contentType };
  }

  async signDownload(path: string, fileName: string) {
    const bucket = await this.privateBucket();
    const { data, error } = await bucket.createSignedUrl(path, 60, {
      download: fileName,
    });
    if (error || !data)
      throw new ServiceUnavailableException(
        'Could not prepare attachment download',
      );
    return data.signedUrl;
  }

  async remove(path: string) {
    const bucket = await this.privateBucket();
    const { error } = await bucket.remove([path]);
    if (error)
      throw new ServiceUnavailableException('Could not remove attachment');
  }
}
