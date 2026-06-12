// Primitive control components. Importing this module also pulls in ui.css.

import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode } from "react";
import "./ui.css";
import { Icon, type IconName } from "./Icon";

export { Icon };
export type { IconName };

// ----------------------------------------------------------- Spinner
export function Spinner({ size = 16, className }: { size?: number; className?: string }) {
  return (
    <span
      className={`spinner${className ? ` ${className}` : ""}`}
      style={{ width: size, height: size }}
      role="status"
      aria-label="Loading"
    />
  );
}

// ------------------------------------------------------------ Button
type ButtonVariant = "primary" | "secondary" | "soft" | "ghost" | "danger";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  block?: boolean;
  iconLeft?: IconName;
  iconRight?: IconName;
}

export function Button({
  variant = "secondary",
  size = "md",
  loading = false,
  block = false,
  iconLeft,
  iconRight,
  className,
  children,
  disabled,
  ...rest
}: ButtonProps) {
  const cls = [
    "btn",
    `btn--${variant}`,
    size !== "md" && `btn--${size}`,
    block && "btn--block",
    className,
  ]
    .filter(Boolean)
    .join(" ");
  const iconSize = size === "sm" ? 15 : size === "lg" ? 19 : 17;
  return (
    <button className={cls} disabled={disabled || loading} {...rest}>
      {loading ? (
        <Spinner size={iconSize} className="btn__spinner" />
      ) : (
        iconLeft && <Icon name={iconLeft} size={iconSize} />
      )}
      {children && <span>{children}</span>}
      {!loading && iconRight && <Icon name={iconRight} size={iconSize} />}
    </button>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName;
  label: string;
  size?: number;
}

export function IconButton({ icon, label, size = 18, className, ...rest }: IconButtonProps) {
  return (
    <button
      className={`icon-btn${className ? ` ${className}` : ""}`}
      aria-label={label}
      title={label}
      {...rest}
    >
      <Icon name={icon} size={size} />
    </button>
  );
}

// ------------------------------------------------------------- Badge
type Tone = "neutral" | "amber" | "copper" | "success" | "danger" | "warning" | "info";

export function Badge({
  tone = "neutral",
  dot = false,
  icon,
  children,
}: {
  tone?: Tone;
  dot?: boolean;
  icon?: IconName;
  children: ReactNode;
}) {
  return (
    <span className={`badge${tone !== "neutral" ? ` badge--${tone}` : ""}`}>
      {dot && <span className="badge__dot" />}
      {icon && <Icon name={icon} size={12} strokeWidth={2} />}
      {children}
    </span>
  );
}

// --------------------------------------------------------- Segmented
export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  count?: number;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  return (
    <div className="segmented" role="tablist">
      {options.map((opt) => (
        <button
          key={opt.value}
          role="tab"
          aria-selected={opt.value === value}
          className={`segmented__opt${opt.value === value ? " segmented__opt--active" : ""}`}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
          {opt.count !== undefined && <span className="segmented__count">{opt.count}</span>}
        </button>
      ))}
    </div>
  );
}

// -------------------------------------------------------- SearchInput
interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "onChange"> {
  value: string;
  onValueChange: (value: string) => void;
  small?: boolean;
  onClear?: () => void;
}

export function SearchInput({
  value,
  onValueChange,
  small = false,
  onClear,
  className,
  ...rest
}: SearchInputProps) {
  return (
    <div className={`search${small ? " search--sm" : ""}${className ? ` ${className}` : ""}`}>
      <span className="search__icon">
        <Icon name="search" size={small ? 16 : 19} />
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onValueChange(e.target.value)}
        spellCheck={false}
        autoCorrect="off"
        autoCapitalize="off"
        {...rest}
      />
      {value && (
        <button
          className="search__clear"
          aria-label="Clear search"
          onClick={() => {
            onValueChange("");
            onClear?.();
          }}
        >
          <Icon name="x" size={15} />
        </button>
      )}
    </div>
  );
}

// --------------------------------------------------------- EmptyState
export function EmptyState({
  icon,
  title,
  description,
  children,
}: {
  icon: IconName;
  title: string;
  description?: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <div className="empty__icon">
        <Icon name={icon} size={32} strokeWidth={1.6} />
      </div>
      <div className="empty__title">{title}</div>
      {description && <p className="empty__desc">{description}</p>}
      {children}
    </div>
  );
}

// ----------------------------------------------------------- Skeleton
export function Skeleton({
  width,
  height = 14,
  radius,
}: {
  width?: number | string;
  height?: number | string;
  radius?: number | string;
}) {
  return (
    <span
      className="skeleton"
      style={{
        display: "block",
        width: width ?? "100%",
        height,
        borderRadius: radius,
      }}
    />
  );
}
