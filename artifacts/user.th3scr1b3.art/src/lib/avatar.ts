import { supabase } from './supabase';

// Same storage layout as PIM (src/utils/avatarUpload.ts): one 256px WebP per player at
// avatars/<user id>/<user id>.webp, URL saved on public.profiles.avatar_url.

export const AVATAR_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const AVATAR_MAX_BYTES = 2 * 1024 * 1024;

export function validateAvatarFile(file: File): string | null {
  if (!AVATAR_TYPES.includes(file.type)) return 'Use a JPG, PNG or WebP image.';
  if (file.size > AVATAR_MAX_BYTES) return 'Image must be 2 MB or smaller.';
  return null;
}

function toSquareWebp(file: File): Promise<Blob> {
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
      ctx.drawImage(img, (img.width - size) / 2, (img.height - size) / 2, size, size, 0, 0, 256, 256);
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Could not encode image'))), 'image/webp', 0.9);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Could not read image'));
    };
    img.src = objectUrl;
  });
}

/** Uploads the photo, saves it on the profile row and auth metadata, and returns the new URL. */
export async function saveAvatar(userId: string, file: File): Promise<string> {
  const blob = await toSquareWebp(file);
  const path = `${userId}/${userId}.webp`;

  const { error: uploadError } = await supabase.storage
    .from('avatars')
    .upload(path, blob, { upsert: true, contentType: 'image/webp', cacheControl: '3600' });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from('avatars').getPublicUrl(path);
  // Same path on every change, so bust caches or the old photo keeps showing.
  const url = `${data.publicUrl}?v=${Date.now()}`;

  const { error: profileError } = await supabase.from('profiles').update({ avatar_url: url }).eq('id', userId);
  if (profileError) throw profileError;
  await supabase.auth.updateUser({ data: { avatar_url: url } }).catch(() => {});

  return url;
}
