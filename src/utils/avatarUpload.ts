/**
 * avatarUpload.ts — Shared avatar upload for PIM profiles.
 * Center-crops to a 256px WebP, stores it at avatars/<userId>/<userId>.webp,
 * and returns a cache-busted public URL so a changed photo shows right away.
 */

import { supabase } from '../services/supabaseClient';

export const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

export function validateAvatarFile(file: File): string | null {
  if (!AVATAR_TYPES.includes(file.type)) return 'Use a JPG, PNG or WebP image.';
  if (file.size > AVATAR_MAX_BYTES) return 'Image must be 2 MB or smaller.';
  return null;
}

export function processAvatar(file: File): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      const canvas = document.createElement('canvas');
      canvas.width = 256;
      canvas.height = 256;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('No canvas context'));

      const size = Math.min(img.width, img.height);
      const sx = (img.width - size) / 2;
      const sy = (img.height - size) / 2;
      ctx.drawImage(img, sx, sy, size, size, 0, 0, 256, 256);

      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Could not encode image'));
      }, 'image/webp', 0.9);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not read image'));
    };
    img.src = objectUrl;
  });
}

export async function uploadAvatar(userId: string, file: File): Promise<string> {
  const blob = await processAvatar(file);
  const filePath = `${userId}/${userId}.webp`;

  const { error } = await supabase.storage
    .from('avatars')
    .upload(filePath, blob, { upsert: true, contentType: 'image/webp', cacheControl: '3600' });
  if (error) throw error;

  const { data } = supabase.storage.from('avatars').getPublicUrl(filePath);
  return `${data.publicUrl}?v=${Date.now()}`;
}
