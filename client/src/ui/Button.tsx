import { ButtonHTMLAttributes } from "react";
import { ANIMATION_TRANSITION } from "@/lib/animation-constants";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary";
}

export function Button({
  variant = "primary",
  className = "",
  children,
  ...props
}: ButtonProps) {
  const baseStyles =
    `px-4 py-2 rounded-lg font-medium ${ANIMATION_TRANSITION.DEFAULT} disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2`;
  const variantStyles = {
    primary: "bg-macon-orange text-white hover:bg-macon-orange-dark hover:shadow-lg focus:ring-macon-orange",
    secondary: "bg-gray-200 text-gray-800 hover:bg-gray-300 hover:shadow-md focus:ring-gray-400",
  };

  return (
    <button
      className={`${baseStyles} ${variantStyles[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
