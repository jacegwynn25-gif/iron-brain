'use client';

import { createContext, useContext, useState, useCallback, useMemo } from 'react';
import type { ReactNode } from 'react';
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

type DialogResolver =
    | { type: 'alert'; resolve: () => void }
    | { type: 'confirm'; resolve: (value: boolean) => void };

const DialogContext = createContext<DialogContextType | undefined>(undefined);

export function DialogProvider({ children }: { children: ReactNode }) {
    const [isOpen, setIsOpen] = useState(false);
    const [options, setOptions] = useState<DialogOptions>({
        title: '',
        message: '',
        type: 'alert',
    });
    const [resolver, setResolver] = useState<DialogResolver | null>(null);

    const showAlert = useCallback((title: string, message: string, extraOptions?: Partial<DialogOptions>) => {
        return new Promise<void>((resolve) => {
            setOptions({
                title,
                message,
                type: 'alert',
                confirmLabel: 'OK',
                ...extraOptions,
            });
            setResolver({ type: 'alert', resolve });
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
            setResolver({ type: 'confirm', resolve });
            setIsOpen(true);
        });
    }, []);

    const handleConfirm = useCallback(() => {
        setIsOpen(false);
        if (resolver?.type === 'confirm') {
            resolver.resolve(true);
        } else if (resolver) {
            resolver.resolve();
        }
    }, [resolver]);

    const handleCancel = useCallback(() => {
        setIsOpen(false);
        if (resolver?.type === 'confirm') {
            resolver.resolve(false);
        } else if (resolver) {
            resolver.resolve();
        }
    }, [resolver]);

    const contextValue = useMemo(
        () => ({ alert: showAlert, confirm: showConfirm }),
        [showAlert, showConfirm]
    );

    return (
        <DialogContext.Provider value={contextValue}>
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
