import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Payment, Subscription } from '@/config/subscription';

export const generateReceiptPDF = (payment: Payment, subscription: Subscription, baseName: string) => {
    const doc = new jsPDF();

    // Title
    doc.setFontSize(22);
    doc.setTextColor(40, 40, 40);
    doc.text('Recibo de Pagamento', 105, 20, { align: 'center' });

    // Company Info (Header)
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text('BaseTeen - Sistema de Gerenciamento', 105, 30, { align: 'center' });
    doc.text(`Data de Emissão: ${new Date().toLocaleDateString('pt-BR')}`, 105, 35, { align: 'center' });

    // Payment Details
    doc.setFontSize(14);
    doc.setTextColor(0, 0, 0);
    doc.text('Detalhes do Pagamento', 14, 50);

    const paymentRows = [
        ['ID da Transação', payment.id],
        ['Base', baseName],
        ['Descrição', payment.description || (payment.type === 'subscription' ? 'Assinatura' : 'Adição de Membros')],
        ['Data do Pagamento', payment.createdAt ? new Date(payment.createdAt).toLocaleDateString('pt-BR') : '-'],
        ['Método', payment.paymentMethod.toUpperCase()],
        ['Status', payment.status === 'confirmed' ? 'Confirmado' : 'Pendente'],
    ];

    if (payment.confirmedAt) {
        paymentRows.push(['Confirmado em', new Date(payment.confirmedAt).toLocaleDateString('pt-BR')]);
    }

    autoTable(doc, {
        startY: 55,
        head: [['Campo', 'Valor']],
        body: paymentRows,
        theme: 'striped',
        headStyles: { fillColor: [66, 133, 244] },
    });

    // Total Amount
    const finalY = (doc as any).lastAutoTable.finalY + 10;
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text(`Total Pago: R$ ${payment.amount.toFixed(2)}`, 14, finalY);

    // Signature
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0); // Black
    doc.text('RECEBIDO POR ALEX SEABRA (CPF 683.232.802-82)', 14, finalY + 10);

    // Footer
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(150, 150, 150);
    doc.text('Obrigado por usar o BaseTeen!', 105, 280, { align: 'center' });

    // Save
    doc.save(`recibo_${payment.id}.pdf`);
};
