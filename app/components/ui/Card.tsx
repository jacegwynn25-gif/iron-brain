import { type ReactNode } from 'react';

type CardVariant = 'default' | 'dark' | 'light' | 'inline';

interface CardProps {
  children: ReactNode;
  variant?: CardVariant;
  className?: string;
}

const variantStyles: Record<CardVariant, string> = {
  default: 'rounded-2xl border border-white/10 bg-white/5 backdrop-blur-xl p-4',
  dark: 'rounded-2xl border border-white/10 bg-zinc-950 p-4',
  light: 'rounded-xl border border-white/10 bg-white/5 p-3',
  inline: 'rounded-xl border border-white/10 bg-white/5 px-3 py-2',
};

export default function Card({ children, variant = 'default', className = '' }: CardProps) {
  return (
    <div className={`${variantStyles[variant]} ${className}`}>
      {children}
    </div>
  );
}
