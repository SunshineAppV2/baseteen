export const SUBSCRIPTION_CONFIG = {
    // WhatsApp contact for member limit increases
    WHATSAPP_NUMBER: '5591983292005', // (91) 98329-2005
    WHATSAPP_MESSAGE: 'Olá! Gostaria de aumentar meu limite de membros.',

    // Pricing
    PRICE_PER_USER_MONTHLY: 1.00, // R$ 1,00 per user/month

    // Plans
    PLANS: {
        MONTHLY: {
            id: 'monthly',
            name: 'Mensal',
            months: 1,
        },
        QUARTERLY: {
            id: 'quarterly',
            name: 'Trimestral',
            months: 3,
        },
        SEMIANNUAL: {
            id: 'semiannual',
            name: 'Semestral',
            months: 6,
        },
        ANNUAL: {
            id: 'annual',
            name: 'Anual',
            months: 12,
        },
        FREE: {
            id: 'free',
            name: 'Livre (Sem Cobrança)',
            months: 12, // 1 year validity for free plans
        },
    },

    // Expiration warnings (days before)
    WARNING_DAYS: [7, 3, 1],
} as const;

export type SubscriptionPlan = 'monthly' | 'quarterly' | 'semiannual' | 'annual' | 'free';
export type SubscriptionStatus = 'active' | 'expired' | 'pending';

export interface Subscription {
    id: string;
    baseId: string;
    plan: SubscriptionPlan;
    status: SubscriptionStatus;
    memberLimit: number; // Number of members coordinator paid for
    currentMemberCount: number; // Current active members
    startDate: Date;
    endDate: Date;
    amount: number; // R$ 1.00 * memberLimit * months
    createdAt: Date;
    updatedAt: Date;
}

export type PaymentType = 'subscription' | 'member_addition';

export interface Payment {
    id: string;
    subscriptionId: string; // ID of the subscription this payment relates to (even if it's a new one)
    baseId: string;
    type: PaymentType;
    amount: number;
    status: 'pending' | 'confirmed' | 'expired' | 'refunded';
    paymentMethod: 'pix';
    description: string; // e.g., "Assinatura Trimestral", "Adição de 2 membros"
    metadata?: {
        memberCount?: number; // How many members created/added
        months?: number; // Duration in months
        newMemberLimit?: number; // Resulting member limit after confirmation
        startDate?: Date; // Optional: specific start date for the subscription
    };
    confirmedAt?: Date;
    confirmedBy?: string; // Admin/Master user ID
    createdAt: Date;
}
