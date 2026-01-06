'use client';

import { X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { SUBSCRIPTION_CONFIG } from '@/config/subscription';

interface MemberLimitModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentCount: number;
    memberLimit: number;
}

export default function MemberLimitModal({
    isOpen,
    onClose,
    currentCount,
    memberLimit
}: MemberLimitModalProps) {
    if (!isOpen) return null;

    const whatsappLink = `https://wa.me/${SUBSCRIPTION_CONFIG.WHATSAPP_NUMBER}?text=${encodeURIComponent(
        `${SUBSCRIPTION_CONFIG.WHATSAPP_MESSAGE}\n\nAtualmente tenho ${currentCount} membros e o limite é ${memberLimit}. Gostaria de aumentar para mais membros.`
    )}`;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 relative">
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 transition-colors"
                >
                    <X size={24} />
                </button>

                <div className="text-center mb-6">
                    <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-3xl">⚠️</span>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 mb-2">
                        Limite de Membros Atingido
                    </h2>
                    <p className="text-gray-600">
                        Você atingiu o limite de membros da sua assinatura
                    </p>
                </div>

                <div className="bg-gray-50 rounded-lg p-4 mb-6">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-sm text-gray-600">Membros atuais:</span>
                        <span className="text-lg font-bold text-gray-900">{currentCount}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-sm text-gray-600">Limite contratado:</span>
                        <span className="text-lg font-bold text-orange-600">{memberLimit}</span>
                    </div>
                </div>

                <p className="text-sm text-gray-700 mb-6 text-center">
                    Para adicionar mais membros, entre em contato via WhatsApp e informe quantos membros deseja adicionar.
                </p>

                <div className="flex flex-col gap-3">
                    <a
                        href={whatsappLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="w-full"
                    >
                        <Button className="w-full bg-green-600 hover:bg-green-700 text-white border-none">
                            <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
                            </svg>
                            Contatar via WhatsApp
                        </Button>
                    </a>
                    <Button
                        onClick={onClose}
                        className="w-full bg-gray-200 hover:bg-gray-300 text-gray-700 border-none"
                    >
                        Fechar
                    </Button>
                </div>
            </div>
        </div>
    );
}
