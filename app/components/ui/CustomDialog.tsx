'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertCircle, CheckCircle2, X } from 'lucide-react';

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
                <div className="fixed inset-0 z-[300] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={type === 'confirm' ? undefined : onClose}
                        className="absolute inset-0 bg-zinc-950/60 backdrop-blur-md"
                    />

                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 350 }}
                        className="relative w-full max-w-sm overflow-hidden rounded-3xl border border-white/10 bg-zinc-900/80 p-6 shadow-2xl backdrop-blur-2xl"
                    >
                        <div className="flex flex-col items-center text-center">
                            <div className={`mb-4 flex h-14 w-14 items-center justify-center rounded-2xl ${variant === 'danger' ? 'bg-rose-500/20 text-rose-400' : 'bg-purple-500/20 text-purple-400'
                                }`}>
                                {variant === 'danger' ? (
                                    <AlertCircle className="h-8 w-8" />
                                ) : (
                                    <CheckCircle2 className="h-8 w-8" />
                                )}
                            </div>

                            <h3 className="mb-2 text-xl font-bold text-white">{title}</h3>
                            <p className="mb-8 text-sm leading-relaxed text-zinc-400">
                                {message}
                            </p>

                            <div className="flex w-full flex-col gap-3">
                                <button
                                    type="button"
                                    onClick={onConfirm}
                                    className={`w-full rounded-2xl py-4 text-xs font-black uppercase tracking-[0.3em] transition-all active:scale-[0.98] ${variant === 'danger'
                                            ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20 hover:bg-rose-400'
                                            : 'bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/20 hover:brightness-110'
                                        }`}
                                >
                                    {confirmLabel}
                                </button>

                                {type === 'confirm' && (
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        className="w-full rounded-2xl bg-zinc-800/50 py-4 text-xs font-bold uppercase tracking-[0.3em] text-zinc-400 transition-all hover:bg-zinc-800 hover:text-zinc-200 active:scale-[0.98]"
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
