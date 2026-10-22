import { Gamepad2, Keyboard, Smartphone } from "lucide-react";

export type ControlDevice = "keyboard" | "touch" | "gamepad";

const devices = [
  { id: "keyboard", label: "Teclado", Icon: Keyboard },
  { id: "touch", label: "Teléfono", Icon: Smartphone },
  { id: "gamepad", label: "Mando", Icon: Gamepad2 },
] as const;

export function ControlDeviceTabs({
  device,
  onChange,
  label = "Dispositivo de juego",
}: {
  device: ControlDevice;
  onChange: (device: ControlDevice) => void;
  label?: string;
}) {
  return (
    <div className="help-devices" role="group" aria-label={label}>
      {devices.map(({ id, label, Icon }) => (
        <button
          key={id}
          type="button"
          data-device={id}
          aria-pressed={device === id}
          onClick={() => onChange(id)}
        >
          <Icon size={19} aria-hidden="true" />
          {label}
        </button>
      ))}
    </div>
  );
}
