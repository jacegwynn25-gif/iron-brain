'use client';

import React, { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import CustomDialog from '@/app/components/ui/CustomDialog';

interface DialogOptions {
    title: string;
    message: string;
    type?: 'alert' | 'confirm';
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'primary' | 'danger';
}

interface DialogContextType {
    alert: (title: string, message: string, options?: Partial<DialogOptions>) => Promise<void>;
    confirm: (title: string, message: string, options?: Partial<DialogOptions>) => Promise<boolean>;
}

const DialogContext = createContext<DialogContextType | undefined>(undefined);

export function DialogProvider({ children }: { children: ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    const [options, setOptions] = useState<DialogOptions>({
        title: '',
        message: '',
        type: 'alert',
    });
    const [resolver, setResolver] = useState<{ resolve: (value: any) => void } | null>(null);

    const showAlert = useCallback((title: string, message: string, extraOptions?: Partial<DialogOptions>) => {
        return new Promise<void>((resolve) => {
            setOptions({
                title,
                message,
                type: 'alert',
                confirmLabel: 'OK',
                ...extraOptions,
            });
            setResolver({ resolve });
            setIsOpen(true);
        });
    }, []);

    const showConfirm = useCallback((title: string, message: string, extraOptions?: Partial<DialogOptions>) => {
        return new Promise<boolean>((resolve) => {
            setOptions({
                title,
                message,
                type: 'confirm',
                confirmLabel: 'Confirm',
                cancelLabel: 'Cancel',
                ...extraOptions,
            });
            setResolver({ resolve });
            setIsOpen(true);
        });
    }, []);

    const handleConfirm = useCallback(() => {
        setIsOpen(false);
        if (resolver) {
            resolver.resolve(options.type === 'confirm' ? true : undefined);
        }
    }, [resolver, options.type]);

    const handleCancel = useCallback(() => {
        setIsOpen(false);
        if (resolver) {
            resolver.resolve(false);
        }
    }, [resolver]);

    return (
        <DialogContext.Provider value={{ alert: showAlert, confirm: showConfirm }}>
            {children}
            <CustomDialog
                isOpen={isOpen}
                onClose={handleCancel}
                onConfirm={handleConfirm}
                {...options}
            />
        </DialogContext.Provider>
    );
}

export function useDialog() {
    const context = useContext(DialogContext);
    if (context === undefined) {
        throw new Error('useDialog must be used within a DialogProvider');
    }
    return context;
}
