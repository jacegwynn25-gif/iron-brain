import { forwardRef, type ButtonHTMLAttributes } from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

const buttonVariants = cva(
  'inline-flex items-center justify-center font-semibold transition-all active:scale-[0.98] disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        default:
          'bg-gradient-to-r from-purple-600 to-fuchsia-500 text-white shadow-lg shadow-purple-500/20 hover:shadow-xl',
        secondary:
          'bg-zinc-800 text-white hover:bg-zinc-700 border border-zinc-700',
        ghost:
          'bg-transparent text-zinc-300 hover:bg-white/10 hover:text-white',
        destructive:
          'bg-red-600 text-white hover:bg-red-700 shadow-lg shadow-red-500/20',
        outline:
          'border border-white/10 bg-white/5 text-white hover:bg-white/10',
      },
      size: {
        default: 'rounded-xl px-4 py-2.5 text-sm',
        sm: 'rounded-lg px-3 py-1.5 text-xs',
        lg: 'rounded-xl px-6 py-3 text-base',
        icon: 'rounded-lg p-2',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

function cn(...inputs: Parameters<typeof clsx>) {
  return twMerge(clsx(inputs));
}

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size }), className)}
        ref={ref}
        {...props}
      />
    );
  }
);

Button.displayName = 'Button';

export { Button, buttonVariants };
