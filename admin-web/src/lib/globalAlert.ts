// Global alert override to use centered custom alert
let globalShowAlert: ((message: string) => void) | null = null;

export function setGlobalAlert(showAlert: (message: string) => void) {
    globalShowAlert = showAlert;

    // Override native alert
    if (typeof window !== 'undefined') {
        window.alert = (message?: any) => {
            if (globalShowAlert) {
                globalShowAlert(String(message || ''));
            }
        };
    }
}

export function getGlobalAlert() {
    return globalShowAlert;
}
