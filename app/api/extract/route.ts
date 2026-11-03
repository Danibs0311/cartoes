import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import { PDFDocument } from '@cantoo/pdf-lib';

export async function POST(req: NextRequest) {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'Chave GEMINI_API_KEY não configurada no arquivo .env.local' },
        { status: 400 }
      );
    }

    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const cardName = (formData.get('cardName') as string) || '';
    const password = (formData.get('password') as string) || '';

    if (!file) {
      return NextResponse.json({ error: 'Nenhum arquivo enviado.' }, { status: 400 });
    }

    const arrayBuffer = await file.arrayBuffer();
    let base64Data = Buffer.from(arrayBuffer).toString('base64');
    let mimeType = file.type || 'application/pdf';

    // Desbloqueio de PDF com senha
    if (file.name.toLowerCase().endsWith('.pdf') || mimeType.includes('pdf')) {
      try {
        const pdfDoc = await PDFDocument.load(arrayBuffer, {
          password: password.trim() || undefined,
        });
        const unencryptedBytes = await pdfDoc.save();
        base64Data = Buffer.from(unencryptedBytes).toString('base64');
        mimeType = 'application/pdf';
      } catch (pdfErr: any) {
        const errMsg = String(pdfErr?.message || '');
        if (
          errMsg.includes('password') ||
          errMsg.includes('encrypted') ||
          errMsg.includes('Password') ||
          errMsg.includes('Security') ||
          errMsg.includes('decrypt')
        ) {
          if (!password.trim()) {
            return NextResponse.json(
              { error: '🔒 Esta fatura está protegida por senha. Por favor, digite a senha da fatura (ex: dígitos do CPF ou data de nascimento) no campo abaixo para abrir.' },
              { status: 422 }
            );
          } else {
            return NextResponse.json(
              { error: '❌ Senha incorreta para esta fatura. Verifique a senha do seu banco e tente novamente.' },
              { status: 422 }
            );
          }
        }
      }
    }

    const ai = new GoogleGenAI({ apiKey });

    const prompt = `Você é um especialista em extração e conciliação de faturas de cartão de crédito brasileiras.
Analise detalhadamente o arquivo de fatura em anexo ${cardName ? `referente ao cartão "${cardName}"` : ''}.
Extraia todas as compras e parcelas contidas na fatura.

Instruções críticas:
1. Para cada compra parcelada (ex: "LOJA X PARC 03/10" ou "03/10 LOJA X" ou "3/10"), identifique com precisão:
   - current_installment: o número da parcela cobrada nesta fatura (ex: 3)
   - total_installments: o total de parcelas (ex: 10)
   - Se for compra à vista (sem parcelamento), current_installment = 1 e total_installments = 1.
2. Identifique o valor exato da parcela (número decimal, ex: 154.90).
3. Identifique o valor total consolidado da fatura (total_amount).
4. Identifique o mês e ano de vencimento ou competência da fatura.

Retorne EXCLUSIVAMENTE um objeto JSON válido, sem crases de markdown e sem texto adicional:
{
  "card_name": "Nome do cartão ou banco identificado",
  "due_date": "YYYY-MM-DD",
  "month": 3,
  "year": 2026,
  "total_amount": 1250.50,
  "items": [
    {
      "date": "DD/MM/YYYY",
      "description": "NOME DO ESTABELECIMENTO",
      "current_installment": 1,
      "total_installments": 5,
      "amount": 150.00
    }
  ]
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: [
        {
          inlineData: {
            data: base64Data,
            mimeType: mimeType || 'application/pdf',
          },
        },
        prompt,
      ],
      config: {
        responseMimeType: 'application/json',
      },
    });

    const responseText = response.text || '{}';
    const parsed = JSON.parse(responseText);

    return NextResponse.json({ success: true, data: parsed });
  } catch (error: any) {
    console.error('Erro na extração com Gemini:', error);
    let userMsg = error?.message || 'Falha ao processar fatura com Gemini';
    if (userMsg.includes('INVALID_ARGUMENT') || userMsg.includes('400')) {
      userMsg = 'O PDF não pôde ser lido pela IA (provavelmente está protegido por senha do banco). Digite a senha no campo "Senha do PDF" e tente novamente.';
    }
    return NextResponse.json(
      { error: userMsg },
      { status: 400 }
    );
  }
}
