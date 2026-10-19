'use client';

import {
  AVATARS,
  AVATAR_LABELS,
  avatarSrc,
  type AvatarId,
} from '@/lib/auth/avatars';

interface AvatarPickerProps {
  value: AvatarId | null;
  onChange: (value: AvatarId | null) => void;
  disabled?: boolean;
}

export default function AvatarPicker({
  value,
  onChange,
  disabled,
}: AvatarPickerProps) {
  return (
    <div className="field">
      <span className="field-label" id="avatar-picker-label">
        Avatar (opcional)
      </span>
      <div
        className="avatar-picker"
        role="group"
        aria-labelledby="avatar-picker-label"
      >
        {AVATARS.map((id) => (
          <button
            key={id}
            type="button"
            disabled={disabled}
            aria-pressed={value === id}
            aria-label={AVATAR_LABELS[id]}
            title={AVATAR_LABELS[id]}
            onClick={() => onChange(value === id ? null : id)}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={avatarSrc(id)} alt="" width={32} height={32} />
          </button>
        ))}
      </div>
    </div>
  );
}
