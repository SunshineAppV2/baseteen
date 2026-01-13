'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import CenteredAlert from '@/components/CenteredAlert';
import { setGlobalAlert } from '@/lib/globalAlert';

interface AlertContextType {
    showAlert: (message: string) => void;
}

const AlertContext = createContext<AlertContextType | undefined>(undefined);

export function AlertProvider({ children }: { children: ReactNode }) {
    const [alertMessage, setAlertMessage] = useState<string | null>(null);

    const showAlert = (message: string) => {
        setAlertMessage(message);
    };

    const closeAlert = () => {
        setAlertMessage(null);
    };

    // Set global alert override
    useEffect(() => {
        setGlobalAlert(showAlert);
    }, []);

    return (
        <AlertContext.Provider value={{ showAlert }}>
            {children}
            {alertMessage && alertMessage.trim().length > 0 && (
                <CenteredAlert message={alertMessage} onClose={closeAlert} />
            )}
        </AlertContext.Provider>
    );
}

export function useAlert() {
    const context = useContext(AlertContext);
    if (!context) {
        throw new Error('useAlert must be used within AlertProvider');
    }
    return context;
}
