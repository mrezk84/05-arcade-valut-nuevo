interface SkinSelectProps<T extends string> {
  id: string;
  value: T;
  options: readonly { id: T; name: string }[];
  onChange: (id: T) => void;
}

/** Skin selector for the play-page HUD (pass it through `hudExtra`). */
export default function SkinSelect<T extends string>({
  id,
  value,
  options,
  onChange,
}: SkinSelectProps<T>) {
  return (
    <div className="hud-stat">
      <label className="l" htmlFor={id}>
        Skin
      </label>
      <select
        id={id}
        className="skin-select"
        value={value}
        onChange={(e) => {
          onChange(e.target.value as T);
          // Keep Space and the arrow keys for the game, not for the select
          e.target.blur();
        }}
      >
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.name}
          </option>
        ))}
      </select>
    </div>
  );
}
