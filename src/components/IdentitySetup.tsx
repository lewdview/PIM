import { useState, useRef, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Camera, Check, X, Loader2, User } from 'lucide-react';
import { supabase } from '../services/supabaseClient';
import { useVaultStore } from '../store/useVaultStore';
import { useAuthStore } from '../store/useAuthStore';
import { getIdenticon } from '../utils/identicon';

interface IdentitySetupProps {
  onComplete?: () => void;
  compact?: boolean;
}

export default function IdentitySetup({ onComplete, compact }: IdentitySetupProps) {
  const { user } = useAuthStore();
  const [username, setUsername] = useState('');
  const [isValidFormat, setIsValidFormat] = useState(true);
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Debounced username check
  useEffect(() => {
    if (username.length < 3) {
      setIsValidFormat(username.length === 0);
      setIsAvailable(null);
      return;
    }

    // Alphanumeric + _, -, .
    const valid = /^[a-zA-Z0-9_\-.]+$/.test(username) && username.length <= 20;
    setIsValidFormat(valid);
    if (!valid) {
      setIsAvailable(null);
      return;
    }

    setIsChecking(true);
    const timeoutId = setTimeout(async () => {
      try {
        const clean = username.trim();
        const { data } = await supabase
          .from('profiles')
          .select('id')
          .ilike('username', clean)
          .maybeSingle();

        if (!data) {
          // not found = available
          setIsAvailable(true);
        } else {
          // found = taken unless it's our own
          setIsAvailable(data.id === user?.id);
        }
      } catch (err) {
        setIsAvailable(null);
      } finally {
        setIsChecking(false);
      }
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [username, user]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) return;
    if (file.size > 2 * 1024 * 1024) return;

    setAvatarFile(file);
    const reader = new FileReader();
    reader.onload = (event) => {
      setAvatarPreview(event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const processAvatar = async (file: File): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = 256;
        canvas.height = 256;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject('No context');

        const size = Math.min(img.width, img.height);
        const sx = (img.width - size) / 2;
        const sy = (img.height - size) / 2;
        ctx.drawImage(img, sx, sy, size, size, 0, 0, 256, 256);

        canvas.toBlob((blob) => {
          if (blob) resolve(blob);
          else reject('Blob failed');
        }, 'image/webp', 0.9);
      };
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  };

  const handleSave = async () => {
    if (!user || !isValidFormat || isAvailable !== true) return;
    setIsSaving(true);

    try {
      const cleanUsername = username.trim();
      let finalAvatarUrl = user.user_metadata?.avatar_url;

      if (avatarFile) {
        const blob = await processAvatar(avatarFile);
        const filePath = `${user.id}/${user.id}.webp`;

        const { error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filePath, blob, { upsert: true, contentType: 'image/webp' });

        if (!uploadError) {
          const { data: publicUrlData } = supabase.storage
            .from('avatars')
            .getPublicUrl(filePath);

          finalAvatarUrl = publicUrlData.publicUrl;
        }
      }

      await supabase
        .from('profiles')
        .update({
          username: cleanUsername,
          display_name: cleanUsername,
          avatar_url: finalAvatarUrl,
        })
        .eq('id', user.id);

      await supabase.auth.updateUser({
        data: {
          username: cleanUsername,
          display_name: cleanUsername,
          avatar_url: finalAvatarUrl,
        }
      });

      // Update local store via reload vault data
      const { loadVaultData, updateProfile } = useVaultStore.getState();
      if (updateProfile) {
        await updateProfile(cleanUsername, finalAvatarUrl, cleanUsername).catch(() => {});
      }
      if (loadVaultData) {
        await loadVaultData(true);
      }

      onComplete?.();
    } catch (err) {
      console.error("Failed to save identity", err);
    } finally {
      setIsSaving(false);
    }
  };

  const getStatusIcon = () => {
    if (username.length === 0) return null;
    if (!isValidFormat) return <X size={16} className="text-[#ff3800]" />;
    if (isChecking) return <Loader2 size={16} className="text-white/50 animate-spin" />;
    if (isAvailable === true) return <Check size={16} className="text-[#39FF14]" />;
    if (isAvailable === false) return <X size={16} className="text-[#ff3800]" />;
    return null;
  };

  const avatarUrl = avatarPreview || user?.user_metadata?.avatar_url || null;
  const identicon = getIdenticon(user?.id || 'anon', username || null);

  return (
    <div className={`flex flex-col gap-6 bg-[#0a0a0f] border border-white/10 p-6 ${compact ? 'rounded-none' : ''}`}>
      <div className="flex flex-col md:flex-row gap-6 items-start md:items-center">
        {/* Avatar Upload */}
        <div 
          className="relative w-24 h-24 rounded-full overflow-hidden bg-[#111116] border-2 border-white/10 cursor-pointer group shrink-0"
          onClick={() => fileInputRef.current?.click()}
        >
          <input 
            type="file" 
            ref={fileInputRef} 
            className="hidden" 
            accept=".jpg,.jpeg,.png,.webp"
            onChange={handleFileChange}
          />
          {avatarUrl ? (
            <img src={avatarUrl} alt="Avatar Preview" className="w-full h-full object-cover" />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center"
              style={{ background: identicon.bgColor }}
            >
              <span style={{ fontFamily: '"JetBrains Mono", monospace', fontSize: '28px', fontWeight: 900, color: 'rgba(255,255,255,0.85)' }}>
                {identicon.initials}
              </span>
            </div>
          )}
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
            <Camera size={24} className="text-white" />
          </div>
        </div>
        
        {/* Username Input */}
        <div className="flex-1 w-full">
          <label className="block font-mono text-[10px] text-white/50 uppercase mb-2">
            PIM IDENTITY ALIAS
          </label>
          <div className="relative">
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="e.g. neuro_punk_99"
              className="w-full bg-black/50 border-2 border-white/20 text-white font-mono px-4 py-3 focus:outline-none focus:border-[#FFD700] transition-colors"
              maxLength={20}
            />
            <div className="absolute right-4 top-1/2 -translate-y-1/2">
              {getStatusIcon()}
            </div>
          </div>
          <p className="font-mono text-[10px] text-white/40 mt-2 h-4">
            {username.length > 0 && !isValidFormat && "3-20 chars, alphanumeric, _, -, . only"}
            {isAvailable === false && "Username taken."}
            {isAvailable === true && "Username available."}
          </p>
        </div>
      </div>

      <button
        onClick={handleSave}
        disabled={isSaving || !isValidFormat || isAvailable !== true}
        className="w-full py-3 bg-[#FFD700] text-black font-black uppercase tracking-widest border-2 border-black shadow-[3px_3px_0_#000] disabled:opacity-50 disabled:cursor-not-allowed hover:translate-x-[1px] hover:translate-y-[1px] hover:shadow-[2px_2px_0_#000] transition-all flex justify-center items-center gap-2"
        style={{ fontFamily: 'Impact, sans-serif' }}
      >
        {isSaving ? <Loader2 size={18} className="animate-spin" /> : "LOCK IN IDENTITY"}
      </button>
    </div>
  );
}
