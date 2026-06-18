'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, CheckCircle2 } from 'lucide-react';
import { liquidButtonClass } from './liquid';

interface CustomDialogProps {
    isOpen: boolean;
    title: string;
    message: string;
    type?: 'alert' | 'confirm';
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'primary' | 'danger';
    onClose: () => void;
    onConfirm: () => void;
}

export default function CustomDialog({
    isOpen,
    title,
    message,
    type = 'alert',
    confirmLabel = 'OK',
    cancelLabel = 'Cancel',
    variant = 'primary',
    onClose,
    onConfirm,
}: CustomDialogProps) {
    if (!isOpen && !isOpen) return null; // Small trick for AnimatePresence if manually controlled

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[var(--z-modal-tall)] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={type === 'confirm' ? undefined : onClose}
                        className="absolute inset-0 bg-transparent"
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                        className="liquid-sheet-panel relative w-full max-w-sm overflow-hidden rounded-[1.2rem] p-6"
                    >
                        <div className="flex flex-col items-center text-center">
                            <div className={`mb-4 flex h-12 w-12 items-center justify-center rounded-full border ${variant === 'danger' ? 'border-rose-400/30 text-rose-300' : 'border-emerald-400/30 text-emerald-300'
                                }`}>
                                {variant === 'danger' ? (
                                    <AlertCircle className="h-6 w-6" />
                                ) : (
                                    <CheckCircle2 className="h-6 w-6" />
                                )}
                            </div>

                            <h3 className="mb-2 text-lg font-black italic tracking-tight text-white">{title}</h3>
                            <p className="mb-8 text-sm leading-relaxed text-zinc-400">
                                {message}
                            </p>

                            <div className="flex w-full flex-col gap-3">
                                <button
                                    type="button"
                                    onClick={onConfirm}
                                    className={liquidButtonClass({
                                        variant: variant === 'danger' ? 'danger' : 'action',
                                        className: 'w-full rounded-xl py-4 text-xs',
                                    })}
                                >
                                    {confirmLabel}
                                </button>

                                {type === 'confirm' && (
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        className="w-full rounded-xl border border-white/10 bg-white/[0.045] py-4 text-xs font-semibold text-zinc-300 transition-all hover:bg-white/[0.075] hover:text-zinc-100 active:scale-[0.98]"
                                    >
                                        {cancelLabel}
                                    </button>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
